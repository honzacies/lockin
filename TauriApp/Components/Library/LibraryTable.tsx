"use client";

import { useState } from "react";
import { FileText, Folder, Hash, Rocket } from "lucide-react";
import type { LibraryRow, LibrarySource } from "@/Types/LibraryRow";
import { FormatRelativeDate } from "@/Lib/FormatDate";
import { ProjectIcon } from "@/Components/Shared/ProjectIcon";
import { FavoriteStarButton } from "@/Components/Shared/FavoriteStarButton";
import { InlineRenameField } from "@/Components/Shared/InlineRenameField";
import { DEFAULT_TAG_COLOR } from "@/Types/Library";
import { ContextMenu } from "@/Components/Shared/ContextMenu";
import { SidebarItemMenu } from "@/Components/AppShell/SidebarItemMenu";
import { RenameByKind, ToggleFavoriteByKind } from "@/Lib/LibraryItemActions";

export const HEADER_CELLS = [
  { label: "Name", width: "w-[260px]" },
  { label: "Description", width: "w-[300px]" },
  { label: "Source", width: "w-[150px]" },
  { label: "Type", width: "w-[130px]" },
  { label: "Size", width: "w-[100px]" },
  { label: "Created at", width: "w-[110px]" },
  { label: "Last edited at", width: "flex-1" },
];

const KIND_ICON = {
  document: FileText,
  folder: Folder,
  tag: Hash,
  project: Rocket,
};

const SOURCE_ICON: Record<LibrarySource["kind"], typeof Folder> = {
  folder: Folder,
  tag: Hash,
  project: Rocket,
};

const KIND_LABEL: Record<LibraryRow["kind"], string> = {
  document: "Document",
  folder: "Folder",
  tag: "Tag",
  project: "Project",
};

interface LibraryTableProps {
  rows: LibraryRow[];
  onOpenRow: (row: LibraryRow) => void;
}

export function LibraryTable({ rows, onOpenRow }: LibraryTableProps) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-4 border-b border-[#f0efed] px-2.5 py-2 text-xs font-medium text-[#91918e]">
        {HEADER_CELLS.map((cell) => (
          <span key={cell.label} className={cell.width}>
            {cell.label}
          </span>
        ))}
      </div>
      {rows.length === 0 && (
        <div className="px-2.5 py-6 text-sm text-[#91918e]">Nothing here yet.</div>
      )}
      {rows.map((row) => (
        <LibraryRowView key={`${row.kind}-${row.id}`} row={row} onOpenRow={onOpenRow} />
      ))}
    </div>
  );
}

function LibraryRowView({
  row,
  onOpenRow,
}: {
  row: LibraryRow;
  onOpenRow: (row: LibraryRow) => void;
}) {
  const Icon = KIND_ICON[row.kind];
  const [editing, setEditing] = useState(false);

  return (
    <ContextMenu
      menu={(close) => (
        <SidebarItemMenu
          kind={row.kind}
          id={row.id}
          close={close}
          onRenameStart={() => setEditing(true)}
        />
      )}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => onOpenRow(row)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onOpenRow(row);
        }}
        className="flex cursor-pointer items-center gap-4 border-b border-[#f0efed]/60 px-2.5 py-2.5 text-left text-sm hover:bg-black/[0.02]"
      >
        <span className="flex w-[260px] items-center gap-2 truncate">
          <FavoriteStarButton
            isFavorite={row.isFavorite}
            onToggle={() => ToggleFavoriteByKind(row.kind, row.id)}
          />
          {row.icon ? (
            <ProjectIcon icon={row.icon} size={16} />
          ) : (
            <Icon
              size={16}
              strokeWidth={1.5}
              className={`shrink-0 ${row.kind === "tag" ? "" : "text-[#91918e]"}`}
              style={row.kind === "tag" ? { color: row.color ?? DEFAULT_TAG_COLOR } : undefined}
            />
          )}
          <InlineRenameField
            value={row.name}
            editing={editing}
            onEditingChange={setEditing}
            onCommit={(name) => RenameByKind(row.kind, row.id, name)}
            viewClassName="truncate rounded px-0.5 font-medium text-[#2c2c2b] hover:bg-black/[0.04]"
          />
          <span className="flex shrink-0 items-center gap-1 rounded-2xl bg-black/[0.03] px-1.5 py-0.5 text-[10px] font-medium text-[#7d7a75]">
            OPEN
          </span>
        </span>
        <span className="w-[300px] truncate text-[#2c2c2b]/80">{row.description || "—"}</span>
        <span className="flex w-[150px] flex-wrap items-center gap-1">
          {row.sources.length === 0 ? (
            <span className="text-[#91918e]">—</span>
          ) : (
            row.sources.map((source, index) => {
              const SourceIcon = SOURCE_ICON[source.kind];
              return (
                <span
                  key={`${source.kind}-${index}`}
                  className={`flex w-fit items-center gap-1 rounded-lg bg-black/[0.03] px-2 py-1 text-xs ${
                    source.kind === "tag" ? "" : "text-[#5f5e59]"
                  }`}
                  style={source.kind === "tag" ? { color: source.color ?? DEFAULT_TAG_COLOR } : undefined}
                >
                  <SourceIcon size={12} strokeWidth={1.5} />
                  {source.label}
                </span>
              );
            })
          )}
        </span>
        <span className="w-[130px]">
          <span className="flex w-fit items-center gap-1 rounded-xl bg-black/[0.03] px-2 py-1 text-xs font-medium text-[#2c2c2b]">
            <Icon
              size={12}
              strokeWidth={1.5}
              style={row.kind === "tag" ? { color: row.color ?? DEFAULT_TAG_COLOR } : undefined}
            />
            {KIND_LABEL[row.kind]}
          </span>
        </span>
        <span className="w-[100px] text-xs text-[#5f5e59]">{row.sizeLabel}</span>
        <span className="w-[110px] text-xs text-[#2c2c2b]/80">
          {FormatRelativeDate(row.createdAt)}
        </span>
        <span className="flex-1 text-xs text-[#2c2c2b]/80">
          {FormatRelativeDate(row.updatedAt)}
        </span>
      </div>
    </ContextMenu>
  );
}
