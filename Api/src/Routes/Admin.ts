import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { GenerateInviteCode } from "../Lib/Tokens.js";
import { CollectSystemMetrics } from "../Lib/Metrics.js";

const CreateInvites = z.object({
  count: z.number().int().min(1).max(50).default(1),
  note: z.string().max(200).optional(),
  /** Počet dní do expirace. Bez toho kód nevyprší. */
  expiresInDays: z.number().int().min(1).max(365).optional(),
});

const UpdateQuota = z.object({
  storageQuota: z.string().regex(/^\d+$/, "Kvóta musí být celé číslo v bajtech"),
});

export async function AdminRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", app.RequireAdmin);

  app.get("/admin/invites", async (_request, reply) => {
    const invites = await app.prisma.inviteCode.findMany({
      orderBy: { createdAt: "desc" },
      include: { usedBy: { select: { id: true, username: true } } },
    });

    return reply.send(
      invites.map((invite) => ({
        id: invite.id,
        code: invite.code,
        note: invite.note,
        createdAt: invite.createdAt.toISOString(),
        expiresAt: invite.expiresAt?.toISOString() ?? null,
        revokedAt: invite.revokedAt?.toISOString() ?? null,
        usedAt: invite.usedAt?.toISOString() ?? null,
        usedBy: invite.usedBy,
        // Odvozený stav, ať ho nemusí počítat každé UI zvlášť.
        state: invite.revokedAt
          ? "revoked"
          : invite.usedAt
            ? "used"
            : invite.expiresAt && invite.expiresAt < new Date()
              ? "expired"
              : "active",
      })),
    );
  });

  app.post("/admin/invites", async (request, reply) => {
    const parsed = CreateInvites.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Neplatný vstup." });
    }
    const { count, note, expiresInDays } = parsed.data;
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const codes = Array.from({ length: count }, () => ({
      code: GenerateInviteCode(),
      note: note ?? null,
      expiresAt,
    }));

    await app.prisma.inviteCode.createMany({ data: codes });

    return reply.code(201).send({ codes: codes.map((c) => c.code) });
  });

  /** Odvolání, ne smazání — v přehledu má zůstat stopa, že kód existoval. */
  app.post("/admin/invites/:id/revoke", async (request, reply) => {
    const { id } = request.params as { id: string };
    const invite = await app.prisma.inviteCode.findUnique({ where: { id } });
    if (!invite) return reply.code(404).send({ error: "Kód neexistuje." });
    if (invite.usedAt) {
      return reply.code(409).send({ error: "Použitý kód už odvolat nejde." });
    }

    await app.prisma.inviteCode.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
    return reply.code(204).send();
  });

  app.get("/admin/users", async (_request, reply) => {
    const users = await app.prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        username: true,
        role: true,
        storageQuota: true,
        storageUsed: true,
        createdAt: true,
        lastSeenAt: true,
        _count: { select: { projects: true, documents: true, media: true } },
      },
    });

    return reply.send(
      users.map((user) => ({
        ...user,
        storageQuota: user.storageQuota.toString(),
        storageUsed: user.storageUsed.toString(),
        createdAt: user.createdAt.toISOString(),
        lastSeenAt: user.lastSeenAt?.toISOString() ?? null,
        counts: user._count,
        _count: undefined,
      })),
    );
  });

  app.patch("/admin/users/:id/quota", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = UpdateQuota.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Neplatná kvóta." });
    }

    const user = await app.prisma.user.findUnique({ where: { id } });
    if (!user) return reply.code(404).send({ error: "Uživatel neexistuje." });

    await app.prisma.user.update({
      where: { id },
      data: { storageQuota: BigInt(parsed.data.storageQuota) },
    });
    return reply.code(204).send();
  });

  /**
   * Přehled zdrojů — uptime, RAM, disk, zátěž, plus kolik místa zabírají
   * uživatelé podle databáze (to je něco jiného než obsazenost disku, na
   * kterém běží i ostatní projekty).
   */
  app.get("/admin/metrics", async (_request, reply) => {
    const [system, aggregate, userCount, documentCount, projectCount] = await Promise.all([
      CollectSystemMetrics(),
      app.prisma.mediaFile.aggregate({ _sum: { bytes: true }, _count: true }),
      app.prisma.user.count(),
      app.prisma.document.count(),
      app.prisma.project.count(),
    ]);

    return reply.send({
      system,
      storage: {
        mediaBytes: aggregate._sum.bytes ?? 0,
        mediaFiles: aggregate._count,
      },
      counts: {
        users: userCount,
        documents: documentCount,
        projects: projectCount,
      },
    });
  });
}
