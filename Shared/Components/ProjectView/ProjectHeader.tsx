"use client";

import { ProjectUpdatedAt } from "@lockin/shared/Lib/CreateProject";
import { useEffect, useRef, useState } from "react";
import type { Project } from "@lockin/shared/Types/Project";
import { PriorityChip } from "@lockin/shared/Components/Shared/PriorityChip";
import { StatusChip } from "@lockin/shared/Components/Shared/StatusChip";
import { ProjectProgressBar } from "@lockin/shared/Components/Shared/ProjectProgressBar";
import { TagSelector } from "@lockin/shared/Components/Shared/TagSelector";
import { DefaultDocumentName } from "@lockin/shared/Lib/CreateDocument";
import { IconPicker } from "@lockin/shared/Components/Shared/IconPicker";
import { DeadlinePill, UpdatedPill } from "@lockin/shared/Components/Shared/MetaPills";
import { UseDataStore } from "@lockin/shared/Store/UseDataStore";

interface ProjectHeaderProps {
  project: Project;
  onUpdate: (patch: Partial<Project>) => void;
  /** Library's 600px side panel vs the full page — the *only* difference is
   * less outer padding; icon size, name size, and every row below render
   * completely identically either way, deliberately, so the panel reads as
   * "the same header, narrower container" rather than a distinct smaller
   * design that has to be kept in sync by hand. */
  compact?: boolean;
}

export function ProjectHeader({ project, onUpdate, compact = false }: ProjectHeaderProps) {
  const updatedAt = UseDataStore((s) => ProjectUpdatedAt(project, s.documents));
  const [nameDraft, setNameDraft] = useState(project.name);
  // ProjectHeader is no longer remounted when switching projects (see
  // ProjectView.tsx), so nameDraft needs its own reset here instead of
  // getting one for free from a fresh useState initializer.
  const projectIdRef = useRef(project.id);
  useEffect(() => {
    if (projectIdRef.current === project.id) return;
    projectIdRef.current = project.id;
    setNameDraft(project.name);
    // Only the project's identity should trigger this reset.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);
  function CommitName() {
    // Prázdný název = zpět na výchozí (ve vaultu jméno kořenového souboru); soubor se nepřejmenuje.
    const next = nameDraft.trim() || DefaultDocumentName(project.rootDocumentId);
    if (next !== project.name) onUpdate({ name: next });
    setNameDraft(next);
  }

  function HandlePriorityChange(priority: string) {
    onUpdate({ priority });
  }

  function HandleStatusChange(status: string) {
    onUpdate({ status });
  }

  function HandleProgressChange(progress: number) {
    onUpdate({ progress });
  }

  function HandleIconChange(icon: string | undefined) {
    onUpdate({ icon });
  }

  return (
    <div className={`flex flex-col gap-4 ${compact ? "px-4 pt-4" : "px-[50px] pt-8"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <UpdatedPill at={updatedAt} />
        <DeadlinePill
          date={project.deadline}
          time={project.deadlineTime ?? null}
          onChangeDate={(deadline) => onUpdate({ deadline })}
          onChangeTime={(deadlineTime) => onUpdate({ deadlineTime })}
        />
      </div>

      <div className="flex items-center gap-3">
        <IconPicker icon={project.icon} onChange={HandleIconChange} size={64} />

        {/* textarea, ne input — dlouhý název se zalomí místo useknutí */}
        <textarea
          rows={1}
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value.replace(/\n/g, " "))}
          onBlur={CommitName}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
          placeholder="Untitled"
          className="min-w-0 flex-1 resize-none overflow-hidden bg-transparent text-[40px] leading-[1.15] font-medium tracking-[-0.8px] text-black outline-none [field-sizing:content] placeholder:text-[var(--lk-faint)]"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <TagSelector
          tagIds={project.tagIds}
          onToggle={(tagId) => UseDataStore.getState().ToggleProjectTag(project.id, tagId)}
        />
        <PriorityChip priority={project.priority} onChange={HandlePriorityChange} />
        <StatusChip status={project.status} onChange={HandleStatusChange} />
        <ProjectProgressBar value={project.progress} onChange={HandleProgressChange} />
      </div>
    </div>
  );
}
