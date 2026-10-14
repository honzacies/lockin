"use client";

import { argon2id } from "hash-wasm";

/**
 * Šifrování na straně prohlížeče.
 *
 * Hierarchie klíčů — tohle je celý princip:
 *
 *   passphrase ──Argon2id(sůl)──▶ odvozený klíč ──obaluje──▶ hlavní klíč ──▶ data
 *
 * Passphrase nešifruje data, ale jen hlavní klíč. Změna passphrase proto
 * přepíše jediný malý záznam na serveru a dokumentů se vůbec nedotkne — ať
 * jich je pět nebo pět tisíc.
 *
 * Na server jde výhradně obalený hlavní klíč, sůl a parametry odvození.
 * Passphrase, odvozený klíč ani hlavní klíč server nikdy neuvidí.
 */

/** Parametry Argon2id. Ukládají se s klíčem, aby šlo později přitvrdit. */
export const KDF_PARAMS = {
  algorithm: "argon2id" as const,
  memoryKiB: 65536, // 64 MiB
  iterations: 3,
  parallelism: 1,
};

const KEY_LENGTH = 32; // AES-256
const NONCE_LENGTH = 12; // AES-GCM standard

// ---------------------------------------------------------------- base64

export function ToBase64(bytes: Uint8Array<ArrayBufferLike>): string {
  let binary = "";
  // Po blocích, protože String.fromCharCode(...celéPole) přeteče zásobník
  // u velkých souborů (u médií jde o desítky MB).
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export function FromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function RandomBytes(length: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(length));
}

// ------------------------------------------------- odvození a obalení

/**
 * Z passphrase udělá klíč, kterým se obaluje hlavní klíč.
 *
 * Argon2id, ne PBKDF2: je paměťově náročný, takže útok hrubou silou nad
 * uniklou databází se nedá rozjet na grafické kartě tak levně. WebCrypto ho
 * neumí, proto WASM.
 */
async function DeriveWrappingKey(
  passphrase: string,
  salt: Uint8Array,
  params: typeof KDF_PARAMS,
): Promise<CryptoKey> {
  const raw = await argon2id({
    password: passphrase,
    salt,
    memorySize: params.memoryKiB,
    iterations: params.iterations,
    parallelism: params.parallelism,
    hashLength: KEY_LENGTH,
    outputType: "binary",
  });

  return crypto.subtle.importKey("raw", raw as Uint8Array<ArrayBuffer>, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

export interface WrappedKeyRecord {
  salt: string;
  wrappedKey: string;
  nonce: string;
  algorithm: string;
  memoryKiB: number;
  iterations: number;
  parallelism: number;
}

/**
 * Vytvoří nový hlavní klíč a obalí ho passphrase. Volá se jednou, při
 * prvním nastavení.
 */
export async function CreateWrappedKey(passphrase: string): Promise<WrappedKeyRecord> {
  const salt = RandomBytes(16);
  const nonce = RandomBytes(NONCE_LENGTH);
  const masterKeyBytes = RandomBytes(KEY_LENGTH);

  const wrappingKey = await DeriveWrappingKey(passphrase, salt, KDF_PARAMS);
  const wrapped = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce },
    wrappingKey,
    masterKeyBytes,
  );

  return {
    salt: ToBase64(salt),
    wrappedKey: ToBase64(new Uint8Array(wrapped)),
    nonce: ToBase64(nonce),
    ...KDF_PARAMS,
  };
}

/**
 * Odemkne hlavní klíč passphrase.
 *
 * Vrací **neexportovatelný** `CryptoKey` — prohlížeč s ním umí šifrovat, ale
 * JavaScript z něj nepřečte bajty. Špatná passphrase se pozná tím, že
 * AES-GCM neověří autentizační značku a `decrypt` vyhodí výjimku; není k tomu
 * potřeba žádný zvláštní kontrolní údaj.
 */
