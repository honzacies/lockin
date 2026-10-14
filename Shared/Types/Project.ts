import type { FieldValue } from "./ProjectFields";
import type { JSONContent } from "@tiptap/core";
import type { CanvasScene } from "@lockin/shared/Store/UseCanvasStore";
import type { DocumentLock } from "@lockin/shared/Lib/DocumentLock";

export type DocumentMode = "text" | "sketch";

export interface SketchPoint {
  x: number;
  y: number;
}

export interface SketchStroke {
  points: SketchPoint[];
  color: string;
  size: number;
}

export interface SketchContent {
  /** Kresby ze starého sketch mode — zůstávají jako záloha, zobrazuje se `canvas`. */
  strokes: SketchStroke[];
  /** Sketch mode jako canvas (karty, spojnice, pero, tužka). */
  canvas?: CanvasScene;
}

export interface TextContent {
  /** Tiptap's native document format — the block editor's source of truth. */
  json: JSONContent;
}

/** Block types that expose a per-type styling pencil in the slash menu. */
export type StyleableBlockType =
  | "paragraph"
  | "heading1"
  | "heading2"
  | "heading3"
  | "link"
  | "quote"
  | "codeBlock"
  | "divider"
  | "bulletList"
  | "dashedList"
  | "numberedList";

/**
 * Per-type visual overrides. Every field is optional; a block type only reads
 * the subset relevant to it (see BLOCK_STYLE_FIELDS in Editor/StyleVars.ts).
 */
export interface BlockStyle {
  color?: string; // text / foreground
  fontFamily?: string; // a loaded font CSS value (see app/Fonts.ts)
  fontSize?: number; // text size, px
  background?: string; // codeBlock only
  thickness?: number; // divider, px
  width?: number; // divider, percent 0–100
  markerGap?: number; // lists, px between marker and text
}

/** Word-style "element styles" for one document, keyed by block type. */
export type DocumentStyleConfig = Partial<Record<StyleableBlockType, BlockStyle>>;

export interface DocumentSummary {
  id: string;
  /** null for standalone documents — a project is just one way to group
   * documents, not a prerequisite for one to exist. */
  projectId: string | null;
  name: string;
  description: string;
  updatedAt: string;
  createdAt: string;
  lastMode: DocumentMode;
  /** Library-only organization — which folder this shows up under (if any). */
  folderId: string | null;
  tagIds: string[];
  isFavorite: boolean;
  /** Emoji or uploaded-image (data URL) icon, same convention as Project.icon. */
  icon?: string;
  /** Read-only — the editor stops accepting input while set. */
  isLocked?: boolean;
  /** Chráněno heslem: obsah je zašifrovaný tady a `text.json` zůstává prázdný,
   * dokud ho uživatel neodemkne (Lib/DocumentLock.ts). */
  lock?: DocumentLock;
  /** Shrinks the editor's default body text size. */
  smallText?: boolean;
  /** Wiki odkazy mimo text dokumentu — ve vaultu z frontmatteru (`related:`, `up:`).
   * Počítá se při načtení ze souboru, nikam se neukládá. */
  extraLinks?: string[];
  /** Reserved for a future actual table of contents — the settings menu
   * toggle exists today, but nothing reads this yet. */
  showTableOfContents?: boolean;
  /** Per-document background/text color override — unset falls back to the
   * app's normal white/black. */
  theme?: DocumentTheme;
}

export interface DocumentTheme {
  background?: string;
  foreground?: string;
  /** Off by default — recolors embedded blocks (to-do lists, color
   * palettes) to fit this theme via a best-effort filter, since it can't
   * reliably preserve every custom swatch a block might already carry. */
  adaptBlocks?: boolean;
}

export interface DocumentRecord extends DocumentSummary {
  text: TextContent;
  sketch: SketchContent;
  /** Per-type element styles for this document's editor (optional). */
  style?: DocumentStyleConfig;
  /** Roste při změně textu zvenku (MCP, To-do Home) — otevřený editor se podle
   * něj znovu připojí, jinak by změnu přepsal svým obsahem. */
  revision?: number;
}

export interface Project {
  id: string;
  name: string;
  /** Emoji icon shown above the project name (Notion-style page icon). */
  icon?: string;
  /** @deprecated Starý textový štítek — při startu se převede na Library štítek v `tagIds`. */
  tag?: string;
  /** References a PriorityOption.id in UsePriorityStore. */
  priority: string;
  /** References a StatusOption.id in UsePriorityStore. */
  status: string;
  progress: number;
  deadline: string | null;
  /** Optional time-of-day for the deadline, "HH:mm" 24h format. */
  deadlineTime?: string | null;
  createdAt: string;
  lastEditedAt: string;
  /** The project hub's own Text/Sketch document (its "main content"). */
  rootDocumentId: string;
  /** Sub-documents listed in the Contents rail. */
  documentIds: string[];
  isFavorite: boolean;
  /** Library-only organization — same convention as DocumentSummary. */
  folderId: string | null;
  tagIds: string[];
  /** Hodnoty vlastních polí podle `FieldDefinition.id` (Types/ProjectFields.ts). */
  fields?: Record<string, FieldValue>;
  /** Pole skrytá v tomto projektu (vestavěná i vlastní) — hodnota zůstává uložená. */
  hiddenFields?: string[];
  /** Pořadí polí v hlavičce; chybějící pole jdou na konec ve výchozím pořadí. */
  fieldOrder?: string[];
}

export interface ManifestEntry {
  id: string;
  kind: "project" | "document";
  name: string;
  tag?: string;
  priority?: string;
  status?: string;
  progress?: number;
  deadline?: string | null;
  updatedAt: string;
}

export interface Manifest {
  entries: ManifestEntry[];
}
