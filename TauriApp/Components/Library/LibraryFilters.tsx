"use client";

import { Button, ButtonGroup, Dropdown } from "@heroui/react";
import { ChevronDown, Clock, FileText, Folder, Hash, Plus, Rocket, Star } from "lucide-react";
import type { LibraryFolder, LibraryTag } from "@/Types/Library";
import { IsSameFilterGroup, type LibraryFilter } from "@/Types/LibraryFilter";
import { UsePriorityStore } from "@/Store/UsePriorityStore";
import { UseDataStore } from "@/Store/UseDataStore";
import { Popover } from "@/Components/Shared/Popover";
import { ContextMenuItem } from "@/Components/Shared/ContextMenu";

interface LibraryFiltersProps {
  filter: LibraryFilter | null;
  onFilterChange: (filter: LibraryFilter | null) => void;
  folders: LibraryFolder[];
  tags: LibraryTag[];
  onCreateDocument: () => void;
  onCreateProject: () => void;
}

const PILL_BASE = "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm";
const PILL_ACTIVE = "bg-black/[0.05] text-[#2c2c2b]";
const PILL_INACTIVE = "text-[#5f5e59] hover:bg-black/[0.03]";
const CHEVRON_BUTTON = "flex items-center rounded-full px-2 py-1.5 text-[#5f5e59] hover:bg-black/[0.03]";
const NEW_BUTTON =
  "flex items-center gap-1.5 rounded-full bg-[#2c2c2b] px-3 py-1.5 text-sm font-medium text-white hover:bg-black";

