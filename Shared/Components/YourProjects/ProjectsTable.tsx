"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Hash } from "lucide-react";
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
      <div className="flex items-center gap-4 user-select-none border-b border-[#f0efed] px-2.5 py-2 text-xs font-medium text-[#91918e]">
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
        className="flex cursor-pointer items-center gap-4 border-b border-[#f0efed]/60 px-2.5 py-2.5 text-sm hover:bg-black/[0.02]"
      >
        <span className="flex w-[220px] items-center gap-2 truncate font-medium text-[#2c2c2b]">
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
        <span className="w-[260px] select-none truncate text-[#2c2c2b]/80">
          {project.tag ? `A ${project.tag} project` : "—"}
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
        <span className="flex w-[150px] select-none items-center gap-1.5 text-xs text-[#5f5e59]">
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
        <div className="w-[130px] flex flex-row items-center justify-start">
          <span className="flex w-fit max-w-[130px] select-none items-center gap-1 rounded-xl bg-black/[0.03] px-2 py-1 text-xs font-medium text-[#2c2c2b]">
            <Hash size={12} strokeWidth={1.5} />
            {project.tag || "—"}
          </span>
        </div>
        <span className="flex-1 text-xs text-[#2c2c2b]/80">
          {FormatRelativeDate(project.lastEditedAt)}
        </span>
      </div>
    </ContextMenu>
  );
}
