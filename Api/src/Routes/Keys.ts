import { z } from "zod";
import type { FastifyInstance } from "fastify";

/**
 * Obalený hlavní klíč uživatele.
 *
 * Server je tady jen úložiště — obsah těchhle polí nikdy nedešifruje a ani
 * nemůže. Passphrase se sem neposílá v žádné podobě, ani zahashovaná:
 * odvození klíče i obalení probíhá výhradně v prohlížeči.
 */

const Base64 = z.string().min(1).max(4096).regex(/^[A-Za-z0-9+/]+={0,2}$/, "Expected base64");

const KeyBody = z.object({
  salt: Base64,
  wrappedKey: Base64,
  nonce: Base64,
  algorithm: z.string().max(32).default("argon2id"),
  memoryKiB: z.number().int().min(8192).max(1048576).default(65536),
  iterations: z.number().int().min(1).max(20).default(3),
  parallelism: z.number().int().min(1).max(16).default(1),
});

export async function KeyRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", app.Authenticate);

  /** Vrátí obalený klíč, nebo 404 když si uživatel ještě passphrase nenastavil. */
  app.get("/keys/me", async (request, reply) => {
    const key = await app.prisma.userKey.findUnique({
      where: { userId: request.user.sub },
    });
    if (!key) return reply.code(404).send({ error: "No passphrase has been set up yet." });

    return reply.send({
      salt: key.salt,
      wrappedKey: key.wrappedKey,
      nonce: key.nonce,
      algorithm: key.algorithm,
      memoryKiB: key.memoryKiB,
      iterations: key.iterations,
      parallelism: key.parallelism,
    });
  });

  /**
   * První nastavení passphrase. Schválně **jen create, ne upsert** — kdyby
   * tudy šlo klíč přepsat, stačil by ukradený access token k tomu, aby
   * útočník nastavil vlastní passphrase. Data by tím sice nepřečetl (starý
   * hlavní klíč je pryč), ale oběti by je nenávratně zamkl.
   */
  app.post("/keys/me", async (request, reply) => {
    const parsed = KeyBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid key." });
    }

    const existing = await app.prisma.userKey.findUnique({
      where: { userId: request.user.sub },
    });
    if (existing) {
      return reply
        .code(409)
        .send({ error: "A passphrase is already set. Use PUT /keys/me to change it." });
    }

    await app.prisma.userKey.create({
      data: { userId: request.user.sub, ...parsed.data },
    });
    return reply.code(201).send({ ok: true });
  });

  /**
   * Změna passphrase. Přijde nově obalený **stejný** hlavní klíč, takže se
   * přepíše jeden řádek a dokumentů se to nedotkne.
   *
   * Vyžaduje se heslo k účtu — bez toho by ukradený access token stačil
   * k zamčení dat. Ověřit, že volající zná i starou passphrase, server neumí
   * (a nemá jak), takže tohle je jediná páka, kterou má.
   */
  app.put("/keys/me", async (request, reply) => {
    const parsed = KeyBody.extend({ password: z.string().min(1) }).safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid input." });
    }
    const { password, ...key } = parsed.data;

    const user = await app.prisma.user.findUnique({ where: { id: request.user.sub } });
    if (!user) return reply.code(404).send({ error: "No such user." });

    const { VerifyPassword } = await import("../Lib/Password.js");
    if (!(await VerifyPassword(user.passwordHash, password))) {
      return reply.code(401).send({ error: "Wrong account password." });
    }

    await app.prisma.userKey.update({
      where: { userId: request.user.sub },
      data: key,
    });
    return reply.code(204).send();
  });
}
