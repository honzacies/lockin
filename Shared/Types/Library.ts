/** What every tag looked like before LibraryTag.color existed — kept as the
 * fallback so old tags (and the "no custom color chosen yet" case) render
 * exactly like they always have. */
export const DEFAULT_TAG_COLOR = "#ff383c";

export interface LibraryFolder {
  id: string;
  name: string;
  description: string;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
  /** Emoji or uploaded-image icon, same convention as Project.icon. */
  icon?: string;
}

export interface LibraryTag {
  id: string;
  name: string;
  description: string;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
  /** Optional — tags are primarily identified by color/name, but can carry
   * a custom icon too. */
  icon?: string;
  /** Hex color driving the tag's icon/chips everywhere it's shown (Sidebar,
   * Library table, source chips). Falls back to DEFAULT_TAG_COLOR when unset
   * (e.g. tags saved before this field existed). */
  color?: string;
}
