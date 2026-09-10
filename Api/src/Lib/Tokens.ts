import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Refresh tokeny jsou náhodné řetězce, ne JWT — mají se dát odvolat, což
 * u bezstavového JWT nejde. V databázi leží jen jejich SHA-256, takže z
 * uniklé databáze se použitelný token vytáhnout nedá.
 *
 * SHA-256 (a ne Argon2) je tady správně: token má 256 bitů entropie, takže
 * slovníkový útok nedává smysl a pomalý hash by jen zdržoval každý refresh.
 */

export function GenerateRefreshToken(): string {
  return randomBytes(32).toString("base64url");
}

export function HashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Porovnání v konstantním čase — délky se musí shodovat, jinak throwne. */
export function SafeCompare(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

/**
 * Invite kód ve tvaru LOCKIN-XXXX-XXXX. Abeceda vynechává znaky, které se
 * pletou při přepisování z papíru nebo ze zprávy: 0/O, 1/I/L, U/V.
 */
const ALPHABET = "ABCDEFGHJKMNPQRSTWXYZ23456789";

export function GenerateInviteCode(): string {
  const pick = () =>
    Array.from(randomBytes(4))
      .map((byte) => ALPHABET[byte % ALPHABET.length])
      .join("");
  return `LOCKIN-${pick()}-${pick()}`;
}
