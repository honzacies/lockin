import type { JSONContent } from "@tiptap/core";

/** Walks a TipTap document's JSON tree and joins every text run into plain
 * text, one line per top-level block — used for the settings menu's "Copy
 * page contents," which works off the document's already-saved JSON rather
 * than needing a live editor instance passed all the way down from
 * RichTextEditor.tsx. */
export function ExtractPlainText(node: JSONContent): string {
  const lines: string[] = [];

  function Walk(current: JSONContent): string {
    if (current.type === "text") return current.text ?? "";
    return (current.content ?? []).map(Walk).join("");
  }

  for (const block of node.content ?? []) {
    lines.push(Walk(block));
  }

  return lines.join("\n").trim();
}
