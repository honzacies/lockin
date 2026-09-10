"use client";

import type { DocumentRecord, Project } from "@lockin/shared/Types/Project";
import type {
  DataStorageAdapter,
  KeyValueAdapter,
  MediaAdapter,
} from "@lockin/shared/Platform/Types";
import { API_URL, ApiError, ApiFetch } from "./ApiClient";
import { GetAccessToken } from "./Session";
import { GetMasterKey } from "./KeyVault";
import { OpenFile, OpenJson, SealFile, SealJson, type Sealed } from "./Crypto";

/**
 * Přihlášený režim — všechno jde přes API, ale **zašifrované**.
 *
 * Tady je jediné místo, kde se šifruje a dešifruje. `Shared/` o tom neví:
 * dostává a posílá běžné `Project` a `DocumentRecord`, protože mluví se
 * serverem výhradně přes tenhle adaptér.
 *
 * Server dostane jen ciphertext plus adresaci a časy. Název, obsah, skica,
 * styly, zařazení do složek — všechno je uvnitř šifrovaného bloku.
 */

function RequireKey(): CryptoKey {
  const key = GetMasterKey();
  if (!key) {
    throw new Error("Trezor je zamčený — nejdřív je potřeba zadat passphrase.");
  }
  return key;
}

/** Obálka, kterou vidí server. Zbytek entity je uvnitř `ciphertext`. */
interface Envelope extends Sealed {
  id: string;
  createdAt: string;
  updatedAt: string;
}

async function SealProject(project: Project): Promise<Envelope> {
  const sealed = await SealJson(RequireKey(), project);
  return {
    id: project.id,
    createdAt: project.createdAt,
    updatedAt: project.lastEditedAt,
    ...sealed,
  };
}

async function SealDocument(doc: DocumentRecord): Promise<Envelope> {
  const sealed = await SealJson(RequireKey(), doc);
  return { id: doc.id, createdAt: doc.createdAt, updatedAt: doc.updatedAt, ...sealed };
}

/**
 * Jeden poškozený nebo cizím klíčem zašifrovaný záznam nesmí shodit celý
 * bootstrap — zbytek knihovny se má načíst i tak. Nedešifrovatelné položky
 * se přeskočí a nahlásí do konzole.
 */
async function OpenAll<T>(envelopes: Envelope[], label: string): Promise<T[]> {
  const key = RequireKey();
  const out: T[] = [];
  for (const envelope of envelopes) {
    try {
      out.push(await OpenJson<T>(key, envelope));
    } catch {
      console.warn(`${label} ${envelope.id}: nejde dešifrovat, přeskakuji`);
    }
  }
  return out;
}

export const ApiDataStorage: DataStorageAdapter = {
  async LoadAll() {
    const payload = await ApiFetch<{ projects: Envelope[]; documents: Envelope[] }>("/sync");
    const [projects, documents] = await Promise.all([
      OpenAll<Project>(payload.projects, "Projekt"),
      OpenAll<DocumentRecord>(payload.documents, "Dokument"),
    ]);
    return { projects, documents };
  },

  async SaveProject(project) {
    await ApiFetch(`/projects/${encodeURIComponent(project.id)}`, {
      method: "PUT",
      body: await SealProject(project),
    });
  },

  async LoadProject(id) {
    // Samostatný GET na jeden projekt API nemá — bootstrap přes /sync stáhne
    // všechno naráz a klient si to drží ve storu.
    const { projects } = await ApiDataStorage.LoadAll();
    return projects.find((p) => p.id === id) ?? null;
  },

  async DeleteProject(id) {
    await ApiFetch(`/projects/${encodeURIComponent(id)}`, { method: "DELETE" });
  },

  async SaveDocument(doc) {
    await ApiFetch(`/documents/${encodeURIComponent(doc.id)}`, {
      method: "PUT",
      body: await SealDocument(doc),
    });
  },

  async LoadDocument(id) {
    const { documents } = await ApiDataStorage.LoadAll();
    return documents.find((d) => d.id === id) ?? null;
  },

  async DeleteDocument(id) {
    await ApiFetch(`/documents/${encodeURIComponent(id)}`, { method: "DELETE" });
  },

  /** Index vlastní server, klient nemá co přestavovat. */
  async RebuildIndex() {},
};

