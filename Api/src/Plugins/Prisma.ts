import fp from "fastify-plugin";
import { PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

/**
 * Jedna instance PrismaClient na celý server, zavěšená na `fastify.prisma`.
 * Vytvářet klienta per request by vyčerpalo connection pool.
 */
async function PrismaPlugin(app: FastifyInstance): Promise<void> {
  const prisma = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

  await prisma.$connect();
  app.decorate("prisma", prisma);

  app.addHook("onClose", async () => {
    await prisma.$disconnect();
  });
}

export default fp(PrismaPlugin, { name: "prisma" });
