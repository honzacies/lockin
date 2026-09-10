import assert from "node:assert/strict";
import Fastify from "fastify";

/**
 * Ověří, že neautorizovaný request se k handleru **nedostane**.
 *
 * Nespoléhá na běžící server ani databázi — `fastify.inject()` prožene request
 * celým životním cyklem v paměti. Tím se dá otestovat právě to, co je na async
 * preHandlerech ošidné: že `reply.send()` uvnitř hooku request opravdu zastaví
 * a handler se nespustí (viz komentář v Plugins/Auth.ts).
 *
 * Spustit: `bun run verify:auth`
 */

process.env.JWT_SECRET ??= "test-secret-aspon-32-znaku-dlouhy-klic-xxxxx";
process.env.DATABASE_URL ??= "postgresql://x:x@localhost:5432/x";

let handlerReached = false;

async function Main(): Promise<void> {
  // Dynamický import schválně: Env.ts se validuje hned při vyhodnocení modulu
  // a statické importy se hoistují nad přiřazení výše, takže by validace
  // spadla dřív, než by se testovací proměnné stihly nastavit.
  const { default: AuthPlugin } = await import("../Plugins/Auth.js");

  const app = Fastify({ logger: false });
  await app.register(AuthPlugin);

  // Chráněné routy — `handlerReached` je detektor: když se přepne na true,
  // znamená to, že hook request nezastavil.
  await app.register(async (scope) => {
    scope.addHook("preHandler", scope.Authenticate);
    scope.get("/chraneno", async () => {
      handlerReached = true;
      return { ok: true };
    });
  });

  await app.register(async (scope) => {
    scope.addHook("preHandler", scope.RequireAdmin);
    scope.get("/admin-only", async () => {
      handlerReached = true;
      return { ok: true };
    });
  });

  // `app.inject` je přetížená, takže se její parametry přes `Parameters<>`
  // odvodit nedají — options se proto rozkládají až tady, na přímém volání.
  const Check = async (
    label: string,
    options: { method: "GET" | "POST"; url: string; headers?: Record<string, string> },
    expectedStatus: number,
    expectHandler: boolean,
  ) => {
    handlerReached = false;
    const response = await app.inject({
      method: options.method,
      url: options.url,
      headers: options.headers,
    });
    assert.equal(
      response.statusCode,
      expectedStatus,
      `${label}: čekal jsem ${expectedStatus}, dostal ${response.statusCode}`,
    );
    assert.equal(
      handlerReached,
      expectHandler,
      `${label}: handler ${handlerReached ? "SE SPUSTIL" : "se nespustil"}, ale neměl`,
    );
    console.log(`  ✓ ${label} → ${response.statusCode}`);
  };

  console.log("\nOvěření autorizace API\n");

  await Check("bez tokenu", { method: "GET", url: "/chraneno" }, 401, false);

  await Check(
    "s nesmyslným tokenem",
    { method: "GET", url: "/chraneno", headers: { authorization: "Bearer neco-spatneho" } },
    401,
    false,
  );

  await Check(
    "s tokenem podepsaným cizím klíčem",
    {
      method: "GET",
      url: "/chraneno",
      headers: {
        // Podepsáno jiným tajemstvím — struktura sedí, podpis ne.
        authorization:
          "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ4IiwidXNlcm5hbWUiOiJ4Iiwicm9sZSI6IkFETUlOIn0.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      },
    },
    401,
    false,
  );

  const userToken = app.jwt.sign({ sub: "u1", username: "user", role: "USER" });
  const adminToken = app.jwt.sign({ sub: "a1", username: "admin", role: "ADMIN" });

  await Check(
    "s platným tokenem",
    { method: "GET", url: "/chraneno", headers: { authorization: `Bearer ${userToken}` } },
    200,
    true,
  );

  await Check("admin route bez tokenu", { method: "GET", url: "/admin-only" }, 401, false);

  await Check(
    "admin route s běžným uživatelem",
    { method: "GET", url: "/admin-only", headers: { authorization: `Bearer ${userToken}` } },
    403,
    false,
  );

  await Check(
    "admin route s adminem",
    { method: "GET", url: "/admin-only", headers: { authorization: `Bearer ${adminToken}` } },
    200,
    true,
  );

  await app.close();
  console.log("\nVšechno prošlo — neautorizovaný request se k handleru nedostane.\n");
}

Main().catch((error) => {
  console.error("\nSELHALO:", error instanceof Error ? error.message : error, "\n");
  process.exit(1);
});
