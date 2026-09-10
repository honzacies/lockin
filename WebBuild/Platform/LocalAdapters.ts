"use client";

import type { DocumentRecord, Project } from "@lockin/shared/Types/Project";
import type {
  DataStorageAdapter,
  KeyValueAdapter,
  MediaAdapter,
} from "@lockin/shared/Platform/Types";
import {
  DbDelete,
  DbGet,
  DbGetAll,
  DbGetAllKeys,
  DbPut,
  STORE_DOCUMENTS,
  STORE_KV,
  STORE_MEDIA,
  STORE_PROJECTS,
} from "./LocalDb";

/**
 * Anonymní režim — všechno zůstává v prohlížeči, nikam se nic neposílá.
 * Tohle je výchozí stav, dokud se uživatel nepřihlásí.
 */

export const LocalDataStorage: DataStorageAdapter = {
  async LoadAll() {
    const [projects, documents] = await Promise.all([
      DbGetAll<Project>(STORE_PROJECTS),
      DbGetAll<DocumentRecord>(STORE_DOCUMENTS),
    ]);
    return { projects, documents };
  },

  async SaveProject(project) {
    await DbPut(STORE_PROJECTS, project.id, project);
  },

  async LoadProject(id) {
    return (await DbGet<Project>(STORE_PROJECTS, id)) ?? null;
  },

  async DeleteProject(id) {
    await DbDelete(STORE_PROJECTS, id);
  },

  async SaveDocument(doc) {
    await DbPut(STORE_DOCUMENTS, doc.id, doc);
  },

  async LoadDocument(id) {
    return (await DbGet<DocumentRecord>(STORE_DOCUMENTS, id)) ?? null;
  },

  async DeleteDocument(id) {
    await DbDelete(STORE_DOCUMENTS, id);
  },

  /** IndexedDB je sama sobě indexem — není co přestavovat. */
  async RebuildIndex() {},
};

interface StoredMedia {
  blob: Blob;
  mime: string;
}

/**
 * Blob URL se musí ručně uvolňovat, jinak drží data v paměti až do zavření
 * záložky. Cache je zároveň pojistka, aby se pro jednu cestu nevyráběla nová
 * URL při každém překreslení.
 */
const blobUrls = new Map<string, string>();

const MAX_LOCAL_BYTES = 50 * 1024 * 1024;

export const LocalMedia: MediaAdapter = {
  async Save(file) {
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      throw new Error("Only images and videos can be uploaded.");
    }
    if (file.size > MAX_LOCAL_BYTES) {
      throw new Error("That file is too large (50 MB max).");
    }
    const extension = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : "";
    const path = `Media/media-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${extension}`;
    await DbPut(STORE_MEDIA, path, { blob: file, mime: file.type } satisfies StoredMedia);
    return path;
  },

  async ResolveUrl(path) {
    const cached = blobUrls.get(path);
    if (cached) return cached;

    const stored = await DbGet<StoredMedia>(STORE_MEDIA, path);
    if (!stored) return "";

    const url = URL.createObjectURL(stored.blob);
    blobUrls.set(path, url);
    return url;
  },

  async Delete(path) {
    const url = blobUrls.get(path);
    if (url) {
      URL.revokeObjectURL(url);
      blobUrls.delete(path);
    }
    await DbDelete(STORE_MEDIA, path);
  },

  async SweepOrphaned(documents) {
    const referenced = new Set<string>();
    for (const doc of documents) {
      CollectMediaPaths(doc, referenced);
    }

    const keys = await DbGetAllKeys(STORE_MEDIA);
    for (const key of keys) {
      if (!referenced.has(key)) {
        await LocalMedia.Delete(key);
      }
    }
  },
};

/** Projde Tiptap JSON a posbírá cesty všech media uzlů. */
function CollectMediaPaths(doc: DocumentRecord, into: Set<string>): void {
  const walk = (node: { type?: string; attrs?: Record<string, unknown>; content?: unknown[] }) => {
    if (node.type === "media" && typeof node.attrs?.path === "string") {
      into.add(node.attrs.path);
    }
    for (const child of (node.content ?? []) as typeof node[]) {
      walk(child);
    }
  };
  if (doc.text?.json) walk(doc.text.json);
}

export const LocalKeyValue: KeyValueAdapter = {
  async GetItem(store, key) {
    return (await DbGet<string>(STORE_KV, `${store}:${key}`)) ?? null;
  },

  async SetItem(store, key, value) {
    await DbPut(STORE_KV, `${store}:${key}`, value);
  },

  async RemoveItem(store, key) {
    await DbDelete(STORE_KV, `${store}:${key}`);
  },
};
