import type { Editor, Range } from "@tiptap/core";
import {
  CheckSquare,
  Clapperboard,
  Code,
  Heading1,
  Heading2,
  Heading3,
  ImagePlus,
  Link,
  List,
  ListMinus,
  ListOrdered,
  type LucideIcon,
  Minus,
  Info,
  Layers,
  Palette,
  Sigma,
  Quote,
  Table,
  Type,
  Video,
} from "@lockin/shared/Components/Shared/UiIcons";
import type { StyleableBlockType } from "@lockin/shared/Types/Project";
import { StripHeadingOverrides } from "./StripHeadingOverrides";

export type SlashCommandGroup =
  | "TEXT"
  | "SCHOOL"
  | "STYLING"
  | "LIST"
  | "MEDIA"
  | "WEB DESIGN"
  | "MOVIE/VIDEO CREATING";

export interface SlashCommandItem {
  title: string;
  description: string;
  group: SlashCommandGroup;
  /** Stable key for per-type styling (pencil → settings modal). Null hides
   * the pencil — used by blocks that carry their own inline settings
   * (e.g. the rich to-do list). */
  blockType: StyleableBlockType | null;
  icon: LucideIcon | string;
  command: (props: { editor: Editor; range: Range }) => void;
}

export const SLASH_COMMAND_ITEMS: SlashCommandItem[] = [
  // ── TEXT ────────────────────────────────────────────────
  {
    title: "Paragraph",
    description: "Plain paragraph text",
    group: "TEXT",
    blockType: "paragraph",
    icon: Type,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setParagraph().run(),
  },
  {
    title: "Heading 1",
    description: "Big section heading",
    group: "TEXT",
    blockType: "heading1",
    icon: Heading1,
    command: ({ editor, range }) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setNode("heading", { level: 1 })
        .command(({ tr, state }) => {
          StripHeadingOverrides(tr, state.schema, state.selection.$from.start(), state.selection.$from.end());
          return true;
        })
        .run(),
  },
  {
    title: "Heading 2",
    description: "Medium section heading",
    group: "TEXT",
    blockType: "heading2",
    icon: Heading2,
    command: ({ editor, range }) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setNode("heading", { level: 2 })
        .command(({ tr, state }) => {
          StripHeadingOverrides(tr, state.schema, state.selection.$from.start(), state.selection.$from.end());
          return true;
        })
        .run(),
  },
  {
    title: "Heading 3",
    description: "Small section heading",
    group: "TEXT",
    blockType: "heading3",
    icon: Heading3,
    command: ({ editor, range }) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setNode("heading", { level: 3 })
        .command(({ tr, state }) => {
          StripHeadingOverrides(tr, state.schema, state.selection.$from.start(), state.selection.$from.end());
          return true;
        })
        .run(),
  },
  {
    title: "Link",
    description: "Type [name](link) — it becomes a real link as you close the )",
    group: "TEXT",
    blockType: "link",
    icon: Link,
    command: ({ editor, range }) => {
      // A filled-in template rather than a bare "[" — "link name" comes out
      // pre-selected so typing immediately replaces it, snippet-style, then
      // Tab/arrow past "](" lands you in "link" to overwrite with the real
      // URL. Note this text is inserted programmatically, not typed, so the
      // markdown-link input rule (RichTextEditor.tsx's
      // `link: { markdownLinks: true }`) never fires on it — it stays plain
      // "[link name](link)" text unless the closing `)` gets retyped by hand.
      const nameFrom = range.from + 1;
      const nameTo = nameFrom + "link name".length;
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent("[link name](link)")
        .setTextSelection({ from: nameFrom, to: nameTo })
        .run();
    },
  },
  {
    title: "Quote",
    description: "Capture a quote",
    group: "TEXT",
    blockType: "quote",
    icon: Quote,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
  },
  {
    title: "Code block",
    description: "Monospaced code",
    group: "TEXT",
    blockType: "codeBlock",
    icon: Code,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
  },

  // ── STYLING ─────────────────────────────────────────────
  // ── SCHOOL ──────────────────────────────────────────────
  {
    title: "Formula",
    description: "Math and physics with LaTeX — $x^2$",
    group: "SCHOOL",
    blockType: null,
    icon: Sigma,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setMathBlock().run(),
  },
  {
    title: "Callout",
    description: "Highlighted box — remember, watch out, tip",
    group: "SCHOOL",
    blockType: null,
    icon: Info,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setCallout("note").run(),
  },
  {
    title: "Flashcards",
    description: "Question and answer pairs you can test yourself on",
    group: "SCHOOL",
    blockType: null,
    icon: Layers,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).insertFlashcards().run(),
  },
  {
    title: "Divider",
    description: "Horizontal divider line",
    group: "STYLING",
    blockType: "divider",
    icon: Minus,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },

  // ── LIST ────────────────────────────────────────────────
  {
    title: "Bulleted list",
    description: "Simple bulleted list",
    group: "LIST",
    blockType: "bulletList",
    icon: List,
    command: ({ editor, range }) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .toggleBulletList()
        .updateAttributes("bulletList", { variant: null })
        .run(),
  },
  {
    title: "Dashed list",
    description: "Bulleted list with dashes",
    group: "LIST",
    blockType: "dashedList",
    icon: ListMinus,
    command: ({ editor, range }) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .toggleBulletList()
        .updateAttributes("bulletList", { variant: "dash" })
        .run(),
  },
  {
    title: "Numbered list",
    description: "List with numbering",
    group: "LIST",
    blockType: "numberedList",
    icon: ListOrdered,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    title: "To-do list",
    description: "Rich checklist with title, deadline & progress",
    group: "LIST",
    blockType: null,
    icon: CheckSquare,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).insertRichTodoList().run(),
  },
  {
    title: "Table",
    description: "Notion-style table with hover to add rows/columns",
    group: "LIST",
    blockType: null,
    icon: Table,
    command: ({ editor, range }) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run(),
  },

  // ── MEDIA ───────────────────────────────────────────────
  {
    title: "Image or video",
    description: "Upload any image or video file",
    group: "MEDIA",
    blockType: null,
    icon: ImagePlus,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).insertMedia().run(),
  },
  {
    title: "YouTube",
    description: "Embed a YouTube video from a link",
    group: "MEDIA",
    blockType: null,
    icon: `<svg width="15px" height="15px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path fill-rule="evenodd" clip-rule="evenodd" d="M20.5949 4.45999C21.5421 4.71353 22.2865 5.45785 22.54 6.40501C22.9982 8.12001 23 11.7004 23 11.7004C23 11.7004 23 15.2807 22.54 16.9957C22.2865 17.9429 21.5421 18.6872 20.5949 18.9407C18.88 19.4007 12 19.4007 12 19.4007C12 19.4007 5.12001 19.4007 3.405 18.9407C2.45785 18.6872 1.71353 17.9429 1.45999 16.9957C1 15.2807 1 11.7004 1 11.7004C1 11.7004 1 8.12001 1.45999 6.40501C1.71353 5.45785 2.45785 4.71353 3.405 4.45999C5.12001 4 12 4 12 4C12 4 18.88 4 20.5949 4.45999ZM15.5134 11.7007L9.79788 15.0003V8.40101L15.5134 11.7007Z" stroke="#000000" stroke-linejoin="round"/>
      </svg>`,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).insertYoutubeEmbed().run(),
  },

  // ── WEB DESIGN ──────────────────────────────────────────
  {
    title: "Color Palette",
    description: "Named groups of color swatches, click to copy",
    group: "WEB DESIGN",
    blockType: null,
    icon: Palette,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).insertColorPalette().run(),
  },

  // ── MOVIE/VIDEO CREATING ────────────────────────────────
  {
    title: "Scenario",
    description: "Timestamped script beats — time, title, words to say, word count",
    group: "MOVIE/VIDEO CREATING",
    blockType: null,
    icon: Clapperboard,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).insertScenario().run(),
  },
];
