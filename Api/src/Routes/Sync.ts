import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { ToClientDocument, ToClientProject } from "../Lib/Mappers.js";

/**
 * Zápisové tělo pro projekt i dokument. Obsah (Tiptap JSON, skica, styly) se
 * nevaliduje do hloubky — je to strukturovaný blob, jehož tvar vlastní editor
 * na klientu, a validovat tady celý ProseMirror dokument by znamenalo držet
 * jeho schéma na dvou místech. Server hlídá jen to, co sám používá: kdo to
 * vlastní, jak se to jmenuje, kdy se to změnilo.
 */
const ProjectBody = z.object({
  id: z.string().min(1).max(128),
  name: z.string().max(500),
  icon: z.string().max(200_000).optional(),
  tag: z.string().max(200).default(""),
  priority: z.string().max(100).default(""),
  status: z.string().max(100).default(""),
  progress: z.number().int().min(0).max(100).default(0),
  deadline: z.string().nullable().default(null),
  deadlineTime: z.string().nullable().optional(),
  createdAt: z.string(),
  lastEditedAt: z.string(),
  rootDocumentId: z.string().max(128),
  documentIds: z.array(z.string().max(128)).max(5000).default([]),
  isFavorite: z.boolean().default(false),
  folderId: z.string().max(128).nullable().default(null),
  tagIds: z.array(z.string().max(128)).max(500).default([]),
});

const DocumentBody = z.object({
  id: z.string().min(1).max(128),
  projectId: z.string().max(128).nullable().default(null),
  name: z.string().max(500),
  description: z.string().max(5000).default(""),
  icon: z.string().max(200_000).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastMode: z.string().max(20).default("text"),
  folderId: z.string().max(128).nullable().default(null),
  tagIds: z.array(z.string().max(128)).max(500).default([]),
  isFavorite: z.boolean().default(false),
  isLocked: z.boolean().optional(),
  smallText: z.boolean().optional(),
  showTableOfContents: z.boolean().optional(),
  theme: z.unknown().optional(),
  text: z.unknown(),
  sketch: z.unknown(),
  style: z.unknown().optional(),
});

export async function SyncRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", app.Authenticate);

  /**
   * Bootstrap při startu aplikace — vše, z čeho se hydratuje store, jedním
   * requestem. Odpovídá `DataStorageAdapter.LoadAll()`.
   */
  app.get("/sync", async (request, reply) => {
    const userId = request.user.sub;
    const [projects, documents] = await Promise.all([
      app.prisma.project.findMany({ where: { userId } }),
      app.prisma.document.findMany({ where: { userId } }),
    ]);

    return reply.send({
      projects: projects.map(ToClientProject),
      documents: documents.map(ToClientDocument),
    });
  });

  app.put("/projects/:id", async (request, reply) => {
    const parsed = ProjectBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Neplatný projekt." });
    }
    const body = parsed.data;
    const userId = request.user.sub;

    // Cesta v URL musí sedět s tělem — jinak by se dal přepsat cizí záznam
    // podstrčením jiného id v těle.
    if ((request.params as { id: string }).id !== body.id) {
      return reply.code(400).send({ error: "ID v adrese a v těle se neshodují." });
    }

    const data = {
      name: body.name,
      icon: body.icon ?? null,
      tag: body.tag,
      priority: body.priority,
      status: body.status,
      progress: body.progress,
      deadline: body.deadline,
      deadlineTime: body.deadlineTime ?? null,
      createdAt: new Date(body.createdAt),
      lastEditedAt: new Date(body.lastEditedAt),
      rootDocumentId: body.rootDocumentId,
      documentIds: body.documentIds,
      isFavorite: body.isFavorite,
      folderId: body.folderId,
      tagIds: body.tagIds,
    };

    const row = await app.prisma.project.upsert({
      where: { userId_clientId: { userId, clientId: body.id } },
      create: { userId, clientId: body.id, ...data },
      update: data,
    });

    return reply.send(ToClientProject(row));
  });

  app.delete("/projects/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    await app.prisma.project.deleteMany({
      where: { userId: request.user.sub, clientId: id },
    });
    return reply.code(204).send();
  });

  app.put("/documents/:id", async (request, reply) => {
    const parsed = DocumentBody.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: parsed.error.issues[0]?.message ?? "Neplatný dokument." });
    }
    const body = parsed.data;
    const userId = request.user.sub;

    if ((request.params as { id: string }).id !== body.id) {
      return reply.code(400).send({ error: "ID v adrese a v těle se neshodují." });
    }

    const data = {
      projectId: body.projectId,
      name: body.name,
      description: body.description,
      icon: body.icon ?? null,
      createdAt: new Date(body.createdAt),
      updatedAt: new Date(body.updatedAt),
      lastMode: body.lastMode,
      folderId: body.folderId,
      tagIds: body.tagIds,
      isFavorite: body.isFavorite,
      isLocked: body.isLocked ?? false,
      smallText: body.smallText ?? false,
      showTableOfContents: body.showTableOfContents ?? false,
      theme: (body.theme ?? null) as never,
      text: (body.text ?? {}) as never,
      sketch: (body.sketch ?? { strokes: [] }) as never,
      style: (body.style ?? null) as never,
    };

    const row = await app.prisma.document.upsert({
      where: { userId_clientId: { userId, clientId: body.id } },
      create: { userId, clientId: body.id, ...data },
      update: data,
    });

    return reply.send(ToClientDocument(row));
  });

  app.delete("/documents/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    await app.prisma.document.deleteMany({
      where: { userId: request.user.sub, clientId: id },
    });
    return reply.code(204).send();
  });

  /**
   * Drobné kolekce (složky, tagy, poznámky, rozložení sidebaru, UI stav) —
   * odpovídá `KeyValueAdapter`. Klient sem posílá už zserializovaný JSON
   * řetězec, přesně jak ho vyrobí zustand `persist`.
   */
  app.get("/collections/:name/:key", async (request, reply) => {
    const { name, key } = request.params as { name: string; key: string };
    const row = await app.prisma.collection.findUnique({
      where: { userId_name_key: { userId: request.user.sub, name, key } },
    });
    return reply.send({ value: row?.value ?? null });
  });

  app.put("/collections/:name/:key", async (request, reply) => {
    const { name, key } = request.params as { name: string; key: string };
    const parsed = z.object({ value: z.string().max(20_000_000) }).safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Chybí hodnota, nebo je moc velká." });
    }
    const userId = request.user.sub;

    await app.prisma.collection.upsert({
      where: { userId_name_key: { userId, name, key } },
      create: { userId, name, key, value: parsed.data.value },
      update: { value: parsed.data.value },
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
