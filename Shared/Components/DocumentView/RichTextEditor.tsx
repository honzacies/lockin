"use client";

import { useEffect } from "react";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { NodeSelection } from "@tiptap/pm/state";
import StarterKit from "@tiptap/starter-kit";
import BulletList from "@tiptap/extension-bullet-list";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { TextStyle, Color, FontFamily, FontSize } from "@tiptap/extension-text-style";
import TextAlign from "@tiptap/extension-text-align";
import { SlashCommandExtension } from "./Editor/SlashCommand/SlashCommandExtension";
import { TodoListExtension } from "./Editor/TodoList/TodoListExtension";
import { ColorPaletteExtension } from "./Editor/ColorPalette/ColorPaletteExtension";
import { ScenarioExtension } from "./Editor/Scenario/ScenarioExtension";
import { MediaExtension } from "./Editor/Media/MediaExtension";
import { YoutubeExtension } from "./Editor/Media/YoutubeExtension";
import {
  TableExtension,
  TableRowExtension,
  TableHeaderExtension,
  TableCellExtension,
} from "./Editor/Table/TableExtension";
import { MarkdownPasteExtension } from "./Editor/Text/MarkdownPasteExtension";
import { ImagePasteExtension } from "./Editor/Text/ImagePasteExtension";
import { SpoilerExtension } from "./Editor/Text/SpoilerExtension";
import { BlockSelectionExtension, AttachMarqueeZone } from "./Editor/BlockSelectionExtension";
import { SelectionToolbar } from "./Editor/SelectionToolbar";
import { BuildStyleVars } from "./Editor/StyleVars";
import type { DocumentStyleConfig } from "@lockin/shared/Types/Project";

// Extend the bundled bullet list with a `variant` attribute so the slash menu
// can offer a dashed variant alongside the default disc markers.
const VariantBulletList = BulletList.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      variant: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-variant"),
        renderHTML: (attributes) =>
          attributes.variant ? { "data-variant": attributes.variant } : {},
      },
    };
  },
});

interface RichTextEditorProps {
  initialContent: JSONContent;
  onChange: (json: JSONContent) => void;
  /** Per-block-type element styles, applied as CSS custom properties. */
  style?: DocumentStyleConfig;
  /** Library's 600px side panel vs the full page — must match whatever
   * left padding the header above it (ProjectHeader/ProjectContents, or
   * StandaloneDocumentEditor's own header block) uses in the same mode, or
   * the editor's own content drifts out of alignment with it. */
  compact?: boolean;
  /** Document settings menu's "Small text" toggle. */
  smallText?: boolean;
  /** Document settings menu's "Lock page" toggle — read-only while true. */
  locked?: boolean;
  /** Document settings menu's Theme "Text" color. */
  themeForeground?: string;
}

export function RichTextEditor({
  initialContent,
  onChange,
  style,
  compact = false,
  smallText = false,
  locked = false,
  themeForeground,
}: RichTextEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    editable: !locked,
    extensions: [
      StarterKit.configure({
        bulletList: false,
        // Typing `[name](link)` converts it straight into a real link mark
        // as you finish the closing `)` — @tiptap/extension-link ships this
        // itself (both an input rule for typing and a paste rule for
        // pasting markdown-formatted text), just off by default.
        link: { markdownLinks: true },
      }),
      VariantBulletList,
      TaskList,
      TaskItem.configure({ nested: true }),
      TodoListExtension,
      ColorPaletteExtension,
      ScenarioExtension,
      MediaExtension,
      YoutubeExtension,
      TableExtension,
      TableRowExtension,
      TableHeaderExtension,
      TableCellExtension,
      SpoilerExtension,
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      BlockSelectionExtension,
      Placeholder.configure({
        placeholder: "Type '/' for commands, or just start writing…",
      }),
      SlashCommandExtension,
      ImagePasteExtension,
      MarkdownPasteExtension,
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        // No hardcoded text color here — .prose-editor's own CSS sets none
        // either, so it inherits the ancestor wrapper's color, which is
        // where a document's theme.foreground gets applied (see
        // StandaloneDocumentEditor/ProjectView). A hardcoded class here
        // would win over that inherited value and mask the theme entirely.
        class: `prose-editor min-h-[500px] w-full pb-24 leading-[24px] outline-none ${
          compact ? "px-4" : "px-[50px]"
        } ${smallText ? "text-[14px]" : "text-[16px]"}`,
        spellcheck: "false",
        autocorrect: "off",
        autocapitalize: "off",
      },
    },
    onUpdate: ({ editor: instance }) => onChange(instance.getJSON()),
  });

  // Lets the marquee (see BlockSelectionExtension) start from anywhere in an
  // ancestor `[data-marquee-zone]` — e.g. a project's header/contents rail
  // sitting above the editor — not just inside the editable region itself.
  useEffect(() => {
    if (!editor) return;
    const zone = editor.view.dom.closest<HTMLElement>("[data-marquee-zone]");
    if (!zone) return;
    return AttachMarqueeZone(editor.view, zone);
  }, [editor]);

  useEffect(() => {
    editor?.setEditable(!locked);
  }, [editor, locked]);

  return (
    <div style={BuildStyleVars(style, themeForeground)} className="flex flex-1 flex-col">
      {editor ? (
        // BubbleMenu repositions by writing `left`/`top` directly onto its
        // own element on every selection change (see
        // @tiptap/extension-bubble-menu's BubbleMenuView) — a plain CSS
        // transition on those same properties is enough to animate that,
        // since it's the same DOM node being moved, not remounted.
        <BubbleMenu
          editor={editor}
          // Media/to-do/color-palette blocks are `atom` nodes selected via a
          // NodeSelection (not a text range) — the default shouldShow only
          // checks "is the selection non-empty," which a NodeSelection
          // satisfies too, so without this the text-formatting toolbar
          // popped up over a selected image just as if text were selected.
          // Media gets its own toolbar instead (see MediaNodeView.tsx).
          shouldShow={({ view, state }) =>
            view.hasFocus() &&
            editor.isEditable &&
            !state.selection.empty &&
            !(state.selection instanceof NodeSelection)
          }
          className="transition-[left,top] duration-150 ease-out"
        >
          <SelectionToolbar editor={editor} />
        </BubbleMenu>
      ) : null}
      <EditorContent editor={editor} />
    </div>
  );
}
