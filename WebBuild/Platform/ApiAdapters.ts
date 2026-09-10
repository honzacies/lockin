"use client";

import type { DocumentRecord, Project } from "@lockin/shared/Types/Project";
import type {
  DataStorageAdapter,
  KeyValueAdapter,
  MediaAdapter,
} from "@lockin/shared/Platform/Types";
import { API_URL, ApiError, ApiFetch } from "./ApiClient";
import { GetAccessToken } from "./Session";

/** Přihlášený režim — všechno jde přes API na server. */

export const ApiDataStorage: DataStorageAdapter = {
  async LoadAll() {
    return ApiFetch<{ projects: Project[]; documents: DocumentRecord[] }>("/sync");
  },

  async SaveProject(project) {
    await ApiFetch(`/projects/${encodeURIComponent(project.id)}`, {
      method: "PUT",
      body: project,
    });
  },

  async LoadProject(id) {
    // Samostatný GET na jeden projekt API nemá — bootstrap přes /sync stáhne
    // všechno naráz a klient si to drží ve storu, takže by to byl endpoint
    // navíc, který nikdo nevolá.
    const { projects } = await ApiFetch<{ projects: Project[] }>("/sync");
    return projects.find((p) => p.id === id) ?? null;
  },

  async DeleteProject(id) {
    await ApiFetch(`/projects/${encodeURIComponent(id)}`, { method: "DELETE" });
  },

  async SaveDocument(doc) {
    await ApiFetch(`/documents/${encodeURIComponent(doc.id)}`, {
      method: "PUT",
      body: doc,
    });
  },

  async LoadDocument(id) {
    const { documents } = await ApiFetch<{ documents: DocumentRecord[] }>("/sync");
    return documents.find((d) => d.id === id) ?? null;
  },

  async DeleteDocument(id) {
    await ApiFetch(`/documents/${encodeURIComponent(id)}`, { method: "DELETE" });
  },

  /** Index vlastní server, klient nemá co přestavovat. */
  async RebuildIndex() {},
};

export const ApiMedia: MediaAdapter = {
  async Save(file) {
    const form = new FormData();
    form.append("file", file);
    const result = await ApiFetch<{ path: string; bytes: number }>("/media", {
      method: "POST",
      body: form,
      raw: true,
    });
    return result.path;
  },

  /**
   * Vrací přímou adresu na API. Endpoint vyžaduje `Authorization` hlavičku,
   * kterou `<img src>` neumí poslat — proto se soubor stáhne fetchem a udělá
   * se z něj blob URL.
   */
  async ResolveUrl(path) {
    const cached = blobUrls.get(path);
    if (cached) return cached;

    const relative = path.startsWith("Media/") ? path.slice("Media/".length) : path;
    try {
      const response = await fetch(`${API_URL}/media/${relative}`, {
        headers: { Authorization: `Bearer ${GetAccessToken() ?? ""}` },
      });
      if (!response.ok) return "";
      const url = URL.createObjectURL(await response.blob());
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
   * Mazat jednotlivě by znamenalo tolik requestů, kolik je osiřelých souborů.
   */
  async SweepOrphaned(documents) {
    const referenced: string[] = [];
    for (const doc of documents) {
      CollectMediaPaths(doc, referenced);
    }
    await ApiFetch("/media/sweep", { method: "POST", body: { referenced } }).catch(() => {});
  },
};

const blobUrls = new Map<string, string>();

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

export const ApiKeyValue: KeyValueAdapter = {
  async GetItem(store, key) {
    try {
      const result = await ApiFetch<{ value: string | null }>(
        `/collections/${encodeURIComponent(store)}/${encodeURIComponent(key)}`,
      );
      return result.value;
    } catch (error) {
      // 404 znamená „ještě nic uloženo", ne chybu — vrať prázdno a nech
      // store naběhnout na výchozí hodnoty.
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  },

  async SetItem(store, key, value) {
    await ApiFetch(`/collections/${encodeURIComponent(store)}/${encodeURIComponent(key)}`, {
      method: "PUT",
      body: { value },
    });
  },

  async RemoveItem(store, key) {
    await ApiFetch(`/collections/${encodeURIComponent(store)}/${encodeURIComponent(key)}`, {
      method: "DELETE",
    });
  },
};
