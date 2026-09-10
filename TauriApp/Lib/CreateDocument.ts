import type { DocumentRecord } from "@/Types/Project";
import { UseDataStore } from "@/Store/UseDataStore";
import { UseUiStore } from "@/Store/UseUiStore";

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
  };
}

/** Creates a new standalone document (no project) and persists it (via the
 * store's self-saving UpsertDocument), returning it so the caller can
 * navigate to it. */
export function CreateNewDocument(): DocumentRecord {
  const doc = BuildBlankDocument(`doc-${Date.now()}`, null);
  UseDataStore.getState().UpsertDocument(doc);
  return doc;
}
