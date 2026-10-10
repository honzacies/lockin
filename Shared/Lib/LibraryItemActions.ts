import { UseDataStore } from "@lockin/shared/Store/UseDataStore";
import { UseCanvasStore } from "@lockin/shared/Store/UseCanvasStore";

/** The kinds of item every Sidebar row, the Library table, and the Projects
 * table can point at — each has its own favorite/rename/icon/delete actions in
 * UseDataStore, differing only in which one applies. A canvas is the odd one
 * out: it lives in UseCanvasStore and has no favorite flag or icon, so only
 * rename and delete do anything (SidebarItemMenu hides the rest). */
export type LibraryItemKind = "document" | "project" | "folder" | "tag" | "canvas";

export function ToggleFavoriteByKind(kind: LibraryItemKind, id: string): void {
  const store = UseDataStore.getState();
  if (kind === "document") store.ToggleDocumentFavorite(id);
  if (kind === "project") store.ToggleProjectFavorite(id);
  if (kind === "folder") store.ToggleFolderFavorite(id);
  if (kind === "tag") store.ToggleTagFavorite(id);
}

export function RenameByKind(kind: LibraryItemKind, id: string, name: string): void {
  const store = UseDataStore.getState();
  if (kind === "document") store.RenameDocument(id, name);
  if (kind === "project") store.RenameProject(id, name);
  if (kind === "folder") store.RenameFolder(id, name);
  if (kind === "tag") store.RenameTag(id, name);
  if (kind === "canvas") {
    const canvas = UseCanvasStore.getState().canvases.find((c) => c.id === id);
    if (canvas) UseCanvasStore.getState().Save({ ...canvas, name });
  }
}

export function SetIconByKind(kind: LibraryItemKind, id: string, icon: string | undefined): void {
  const store = UseDataStore.getState();
  if (kind === "document") store.SetDocumentIcon(id, icon);
  if (kind === "project") store.SetProjectIcon(id, icon);
  if (kind === "folder") store.SetFolderIcon(id, icon);
  if (kind === "tag") store.SetTagIcon(id, icon);
}

export function RemoveByKind(kind: LibraryItemKind, id: string): void {
  const store = UseDataStore.getState();
  if (kind === "document") store.RemoveDocument(id);
  if (kind === "project") store.RemoveProject(id);
  if (kind === "folder") store.RemoveFolder(id);
  if (kind === "tag") store.RemoveTag(id);
  if (kind === "canvas") UseCanvasStore.getState().Remove(id);
}
