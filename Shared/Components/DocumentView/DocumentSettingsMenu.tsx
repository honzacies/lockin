"use client";

import { useRef, useState } from "react";
import {
  CaseSensitive,
  ClipboardCopy,
  Copy,
  Download,
  FolderInput,
  LayoutTemplate,
  List,
  Lock,
  LockOpen,
  Palette,
  RotateCcw,
  Search,
  Trash2,
  Type,
  Upload,
  Wand2,
} from "lucide-react";
import { Button, Input } from "@heroui/react";
import type { DocumentRecord } from "@lockin/shared/Types/Project";
import { ContextMenuBackRow, ContextMenuItem, ContextMenuLabel } from "@lockin/shared/Components/Shared/ContextMenu";
import { FontPicker } from "@lockin/shared/Components/DocumentView/StyleEditor/FontPicker";
import { FontCategoryTiles } from "@lockin/shared/Components/DocumentView/StyleEditor/FontCategoryTiles";
import { ColorPicker } from "@lockin/shared/Components/DocumentView/StyleEditor/ColorPicker";
import { UseDataStore } from "@lockin/shared/Store/UseDataStore";
import { ExtractPlainText } from "@lockin/shared/Lib/ExtractPlainText";

interface DocumentSettingsMenuProps {
  document: DocumentRecord;
  close: () => void;
}

type Step = "root" | "font" | "theme" | "move";

/**
 * The document settings gear's menu (DocumentModeToolbar.tsx) — font/theme,
 * page actions (copy/duplicate/move/delete), display toggles, page lock,
 * and import/export. Same compact-menu visual language as ContextMenu.tsx
 * throughout; sections use ContextMenuLabel instead of literal dividers.
 */
