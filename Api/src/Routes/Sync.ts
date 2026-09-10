import { z } from "zod";
import type { FastifyInstance } from "fastify";

/**
 * Synchronizace dokumentů a projektů.
 *
 * Server tady nevidí **nic** z obsahu — dostane ciphertext a uloží ho.
 * Neexistuje tu proto žádná validace názvů, priorit ani struktury: všechno
 * tohle je uvnitř šifrovaného bloku a klíč server nemá. Kontroluje se jen to,
 * co server sám používá: komu záznam patří, jak se adresuje a kdy se změnil.
 */

/// Ciphertext může být velký (dokument s dlouhým textem), strop je hrubá
/// pojistka proti zaplnění databáze jedním requestem.
const Ciphertext = z.string().min(1).max(20_000_000);
const Nonce = z.string().min(1).max(64);

const EnvelopeBody = z.object({
  id: z.string().min(1).max(128),
  createdAt: z.string(),
  updatedAt: z.string(),
  ciphertext: Ciphertext,
  nonce: Nonce,
});

export async function SyncRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", app.Authenticate);

  /** Bootstrap při startu — vše, co si klient dešifruje a nahydratuje do storu. */
  app.get("/sync", async (request, reply) => {
    const userId = request.user.sub;
    const [projects, documents] = await Promise.all([
      app.prisma.project.findMany({ where: { userId } }),
      app.prisma.document.findMany({ where: { userId } }),
    ]);

    return reply.send({
      projects: projects.map((row) => ({
        id: row.clientId,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.lastEditedAt.toISOString(),
        ciphertext: row.ciphertext,
        nonce: row.nonce,
      })),
      documents: documents.map((row) => ({
        id: row.clientId,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        ciphertext: row.ciphertext,
        nonce: row.nonce,
      })),
    });
  });

  app.put("/projects/:id", async (request, reply) => {
    const parsed = EnvelopeBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Neplatný projekt." });
    }
    const body = parsed.data;

    // Cesta v URL musí sedět s tělem — jinak by se dal přepsat jiný záznam
    // podstrčením odlišného id uvnitř.
    if ((request.params as { id: string }).id !== body.id) {
      return reply.code(400).send({ error: "ID v adrese a v těle se neshodují." });
    }

    const data = {
      createdAt: new Date(body.createdAt),
      lastEditedAt: new Date(body.updatedAt),
      ciphertext: body.ciphertext,
      nonce: body.nonce,
    };

    await app.prisma.project.upsert({
      where: { userId_clientId: { userId: request.user.sub, clientId: body.id } },
      create: { userId: request.user.sub, clientId: body.id, ...data },
      update: data,
    });

    return reply.code(204).send();
  });

  app.delete("/projects/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    await app.prisma.project.deleteMany({
      where: { userId: request.user.sub, clientId: id },
    });
    return reply.code(204).send();
  });

  app.put("/documents/:id", async (request, reply) => {
    const parsed = EnvelopeBody.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: parsed.error.issues[0]?.message ?? "Neplatný dokument." });
    }
    const body = parsed.data;

    if ((request.params as { id: string }).id !== body.id) {
      return reply.code(400).send({ error: "ID v adrese a v těle se neshodují." });
    }

    const data = {
      createdAt: new Date(body.createdAt),
      updatedAt: new Date(body.updatedAt),
      ciphertext: body.ciphertext,
      nonce: body.nonce,
    };

    await app.prisma.document.upsert({
      where: { userId_clientId: { userId: request.user.sub, clientId: body.id } },
      create: { userId: request.user.sub, clientId: body.id, ...data },
      update: data,
    });

    return reply.code(204).send();
  });

  app.delete("/documents/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    await app.prisma.document.deleteMany({
      where: { userId: request.user.sub, clientId: id },
    });
    return reply.code(204).send();
  });

  /**
   * Drobné kolekce (složky, štítky, poznámky, rozložení sidebaru, UI stav).
   * `name` a `key` jsou konstanty z kódu, ne uživatelská data, takže zůstávají
   * čitelné; `value` je zašifrovaný stejným hlavním klíčem jako dokumenty.
   */
  app.get("/collections/:name/:key", async (request, reply) => {
    const { name, key } = request.params as { name: string; key: string };
    const row = await app.prisma.collection.findUnique({
      where: { userId_name_key: { userId: request.user.sub, name, key } },
    });
    if (!row) return reply.send({ value: null, nonce: null });
    return reply.send({ value: row.value, nonce: row.nonce });
  });

  app.put("/collections/:name/:key", async (request, reply) => {
    const { name, key } = request.params as { name: string; key: string };
    const parsed = z
      .object({ value: Ciphertext, nonce: Nonce })
      .safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Chybí hodnota, nebo je moc velká." });
    }
    const userId = request.user.sub;

    await app.prisma.collection.upsert({
      where: { userId_name_key: { userId, name, key } },
      create: { userId, name, key, value: parsed.data.value, nonce: parsed.data.nonce },
      update: { value: parsed.data.value, nonce: parsed.data.nonce },
    });

    return reply.code(204).send();
  });

  app.delete("/collections/:name/:key", async (request, reply) => {
    const { name, key } = request.params as { name: string; key: string };
    await app.prisma.collection.deleteMany({
      where: { userId: request.user.sub, name, key },
    });
    return reply.code(204).send();
  });
}
