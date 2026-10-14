"use client";

import type { JSONContent } from "@tiptap/core";
import { FromBase64, KDF_PARAMS, ToBase64 } from "@lockin/shared/Lib/Crypto";
import { argon2id } from "hash-wasm";

/**
 * Dokument chráněný heslem. Heslo se nikam neukládá — z něj a ze soli se
 * Argon2id odvodí klíč a obsahem dokumentu projde AES-256-GCM. Na disku
 * zůstane jen šifrovaný text, sůl, nonce a parametry odvození.
 *
 * Špatné heslo nevyrobí nesmysl, ale čistou chybu: GCM nese autentizační
 * značku, která při jiném klíči neprojde a `decrypt` vyhodí výjimku. To je
 * záměr — kdyby se místo toho vrátila nějaká změť, šlo by ji omylem uložit
 * zpátky a přepsat jí původní dokument.
 *
 * Zapomenuté heslo = ztracený dokument. Zadní vrátka tu nejsou.
 */
export interface DocumentLock {
  /** base64 */
  salt: string;
  nonce: string;
  ciphertext: string;
  memoryKiB: number;
  iterations: number;
  parallelism: number;
}

/** Prázdný dokument, který zůstane v `text.json`, dokud je zamčeno. */
export const EMPTY_DOC: JSONContent = { type: "doc", content: [{ type: "paragraph" }] };

type Params = Pick<DocumentLock, "memoryKiB" | "iterations" | "parallelism">;

async function DeriveKey(password: string, salt: Uint8Array, params: Params): Promise<CryptoKey> {
  const raw = await argon2id({
    password,
    salt,
    memorySize: params.memoryKiB,
    iterations: params.iterations,
    parallelism: params.parallelism,
    hashLength: 32,
    outputType: "binary",
  });
  // `raw` z hash-wasm je Uint8Array nad obecným bufferem; WebCrypto chce
  // ArrayBuffer, proto kopie přes .slice().
  return crypto.subtle.importKey("raw", raw.slice().buffer as ArrayBuffer, "AES-GCM", false, ["encrypt", "decrypt"]);
}

/** Klíče odemčených dokumentů — jen v paměti, po zavření aplikace jsou pryč.
 * Díky nim se heslo neptá znovu při každém přepnutí záložky. */
const unlocked = new Map<string, CryptoKey>();

export const UnlockedKey = (documentId: string) => unlocked.get(documentId);
export const ForgetKey = (documentId: string) => unlocked.delete(documentId);

/** Zamkne obsah novým heslem. Vrací zámek i klíč, aby šlo rovnou psát dál. */
export async function CreateLock(documentId: string, json: JSONContent, password: string): Promise<DocumentLock> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const params: Params = KDF_PARAMS;
  const key = await DeriveKey(password, salt, params);
  unlocked.set(documentId, key);
  return { ...(await Seal(key, json, salt, params)) };
}

/** Přešifruje obsah už odemčeným klíčem — volá se při každém uložení. */
export async function ResealLock(key: CryptoKey, lock: DocumentLock, json: JSONContent): Promise<DocumentLock> {
  return Seal(key, json, FromBase64(lock.salt), lock);
}

async function Seal(key: CryptoKey, json: JSONContent, salt: Uint8Array, params: Params): Promise<DocumentLock> {
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce },
    key,
    new TextEncoder().encode(JSON.stringify(json)),
  );
  return {
    salt: ToBase64(salt),
    nonce: ToBase64(nonce),
    ciphertext: ToBase64(new Uint8Array(ciphertext)),
    memoryKiB: params.memoryKiB,
    iterations: params.iterations,
    parallelism: params.parallelism,
  };
}

/**
 * Odemkne obsah heslem. Při špatném hesle vyhodí výjimku (ověření GCM),
 * takže volající pozná neúspěch spolehlivě, ne „podle toho, jak to vypadá".
 * Klíč si nechá v paměti pro další uložení.
 */
export async function OpenLock(documentId: string, lock: DocumentLock, password: string): Promise<JSONContent> {
  const key = await DeriveKey(password, FromBase64(lock.salt), lock);
  const json = await OpenWithKey(lock, key);
  unlocked.set(documentId, key);
  return json;
}

/** Rozšifruje klíčem, který už je v paměti — na heslo se znovu neptá.
 * Používá se při sundání ochrany, aby se obsah vrátil do dokumentu. */
export async function OpenWithKey(lock: DocumentLock, key: CryptoKey): Promise<JSONContent> {
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: FromBase64(lock.nonce) },
    key,
    FromBase64(lock.ciphertext),
  );
  return JSON.parse(new TextDecoder().decode(plaintext)) as JSONContent;
}
