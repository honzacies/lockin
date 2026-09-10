import Fastify, { type FastifyError } from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import { CorsOrigins, Env, IsProduction } from "./Env.js";
import PrismaPlugin from "./Plugins/Prisma.js";
import AuthPlugin from "./Plugins/Auth.js";
import { AuthRoutes } from "./Routes/Auth.js";
import { SyncRoutes } from "./Routes/Sync.js";
import { KeyRoutes } from "./Routes/Keys.js";
import { MediaRoutes } from "./Routes/Media.js";
import { AdminRoutes } from "./Routes/Admin.js";

const app = Fastify({
  logger: IsProduction
    ? { level: "info" }
    : { level: "info", transport: { target: "pino-pretty" } },
  // Za Cloudflare a reverzní proxy — bez tohohle by rate limit viděl u všech
  // requestů IP proxy a omezoval by všechny uživatele jako jednoho.
  trustProxy: true,
  bodyLimit: 25 * 1024 * 1024,
});

// BigInt (storageQuota/storageUsed) neumí JSON.stringify. Jednotlivé routy si
// ho převádějí na řetězec samy, tohle je záchranná síť pro místa, kde by to
// někdo zapomněl — jinak by to spadlo až za běhu.
app.setSerializerCompiler(() => (data) =>
  JSON.stringify(data, (_key, value) => (typeof value === "bigint" ? value.toString() : value)),
);

await app.register(cors, {
  origin: CorsOrigins,
  credentials: true,
});

await app.register(rateLimit, {
  max: 300,
  timeWindow: "1 minute",
});

await app.register(multipart, {
  limits: { fileSize: Env.MAX_UPLOAD_BYTES, files: 1 },
});

await app.register(PrismaPlugin);
await app.register(AuthPlugin);

app.get("/health", async () => ({ ok: true, uptime: Math.floor(process.uptime()) }));

// Přihlašovací endpointy mají vlastní, přísnější limit — 300/min z globálního
// nastavení je na hádání hesel dost velkorysé.
await app.register(async (scope) => {
  await scope.register(rateLimit, {
    max: 10,
    timeWindow: "1 minute",
    keyGenerator: (request) => request.ip,
  });
  await scope.register(AuthRoutes);
});

await app.register(KeyRoutes);
await app.register(SyncRoutes);
await app.register(MediaRoutes);
await app.register(AdminRoutes);

// `error` se explicitně typuje — po vlastním setSerializerCompiler výše ho
// Fastify odvodí jen jako `unknown`.
app.setErrorHandler((error: FastifyError, request, reply) => {
  request.log.error(error);
  const status = error.statusCode ?? 500;
  // V produkci se ven neposílá vnitřní hláška — mohla by prozradit strukturu
  // databáze nebo cesty na disku.
  const message =
    status >= 500 && IsProduction ? "Někde se to rozbilo. Zkus to prosím znovu." : error.message;
  reply.code(status).send({ error: message });
});

async function Start(): Promise<void> {
  try {
    await app.listen({ port: Env.PORT, host: Env.HOST });
    app.log.info(`LockIn API běží na ${Env.HOST}:${Env.PORT}`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    app.log.info(`${signal} — vypínám`);
    app.close().then(() => process.exit(0));
  });
}

void Start();
