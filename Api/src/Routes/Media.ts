import { createReadStream } from "node:fs";
import { mkdir, stat, unlink, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { Env } from "../Env.js";

export async function MediaRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", app.Authenticate);

  await mkdir(Env.MEDIA_DIR, { recursive: true });

  /**
   * Upload. Kvóta se kontroluje před zápisem i po něm — velikost se dopředu
   * dozvíme až po přečtení streamu, takže první kontrola je jen rychlé
   * odmítnutí zjevně přeplněného účtu a rozhoduje až ta druhá.
   */
  app.post("/media", async (request, reply) => {
    const userId = request.user.sub;

    const user = await app.prisma.user.findUnique({
      where: { id: userId },
      select: { storageQuota: true, storageUsed: true },
    });
    if (!user) return reply.code(404).send({ error: "Uživatel neexistuje." });
    if (user.storageUsed >= user.storageQuota) {
      return reply.code(413).send({ error: "Vyčerpal jsi úložnou kvótu." });
    }

    const file = await request.file({ limits: { fileSize: Env.MAX_UPLOAD_BYTES } });
    if (!file) return reply.code(400).send({ error: "Chybí soubor." });

    const buffer = await file.toBuffer().catch(() => null);
    if (!buffer) {
      return reply
        .code(413)
        .send({ error: `Soubor je moc velký (max ${Math.floor(Env.MAX_UPLOAD_BYTES / 1024 / 1024)} MB).` });
    }

    const bytes = buffer.byteLength;
    if (BigInt(bytes) + user.storageUsed > user.storageQuota) {
      return reply.code(413).send({ error: "Soubor by přesáhl tvoji úložnou kvótu." });
    }

    // Žádná přípona — obsah je šifrovaný a server netuší, co v něm je.
    // storageKey je serverové jméno, clientPath je to, co jde do dokumentu.
    // Rozdělené schválně: cesta od klienta nikdy neurčuje, kam se zapisuje.
    const storageKey = `${userId}-${Date.now()}-${randomBytes(6).toString("hex")}.bin`;
    const clientPath = `Media/media-${Date.now()}-${randomBytes(3).toString("hex")}.bin`;

    await writeFile(path.join(Env.MEDIA_DIR, storageKey), buffer);

    await app.prisma.$transaction([
      app.prisma.mediaFile.create({
        data: { userId, path: clientPath, storageKey, bytes },
      }),
      app.prisma.user.update({
        where: { id: userId },
        data: { storageUsed: { increment: BigInt(bytes) } },
      }),
    ]);

    return reply.code(201).send({ path: clientPath, bytes });
  });

  /**
   * Stažení. Cesta se nepřekládá na disk přímo — vyhledá se v databázi podle
   * (uživatel, path) a teprve z řádku se vezme `storageKey`. Průchod cestou
   * ven z adresáře tak není možný ani teoreticky.
   */
  app.get("/media/*", async (request, reply) => {
    const clientPath = (request.params as Record<string, string>)["*"];
    const row = await app.prisma.mediaFile.findUnique({
      where: { userId_path: { userId: request.user.sub, path: `Media/${clientPath}` } },
    });
    if (!row) return reply.code(404).send({ error: "Soubor neexistuje." });

    const absolute = path.join(Env.MEDIA_DIR, row.storageKey);
    try {
      await stat(absolute);
    } catch {
      return reply.code(404).send({ error: "Soubor na disku chybí." });
    }

    // Vždycky octet-stream: skutečný typ je uvnitř šifrované hlavičky, kterou
    // umí přečíst jedině klient.
    return reply
      .type("application/octet-stream")
      .header("Cache-Control", "private, max-age=31536000, immutable")
      .send(createReadStream(absolute));
  });

  app.delete("/media/*", async (request, reply) => {
    const clientPath = (request.params as Record<string, string>)["*"];
    const userId = request.user.sub;
    const row = await app.prisma.mediaFile.findUnique({
      where: { userId_path: { userId, path: `Media/${clientPath}` } },
    });
    if (!row) return reply.code(204).send();

    await unlink(path.join(Env.MEDIA_DIR, row.storageKey)).catch(() => {});
    await app.prisma.$transaction([
      app.prisma.mediaFile.delete({ where: { id: row.id } }),
      app.prisma.user.update({
        where: { id: userId },
        data: { storageUsed: { decrement: BigInt(row.bytes) } },
      }),
    ]);

    return reply.code(204).send();
  });

  /**
   * Úklid osiřelých médií. Klient pošle seznam cest, na které ještě něco
   * odkazuje, server smaže zbytek. Odpovídá `MediaAdapter.SweepOrphaned`.
   */
  app.post("/media/sweep", async (request, reply) => {
    const body = request.body as { referenced?: unknown };
    if (!Array.isArray(body?.referenced)) {
      return reply.code(400).send({ error: "Chybí seznam `referenced`." });
    }
    const referenced = new Set(body.referenced.filter((p): p is string => typeof p === "string"));
    const userId = request.user.sub;

    const all = await app.prisma.mediaFile.findMany({ where: { userId } });
    const orphans = all.filter((row) => !referenced.has(row.path));
    if (orphans.length === 0) return reply.send({ deleted: 0 });

    for (const orphan of orphans) {
      await unlink(path.join(Env.MEDIA_DIR, orphan.storageKey)).catch(() => {});
    }

    const freed = orphans.reduce((sum, row) => sum + BigInt(row.bytes), 0n);
    await app.prisma.$transaction([
      app.prisma.mediaFile.deleteMany({ where: { id: { in: orphans.map((o) => o.id) } } }),
      app.prisma.user.update({
        where: { id: userId },
        data: { storageUsed: { decrement: freed } },
      }),
    ]);

    return reply.send({ deleted: orphans.length });
  });
}
