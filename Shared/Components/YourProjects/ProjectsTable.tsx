"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar } from "lucide-react";
import { DEFAULT_TAG_COLOR } from "@lockin/shared/Types/Library";
import type { Project } from "@lockin/shared/Types/Project";
import { PriorityChip } from "@lockin/shared/Components/Shared/PriorityChip";
import { StatusChip } from "@lockin/shared/Components/Shared/StatusChip";
import { ProjectProgressBar } from "@lockin/shared/Components/Shared/ProjectProgressBar";
import { ProjectIcon } from "@lockin/shared/Components/Shared/ProjectIcon";
import { FavoriteStarButton } from "@lockin/shared/Components/Shared/FavoriteStarButton";
import { InlineRenameField } from "@lockin/shared/Components/Shared/InlineRenameField";
import { FormatRelativeDate } from "@lockin/shared/Lib/FormatDate";
import { UseDataStore } from "@lockin/shared/Store/UseDataStore";
import { ContextMenu } from "@lockin/shared/Components/Shared/ContextMenu";
import { SidebarItemMenu } from "@lockin/shared/Components/AppShell/SidebarItemMenu";

export const HEADER_CELLS = [
  { label: "Name", width: "w-[220px]" },
  { label: "Description", width: "w-[260px]" },
  { label: "State", width: "w-[140px]" },
  { label: "Priority", width: "w-[120px]" },
  { label: "Progress", width: "w-[160px]" },
  { label: "Deadline", width: "w-[150px]" },
  { label: "Tag", width: "w-[130px]" },
  { label: "Last edited", width: "flex-1" },
];

interface ProjectsTableProps {
  projects: Project[];
}

export function ProjectsTable({ projects }: ProjectsTableProps) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-4 user-select-none border-b border-[var(--lk-line)] px-2.5 py-2 text-xs font-medium text-[var(--lk-muted)]">
        {HEADER_CELLS.map((cell) => (
          <span key={cell.label} className={cell.width}>
            {cell.label}
          </span>
        ))}
      </div>
      {projects.map((project) => (
        <ProjectRow key={project.id} project={project} />
      ))}
    </div>
  );
}

function ProjectRow({ project }: { project: Project }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const description = UseDataStore((s) => s.documents[project.rootDocumentId]?.description ?? "");
  const allTags = UseDataStore((s) => s.tags);
  const tags = project.tagIds.map((id) => allTags[id]).filter(Boolean);

  return (
    <ContextMenu
      menu={(close) => (
        <SidebarItemMenu
          kind="project"
          id={project.id}
          close={close}
          onRenameStart={() => setEditing(true)}
        />
      )}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => router.push(`/YourProjects/Project?id=${project.id}`)}
        onKeyDown={(e) => {
          if (e.key === "Enter") router.push(`/YourProjects/Project?id=${project.id}`);
        }}
        className="group/row flex cursor-pointer items-center gap-4 border-b border-[var(--lk-line)]/60 px-2.5 py-2.5 text-sm hover:bg-black/[0.02]"
      >
        <span className="flex w-[220px] items-center gap-2 truncate font-medium text-[var(--lk-ink)]">
          <FavoriteStarButton
            isFavorite={project.isFavorite}
            onToggle={() => UseDataStore.getState().ToggleProjectFavorite(project.id)}
          />
          <ProjectIcon icon={project.icon} size={16} />
          <InlineRenameField
            value={project.name}
            editing={editing}
            onEditingChange={setEditing}
            onCommit={(name) => UseDataStore.getState().RenameProject(project.id, name)}
          />
        </span>
        <span className="w-[260px] select-none truncate text-[var(--lk-ink)]/80">
          {description || "—"}
        </span>
        <span className="w-[140px] select-none">
          <StatusChip status={project.status} size="md" />
        </span>
        <span className="w-[120px] select-none">
          <PriorityChip priority={project.priority} size="md" />
        </span>
        <span className="w-[160px] select-none">
          <ProjectProgressBar value={project.progress} />
        </span>
        <span className="flex w-[150px] select-none items-center gap-1.5 text-xs text-[var(--lk-text2)]">
          {project.deadline && (
            <>
              <Calendar size={14} strokeWidth={1.5} />
              {new Date(project.deadline).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </>
          )}
        </span>
        <div className="flex w-[130px] min-w-0 items-center">
          {tags.length ? (
            <span
              className="flex min-w-0 select-none items-center gap-1 rounded-xl bg-black/[0.03] px-2 py-1 text-xs font-medium text-[var(--lk-ink)]"
              title={tags.map((tag) => tag.name).join(", ")}
            >
              {tags.map((tag) => (
                <span key={tag.id} className="size-1.5 shrink-0 rounded-full" style={{ background: tag.color ?? DEFAULT_TAG_COLOR }} />
              ))}
              <span className="truncate">{tags.map((tag) => tag.name).join(", ")}</span>
            </span>
          ) : (
            <span className="select-none text-[var(--lk-muted)]">—</span>
          )}
        </div>
        <span className="flex-1 text-xs text-[var(--lk-ink)]/80">
          {FormatRelativeDate(project.lastEditedAt)}
        </span>
      </div>
    </ContextMenu>
  );
}
