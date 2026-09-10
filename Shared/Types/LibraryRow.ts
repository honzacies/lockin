export type LibraryRowKind = "document" | "folder" | "tag" | "project";

export interface LibrarySource {
  kind: "folder" | "tag" | "project";
  label: string;
  /** Tag sources only — the tag's color, for the chip's icon/text. */
  color?: string;
}

export interface LibraryRow {
  kind: LibraryRowKind;
  id: string;
  name: string;
  description: string;
  /** Documents only — every folder/tag/project the document is attached to,
   * shown as chips in the Source column. */
  sources: LibrarySource[];
  sizeLabel: string;
  createdAt: string;
  updatedAt: string;
  /** Custom icon (emoji or data URL) — falls back to a kind-appropriate
   * lucide icon (Rocket/Folder/Hash) when unset. */
  icon?: string;
  isFavorite: boolean;
  /** Tag rows only — see LibraryTag.color. */
  color?: string;
}
