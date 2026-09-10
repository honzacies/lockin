import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { HashPassword, VerifyPassword } from "../Lib/Password.js";
import { GenerateRefreshToken, HashRefreshToken } from "../Lib/Tokens.js";
import { Env } from "../Env.js";

const RegisterBody = z.object({
  username: z
    .string()
    .min(3, "Uživatelské jméno musí mít aspoň 3 znaky")
    .max(32)
    .regex(/^[a-zA-Z0-9_.-]+$/, "Povolená jsou jen písmena, číslice a . _ -"),
  password: z.string().min(8, "Heslo musí mít aspoň 8 znaků").max(200),
  inviteCode: z.string().min(1, "Invite kód je povinný"),
});

const LoginBody = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const RefreshBody = z.object({
  refreshToken: z.string().min(1),
});

function RefreshExpiry(): Date {
  return new Date(Date.now() + Env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export async function AuthRoutes(app: FastifyInstance): Promise<void> {
  /**
   * Registrace. Invite kód se spálí ve stejné transakci, jako vzniká
   * uživatel — bez toho by dva souběžné requesty se stejným kódem stihly
   * projít oba (kontrola by u obou proběhla dřív, než by kterýkoli zapsal).
   */
  app.post("/auth/register", async (request, reply) => {
    const parsed = RegisterBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Neplatný vstup." });
    }
    const { username, password, inviteCode } = parsed.data;

    const existing = await app.prisma.user.findUnique({ where: { username } });
    if (existing) {
      return reply.code(409).send({ error: "Uživatelské jméno je obsazené." });
    }

    const passwordHash = await HashPassword(password);

    try {
      const user = await app.prisma.$transaction(async (tx) => {
        // updateMany s podmínkou na nepoužitý kód je atomické: když ho mezitím
        // spotřeboval někdo jiný, `count` vyjde 0 a transakce se zruší.
        const claimed = await tx.inviteCode.updateMany({
          where: {
            code: inviteCode,
            usedAt: null,
            revokedAt: null,
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
          data: { usedAt: new Date() },
        });
        if (claimed.count === 0) {
          throw new Error("INVALID_INVITE");
        }

        const created = await tx.user.create({
          data: {
            username,
            passwordHash,
            storageQuota: BigInt(Env.DEFAULT_STORAGE_QUOTA_BYTES),
          },
        });

        await tx.inviteCode.update({
          where: { code: inviteCode },
          data: { usedById: created.id },
        });

        return created;
      });

      return reply.code(201).send({ id: user.id, username: user.username, role: user.role });
    } catch (error) {
      if (error instanceof Error && error.message === "INVALID_INVITE") {
        return reply
          .code(400)
          .send({ error: "Invite kód je neplatný, už použitý nebo mu vypršela platnost." });
      }
      throw error;
    }
  });

  app.post("/auth/login", async (request, reply) => {
    const parsed = LoginBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Vyplň jméno i heslo." });
    }
    const { username, password } = parsed.data;

    const user = await app.prisma.user.findUnique({ where: { username } });

    // Heslo se ověřuje i u neexistujícího uživatele proti figuríně, aby se
    // podle doby odpovědi nedalo poznat, která jména jsou zabraná.
    const hashToCheck =
      user?.passwordHash ??
      "$argon2id$v=19$m=19456,t=2,p=1$c2FsdHNhbHRzYWx0$0000000000000000000000000000000000000000000";
    const valid = await VerifyPassword(hashToCheck, password);

    if (!user || !valid) {
      return reply.code(401).send({ error: "Špatné jméno nebo heslo." });
    }

    const refreshToken = GenerateRefreshToken();
    await app.prisma.$transaction([
      app.prisma.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: HashRefreshToken(refreshToken),
          expiresAt: RefreshExpiry(),
        },
      }),
      app.prisma.user.update({
        where: { id: user.id },
        data: { lastSeenAt: new Date() },
      }),
    ]);

    const accessToken = app.jwt.sign({
      sub: user.id,
      username: user.username,
      role: user.role,
    });

    return reply.send({
      accessToken,
      refreshToken,
      user: { id: user.id, username: user.username, role: user.role },
    });
  });

  /**
   * Výměna refresh tokenu za nový pár. Starý se hned odvolá (rotace) — kdyby
   * někdo odposlechl a použil starý token podruhé, dostane 401.
   */
  app.post("/auth/refresh", async (request, reply) => {
    const parsed = RefreshBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Chybí refresh token." });
    }

    const tokenHash = HashRefreshToken(parsed.data.refreshToken);
    const stored = await app.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      return reply.code(401).send({ error: "Refresh token je neplatný." });
    }

    const nextToken = GenerateRefreshToken();
    await app.prisma.$transaction([
      app.prisma.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      }),
      app.prisma.refreshToken.create({
        data: {
          userId: stored.userId,
          tokenHash: HashRefreshToken(nextToken),
          expiresAt: RefreshExpiry(),
        },
      }),
    ]);

    const accessToken = app.jwt.sign({
      sub: stored.user.id,
      username: stored.user.username,
      role: stored.user.role,
    });

    return reply.send({
      accessToken,
      refreshToken: nextToken,
      user: { id: stored.user.id, username: stored.user.username, role: stored.user.role },
    });
  });

  app.post("/auth/logout", async (request, reply) => {
    const parsed = RefreshBody.safeParse(request.body);
    // Odhlášení je vždy 204, i když token nesedí — klient stejně maže svou
    // kopii a nemá cenu mu k tomu hlásit chybu.
    if (parsed.success) {
      await app.prisma.refreshToken.updateMany({
        where: { tokenHash: HashRefreshToken(parsed.data.refreshToken), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    return reply.code(204).send();
  });

  app.get("/auth/me", { preHandler: [app.Authenticate] }, async (request, reply) => {
    const user = await app.prisma.user.findUnique({
      where: { id: request.user.sub },
      select: {
        id: true,
        username: true,
        role: true,
        storageQuota: true,
        storageUsed: true,
        createdAt: true,
      },
    });
    if (!user) return reply.code(404).send({ error: "Uživatel neexistuje." });

    return reply.send({
      ...user,
      // BigInt neprojde přes JSON.stringify — posílá se jako řetězec.
      storageQuota: user.storageQuota.toString(),
      storageUsed: user.storageUsed.toString(),
    });
  });
}
