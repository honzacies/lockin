import type { DocumentRecord } from "@lockin/shared/Types/Project";
import { UseDataStore } from "@lockin/shared/Store/UseDataStore";
import { UseUiStore } from "@lockin/shared/Store/UseUiStore";
import { UseSettingsStore } from "@lockin/shared/Store/UseSettingsStore";
import { ActiveWorkspace } from "@lockin/shared/Lib/Workspace";

/** Builds a blank document object — not persisted — the shared shape behind
 * every "new document" entry point, whether it ends up standalone, a
 * project's root document, or a project's sub-document. Callers that need
 * to persist it alongside other changes (e.g. a project and its root
 * document together) should do so themselves via UseDataStore; CreateNewDocument
 * below is the convenience wrapper for the common "just one document" case. */
export function BuildBlankDocument(id: string, projectId: string | null): DocumentRecord {
  const now = new Date().toISOString();
  return {
    id,
    projectId,
    name: "Untitled",
    description: "",
    createdAt: now,
    updatedAt: now,
    lastMode: "text",
    folderId: null,
    tagIds: [],
    isFavorite: false,
    text: { json: { type: "doc", content: [{ type: "paragraph" }] } },
    sketch: { strokes: [] },
    style: UseUiStore.getState().defaultDocumentStyle,
    smallText: UseSettingsStore.getState().newDocumentsSmallText || undefined,
  };
}

/** Creates a new standalone document (no project) and persists it (via the
 * store's self-saving UpsertDocument), returning it so the caller can
 * navigate to it. */
export function CreateNewDocument(): DocumentRecord {
  const doc = BuildBlankDocument(NewDocumentId("Untitled"), null);
  UseDataStore.getState().UpsertDocument(doc);
  return doc;
}

/**
 * ID nového dokumentu. Ve složkovém workspacu je ID cesta souboru
 * (`md:složka/Název.md`, viz VaultStorage) — soubor se tak jmenuje podle
 * dokumentu, ne "doc-123.md", a volné jméno se najde přidáním " 2", " 3"…
 */
export function NewDocumentId(name: string, folder?: string | null): string {
  if (!ActiveWorkspace().path) return `doc-${crypto.randomUUID()}`;
  const clean = name.replace(/[\\/:*?"<>|]/g, "").trim() || "Untitled";
  const dir = (folder ?? "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  const documents = UseDataStore.getState().documents;
  for (let n = 1; ; n++) {
    const id = `md:${dir ? `${dir}/` : ""}${clean}${n > 1 ? ` ${n}` : ""}.md`;
    if (!documents[id]) return id;
  }
}

/** Výchozí název dokumentu, když ho uživatel smaže: ve vaultu jméno souboru, jinak "Untitled". */
export function DefaultDocumentName(id: string): string {
  return id.startsWith("md:") ? (id.split("/").pop() ?? id).replace(/^md:/, "").replace(/\.md$/, "") : "Untitled";
}
