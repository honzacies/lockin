"use client";

import { useState } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import { Button, Input } from "@heroui/react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Code2,
  Eye,
  Italic,
  Minus,
  Plus,
  Quote,
  Repeat,
  Strikethrough,
  Type,
  Underline,
} from "lucide-react";
import { Popover } from "@lockin/shared/Components/Shared/Popover";
import { FontPicker } from "@lockin/shared/Components/DocumentView/StyleEditor/FontPicker";
import { ColorPicker } from "@lockin/shared/Components/DocumentView/StyleEditor/ColorPicker";
import { SlashCommandMenu } from "./SlashCommand/SlashCommandMenu";
import { SLASH_COMMAND_ITEMS } from "./SlashCommand/SlashCommandItems";

const DEFAULT_FONT_SIZE = 16;
const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 96;
const DEFAULT_TEXT_COLOR = "#2c2c2b";

type TextAlignValue = "left" | "center" | "right" | "justify";

const ALIGN_OPTIONS: { value: TextAlignValue; icon: typeof AlignLeft; label: string }[] = [
  { value: "left", icon: AlignLeft, label: "Align left" },
  { value: "center", icon: AlignCenter, label: "Align center" },
  { value: "right", icon: AlignRight, label: "Align right" },
  { value: "justify", icon: AlignJustify, label: "Justify" },
];

const MARK_OPTIONS: {
  name: string;
  icon: typeof Bold;
  label: string;
  toggle: (editor: Editor) => void;
}[] = [
  { name: "bold", icon: Bold, label: "Bold", toggle: (e) => e.chain().focus().toggleBold().run() },
  { name: "italic", icon: Italic, label: "Italic", toggle: (e) => e.chain().focus().toggleItalic().run() },
  {
    name: "underline",
    icon: Underline,
    label: "Underline",
    toggle: (e) => e.chain().focus().toggleUnderline().run(),
  },
  {
    name: "strike",
    icon: Strikethrough,
    label: "Strikethrough",
    toggle: (e) => e.chain().focus().toggleStrike().run(),
  },
];

const SECONDARY_MARK_OPTIONS: {
  name: string;
  icon: typeof Quote;
  label: string;
  toggle: (editor: Editor) => void;
}[] = [
  {
    name: "blockquote",
    icon: Quote,
    label: "Quote",
    toggle: (e) => e.chain().focus().toggleBlockquote().run(),
  },
  { name: "code", icon: Code2, label: "Code", toggle: (e) => e.chain().focus().toggleCode().run() },
  {
    name: "spoiler",
    icon: Eye,
    label: "Spoiler",
    toggle: (e) => e.chain().focus().toggleSpoiler().run(),
  },
];

const TOOLBAR_BUTTON =
  "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--lk-text2)] hover:bg-black/[0.06]";