export async function UnwrapKey(
  passphrase: string,
  record: WrappedKeyRecord,
): Promise<CryptoKey> {
  const wrappingKey = await DeriveWrappingKey(passphrase, FromBase64(record.salt), {
    algorithm: "argon2id",
    memoryKiB: record.memoryKiB,
    iterations: record.iterations,
    parallelism: record.parallelism,
  });

  const masterKeyBytes = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: FromBase64(record.nonce) },
    wrappingKey,
    FromBase64(record.wrappedKey),
  );

  return crypto.subtle.importKey("raw", masterKeyBytes, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

/**
 * Obalí **stejný** hlavní klíč novou passphrase — tohle je celá změna hesla.
 * Klíč se musí dát vyexportovat, proto se odemyká zvlášť exportovatelná
 * varianta, která žije jen po dobu téhle funkce.
 */
export async function RewrapKey(
  oldPassphrase: string,
  newPassphrase: string,
  record: WrappedKeyRecord,
): Promise<WrappedKeyRecord> {
  const wrappingKey = await DeriveWrappingKey(oldPassphrase, FromBase64(record.salt), {
    algorithm: "argon2id",
    memoryKiB: record.memoryKiB,
    iterations: record.iterations,
    parallelism: record.parallelism,
  });

  const masterKeyBytes = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: FromBase64(record.nonce) },
    wrappingKey,
    FromBase64(record.wrappedKey),
  );

  const salt = RandomBytes(16);
  const nonce = RandomBytes(NONCE_LENGTH);
  const newWrappingKey = await DeriveWrappingKey(newPassphrase, salt, KDF_PARAMS);
  const wrapped = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce },
    newWrappingKey,
    masterKeyBytes,
  );

  return {
    salt: ToBase64(salt),
    wrappedKey: ToBase64(new Uint8Array(wrapped)),
    nonce: ToBase64(nonce),
    ...KDF_PARAMS,
  };
}

// ------------------------------------------------------ šifrování dat

export interface Sealed {
  ciphertext: string;
  nonce: string;
}

/** Zašifruje libovolnou hodnotu serializovatelnou do JSON. */
export async function SealJson(key: CryptoKey, value: unknown): Promise<Sealed> {
  const nonce = RandomBytes(NONCE_LENGTH);
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce },
    key,
    plaintext,
  );
  return { ciphertext: ToBase64(new Uint8Array(ciphertext)), nonce: ToBase64(nonce) };
}

export async function OpenJson<T>(key: CryptoKey, sealed: Sealed): Promise<T> {
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: FromBase64(sealed.nonce) },
    key,
    FromBase64(sealed.ciphertext),
  );
  return JSON.parse(new TextDecoder().decode(plaintext)) as T;
}

/**
 * Zašifruje soubor. Před obsah se vloží hlavička s původním názvem a MIME
 * typem, takže ani ty se na server nedostanou — server vidí jen šifrované
 * bajty a jejich délku.
 *
 * Formát: [4 B délka hlavičky][JSON hlavička][obsah souboru]
 */
export async function SealFile(key: CryptoKey, file: File): Promise<Blob> {
  const header = new TextEncoder().encode(
    JSON.stringify({ name: file.name, type: file.type }),
  );
  const body = new Uint8Array(await file.arrayBuffer());

  const plaintext = new Uint8Array(4 + header.length + body.length);
  new DataView(plaintext.buffer).setUint32(0, header.length, false);
  plaintext.set(header, 4);
  plaintext.set(body, 4 + header.length);

  const nonce = RandomBytes(NONCE_LENGTH);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce },
    key,
    plaintext,
  );

  // Nonce se posílá připojený před ciphertext — u médií není kam ho uložit
  // zvlášť, na rozdíl od dokumentů, které mají vlastní sloupec.
  const out = new Uint8Array(NONCE_LENGTH + ciphertext.byteLength);
  out.set(nonce, 0);
  out.set(new Uint8Array(ciphertext), NONCE_LENGTH);
  return new Blob([out]);
}

export interface OpenedFile {
  blob: Blob;
  name: string;
  type: string;
}

export async function OpenFile(key: CryptoKey, sealed: ArrayBuffer): Promise<OpenedFile> {
  const raw = new Uint8Array(sealed);
  const nonce = raw.subarray(0, NONCE_LENGTH);
  const ciphertext = raw.subarray(NONCE_LENGTH);

  const plaintext = new Uint8Array(
    await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, key, ciphertext),
  );

  const headerLength = new DataView(plaintext.buffer, plaintext.byteOffset).getUint32(0, false);
  const header = JSON.parse(
    new TextDecoder().decode(plaintext.subarray(4, 4 + headerLength)),
  ) as { name: string; type: string };

  return {
    blob: new Blob([plaintext.subarray(4 + headerLength)], { type: header.type }),
    name: header.name,
    type: header.type,
  };
}
