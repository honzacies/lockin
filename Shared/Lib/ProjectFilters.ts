import type { Project } from "@lockin/shared/Types/Project";

export type ProgressBucket = "notStarted" | "inProgress" | "done";
export type DeadlineBucket = "overdue" | "today" | "week" | "month" | "later" | "none";
export type SortKey = "status" | "progress" | "priority" | "deadline" | "tag";

/** Filtry Your Projects — co je vyplněné, platí současně (AND). */
export interface ProjectFilter {
  status?: string;
  priority?: string;
  progress?: ProgressBucket;
  deadline?: DeadlineBucket;
  tagId?: string;
  /** Vlastní pole typu výběr: id pole → id volby; ano/ne: id pole → "true". */
  fields?: Record<string, string>;
}

export interface ProjectSort {
  key: SortKey;
  /** false = výchozí směr klíče (viz SortProjects), true = obrácený. */
  reversed: boolean;
}

export function ProgressBucketOf(progress: number): ProgressBucket {
  return progress >= 100 ? "done" : progress > 0 ? "inProgress" : "notStarted";
}

/** Do kdy je deadline vzhledem k `today` ("YYYY-MM-DD"). */
export function DeadlineBucketOf(deadline: string | null, today: string): DeadlineBucket {
  if (!deadline) return "none";
  if (deadline < today) return "overdue";
  if (deadline === today) return "today";
  const days = (Date.parse(deadline) - Date.parse(today)) / 86_400_000;
  return days <= 7 ? "week" : days <= 31 ? "month" : "later";
}

export function IsFilterEmpty(filter: ProjectFilter): boolean {
  return !filter.status && !filter.priority && !filter.progress && !filter.deadline && !filter.tagId && !Object.keys(filter.fields ?? {}).length;
}

export function FilterProjects(projects: Project[], filter: ProjectFilter, today: string): Project[] {
  return projects.filter((p) => {
    if (filter.status && p.status !== filter.status) return false;
    if (filter.priority && p.priority !== filter.priority) return false;
    if (filter.progress && ProgressBucketOf(p.progress) !== filter.progress) return false;
    if (filter.deadline && DeadlineBucketOf(p.deadline, today) !== filter.deadline) return false;
    if (filter.tagId && !p.tagIds.includes(filter.tagId)) return false;
    for (const [fieldId, wanted] of Object.entries(filter.fields ?? {})) {
      const value = p.fields?.[fieldId];
      const ok = Array.isArray(value) ? value.includes(wanted) : String(value ?? "") === wanted;
      if (!ok) return false;
    }
    return true;
  });
}

/**
 * Řazení. Výchozí směry: status a priorita podle pořadí voleb (priorita od
 * nejvyšší), progress od nejvyššího, deadline od nejbližšího, štítek podle
 * názvu prvního štítku. Projekty bez hodnoty jsou vždy na konci.
 */
export function SortProjects(
  projects: Project[],
  sort: ProjectSort,
  ctx: { statusOrder: string[]; priorityOrder: string[]; tagName: (id: string) => string },
): Project[] {
  const key = (p: Project): number | string | null => {
    switch (sort.key) {
      case "status": {
        const i = ctx.statusOrder.indexOf(p.status);
        return i === -1 ? null : i;
      }
      case "priority": {
        const i = ctx.priorityOrder.indexOf(p.priority);
        return i === -1 ? null : -i; // poslední volba (High) první
      }
      case "progress":
        return -p.progress;
      case "deadline":
        return p.deadline;
      case "tag": {
        const names = p.tagIds.map(ctx.tagName).filter(Boolean).sort((a, b) => a.localeCompare(b));
        return names[0] ?? null;
      }
    }
  };
  const dir = sort.reversed ? -1 : 1;
  return [...projects].sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    if (ka === null || kb === null) return ka === kb ? 0 : ka === null ? 1 : -1;
    const cmp = typeof ka === "number" && typeof kb === "number" ? ka - kb : String(ka).localeCompare(String(kb));
    return cmp * dir;
  });
}
