"use client";

import { useState, type ReactNode } from "react";
import { Button, Input } from "@heroui/react";
import { ChevronDown, Clock, FileText, Folder, Hash, Plus, Rocket, Star } from "@lockin/shared/Components/Shared/UiIcons";
import { DEFAULT_TAG_COLOR, type LibraryFolder, type LibraryTag } from "@lockin/shared/Types/Library";
import { IsSameFilterGroup, type LibraryFilter } from "@lockin/shared/Types/LibraryFilter";
import { UsePriorityStore } from "@lockin/shared/Store/UsePriorityStore";
import { UseDataStore } from "@lockin/shared/Store/UseDataStore";
import { Popover } from "@lockin/shared/Components/Shared/Popover";
import { ContextMenuItem } from "@lockin/shared/Components/Shared/ContextMenu";
import { IconGlyph } from "@lockin/shared/Components/Shared/IconGlyph";
import { ManageOptionsButton, OptionIcon, PickerHeader } from "@lockin/shared/Components/Shared/PriorityStatusPicker";

interface LibraryFiltersProps {
  filter: LibraryFilter | null;
  onFilterChange: (filter: LibraryFilter | null) => void;
  folders: LibraryFolder[];
  tags: LibraryTag[];
  onCreateDocument: () => void;
  onCreateProject: () => void;
}

export const PILL_BASE = "h-auto min-w-0 gap-1.5 rounded-full px-3 py-1.5 text-sm font-normal";
export const PILL_ACTIVE = "bg-black/[0.05] text-[var(--lk-ink)]";
export const PILL_INACTIVE = "text-[var(--lk-text2)] hover:bg-black/[0.03]";
/** Tmavé „New" tlačítko vpravo nahoře — stejné v Library i Your Projects. */
export const NEW_BUTTON =
  "h-auto gap-1.5 rounded-full bg-[var(--lk-ink)] px-3 py-1.5 text-sm font-medium text-white hover:bg-black";
const ICON = { size: 14, strokeWidth: 1.75, className: "text-[var(--lk-text2)]" } as const;

/**
 * Skupina filtru: chip (klik = celá skupina) + šipka s výběrem konkrétní položky.
 * Aktivní stav je jedna společná vrstva pod oběma tlačítky — ta sama pozadí nemají.
 */
export function FilterGroup({
  active,
  label,
  icon,
  onToggle,
  menuLabel,
  children,
}: {
  active: boolean;
  label: ReactNode;
  icon: ReactNode;
  onToggle: () => void;
  menuLabel: string;
  children: (close: () => void) => ReactNode;
}) {
  return (
    // Jedna pilulka pro obě tlačítka, mezi nimi tenká čára. Focus ring má celá skupina, ne jednotlivá tlačítka.
    <div
      className={`flex items-center rounded-full transition-colors has-[[data-focus-visible=true]]:ring-2 has-[[data-focus-visible=true]]:ring-[#0088ff]/40 ${
        active ? PILL_ACTIVE : "hover:bg-black/[0.03]"
      }`}
    >
      <Button
        variant="ghost"
        onPress={onToggle}
        className={`${PILL_BASE} bg-transparent pr-2.5 shadow-none ring-0 outline-none hover:bg-transparent data-[focus-visible=true]:ring-0 ${
          active ? "text-[var(--lk-ink)]" : "text-[var(--lk-text2)]"
        }`}
      >
        {icon}
        {label}
      </Button>
      <span aria-hidden className="h-4 w-px shrink-0 bg-[var(--lk-line2)]" />
      <Popover
        panelClassName="w-56 p-1"
        trigger={() => (
          <Button
            variant="ghost"
            isIconOnly
            aria-label={menuLabel}
            className="h-8 w-8 min-w-0 rounded-full bg-transparent text-[var(--lk-text2)] shadow-none ring-0 outline-none hover:text-[var(--lk-ink)] data-[focus-visible=true]:ring-0"
          >
            <ChevronDown size={14} strokeWidth={1.5} />
          </Button>
        )}
      >
        {(close) => <div className="flex flex-col gap-px">{children(close)}</div>}
      </Popover>
    </div>
  );
}

