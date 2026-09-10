"use client";

import { useState } from "react";
import { Folder, Palette, Pencil, Star, Tag, Trash2 } from "lucide-react";
import { ContextMenuBackRow, ContextMenuItem, ContextMenuLabel } from "@lockin/shared/Components/Shared/ContextMenu";
import { IconPicker } from "@lockin/shared/Components/Shared/IconPicker";
import { TagColorPicker } from "@lockin/shared/Components/Shared/TagColorPicker";
import { UseDataStore } from "@lockin/shared/Store/UseDataStore";
import {
  RemoveByKind,
  SetIconByKind,
  ToggleFavoriteByKind,
  type LibraryItemKind,
} from "@lockin/shared/Lib/LibraryItemActions";

export type SidebarItemKind = LibraryItemKind;

// "Change icon"/"Change color" below nest another interactive control
// (IconPicker/TagColorPicker) inside the row — can't use ContextMenuItem
// there, since it renders a real <button> and nesting one inside another is
// invalid HTML (see DESIGN.md's HeroUI Button gotcha, same constraint).
const NESTED_ROW =
  "flex items-center gap-2.5 rounded-md px-2 py-1 text-[13px] font-medium text-[#2c2c2b] hover:bg-black/[0.04]";

interface SidebarItemMenuProps {
  kind: SidebarItemKind;
  id: string;
  close: () => void;
  onRenameStart: () => void;
}

/** Compact per-item context menu used by every Sidebar row AND the Library
 * table — the single shared implementation of "manage this item" for all
 * four item kinds. Capability matrix:
 *  - document: favorite, rename, icon, assign tag, assign folder, delete
 *  - project:  favorite, rename, icon, assign tag, assign folder, delete
 *              (delete cascades to its root document and every sub-document
 *              — see UseDataStore.ts's RemoveProject)
 *  - folder:   favorite, rename, icon, delete (folders don't carry tags)
 *  - tag:      favorite, rename, icon, delete (tags don't carry folders) */
export function SidebarItemMenu({ kind, id, close, onRenameStart }: SidebarItemMenuProps) {
  const [step, setStep] = useState<"root" | "tag" | "folder">("root");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const documents = UseDataStore((s) => s.documents);
  const projects = UseDataStore((s) => s.projects);
  const folders = UseDataStore((s) => s.folders);
  const tags = UseDataStore((s) => s.tags);
  const doc = kind === "document" ? documents[id] : undefined;
  const project = kind === "project" ? projects[id] : undefined;
  const folder = kind === "folder" ? folders[id] : undefined;
  const tag = kind === "tag" ? tags[id] : undefined;

  const isFavorite =
    doc?.isFavorite ?? project?.isFavorite ?? folder?.isFavorite ?? tag?.isFavorite ?? false;
  const currentIcon = doc?.icon ?? project?.icon ?? folder?.icon ?? tag?.icon;
  const currentTagIds = doc?.tagIds ?? project?.tagIds ?? [];
  const currentFolderId = doc?.folderId ?? project?.folderId ?? null;

  function HandleDelete() {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    RemoveByKind(kind, id);
    close();
  }

  function HandleToggleFavorite() {
    ToggleFavoriteByKind(kind, id);
  }

  function HandleIconChange(icon: string | undefined) {
    SetIconByKind(kind, id, icon);
  }

  function HandleToggleTag(tagId: string) {
    if (kind === "document") UseDataStore.getState().ToggleDocumentTag(id, tagId);
    if (kind === "project") UseDataStore.getState().ToggleProjectTag(id, tagId);
  }

  function HandleSetFolder(folderId: string | null) {
    if (kind === "document") UseDataStore.getState().SetDocumentFolder(id, folderId);
    if (kind === "project") UseDataStore.getState().SetProjectFolder(id, folderId);
    close();
  }

  if (step === "tag" && (kind === "document" || kind === "project")) {
    const tagList = Object.values(tags);
    return (
      <div className="flex max-h-64 flex-col gap-px overflow-y-auto">
        <ContextMenuBackRow onClick={() => setStep("root")} />
        {tagList.length === 0 ? (
          <div className="px-2 py-1 text-[13px] text-[#91918e]">No tags yet</div>
        ) : (
          tagList.map((t) => (
            <ContextMenuItem
              key={t.id}
              onClick={() => HandleToggleTag(t.id)}
              selected={currentTagIds.includes(t.id)}
            >
              {t.name}
            </ContextMenuItem>
          ))
        )}
      </div>
    );
  }

  if (step === "folder" && (kind === "document" || kind === "project")) {
    const folderList = Object.values(folders);
    return (
      <div className="flex max-h-64 flex-col gap-px overflow-y-auto">
        <ContextMenuBackRow onClick={() => setStep("root")} />
        <ContextMenuItem onClick={() => HandleSetFolder(null)} selected={!currentFolderId}>
          No folder
        </ContextMenuItem>
        {folderList.map((f) => (
          <ContextMenuItem
            key={f.id}
            onClick={() => HandleSetFolder(f.id)}
            selected={currentFolderId === f.id}
          >
            {f.name}
          </ContextMenuItem>
        ))}
      </div>
    );
  }

  return (
    <>
      <ContextMenuLabel first>Edit</ContextMenuLabel>
      <ContextMenuItem
        icon={
          <Star
            size={14}
            strokeWidth={1.75}
            className={isFavorite ? "fill-[#f5a623] text-[#f5a623]" : "text-[#5f5e59]"}
          />
        }
        onClick={() => {
          HandleToggleFavorite();
          close();
        }}
      >
        {isFavorite ? "Remove from favorites" : "Add to favorites"}
      </ContextMenuItem>
      <ContextMenuItem
        icon={<Pencil size={14} strokeWidth={1.75} className="text-[#5f5e59]" />}
        onClick={() => {
          onRenameStart();
          close();
        }}
      >
        Rename
      </ContextMenuItem>

      <div className={NESTED_ROW}>
        <Palette size={14} strokeWidth={1.75} className="text-[#5f5e59]" />
        <span className="flex-1 text-left">Change icon</span>
        <IconPicker icon={currentIcon} onChange={HandleIconChange} size={22} />
      </div>

      {kind === "tag" ? (
        <div className={NESTED_ROW}>
          <Palette size={14} strokeWidth={1.75} className="text-[#5f5e59]" />
          <span className="flex-1 text-left">Change color</span>
          <TagColorPicker
            color={tag?.color}
            onChange={(color) => UseDataStore.getState().SetTagColor(id, color)}
            size={20}
          />
        </div>
      ) : null}

      {kind === "document" || kind === "project" ? (
        <>
          <ContextMenuLabel>Organize</ContextMenuLabel>
          <ContextMenuItem icon={<Tag size={14} strokeWidth={1.75} className="text-[#5f5e59]" />} onClick={() => setStep("tag")}>
            Assign tag
          </ContextMenuItem>
          <ContextMenuItem
            icon={<Folder size={14} strokeWidth={1.75} className="text-[#5f5e59]" />}
            onClick={() => setStep("folder")}
          >
            Assign folder
          </ContextMenuItem>
        </>
      ) : null}

      <ContextMenuItem
        icon={<Trash2 size={14} strokeWidth={1.75} />}
        onClick={HandleDelete}
        danger
      >
        {confirmingDelete
          ? kind === "project"
            ? "Confirm delete (deletes all its documents too)"
            : "Confirm delete"
          : "Delete"}
      </ContextMenuItem>
    </>
  );
}
