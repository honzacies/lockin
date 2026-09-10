import { hash, verify } from "@node-rs/argon2";

/**
 * Argon2id přes @node-rs/argon2 — má předkompilované binárky pro běžné
 * platformy, takže odpadá node-gyp a build toolchain v Docker image.
 *
 * Parametry jsou OWASP doporučení pro Argon2id (19 MiB paměti, 2 průchody).
 * Sůl si knihovna generuje sama a je součástí výsledného řetězce, takže se
 * neukládá zvlášť.
 */
const OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export async function HashPassword(plain: string): Promise<string> {
  return hash(plain, OPTIONS);
}

export async function VerifyPassword(hashed: string, plain: string): Promise<boolean> {
  try {
    return await verify(hashed, plain, OPTIONS);
  } catch {
    // Poškozený nebo cizí formát hashe — ber jako neshodu, ne jako pád.
    return false;
  }
}