export function LibraryFilters({
  filter,
  onFilterChange,
  folders,
  tags,
  onCreateDocument,
  onCreateProject,
}: LibraryFiltersProps) {
  const statuses = UsePriorityStore((s) => s.statuses);

  function TogglePill(next: LibraryFilter) {
    onFilterChange(filter && IsSameFilterGroup(filter, next) ? null : next);
  }

  function HandleNewFolder() {
    const folder = UseDataStore.getState().AddFolder();
    onFilterChange({ kind: "folder", id: folder.id });
  }

  function HandleNewTag() {
    const tag = UseDataStore.getState().AddTag();
    onFilterChange({ kind: "tag", id: tag.id });
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5">
        <Button
          variant="ghost"
          onPress={() => TogglePill({ kind: "recents" })}
          className={`h-auto font-normal ${PILL_BASE} ${filter?.kind === "recents" ? PILL_ACTIVE : PILL_INACTIVE}`}
        >
          <Clock size={16} strokeWidth={1.5} />
          Recents
        </Button>
        <Button
          variant="ghost"
          onPress={() => TogglePill({ kind: "favorites" })}
          className={`h-auto font-normal ${PILL_BASE} ${filter?.kind === "favorites" ? PILL_ACTIVE : PILL_INACTIVE}`}
        >
          <Star size={16} strokeWidth={1.5} />
          Favorites
        </Button>

        <ButtonGroup
          className={`rounded-full ${filter?.kind.startsWith("folder") ? PILL_ACTIVE : ""}`}
        >
          <Button
            variant="ghost"
            size="sm"
            onPress={() => TogglePill({ kind: "folder-all" })}
            className={`${PILL_BASE} ${filter?.kind.startsWith("folder") ? PILL_ACTIVE : PILL_INACTIVE}`}
          >
            <Folder size={16} strokeWidth={1.5} />
            Folders
          </Button>
          <Dropdown>
            <Dropdown.Trigger
              aria-label="Choose folder"
              className={`${CHEVRON_BUTTON} ${filter?.kind.startsWith("folder") ? PILL_ACTIVE : ""}`}
            >
              <ChevronDown size={14} strokeWidth={1.5} />
            </Dropdown.Trigger>
            <Dropdown.Popover>
              <Dropdown.Menu aria-label="Filter by folder">
                {folders.map((folder) => (
                  <Dropdown.Item
                    key={folder.id}
                    id={folder.id}
                    textValue={folder.name}
                    onAction={() => onFilterChange({ kind: "folder", id: folder.id })}
                  >
                    {folder.name}
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        </ButtonGroup>

        <ButtonGroup
          className={`rounded-full ${filter?.kind.startsWith("tag") ? PILL_ACTIVE : ""}`}
        >
          <Button
            variant="ghost"
            size="sm"
            onPress={() => TogglePill({ kind: "tag-all" })}
            className={`${PILL_BASE} ${filter?.kind.startsWith("tag") ? PILL_ACTIVE : PILL_INACTIVE}`}
          >
            <Hash size={16} strokeWidth={1.5} />
            Tags
          </Button>
          <Dropdown>
            <Dropdown.Trigger
              aria-label="Choose tag"
              className={`${CHEVRON_BUTTON} ${filter?.kind.startsWith("tag") ? PILL_ACTIVE : ""}`}
            >
              <ChevronDown size={14} strokeWidth={1.5} />
            </Dropdown.Trigger>
            <Dropdown.Popover>
              <Dropdown.Menu aria-label="Filter by tag">
                {tags.map((tag) => (
                  <Dropdown.Item
                    key={tag.id}
                    id={tag.id}
                    textValue={tag.name}
                    onAction={() => onFilterChange({ kind: "tag", id: tag.id })}
                  >
                    {tag.name}
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        </ButtonGroup>

        <ButtonGroup
          className={`rounded-full ${filter?.kind.startsWith("project") ? PILL_ACTIVE : ""}`}
        >
          <Button
            variant="ghost"
            size="sm"
            onPress={() => TogglePill({ kind: "project-all" })}
            className={`${PILL_BASE} ${filter?.kind.startsWith("project") ? PILL_ACTIVE : PILL_INACTIVE}`}
          >
            <Rocket size={16} strokeWidth={1.5} />
            Projects
          </Button>
          <Dropdown>
            <Dropdown.Trigger
              aria-label="Choose project status"
              className={`${CHEVRON_BUTTON} ${filter?.kind.startsWith("project") ? PILL_ACTIVE : ""}`}
            >
              <ChevronDown size={14} strokeWidth={1.5} />
            </Dropdown.Trigger>
            <Dropdown.Popover>
              <Dropdown.Menu aria-label="Filter by project status">
                {statuses.map((status) => (
                  <Dropdown.Item
                    key={status.id}
                    id={status.id}
                    textValue={status.label}
                    onAction={() => onFilterChange({ kind: "project", status: status.id })}
                  >
                    {status.label}
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        </ButtonGroup>
      </div>

      {filter?.kind.startsWith("folder") ? (
        <Button variant="ghost" onPress={HandleNewFolder} className={`h-auto font-medium ${NEW_BUTTON}`}>
          <Plus size={15} strokeWidth={1.75} />
          New folder
        </Button>
      ) : filter?.kind.startsWith("tag") ? (
        <Button variant="ghost" onPress={HandleNewTag} className={`h-auto font-medium ${NEW_BUTTON}`}>
          <Plus size={15} strokeWidth={1.75} />
          New tag
        </Button>
      ) : filter?.kind.startsWith("project") ? (
        <Button variant="ghost" onPress={onCreateProject} className={`h-auto font-medium ${NEW_BUTTON}`}>
          <Plus size={15} strokeWidth={1.75} />
          New project
        </Button>
      ) : (
        <Popover
          align="right"
          trigger={() => (
            <Button variant="ghost" className={`h-auto font-medium ${NEW_BUTTON}`}>
              <Plus size={15} strokeWidth={1.75} />
              New
            </Button>
          )}
          panelClassName="w-52 p-1"
        >
          {(close) => (
            <>
              <ContextMenuItem
                icon={<FileText size={14} strokeWidth={1.75} className="text-[#5f5e59]" />}
                onClick={() => {
                  onCreateDocument();
                  close();
                }}
              >
                New document
              </ContextMenuItem>
              <ContextMenuItem
                icon={<Folder size={14} strokeWidth={1.75} className="text-[#5f5e59]" />}
                onClick={() => {
                  HandleNewFolder();
                  close();
                }}
              >
                New folder
              </ContextMenuItem>
              <ContextMenuItem
                icon={<Hash size={14} strokeWidth={1.75} className="text-[#5f5e59]" />}
                onClick={() => {
                  HandleNewTag();
                  close();
                }}
              >
                New tag
              </ContextMenuItem>
              <ContextMenuItem
                icon={<Rocket size={14} strokeWidth={1.75} className="text-[#5f5e59]" />}
                onClick={() => {
                  onCreateProject();
                  close();
                }}
              >
                New project
              </ContextMenuItem>
            </>
          )}
        </Popover>
      )}
    </div>
  );
}
