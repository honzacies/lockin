"use client";

import { useEffect, useState } from "react";
import { Input } from "@heroui/react";
import { ChevronDown, FolderOpen, HardDrive, Trash2 } from "lucide-react";
import { Popover } from "@lockin/shared/Components/Shared/Popover";
import { ContextMenuItem, ContextMenuLabel } from "@lockin/shared/Components/Shared/ContextMenu";
import { IconPicker } from "@lockin/shared/Components/Shared/IconPicker";
import { GetPlatform } from "@lockin/shared/Platform/Platform";
import {
  ActiveWorkspace,
  AddFolderWorkspace,
  DEFAULT_WORKSPACE,
  ListWorkspaces,
  RemoveWorkspace,
  SwitchWorkspace,
  UpdateWorkspace,
  type Workspace,
} from "@lockin/shared/Lib/Workspace";

/** Ikona workspacu — nahraný obrázek, emoji, nebo první písmeno na modrém čtverci. */
function WorkspaceBadge({ workspace, size = 25 }: { workspace: Workspace; size?: number }) {
  if (workspace.icon?.startsWith("data:")) {
    // eslint-disable-next-line @next/next/no-img-element -- small inline data-URL avatar
    return <img src={workspace.icon} alt="" className="shrink-0 rounded-[4px] object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-[4px] bg-[#0088ff] font-semibold text-white"
      style={{ width: size, height: size, fontSize: workspace.icon ? size * 0.7 : size * 0.56, background: workspace.icon ? "transparent" : undefined }}
    >
      {workspace.icon ?? workspace.name.charAt(0).toUpperCase()}
    </div>
  );
}

/** Přepínač workspaců v hlavičce sidebaru. Výchozí je in-app úložiště; na
 * desktopu jde přidat složku (.md soubory, třeba Obsidian vault). */
export function WorkspaceSwitcher() {
  // localStorage až po mountu — statický export se prerenderuje bez něj.
  const [active, setActive] = useState<Workspace>(DEFAULT_WORKSPACE);
  const [list, setList] = useState<Workspace[]>([DEFAULT_WORKSPACE]);
  const [path, setPath] = useState("");
  const canOpenFolder = GetPlatform().window.isAvailable;

  function Refresh() {
    setActive(ActiveWorkspace());
    setList(ListWorkspaces());
  }
  useEffect(Refresh, []);

  function Open(workspace: Workspace) {
    if (workspace.id !== active.id) SwitchWorkspace(workspace.id);
  }

  return (
    <Popover
      panelClassName="w-64 p-1"
      trigger={(open) => (
        <button
          type="button"
          className={`flex items-center gap-[5px] rounded-md px-[5px] py-1 ${open ? "bg-black/[0.05]" : "hover:bg-black/[0.03]"}`}
        >
          <WorkspaceBadge workspace={active} />
          <p className="max-w-[150px] truncate text-[16px] font-semibold tracking-[-0.32px] text-black">{active.name}</p>
          <ChevronDown size={16} className="text-[#91918e]" />
        </button>
      )}
    >
      {(close) => (
        <div className="flex flex-col gap-px">
          <div className="flex items-center gap-2 px-2 py-1.5">
            <IconPicker
              icon={active.icon}
              size={28}
              glyphScale={0.7}
              onChange={(icon) => {
                UpdateWorkspace(active.id, { icon });
                Refresh();
              }}
            />
            <span className="truncate text-[13px] font-medium text-[#5f5e59]">Change icon</span>
          </div>

          <ContextMenuLabel>Workspaces</ContextMenuLabel>
          {list.map((workspace) => (
            <div key={workspace.id} className="group/ws flex items-center">
              <div className="flex-1">
                <ContextMenuItem
                  icon={<WorkspaceBadge workspace={workspace} size={18} />}
                  selected={workspace.id === active.id}
                  onClick={() => {
                    close();
                    Open(workspace);
                  }}
                >
                  {workspace.name}
                </ContextMenuItem>
              </div>
              {workspace.path && workspace.id !== active.id ? (
                <button
                  type="button"
                  aria-label={`Remove ${workspace.name}`}
                  onClick={() => {
                    RemoveWorkspace(workspace.id);
                    Refresh();
                  }}
                  className="hidden rounded p-1 text-[#91918e] hover:bg-black/[0.05] hover:text-[#e5484d] group-hover/ws:block"
                >
                  <Trash2 size={13} />
                </button>
              ) : null}
            </div>
          ))}

          {canOpenFolder ? (
            <>
              <ContextMenuLabel>Open folder</ContextMenuLabel>
              <div className="flex items-center gap-1.5 px-2 pb-1.5">
                <FolderOpen size={14} strokeWidth={1.75} className="shrink-0 text-[#5f5e59]" />
                <Input
                  value={path}
                  placeholder="D:\Notes"
                  onChange={(e) => setPath(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter" || !path.trim()) return;
                    SwitchWorkspace(AddFolderWorkspace(path).id);
                  }}
                  className="w-full rounded-lg border border-[#d9d9d9] bg-white px-1.5 py-0.5 text-[13px] text-[#2c2c2b] outline-none focus:border-[#0485f7]"
                />
              </div>
            </>
          ) : null}

          {active.path ? (
            <p className="flex items-center gap-1.5 truncate px-2 pb-1 text-[11px] text-[#91918e]">
              <HardDrive size={11} className="shrink-0" />
              {active.path}
            </p>
          ) : null}
        </div>
      )}
    </Popover>
  );
}
