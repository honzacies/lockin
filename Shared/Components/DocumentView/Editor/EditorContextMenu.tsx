"use client";

import { useState, type ReactNode } from "react";
import type { Editor } from "@tiptap/react";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import type { Node as PmNode } from "@tiptap/pm/model";
import {
  Bold,
  ClipboardPaste,
  Code,
  Copy,
  CopyPlus,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  List,
  ListMinus,
  ListOrdered,
  Paintbrush,
  Pilcrow,
  Quote,
  Scissors,
  Settings2,
  Strikethrough,
  Trash2,
} from "@lockin/shared/Components/Shared/UiIcons";
import { ContextMenu, ContextMenuItem, ContextMenuLabel } from "@lockin/shared/Components/Shared/ContextMenu";
import { UseUiStore, type BlockSettingsKind } from "@lockin/shared/Store/UseUiStore";
import type { StyleableBlockType } from "@lockin/shared/Types/Project";

interface Target {
  node: PmNode;
  /** Pozice začátku bloku v dokumentu. */
  from: number;
}

/** Kontextové menu je otevřené — bublinová lišta formátování se mezitím neukazuje (překrývaly by se). */
export const EditorMenuState = { open: false };

const ICON = { size: 14, strokeWidth: 1.75, className: "text-[var(--lk-text2)]" } as const;

/** Typ bloku pro editor stylů (stejné typy jako tužka ve slash menu). */
function StyleType(node: PmNode): StyleableBlockType | null {
  switch (node.type.name) {
    case "paragraph":
      return "paragraph";
    case "heading":
      return `heading${node.attrs.level}` as StyleableBlockType;
    case "blockquote":
      return "quote";
    case "codeBlock":
      return "codeBlock";
    case "horizontalRule":
      return "divider";
    case "bulletList":
      return node.attrs.variant === "dash" ? "dashedList" : "bulletList";
    case "orderedList":
      return "numberedList";
    default:
      return null;
  }
}

const STYLE_LABEL: Record<StyleableBlockType, string> = {
  paragraph: "text",
  heading1: "Heading 1",
  heading2: "Heading 2",
  heading3: "Heading 3",
  link: "links",
  quote: "quotes",
  codeBlock: "code blocks",
  divider: "dividers",
  bulletList: "bulleted lists",
  dashedList: "dashed lists",
  numberedList: "numbered lists",
};

const COMPONENT_SETTINGS: Record<string, BlockSettingsKind> = {
  richTodoList: "todo",
  colorPalette: "colorPalette",
  scenario: "scenario",
};

const TEXT_BLOCKS = new Set(["paragraph", "heading", "blockquote", "codeBlock", "bulletList", "orderedList", "taskList"]);

/**
 * Pravý klik v editoru: místo výchozího menu prohlížeče označí blok pod
 * kurzorem (vlastní výběr textu nechá být) a nabídne převod, formát, styl
 * typu bloku, nastavení komponenty a schránku.
 */
