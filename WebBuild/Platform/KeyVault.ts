"use client";

import { ApiError, ApiFetch } from "./ApiClient";
import {
  CreateWrappedKey,
  RewrapKey,
  UnwrapKey,
  type WrappedKeyRecord,
} from "./Crypto";
import { DbDelete, DbGet, DbPut, STORE_KV } from "./LocalDb";

/**
 * Drží odemčený hlavní klíč po dobu, kdy je uživatel přihlášený.
 *
 * Klíč se ukládá do IndexedDB jako **neexportovatelný `CryptoKey`**. To je
 * podstatný detail: prohlížeč s ním umí šifrovat a dešifrovat, ale JavaScript
 * z něj nepřečte bajty, takže ho nejde vytáhnout ani z konzole. Díky tomu
 * přežije reload a passphrase se nezadává pořád dokola.
 *
 * `structuredClone` (a tím i IndexedDB) umí `CryptoKey` uložit nativně —
 * neserializuje se do JSONu, ukládá se samotný objekt klíče.
 */

const VAULT_KEY = "vault:masterKey";

let cached: CryptoKey | null = null;

type Listener = (unlocked: boolean) => void;
const listeners = new Set<Listener>();

function Notify(): void {
  for (const listener of listeners) listener(cached !== null);
}

/** Odběr stavu zámku — UI podle toho pozná, jestli má zobrazit odemykání. */
export function OnVaultChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Klíč pro synchronní použití v adaptérech. `null` = zamčeno. */
export function GetMasterKey(): CryptoKey | null {
  return cached;
}

export function IsUnlocked(): boolean {
  return cached !== null;
}

/**
 * Zkusí obnovit klíč z IndexedDB (po reloadu). Vrací `true`, když se to
 * povedlo — pak se passphrase zadávat nemusí.
 */
export async function TryRestore(): Promise<boolean> {
  if (cached) return true;
  try {
    const stored = await DbGet<CryptoKey>(STORE_KV, VAULT_KEY);
    // `instanceof CryptoKey` schválně: kdyby v úložišti zbylo něco starého
    // nebo poškozeného, nemá se to použít jako klíč.
    if (stored instanceof CryptoKey) {
      cached = stored;
      Notify();
      return true;
    }
  } catch {
    // IndexedDB nedostupná (privátní okno) — uživatel prostě zadá passphrase.
  }
  return false;
}

/** Stáhne obalený klíč ze serveru. `null` = uživatel si ještě passphrase nenastavil. */
export async function FetchWrappedKey(): Promise<WrappedKeyRecord | null> {
  try {
    return await ApiFetch<WrappedKeyRecord>("/keys/me");
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function HasPassphrase(): Promise<boolean> {
  return (await FetchWrappedKey()) !== null;
}

/** První nastavení passphrase — vytvoří hlavní klíč a uloží ho obalený. */
export async function SetupPassphrase(passphrase: string): Promise<void> {
  const record = await CreateWrappedKey(passphrase);
  await ApiFetch("/keys/me", { method: "POST", body: record });
  // Hned odemknout, ať uživatel nemusí passphrase zadávat podruhé.
  cached = await UnwrapKey(passphrase, record);
  await Persist(cached);
  Notify();
}

/**
 * Odemkne trezor passphrase. Vyhodí výjimku, když je passphrase špatná —
 * pozná se to podle toho, že AES-GCM neověří autentizační značku.
 */
export async function Unlock(passphrase: string): Promise<void> {
  const record = await FetchWrappedKey();
  if (!record) throw new Error("Passphrase ještě není nastavená.");

  let key: CryptoKey;
  try {
    key = await UnwrapKey(passphrase, record);
  } catch {
    throw new Error("Špatná passphrase.");
  }

  cached = key;
  await Persist(key);
  Notify();
}

/**
 * Změna passphrase. Přebalí **stejný** hlavní klíč, takže se dokumentů vůbec
 * nedotkne. Heslo k účtu je tu kvůli serveru, který jinak nemá jak ověřit,
 * že změnu vyvolal skutečný vlastník.
 */
export async function ChangePassphrase(
  oldPassphrase: string,
  newPassphrase: string,
  accountPassword: string,
): Promise<void> {
  const record = await FetchWrappedKey();
  if (!record) throw new Error("Passphrase ještě není nastavená.");

  let next: WrappedKeyRecord;
  try {
    next = await RewrapKey(oldPassphrase, newPassphrase, record);
  } catch {
    throw new Error("Stará passphrase nesedí.");
  }

  await ApiFetch("/keys/me", {
    method: "PUT",
    body: { ...next, password: accountPassword },
  });

  // Hlavní klíč se nezměnil, takže odemčený trezor zůstává platný — není co
  // přenačítat ani přešifrovávat.
}

export async function Lock(): Promise<void> {
  cached = null;
  await DbDelete(STORE_KV, VAULT_KEY).catch(() => {});
  Notify();
}

async function Persist(key: CryptoKey): Promise<void> {
  await DbPut(STORE_KV, VAULT_KEY, key).catch(() => {
    // Neuloží-li se, klíč zůstane jen v paměti — po reloadu se prostě zeptáme
    // na passphrase znovu. Není to důvod k pádu.
  });
}
