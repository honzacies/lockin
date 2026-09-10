"use client";

import type { DocumentRecord, Project } from "@lockin/shared/Types/Project";
import { ApiDataStorage, ApiMedia } from "./ApiAdapters";
import { LocalDataStorage, LocalMedia } from "./LocalAdapters";
import { DbClear, DbGetAllKeys, DbGet, STORE_MEDIA } from "./LocalDb";
import { STORE_DOCUMENTS, STORE_KV, STORE_PROJECTS } from "./LocalDb";

/**
 * Přenos dat z anonymního režimu (IndexedDB) na účet.
 *
 * Nabídne se po přihlášení, když v prohlížeči něco leží — uživatel to potvrdí
 * a teprve pak se nahrává. Automaticky ne: kdyby si někdo půjčil cizí
 * prohlížeč, natáhl by si cizí anonymní dokumenty do svého účtu.
 */

export interface LocalDataSummary {
  projects: number;
  documents: number;
  mediaFiles: number;
}

export interface MigrationProgress {
  done: number;
  total: number;
  label: string;
}

/** Kolik toho v prohlížeči leží — podklad pro dotaz „nahrát to?". */
export async function InspectLocalData(): Promise<LocalDataSummary> {
  const [{ projects, documents }, mediaKeys] = await Promise.all([
    LocalDataStorage.LoadAll(),
    DbGetAllKeys(STORE_MEDIA),
  ]);
  return {
    projects: projects.length,
    documents: documents.length,
    mediaFiles: mediaKeys.length,
  };
}

export function HasLocalData(summary: LocalDataSummary): boolean {
  return summary.projects > 0 || summary.documents > 0;
}

interface StoredMedia {
  blob: Blob;
  mime: string;
}

/**
 * Nahraje lokální data na účet. Vrací mapu přemapovaných cest k médiím —
 * server přiděluje vlastní cesty, takže se v dokumentech musí přepsat dřív,
 * než se odešlou.
 *
 * Lokální kopie se maže až úplně nakonec a jen když všechno prošlo. Kdyby to
 * spadlo v půlce, data zůstanou v prohlížeči a jde to zkusit znovu.
 */
export async function MigrateLocalDataToAccount(
  onProgress?: (progress: MigrationProgress) => void,
): Promise<{ projects: number; documents: number; mediaFiles: number }> {
  const { projects, documents } = await LocalDataStorage.LoadAll();
  const mediaKeys = await DbGetAllKeys(STORE_MEDIA);

  const total = projects.length + documents.length + mediaKeys.length;
  let done = 0;
  const Report = (label: string) => {
    done += 1;
    onProgress?.({ done, total, label });
  };

  // 1) Média první — dokumenty na ně odkazují a potřebují nové cesty.
  const pathMap = new Map<string, string>();
  for (const oldPath of mediaKeys) {
    const stored = await DbGet<StoredMedia>(STORE_MEDIA, oldPath);
    if (!stored) {
      Report("media file skipped");
      continue;
    }
    const name = oldPath.split("/").pop() ?? "media";
    const file = new File([stored.blob], name, { type: stored.mime });
    const newPath = await ApiMedia.Save(file);
    pathMap.set(oldPath, newPath);
    Report(name);
  }

  // 2) Dokumenty s přepsanými cestami k médiím.
  for (const doc of documents) {
    await ApiDataStorage.SaveDocument(RemapMediaPaths(doc, pathMap));
    Report(doc.name || "document");
  }

  // 3) Projekty až nakonec — odkazují na dokumenty.
  for (const project of projects) {
    await ApiDataStorage.SaveProject(project as Project);
    Report(project.name || "project");
  }

  // 4) Teprve když všechno prošlo, uklidit prohlížeč.
  await Promise.all([
    DbClear(STORE_PROJECTS),
    DbClear(STORE_DOCUMENTS),
    DbClear(STORE_MEDIA),
    DbClear(STORE_KV),
  ]);

  return {
    projects: projects.length,
    documents: documents.length,
    mediaFiles: pathMap.size,
  };
}

/** Projde Tiptap JSON a nahradí staré cesty k médiím novými serverovými. */
function RemapMediaPaths(doc: DocumentRecord, pathMap: Map<string, string>): DocumentRecord {
  if (pathMap.size === 0 || !doc.text?.json) return doc;

  const Walk = (node: unknown): unknown => {
    if (!node || typeof node !== "object") return node;
    const typed = node as { type?: string; attrs?: Record<string, unknown>; content?: unknown[] };

    const next: typeof typed = { ...typed };
    if (typed.type === "media" && typeof typed.attrs?.path === "string") {
      const mapped = pathMap.get(typed.attrs.path);
      if (mapped) next.attrs = { ...typed.attrs, path: mapped };
    }
    if (Array.isArray(typed.content)) {
      next.content = typed.content.map(Walk);
    }
    return next;
  };

  return { ...doc, text: { json: Walk(doc.text.json) as DocumentRecord["text"]["json"] } };
}

/** Zahození lokálních dat bez nahrání — když uživatel migraci odmítne. */
export async function DiscardLocalData(): Promise<void> {
  await Promise.all([
    DbClear(STORE_PROJECTS),
    DbClear(STORE_DOCUMENTS),
    DbClear(STORE_MEDIA),
    DbClear(STORE_KV),
  ]);
}

/** Uvolní blob URL, které si lokální adaptér nadržel. */
export async function ReleaseLocalMediaUrls(): Promise<void> {
  const keys = await DbGetAllKeys(STORE_MEDIA);
  for (const key of keys) {
    await LocalMedia.Delete(key).catch(() => {});
  }
}
