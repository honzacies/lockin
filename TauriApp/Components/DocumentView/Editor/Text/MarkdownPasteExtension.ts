import { Extension } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import { marked } from "marked";
import type { TodoTask } from "@/Types/QuickNotes";
import { CreateEmptyTodoListConfig } from "../TodoList/TodoListExtension";

/** Tags that only show up when the clipboard's HTML actually encodes real
 * structure (headings, lists, tables, quotes, code, links, images) — as
 * opposed to plain text that happens to be wrapped in a `<span>`/`<meta>`
 * by whatever app copied it (common even for a plain-text-only copy). */
const RICH_HTML_PATTERN = /<(h[1-6]|table|ul|ol|blockquote|pre|img|a)[\s>]/i;

/** Whether `html` looks like it was produced by an actual rich editor
 * (Word, Notion, Google Docs, this app's own copy, ...) rather than being a
 * plain-text paste that merely arrived with incidental HTML wrapping. */
function IsRichHtml(html: string): boolean {
  return RICH_HTML_PATTERN.test(html);
}

const CHECKLIST_LINE_PATTERN = /^[-*]\s+\[([ xX])\]\s+(.*)$/;

/** Strips the inline markdown emphasis this app's TodoTask fields can't
 * render (they're plain strings, no rich marks) — bold/italic/code/strike
 * markers — leaving just the plain text. */
function StripInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/~~(.+?)~~/g, "$1")
    .trim();
}

/**
 * Detects a paste that's *entirely* a GFM checklist (every non-blank line
 * is a `- [ ]`/`- [x]` item, no other content mixed in) and parses it into
 * TodoTask objects, so it becomes a real richTodoList block instead of a
 * plain checklist. Splits each line's text on the first " — "/" – " (em/en
 * dash) into title/description — there's no other signal in plain markdown
 * for "this part is the description", so that's the detection rule.
 * Returns null if the paste doesn't look like a pure checklist.
 */
function ParseMarkdownChecklist(text: string): TodoTask[] | null {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length === 0) return null;

  const matches = lines.map((line) => line.match(CHECKLIST_LINE_PATTERN));
  if (matches.some((match) => !match)) return null;

  return matches.map((match, index) => {
    const [, checked, rest] = match!;
    const dashSplit = rest.match(/^(.*?)\s+[—–]\s+(.*)$/);
    return {
      id: `task-${Date.now()}-${index}`,
      title: StripInlineMarkdown(dashSplit ? dashSplit[1] : rest) || "Untitled task",
      description: StripInlineMarkdown(dashSplit ? dashSplit[2] : ""),
      done: checked.toLowerCase() === "x",
    };
  });
}

/**
 * Auto-formats plain-text markdown on paste — headings, bold/italic, lists,
 * blockquotes, code blocks, links, and (via NotionTableExtension) tables.
 * TipTap has no built-in markdown-paste support: pasting rendered HTML
 * (from a browser, Word, Notion, ...) already works today through the
 * editor's own schema-driven HTML parsing, but pasting *markdown source*
 * as plain text — e.g. copying a `.md` file, or text from a chat reply —
 * previously landed as one literal, unformatted paragraph.
 */
export const MarkdownPasteExtension = Extension.create({
  name: "markdownPaste",

  addProseMirrorPlugins() {
    const editor = this.editor;

    return [
      new Plugin({
        props: {
          handlePaste(_view, event) {
            const clipboard = event.clipboardData;
            if (!clipboard) return false;

            const text = clipboard.getData("text/plain");
            if (!text.trim()) return false;

            const html = clipboard.getData("text/html");
            if (IsRichHtml(html)) return false;

            const tasks = ParseMarkdownChecklist(text);
            if (tasks) {
              event.preventDefault();
              editor
                .chain()
                .focus()
                .insertContent({
                  type: "richTodoList",
                  attrs: { config: { ...CreateEmptyTodoListConfig(), tasks } },
                })
                .run();
              return true;
            }

            const parsed = marked.parse(text, { gfm: true, breaks: false });
            if (typeof parsed !== "string") return false;

            event.preventDefault();
            editor
              .chain()
              .focus()
              .insertContent(parsed, { parseOptions: { preserveWhitespace: false } })
              .run();
            return true;
          },
        },
      }),
    ];
  },
});
