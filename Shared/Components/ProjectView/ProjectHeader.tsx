"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Input } from "@heroui/react";
import { ChevronDown, Clock, Flag } from "lucide-react";
import type { Project } from "@lockin/shared/Types/Project";
import { PriorityChip } from "@lockin/shared/Components/Shared/PriorityChip";
import { StatusChip } from "@lockin/shared/Components/Shared/StatusChip";
import { ProjectProgressBar } from "@lockin/shared/Components/Shared/ProjectProgressBar";
import { Popover } from "@lockin/shared/Components/Shared/Popover";
import { ContextMenuItem } from "@lockin/shared/Components/Shared/ContextMenu";
import { IconPicker } from "@lockin/shared/Components/Shared/IconPicker";
import { DeadlinePickerPanel } from "@lockin/shared/Components/Shared/DeadlinePickerPanel";
import { FormatRelativeDate, FormatDeadlineLabel } from "@lockin/shared/Lib/FormatDate";
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
  const projects = UseDataStore((s) => s.projects);
  // Every distinct tag string already used by some project — picking from
  // this instead of free text is what keeps "web" from also existing as
  // "Web"/"webapp" typo-variants across projects.
  const existingTags = Array.from(
    new Set(Object.values(projects).map((p) => p.tag).filter(Boolean)),
  ).sort();

  function CommitName() {
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== project.name) onUpdate({ name: trimmed });
    else setNameDraft(project.name);
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
      <div className="flex items-center gap-4 text-xs text-[#91918e]">
        <span className="flex items-center gap-1">
          <Clock size={14} strokeWidth={1.5} />
          Last edited {FormatRelativeDate(project.lastEditedAt)}
        </span>

        <Popover
          trigger={() => (
            <Button
              variant="ghost"
              className="h-auto -mx-1 gap-1 rounded px-1 text-xs font-normal text-[#91918e] hover:bg-black/[0.03] hover:text-[#5f5e59]"
            >
              <Flag size={14} strokeWidth={1.5} />
              Deadline
              <span className="text-[#5f5e59]">
                {FormatDeadlineLabel(project.deadline, project.deadlineTime, 24)}
              </span>
            </Button>
          )}
        >
          {(close) => (
            <DeadlinePickerPanel
              date={project.deadline}
              time={project.deadlineTime ?? null}
              onChangeDate={(deadline) => onUpdate({ deadline })}
              onChangeTime={(deadlineTime) => onUpdate({ deadlineTime })}
              onDone={close}
            />
          )}
        </Popover>
      </div>

      <div className="flex items-end gap-3">
        <IconPicker icon={project.icon} onChange={HandleIconChange} size={64} />

        <Input
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={CommitName}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          placeholder="Untitled"
          className="bg-transparent shadow-none text-[40px] ring-0 w-fit font-medium tracking-[-0.8px] text-black outline-none"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Popover
          trigger={() => (
            <Button
              variant="ghost"
              className="h-auto gap-1 rounded-xl bg-black/[0.03] px-2 py-1 text-xs font-medium text-[#5f5e59]"
            >
              {project.tag || "No tag"}
              <ChevronDown size={12} strokeWidth={1.75} className="text-[#a5a49f]" />
            </Button>
          )}
          panelClassName="w-52 p-1"
        >
          {(close) => (
            <div className="flex flex-col gap-px">
              <ContextMenuItem
                onClick={() => {
                  onUpdate({ tag: "" });
                  close();
                }}
                selected={!project.tag}
              >
                No tag
              </ContextMenuItem>
              {existingTags.length === 0 ? (
                <p className="px-2.5 py-1.5 text-[13px] text-[#91918e]">
                  No tags used by any project yet
                </p>
              ) : (
                existingTags.map((tag) => (
                  <ContextMenuItem
                    key={tag}
                    onClick={() => {
                      onUpdate({ tag });
                      close();
                    }}
                    selected={project.tag === tag}
                  >
                    {tag}
                  </ContextMenuItem>
                ))
              )}
            </div>
          )}
        </Popover>
        <PriorityChip priority={project.priority} onChange={HandlePriorityChange} />
        <StatusChip status={project.status} onChange={HandleStatusChange} />
        <ProjectProgressBar value={project.progress} onChange={HandleProgressChange} />
      </div>
    </div>
  );
}