export function DocumentSettingsMenu({ document, close }: DocumentSettingsMenuProps) {
  const [step, setStep] = useState<Step>("root");
  const [query, setQuery] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [copied, setCopied] = useState(false);
  const folders = UseDataStore((s) => s.folders);
  const importInputRef = useRef<HTMLInputElement>(null);

  const q = query.trim().toLowerCase();
  function Matches(...keywords: string[]): boolean {
    if (!q) return true;
    return keywords.some((keyword) => keyword.toLowerCase().includes(q));
  }

  function Patch(patch: Partial<DocumentRecord>) {
    UseDataStore.getState().UpsertDocument({
      ...document,
      ...patch,
      updatedAt: new Date().toISOString(),
    });
  }

  // Background and text each drag their own ColorPicker, firing rapid
  // onChange calls of their own — if both merge against the `document` prop
  // closed over at render time, a background drag and a text drag landing in
  // the same React batch can each overwrite the other's just-written field,
  // since neither has seen the other's update yet. Reading the theme fresh
  // from the store at call time (not the possibly-stale prop) closes that
  // race — the two pickers can no longer stomp on each other.
  function PatchTheme(patch: Partial<NonNullable<DocumentRecord["theme"]>>) {
    const liveTheme = UseDataStore.getState().documents[document.id]?.theme;
    Patch({ theme: { ...liveTheme, ...patch } });
  }

  function HandleCopyContents() {
    const text = ExtractPlainText(document.text.json);
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
      })
      .catch(() => {
        // Clipboard access can fail (permissions, no bridge) — not worth
        // surfacing an error for a "nice to have" copy button.
      });
  }

  function HandleDuplicate() {
    UseDataStore.getState().DuplicateDocument(document.id);
    close();
  }

  function HandleDelete() {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    UseDataStore.getState().RemoveDocument(document.id);
    close();
  }

  function HandleExport() {
    const payload = JSON.stringify(document, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement("a");
    anchor.href = url;
    anchor.download = `${document.name || "Untitled"}.lockindoc.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    close();
  }

  function HandleImportFile(file: File) {
    file
      .text()
      .then((raw) => {
        const parsed = JSON.parse(raw) as Partial<DocumentRecord>;
        if (!parsed || typeof parsed !== "object" || !parsed.text?.json) {
          throw new Error("Not a lockin document export");
        }
        const now = new Date().toISOString();
        const imported: DocumentRecord = {
          ...parsed,
          text: parsed.text,
          id: `doc-${Date.now()}`,
          projectId: null,
          name: parsed.name || "Imported document",
          description: parsed.description ?? "",
          createdAt: now,
          updatedAt: now,
          lastMode: parsed.lastMode ?? "text",
          folderId: null,
          tagIds: [],
          isFavorite: false,
          sketch: parsed.sketch ?? { strokes: [] },
        };
        UseDataStore.getState().UpsertDocument(imported);
        close();
      })
      .catch((error) => {
        console.warn("Document import failed", error);
      });
  }

  if (step === "font") {
    return (
      <div className="flex max-h-90 flex-col gap-1 overflow-y-visible">
        <ContextMenuBackRow onClick={() => setStep("root")} />
        <div className="px-1 pb-1">
          <FontPicker
            value={document.style?.paragraph?.fontFamily}
            onChange={(cssValue) => {
              Patch({
                style: {
                  ...document.style,
                  paragraph: { ...document.style?.paragraph, fontFamily: cssValue },
                },
              });
            }}
          />
        </div>
      </div>
    );
  }

  if (step === "theme") {
    return (
      <div className="flex max-h-96 flex-col gap-2 overflow-y-auto">
        <ContextMenuBackRow onClick={() => setStep("root")} />
        <div className="flex flex-col gap-3 px-2 pb-1">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#a5a49f]">
                Background
              </span>
              {document.theme?.background ? (
                <Button
                  variant="ghost"
                  isIconOnly
                  onPress={() => PatchTheme({ background: undefined })}
                  aria-label="Reset background color"
                  className="h-auto w-auto rounded p-0.5 text-[#a5a49f] hover:bg-black/[0.04] hover:text-[#5f5e59]"
                >
                  <RotateCcw size={11} strokeWidth={1.75} />
                </Button>
              ) : null}
            </div>
            <ColorPicker
              value={document.theme?.background ?? "#ffffff"}
              onChange={(color) => PatchTheme({ background: color })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#a5a49f]">
                Text
              </span>
              {document.theme?.foreground ? (
                <Button
                  variant="ghost"
                  isIconOnly
                  onPress={() => PatchTheme({ foreground: undefined })}
                  aria-label="Reset text color"
                  className="h-auto w-auto rounded p-0.5 text-[#a5a49f] hover:bg-black/[0.04] hover:text-[#5f5e59]"
                >
                  <RotateCcw size={11} strokeWidth={1.75} />
                </Button>
              ) : null}
            </div>
            <ColorPicker
              value={document.theme?.foreground ?? "#2c2c2b"}
              onChange={(color) => PatchTheme({ foreground: color })}
            />
          </div>
          <ContextMenuItem
            icon={<Wand2 size={14} strokeWidth={1.75} className="text-[#5f5e59]" />}
            onClick={() => PatchTheme({ adaptBlocks: !document.theme?.adaptBlocks })}
            selected={document.theme?.adaptBlocks}
          >
            Adapt to-do lists, palettes & code
          </ContextMenuItem>
          <p className="px-0.5 text-[11px] leading-snug text-[#a5a49f]">
            Recolors embedded blocks (to-do lists, color palettes, code
            blocks) to fit this theme — off by default since it can't
            preserve every custom color perfectly.
          </p>
        </div>
      </div>
    );
  }

  if (step === "move") {
    const folderList = Object.values(folders);
    return (
      <div className="flex max-h-64 flex-col gap-px overflow-y-auto">
        <ContextMenuBackRow onClick={() => setStep("root")} />
        <ContextMenuItem
          onClick={() => {
            UseDataStore.getState().SetDocumentFolder(document.id, null);
            close();
          }}
          selected={!document.folderId}
        >
          No folder
        </ContextMenuItem>
        {folderList.length === 0 ? (
          <p className="px-2 py-1 text-[13px] text-[#91918e]">No folders yet</p>
        ) : (
          folderList.map((folder) => (
            <ContextMenuItem
              key={folder.id}
              onClick={() => {
                UseDataStore.getState().SetDocumentFolder(document.id, folder.id);
                close();
              }}
              selected={document.folderId === folder.id}
            >
              {folder.name}
            </ContextMenuItem>
          ))
        )}
      </div>
    );
  }

  return (
    <div className="flex w-60 flex-col gap-px">
      <div className="p-1 pb-0">
        <div className="flex items-center gap-1.5 rounded-lg bg-black/[0.04] px-2 py-1">
          <Search size={13} strokeWidth={1.75} className="shrink-0 text-[#91918e]" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search actions…"
            className="w-full border-none ring-0 rounded-none bg-transparent p-0 text-[13px] text-[#2c2c2b] shadow-none outline-none placeholder:text-[#91918e]"
          />
        </div>
      </div>

      {Matches("font", "theme", "colors") ? (
        <>
          <ContextMenuLabel first>Font</ContextMenuLabel>
          <div className="px-2 pb-1">
            <FontCategoryTiles
              value={document.style?.paragraph?.fontFamily}
              onChange={(cssValue) =>
                Patch({
                  style: {
                    ...document.style,
                    paragraph: { ...document.style?.paragraph, fontFamily: cssValue },
                  },
                })
              }
              variant="compact"
            />
          </div>
          <ContextMenuItem
            icon={<Type size={14} strokeWidth={1.75} className="text-[#5f5e59]" />}
            onClick={() => setStep("font")}
          >
            Change font
          </ContextMenuItem>
          <ContextMenuItem
            icon={<Palette size={14} strokeWidth={1.75} className="text-[#5f5e59]" />}
            onClick={() => setStep("theme")}
          >
            Theme
          </ContextMenuItem>
        </>
      ) : null}

      {Matches("copy page contents", "duplicate", "move to", "folder", "delete document") ? (
        <>
          <ContextMenuLabel>Page</ContextMenuLabel>
          {Matches("copy page contents") ? (
            <ContextMenuItem
              icon={<ClipboardCopy size={14} strokeWidth={1.75} className="text-[#5f5e59]" />}
              onClick={HandleCopyContents}
            >
              {copied ? "Copied!" : "Copy page contents"}
            </ContextMenuItem>
          ) : null}
          {Matches("duplicate") ? (
            <ContextMenuItem
              icon={<Copy size={14} strokeWidth={1.75} className="text-[#5f5e59]" />}
              onClick={HandleDuplicate}
            >
              Duplicate
            </ContextMenuItem>
          ) : null}
          {Matches("move to", "folder") ? (
            <ContextMenuItem
              icon={<FolderInput size={14} strokeWidth={1.75} className="text-[#5f5e59]" />}
              onClick={() => setStep("move")}
            >
              Move to
            </ContextMenuItem>
          ) : null}
          {Matches("delete document") ? (
            <ContextMenuItem
              icon={<Trash2 size={14} strokeWidth={1.75} />}
              onClick={HandleDelete}
              danger
            >
              {confirmingDelete ? "Confirm delete" : "Delete document"}
            </ContextMenuItem>
          ) : null}
        </>
      ) : null}

      {Matches("small text", "table of contents", "customize layout") ? (
        <>
          <ContextMenuLabel>Display</ContextMenuLabel>
          {Matches("small text") ? (
            <ContextMenuItem
              icon={<CaseSensitive size={14} strokeWidth={1.75} className="text-[#5f5e59]" />}
              onClick={() => UseDataStore.getState().ToggleDocumentSmallText(document.id)}
              selected={document.smallText}
            >
              Small text
            </ContextMenuItem>
          ) : null}
          {Matches("table of contents") ? (
            <ContextMenuItem
              icon={<List size={14} strokeWidth={1.75} className="text-[#5f5e59]" />}
              onClick={() => UseDataStore.getState().ToggleDocumentTableOfContents(document.id)}
              selected={document.showTableOfContents}
            >
              Table of contents
            </ContextMenuItem>
          ) : null}
          {Matches("customize layout") ? (
            <ContextMenuItem
              icon={<LayoutTemplate size={14} strokeWidth={1.75} className="text-[#5f5e59]" />}
              onClick={() => {}}
              disabled
            >
              Customize layout
            </ContextMenuItem>
          ) : null}
        </>
      ) : null}

      {Matches("lock page") ? (
        <>
          <ContextMenuLabel>Access</ContextMenuLabel>
          <ContextMenuItem
            icon={
              document.isLocked ? (
                <Lock size={14} strokeWidth={1.75} className="text-[#5f5e59]" />
              ) : (
                <LockOpen size={14} strokeWidth={1.75} className="text-[#5f5e59]" />
              )
            }
            onClick={() => UseDataStore.getState().ToggleDocumentLocked(document.id)}
            selected={document.isLocked}
          >
            Lock page
          </ContextMenuItem>
        </>
      ) : null}

      {Matches("import", "export") ? (
        <>
          <ContextMenuLabel>Data</ContextMenuLabel>
          {Matches("import") ? (
            <ContextMenuItem
              icon={<Upload size={14} strokeWidth={1.75} className="text-[#5f5e59]" />}
              onClick={() => importInputRef.current?.click()}
            >
              Import
            </ContextMenuItem>
          ) : null}
          {Matches("export") ? (
            <ContextMenuItem
              icon={<Download size={14} strokeWidth={1.75} className="text-[#5f5e59]" />}
              onClick={HandleExport}
            >
              Export
            </ContextMenuItem>
          ) : null}
          <input
            ref={importInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) HandleImportFile(file);
            }}
          />
        </>
      ) : null}
    </div>
  );
}