export function EditorContextMenu({ editor, children }: { editor: Editor; children: ReactNode }) {
  const [target, setTarget] = useState<Target | null>(null);

  function HandleOpen(e: React.MouseEvent): boolean {
    const { view, state } = editor;
    const hit = view.posAtCoords({ left: e.clientX, top: e.clientY });
    if (!hit) return false;
    const at = hit.inside >= 0 ? hit.inside : hit.pos;
    const $at = state.doc.resolve(Math.min(at, state.doc.content.size));
    const from = $at.depth === 0 ? at : $at.before(1);
    const node = state.doc.nodeAt(from);
    if (!node) return false;
    setTarget({ node, from });
    EditorMenuState.open = true;

    // Klik do už označeného textu ho nechá — formátuje se ten výběr.
    const { selection } = state;
    if (!selection.empty && selection.from <= hit.pos && hit.pos <= selection.to) return true;
    const sel =
      node.isAtom || !node.content.size
        ? NodeSelection.create(state.doc, from)
        : TextSelection.create(state.doc, from + 1, from + node.nodeSize - 1);
    view.dispatch(state.tr.setSelection(sel));
    view.focus();
    return true;
  }

  function Run(close: () => void, fn: () => void) {
    fn();
    close();
  }

  function Menu(close: () => void) {
    if (!target) return null;
    const { node, from } = target;
    const editable = editor.isEditable;
    const isText = TEXT_BLOCKS.has(node.type.name);
    const styleType = StyleType(node);
    const settingsKind = COMPONENT_SETTINGS[node.type.name];
    const chain = () => editor.chain().focus();
    const Turn = (label: string, icon: ReactNode, apply: () => void) => (
      <ContextMenuItem icon={icon} onClick={() => Run(close, apply)}>
        {label}
      </ContextMenuItem>
    );

    return (
      <div className="flex max-h-[70vh] flex-col gap-px overflow-y-auto">
        {editable && isText ? (
          <>
            <ContextMenuLabel first>Turn into</ContextMenuLabel>
            {Turn("Text", <Pilcrow {...ICON} />, () => chain().clearNodes().setParagraph().run())}
            {Turn("Heading 1", <Heading1 {...ICON} />, () => chain().clearNodes().setHeading({ level: 1 }).run())}
            {Turn("Heading 2", <Heading2 {...ICON} />, () => chain().clearNodes().setHeading({ level: 2 }).run())}
            {Turn("Heading 3", <Heading3 {...ICON} />, () => chain().clearNodes().setHeading({ level: 3 }).run())}
            {Turn("Bulleted list", <List {...ICON} />, () => chain().clearNodes().toggleBulletList().updateAttributes("bulletList", { variant: null }).run())}
            {Turn("Dashed list", <ListMinus {...ICON} />, () => chain().clearNodes().toggleBulletList().updateAttributes("bulletList", { variant: "dash" }).run())}
            {Turn("Numbered list", <ListOrdered {...ICON} />, () => chain().clearNodes().toggleOrderedList().run())}
            {Turn("Quote", <Quote {...ICON} />, () => chain().clearNodes().toggleBlockquote().run())}
            {Turn("Code block", <Code {...ICON} />, () => chain().clearNodes().toggleCodeBlock().run())}

            {node.type.name !== "codeBlock" ? (
              <>
                <ContextMenuLabel>Format</ContextMenuLabel>
                <div className="flex gap-0.5 px-1 pb-1">
                  {[
                    { label: "Bold", icon: <Bold size={15} />, on: editor.isActive("bold"), run: () => chain().toggleBold().run() },
                    { label: "Italic", icon: <Italic size={15} />, on: editor.isActive("italic"), run: () => chain().toggleItalic().run() },
                    { label: "Strikethrough", icon: <Strikethrough size={15} />, on: editor.isActive("strike"), run: () => chain().toggleStrike().run() },
                    { label: "Inline code", icon: <Code size={15} />, on: editor.isActive("code"), run: () => chain().toggleCode().run() },
                  ].map((f) => (
                    <button
                      key={f.label}
                      type="button"
                      aria-label={f.label}
                      title={f.label}
                      aria-pressed={f.on}
                      onClick={() => Run(close, f.run)}
                      className={`flex h-8 flex-1 items-center justify-center rounded-md ${f.on ? "bg-[#0088ff]/10 text-[#0077e0]" : "text-[var(--lk-text2)] hover:bg-black/[0.05]"}`}
                    >
                      {f.icon}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </>
        ) : null}

        {editable && (styleType || settingsKind) ? (
          <>
            <ContextMenuLabel first={!isText}>Customize</ContextMenuLabel>
            {styleType ? (
              <ContextMenuItem icon={<Paintbrush {...ICON} />} onClick={() => Run(close, () => UseUiStore.getState().OpenStyleEditor(styleType))}>
                Style {STYLE_LABEL[styleType]}…
              </ContextMenuItem>
            ) : null}
            {settingsKind ? (
              <ContextMenuItem
                icon={<Settings2 {...ICON} />}
                onClick={() => Run(close, () => UseUiStore.getState().OpenBlockSettings(settingsKind, String(node.attrs.config?.id ?? "")))}
              >
                Block settings…
              </ContextMenuItem>
            ) : null}
          </>
        ) : null}

        <ContextMenuLabel first={!editable}>Edit</ContextMenuLabel>
        <ContextMenuItem icon={<Copy {...ICON} />} onClick={() => Run(close, () => document.execCommand("copy"))}>
          Copy
        </ContextMenuItem>
        {editable ? (
          <>
            <ContextMenuItem icon={<Scissors {...ICON} />} onClick={() => Run(close, () => document.execCommand("cut"))}>
              Cut
            </ContextMenuItem>
            <ContextMenuItem
              icon={<ClipboardPaste {...ICON} />}
              onClick={() =>
                Run(close, () => {
                  navigator.clipboard.readText().then((text) => text && editor.chain().focus().insertContent(text).run());
                })
              }
            >
              Paste
            </ContextMenuItem>
            <ContextMenuItem
              icon={<CopyPlus {...ICON} />}
              onClick={() => Run(close, () => editor.chain().focus().insertContentAt(from + node.nodeSize, node.toJSON()).run())}
            >
              Duplicate block
            </ContextMenuItem>
            <ContextMenuItem
              icon={<Trash2 size={14} strokeWidth={1.75} />}
              danger
              onClick={() => Run(close, () => editor.chain().focus().deleteRange({ from, to: from + node.nodeSize }).run())}
            >
              Delete block
            </ContextMenuItem>
          </>
        ) : null}
      </div>
    );
  }

  return (
    <ContextMenu
      onOpen={HandleOpen}
      onClose={() => {
        EditorMenuState.open = false;
        // Prázdná transakce = bublinová lišta znovu zváží, jestli se ukázat.
        if (!editor.isDestroyed) editor.view.dispatch(editor.state.tr);
      }}
      menu={Menu}
      className="flex flex-1 flex-col"
    >
      {children}
    </ContextMenu>
  );
}