function ParseFontSize(raw: string | null | undefined): number {
  const parsed = raw ? parseFloat(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : DEFAULT_FONT_SIZE;
}

/** Editable-on-click number, matching InlineEditable's click-to-edit pattern
 * (Components/QuickNotes/TodoListView.tsx) but scoped to a small numeric
 * stepper instead of free text. */
function SizeValue({ value, onCommit }: { value: number; onCommit: (next: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  if (editing) {
    return (
      <Input
        autoFocus
        type="number"
        min={MIN_FONT_SIZE}
        max={MAX_FONT_SIZE}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false);
          const parsed = parseInt(draft, 10);
          if (Number.isFinite(parsed)) {
            onCommit(Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, parsed)));
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        className="h-7 w-10 rounded-md border-none bg-black/[0.04] text-center text-[13px] text-[var(--lk-ink)] shadow-none outline-none"
      />
    );
  }

  return (
    <Button
      variant="ghost"
      onPress={() => {
        setDraft(String(value));
        setEditing(true);
      }}
      className="h-7 w-10 shrink-0 rounded-md text-[13px] font-medium text-[var(--lk-ink)] hover:bg-black/[0.06]"
    >
      {value}
    </Button>
  );
}

/**
 * A Notion-style floating selection toolbar — rendered inside a `BubbleMenu`
 * (see RichTextEditor.tsx) so it only ever mounts while there's a real text
 * selection. Font family, size, color, and paragraph alignment — the same
 * four levers `Types/Project.ts`'s per-block-type `BlockStyle` already
 * exposes for a whole block, just applied inline to a selection instead.
 */
export function SelectionToolbar({ editor }: { editor: Editor }) {
  // Reading editor.getAttributes()/isActive() directly at render time only
  // ever reflects whatever the LAST unrelated re-render happened to catch —
  // running a command changes the document, but nothing tells *this*
  // component to re-render just because of that, so the toolbar's own
  // display (the size number, the color dot, which align button is lit up)
  // would sit stale until some other event coincidentally re-rendered it.
  // useEditorState subscribes to every transaction and recomputes its
  // selector each time, which is what actually made this feel instant
  // instead of catching up "eventually."
  const { currentFontFamily, currentFontSize, currentColor, activeAlign, activeMarks } = useEditorState({
    editor,
    selector: ({ editor: instance }) => ({
      currentFontFamily: instance.getAttributes("textStyle").fontFamily as string | undefined,
      currentFontSize: ParseFontSize(instance.getAttributes("textStyle").fontSize as string | undefined),
      currentColor: (instance.getAttributes("textStyle").color as string | undefined) ?? DEFAULT_TEXT_COLOR,
      activeAlign: ALIGN_OPTIONS.find((option) => instance.isActive({ textAlign: option.value }))?.value,
      activeMarks: new Set(
        [...MARK_OPTIONS, ...SECONDARY_MARK_OPTIONS]
          .filter((option) => instance.isActive(option.name))
          .map((option) => option.name),
      ),
    }),
  });

  function SetFontSize(next: number) {
    editor.chain().focus().setFontSize(`${next}px`).run();
  }

  return (
    <div
      data-marquee-ignore="true"
      // Clicking a plain HTML element inside a contentEditable region's
      // BubbleMenu normally blurs the editor and collapses the selection
      // *before* our onPress/onClick ever runs — the command still ends up
      // applying to the right range (chain().focus() restores it), but the
      // extra blur → refocus round-trip is exactly the kind of thing that
      // reads as "laggy." Preventing the mousedown's default action stops
      // that from happening at all, so the selection never actually moves.
      // Real form controls need their own default mousedown behavior left
      // alone, though — this was also silently breaking the hue slider's
      // native thumb drag (preventDefault cancels the whole event's default
      // action regardless of which ancestor called it, range-input drag
      // included) until they were excluded here.
      onMouseDown={(e) => {
        if (e.target instanceof Element && e.target.closest("input, textarea, select")) return;
        e.preventDefault();
      }}
      className="flex items-center gap-0.5 rounded-xl border border-[var(--lk-line)] bg-white p-1 shadow-lg"
    >
      {MARK_OPTIONS.map(({ name, icon: Icon, label, toggle }) => {
        const active = activeMarks.has(name);
        return (
          <Button
            key={name}
            variant="ghost"
            isIconOnly
            aria-label={label}
            onPress={() => toggle(editor)}
            className={`${TOOLBAR_BUTTON} ${active ? "bg-black/[0.06] text-[var(--lk-ink)]" : ""}`}
          >
            <Icon size={15} strokeWidth={1.75} />
          </Button>
        );
      })}

      <div className="mx-0.5 h-4 w-px bg-[var(--lk-line)]" />

      {SECONDARY_MARK_OPTIONS.map(({ name, icon: Icon, label, toggle }) => {
        const active = activeMarks.has(name);
        return (
          <Button
            key={name}
            variant="ghost"
            isIconOnly
            aria-label={label}
            onPress={() => toggle(editor)}
            className={`${TOOLBAR_BUTTON} ${active ? "bg-black/[0.06] text-[var(--lk-ink)]" : ""}`}
          >
            <Icon size={15} strokeWidth={1.75} />
          </Button>
        );
      })}

      <div className="mx-0.5 h-4 w-px bg-[var(--lk-line)]" />

      <Popover
        trigger={(open) => (
          <Button
            variant="ghost"
            isIconOnly
            aria-label="Turn into"
            className={`${TOOLBAR_BUTTON} ${open ? "bg-black/[0.06] text-[var(--lk-ink)]" : ""}`}
          >
            <Repeat size={15} strokeWidth={1.75} />
          </Button>
        )}
        panelClassName="!border-none !bg-transparent !shadow-none p-0"
      >
        {(close) => (
          <SlashCommandMenu
            items={SLASH_COMMAND_ITEMS}
            command={(item) => {
              // The slash menu's own items all lead with `.deleteRange(range)`
              // to clear out the "/query" text the user just typed — there's
              // no such text here, so a zero-width range at the selection's
              // start makes that delete a no-op, and the rest of the command
              // (setNode/toggleX/insertContent) runs against the current
              // selection exactly like it would from a fresh "/" trigger.
              const pos = editor.state.selection.from;
              item.command({ editor, range: { from: pos, to: pos } });
              close();
            }}
          />
        )}
      </Popover>

      <div className="mx-0.5 h-4 w-px bg-[var(--lk-line)]" />

      <Popover
        trigger={(open) => (
          <Button
            variant="ghost"
            isIconOnly
            aria-label="Font"
            className={`${TOOLBAR_BUTTON} ${open ? "bg-black/[0.06] text-[var(--lk-ink)]" : ""}`}
          >
            <Type size={15} strokeWidth={1.75} />
          </Button>
        )}
        panelClassName="w-64 p-3"
      >
        {() => (
          <FontPicker
            value={currentFontFamily}
            onChange={(cssValue) => editor.chain().focus().setFontFamily(cssValue).run()}
          />
        )}
      </Popover>

      <div className="mx-0.5 h-4 w-px bg-[var(--lk-line)]" />

      <Button
        variant="ghost"
        isIconOnly
        aria-label="Decrease size"
        onPress={() => SetFontSize(Math.max(MIN_FONT_SIZE, currentFontSize - 1))}
        className={TOOLBAR_BUTTON}
      >
        <Minus size={14} strokeWidth={1.75} />
      </Button>
      <SizeValue value={currentFontSize} onCommit={SetFontSize} />
      <Button
        variant="ghost"
        isIconOnly
        aria-label="Increase size"
        onPress={() => SetFontSize(Math.min(MAX_FONT_SIZE, currentFontSize + 1))}
        className={TOOLBAR_BUTTON}
      >
        <Plus size={14} strokeWidth={1.75} />
      </Button>

      <div className="mx-0.5 h-4 w-px bg-[var(--lk-line)]" />

      <Popover
        trigger={(open) => (
          <Button
            variant="ghost"
            isIconOnly
            aria-label="Text color"
            className={`${TOOLBAR_BUTTON} ${open ? "bg-black/[0.06]" : ""}`}
          >
            <span
              className="size-4 rounded-full border border-black/10"
              style={{ background: currentColor }}
            />
          </Button>
        )}
        panelClassName="w-64 p-3"
      >
        {() => (
          <ColorPicker
            value={currentColor}
            onChange={(color) => editor.chain().focus().setColor(color).run()}
          />
        )}
      </Popover>

      <div className="mx-0.5 h-4 w-px bg-[var(--lk-line)]" />

      {ALIGN_OPTIONS.map(({ value, icon: Icon, label }) => {
        const active = activeAlign === value;
        return (
          <Button
            key={value}
            variant="ghost"
            isIconOnly
            aria-label={label}
            onPress={() => editor.chain().focus().setTextAlign(value).run()}
            className={`${TOOLBAR_BUTTON} ${active ? "bg-black/[0.06] text-[var(--lk-ink)]" : ""}`}
          >
            <Icon size={15} strokeWidth={1.75} />
          </Button>
        );
      })}
    </div>
  );
}