const blobUrls = new Map<string, string>();

export const ApiMedia: MediaAdapter = {
  /**
   * Soubor se šifruje **před** odesláním, i s hlavičkou nesoucí původní název
   * a MIME typ. Server tedy nezná ani jedno — vidí jen šifrované bajty.
   */
  async Save(file) {
    const sealed = await SealFile(RequireKey(), file);
    const form = new FormData();
    form.append("file", sealed, "blob.bin");
    const result = await ApiFetch<{ path: string; bytes: number }>("/media", {
      method: "POST",
      body: form,
      raw: true,
    });
    return result.path;
  },

  /**
   * Stáhne šifrovaný soubor, dešifruje ho a udělá z něj blob URL. Endpoint
   * vyžaduje `Authorization` hlavičku, kterou `<img src>` neumí poslat, takže
   * fetch by tu byl potřeba i bez šifrování.
   */
  async ResolveUrl(path) {
    const cached = blobUrls.get(path);
    if (cached) return cached;

    const key = GetMasterKey();
    if (!key) return "";

    const relative = path.startsWith("Media/") ? path.slice("Media/".length) : path;
    try {
      const response = await fetch(`${API_URL}/media/${relative}`, {
        headers: { Authorization: `Bearer ${GetAccessToken() ?? ""}` },
      });
      if (!response.ok) return "";
      const opened = await OpenFile(key, await response.arrayBuffer());
      const url = URL.createObjectURL(opened.blob);
      blobUrls.set(path, url);
      return url;
    } catch {
      return "";
    }
  },

  async Delete(path) {
    const cached = blobUrls.get(path);
    if (cached) {
      URL.revokeObjectURL(cached);
      blobUrls.delete(path);
    }
    const relative = path.startsWith("Media/") ? path.slice("Media/".length) : path;
    await ApiFetch(`/media/${relative}`, { method: "DELETE" }).catch(() => {});
  },

  /**
   * Úklid dělá server — klient jen pošle seznam cest, na které něco odkazuje.
   * Cesty jsou neprůhledné identifikátory, ne obsah, takže je server vidět může.
   */
  async SweepOrphaned(documents) {
    const referenced: string[] = [];
    for (const doc of documents) {
      CollectMediaPaths(doc, referenced);
    }
    await ApiFetch("/media/sweep", { method: "POST", body: { referenced } }).catch(() => {});
  },
};

function CollectMediaPaths(doc: DocumentRecord, into: string[]): void {
  const walk = (node: { type?: string; attrs?: Record<string, unknown>; content?: unknown[] }) => {
    if (node.type === "media" && typeof node.attrs?.path === "string") {
      into.push(node.attrs.path);
    }
    for (const child of (node.content ?? []) as typeof node[]) {
      walk(child);
    }
  };
  if (doc.text?.json) walk(doc.text.json);
}

/**
 * Drobné kolekce (složky, štítky, poznámky, UI stav). `store` a `key` jsou
 * konstanty z kódu, ne uživatelská data, takže zůstávají čitelné; hodnota se
 * šifruje stejným hlavním klíčem jako dokumenty.
 */
export const ApiKeyValue: KeyValueAdapter = {
  async GetItem(store, key) {
    try {
      const result = await ApiFetch<{ value: string | null; nonce: string | null }>(
        `/collections/${encodeURIComponent(store)}/${encodeURIComponent(key)}`,
      );
      if (!result.value || !result.nonce) return null;

      const masterKey = GetMasterKey();
      if (!masterKey) return null;

      try {
        return await OpenJson<string>(masterKey, {
          ciphertext: result.value,
          nonce: result.nonce,
        });
      } catch {
        console.warn(`${store}/${key}: nejde dešifrovat, beru jako prázdné`);
        return null;
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  },

  async SetItem(store, key, value) {
    const sealed = await SealJson(RequireKey(), value);
    await ApiFetch(`/collections/${encodeURIComponent(store)}/${encodeURIComponent(key)}`, {
      method: "PUT",
      body: { value: sealed.ciphertext, nonce: sealed.nonce },
    });
  },

  async RemoveItem(store, key) {
    await ApiFetch(`/collections/${encodeURIComponent(store)}/${encodeURIComponent(key)}`, {
      method: "DELETE",
    });
  },
};