export function LibraryFilters({
  filter,
  onFilterChange,
  folders,
  tags,
  onCreateDocument,
  onCreateProject,
}: LibraryFiltersProps) {
  const statuses = UsePriorityStore((s) => s.statuses);
  const priorities = UsePriorityStore((s) => s.priorities);
  const [tagDraft, setTagDraft] = useState("");

  function TogglePill(next: LibraryFilter) {
    onFilterChange(filter && IsSameFilterGroup(filter, next) ? null : next);
  }

  /** Výběr položky: znovu klik na vybranou filtr zruší. */
  function Pick(next: LibraryFilter, close: () => void) {
    onFilterChange(JSON.stringify(filter) === JSON.stringify(next) ? null : next);
    close();
  }

  function HandleNewFolder() {
    const folder = UseDataStore.getState().AddFolder();
    onFilterChange({ kind: "folder", id: folder.id });
  }

  function HandleNewTag() {
    const tag = UseDataStore.getState().AddTag();
    onFilterChange({ kind: "tag", id: tag.id });
  }

  function CreateTagFromDraft(close: () => void) {
    const name = tagDraft.trim();
    if (!name) return;
    const store = UseDataStore.getState();
    const existing = Object.values(store.tags).find((t) => t.name.toLowerCase() === name.toLowerCase());
    const id = existing?.id ?? store.AddTag().id;
    if (!existing) store.RenameTag(id, name);
    setTagDraft("");
    onFilterChange({ kind: "tag", id });
    close();
  }

  const folderActive = Boolean(filter?.kind.startsWith("folder"));
  const tagActive = Boolean(filter?.kind.startsWith("tag"));
  const projectActive = Boolean(filter?.kind.startsWith("project"));

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          variant="ghost"
          onPress={() => TogglePill({ kind: "recents" })}
          className={`${PILL_BASE} ${filter?.kind === "recents" ? PILL_ACTIVE : PILL_INACTIVE}`}
        >
          <Clock size={16} strokeWidth={1.5} />
          Recents
        </Button>
        <Button
          variant="ghost"
          onPress={() => TogglePill({ kind: "favorites" })}
          className={`${PILL_BASE} ${filter?.kind === "favorites" ? PILL_ACTIVE : PILL_INACTIVE}`}
        >
          <Star size={16} strokeWidth={1.5} />
          Favorites
        </Button>

        <FilterGroup
          active={folderActive}
          label="Folders"
          icon={<Folder size={16} strokeWidth={1.5} />}
          onToggle={() => TogglePill({ kind: "folder-all" })}
          menuLabel="Choose folder"
        >
          {(close) => (
            <>
              <PickerHeader title="Available folders" />
              {folders.length === 0 ? (
                <p className="px-2 py-1 text-[13px] text-[var(--lk-muted)]">No folders yet</p>
              ) : (
                folders.map((folder) => (
                  <ContextMenuItem
                    key={folder.id}
                    icon={folder.icon ? <IconGlyph icon={folder.icon} size={14} /> : <Folder {...ICON} />}
                    selected={filter?.kind === "folder" && filter.id === folder.id}
                    onClick={() => Pick({ kind: "folder", id: folder.id }, close)}
                  >
                    {folder.name.split("/").pop() || folder.name}
                  </ContextMenuItem>
                ))
              )}
            </>
          )}
        </FilterGroup>

        <FilterGroup
          active={tagActive}
          label="Tags"
          icon={<Hash size={16} strokeWidth={1.5} />}
          onToggle={() => TogglePill({ kind: "tag-all" })}
          menuLabel="Choose tag"
        >
          {(close) => (
            <>
              <PickerHeader title="Your tags" />
              {tags.map((tag) => (
                <ContextMenuItem
                  key={tag.id}
                  icon={<span className="size-2.5 shrink-0 rounded-full" style={{ background: tag.color ?? DEFAULT_TAG_COLOR }} />}
                  selected={filter?.kind === "tag" && filter.id === tag.id}
                  onClick={() => Pick({ kind: "tag", id: tag.id }, close)}
                >
                  {tag.name}
                </ContextMenuItem>
              ))}
              <div className="mt-1 flex items-center gap-1 border-t border-[var(--lk-line)] px-1 pt-1.5">
                <Input
                  value={tagDraft}
                  onChange={(e) => setTagDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") CreateTagFromDraft(close);
                  }}
                  placeholder="New tag…"
                  aria-label="New tag name"
                  className="h-7 min-w-0 flex-1 rounded-md bg-transparent px-1.5 text-[13px] shadow-none"
                />
                <Button
                  variant="ghost"
                  isIconOnly
                  aria-label="Create tag"
                  isDisabled={!tagDraft.trim()}
                  onPress={() => CreateTagFromDraft(close)}
                  className="h-7 w-7 min-w-0 rounded-md text-[var(--lk-muted)] hover:bg-black/[0.06] hover:text-[var(--lk-ink)]"
                >
                  <Plus size={14} strokeWidth={1.75} />
                </Button>
              </div>
            </>
          )}
        </FilterGroup>

        <FilterGroup
          active={projectActive}
          label="Projects"
          icon={<Rocket size={16} strokeWidth={1.5} />}
          onToggle={() => TogglePill({ kind: "project-all" })}
          menuLabel="Filter projects by status or priority"
        >
          {(close) => (
            <>
              <PickerHeader title="Available statuses" action={<ManageOptionsButton label="Manage statuses" onNavigate={close} />} />
              {statuses.map((status) => (
                <ContextMenuItem
                  key={status.id}
                  icon={<OptionIcon option={status} />}
                  selected={filter?.kind === "project" && filter.status === status.id}
                  onClick={() => Pick({ kind: "project", status: status.id }, close)}
                >
                  {status.label}
                </ContextMenuItem>
              ))}
              <div className="pt-1.5">
                <PickerHeader title="Available priorities" />
              </div>
              {priorities.map((priority) => (
                <ContextMenuItem
                  key={priority.id}
                  icon={<OptionIcon option={priority} />}
                  selected={filter?.kind === "project" && filter.priority === priority.id}
                  onClick={() => Pick({ kind: "project", priority: priority.id }, close)}
                >
                  {priority.label}
                </ContextMenuItem>
              ))}
            </>
          )}
        </FilterGroup>
      </div>

      {folderActive ? (
        <Button variant="ghost" onPress={HandleNewFolder} className={NEW_BUTTON}>
          <Plus size={15} strokeWidth={1.75} />
          New folder
        </Button>
      ) : tagActive ? (
        <Button variant="ghost" onPress={HandleNewTag} className={NEW_BUTTON}>
          <Plus size={15} strokeWidth={1.75} />
          New tag
        </Button>
      ) : projectActive ? (
        <Button variant="ghost" onPress={onCreateProject} className={NEW_BUTTON}>
          <Plus size={15} strokeWidth={1.75} />
          New project
        </Button>
      ) : (
        <Popover
          align="right"
          trigger={() => (
            <Button variant="ghost" className={NEW_BUTTON}>
              <Plus size={15} strokeWidth={1.75} />
              New
            </Button>
          )}
          panelClassName="w-52 p-1"
        >
          {(close) => (
            <div className="flex flex-col gap-px">
              <ContextMenuItem
                icon={<FileText {...ICON} />}
                onClick={() => {
                  onCreateDocument();
                  close();
                }}
              >
                New document
              </ContextMenuItem>
              <ContextMenuItem
                icon={<Folder {...ICON} />}
                onClick={() => {
                  HandleNewFolder();
                  close();
                }}
              >
                New folder
              </ContextMenuItem>
              <ContextMenuItem
                icon={<Hash {...ICON} />}
                onClick={() => {
                  HandleNewTag();
                  close();
                }}
              >
                New tag
              </ContextMenuItem>
              <ContextMenuItem
                icon={<Rocket {...ICON} />}
                onClick={() => {
                  onCreateProject();
                  close();
                }}
              >
                New project
              </ContextMenuItem>
            </div>
          )}
        </Popover>
      )}
    </div>
  );
}
