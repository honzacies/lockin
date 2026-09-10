import fp from "fastify-plugin";
import fastifyJwt from "@fastify/jwt";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { Env } from "../Env.js";

/** Co nese access token. Krátká životnost, takže role uvnitř je přijatelná. */
export interface AccessTokenPayload {
  sub: string;
  username: string;
  role: "USER" | "ADMIN";
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: AccessTokenPayload;
    user: AccessTokenPayload;
  }
}

declare module "fastify" {
  interface FastifyInstance {
    /** Vyžaduje platný access token, jinak 401. */
    Authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    /** Vyžaduje platný token a roli ADMIN, jinak 401/403. */
    RequireAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

async function AuthPlugin(app: FastifyInstance): Promise<void> {
  await app.register(fastifyJwt, {
    secret: Env.JWT_SECRET,
    sign: { expiresIn: Env.ACCESS_TOKEN_TTL },
  });

  // `return reply` je tu podstatné, ne kosmetika. Async preHandler zastaví
  // request jen tehdy, když se `reply.send()` stihne zavolat dřív, než se
  // promise vyřeší — a vrácení `reply` je způsob, jak to Fastify říct
  // jednoznačně. Bez toho hrozí, že se handler přesto spustí a neověřený
  // request projde (viz fastify/docs/Reference/Hooks.md, „Respond to a
  // request from a hook").
  app.decorate("Authenticate", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch {
      await reply.code(401).send({ error: "Missing or expired sign-in." });
      return reply;
    }
  });

  app.decorate("RequireAdmin", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch {
      await reply.code(401).send({ error: "Missing or expired sign-in." });
      return reply;
    }
    if (request.user.role !== "ADMIN") {
      // Schválně 403 a ne 404 — uživatel je ověřený, jen na tohle nemá právo.
      await reply.code(403).send({ error: "You do not have permission to do that." });
      return reply;
    }
  });
}

export default fp(AuthPlugin, { name: "auth" });
