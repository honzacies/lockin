import { UseDataStore } from "@lockin/shared/Store/UseDataStore";

/** The four kinds of item every Sidebar row, the Library table, and the
 * Projects table can point at — each has its own favorite/rename/icon/delete
 * actions in UseDataStore, differing only in which one applies. */
export type LibraryItemKind = "document" | "project" | "folder" | "tag";

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
}
