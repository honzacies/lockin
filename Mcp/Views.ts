import type { DocumentRecord, Project } from "@lockin/shared/Types/Project";
import type { TodoTask } from "@lockin/shared/Types/QuickNotes";
import type { FocusColumn, FocusTask } from "@lockin/shared/Store/UseFocusStore";
import { FindLists, SourceKey } from "@lockin/shared/Lib/CollectTodoSources";
import { DocToMarkdown } from "@lockin/shared/Lib/Markdown";
import type { WorkspaceData } from "./Data";

/** Odkaz na úkol v listu — přesně tohle berou zapisovací nástroje. */
export interface TaskRef {
  docId: string | null;
  listId: string;
  taskId: string;
}

export interface TaskView {
  ref: TaskRef;
  title: string;
  description?: string;
  done: boolean;
  list: string;
  group?: string;
  document: string;
  project?: string;
  deadline?: string | null;
  /** Když je úkol i na boardu: sloupec a ID karty. */
  board?: { column: FocusColumn; boardTaskId: string; done: boolean };
}

const COLUMN_LABEL: Record<FocusColumn, string> = { backlog: "Backlog", week: "This week", today: "Today" };

function ProjectOf(data: WorkspaceData, doc: DocumentRecord): Project | undefined {
  return doc.projectId ? data.projects[doc.projectId] : undefined;
}

/** Všechny úkoly ze všech listů (dokumenty + Quick Notes), s napojením na board. */
export function AllTasks(data: WorkspaceData): TaskView[] {
  const onBoard = new Map(data.board.tasks.filter((t) => t.source).map((t) => [t.source!.key, t]));
  const out: TaskView[] = [];
  const Push = (base: Omit<TaskView, "ref" | "title" | "description" | "done" | "group" | "board">, docId: string | null, listId: string, task: TodoTask, group?: string) => {
    const card = onBoard.get(SourceKey(listId, task.id));
    out.push({
      ...base,
      ref: { docId, listId, taskId: task.id },
      title: task.title,
      ...(task.description ? { description: task.description } : {}),
      done: task.done,
      ...(group ? { group } : {}),
      ...(card ? { board: { column: card.column, boardTaskId: card.id, done: card.done } } : {}),
    });
  };
  for (const doc of data.documents) {
    const project = ProjectOf(data, doc);
    for (const list of FindLists(doc.id, doc.text?.json)) {
      const base = {
        list: list.title,
        document: doc.name || "Untitled",
        ...(project ? { project: project.name } : {}),
        deadline: list.kind === "card" ? ((list.node.attrs?.config as { deadline?: string | null })?.deadline ?? null) : null,
      };
      for (const task of list.tasks) Push(base, doc.id, list.id, task);
      for (const group of list.groups ?? []) for (const task of group.tasks) Push(base, doc.id, list.id, task, group.title);
    }
  }
  for (const list of data.quickLists) {
    const base = { list: list.title, document: "Quick Notes", deadline: list.deadline };
    for (const task of list.tasks) Push(base, null, list.id, task);
    for (const group of list.groups ?? []) for (const task of group.tasks) Push(base, null, list.id, task, group.title);
  }
  return out;
}

/** To-do Home v textu: projekty, jejich listy a progres. */
export function Overview(data: WorkspaceData) {
  const tasks = AllTasks(data);
  const byProject = new Map<string, TaskView[]>();
  for (const t of tasks) {
    const key = t.project ?? (t.document === "Quick Notes" ? "(Quick Notes)" : "(Other documents)");
    byProject.set(key, [...(byProject.get(key) ?? []), t]);
  }
  const label = (list: { id: string; label: string }[], id: string) => list.find((o) => o.id === id)?.label ?? id;
  const open = tasks.filter((t) => !t.done).length;
  return {
    workspace: data.workspace.name,
    totals: { open, done: tasks.length - open, progress: tasks.length ? Math.round(((tasks.length - open) / tasks.length) * 100) : 0 },
    board: Object.fromEntries(
      (["today", "week", "backlog"] as FocusColumn[]).map((c) => [COLUMN_LABEL[c], data.board.tasks.filter((t) => t.column === c && !t.done).length]),
    ),
    projects: [...byProject.entries()]
      .map(([name, list]) => {
        const project = Object.values(data.projects).find((p) => p.name === name);
        const openHere = list.filter((t) => !t.done).length;
        const lists = new Map<string, { open: number; done: number }>();
        for (const t of list) {
          const key = `${t.list} — ${t.document}`;
          const entry = lists.get(key) ?? { open: 0, done: 0 };
          entry[t.done ? "done" : "open"]++;
          lists.set(key, entry);
        }
        return {
          name,
          ...(project ? { status: label(data.statuses, project.status), priority: label(data.priorities, project.priority), deadline: project.deadline } : {}),
          open: openHere,
          done: list.length - openHere,
          progress: Math.round(((list.length - openHere) / list.length) * 100),
          lists: [...lists.entries()].map(([list, c]) => ({ list, ...c })),
        };
      })
      .sort((a, b) => b.open - a.open),
  };
}

/** Board (Backlog / This week / Today) v pořadí, jak ho vidí uživatel. */
export function Board(data: WorkspaceData) {
  const groups = new Map(data.board.groups.map((g) => [g.id, g]));
  const Card = (t: FocusTask) => ({
    boardTaskId: t.id,
    title: t.title,
    done: t.done,
    ...(t.groupId && groups.get(t.groupId) ? { group: groups.get(t.groupId)!.title } : {}),
    ...(t.source ? { from: t.source.label } : {}),
    ...(t.estimateMin ? { estimateMin: t.estimateMin } : {}),
    ...(t.spentSec ? { spentMin: Math.round(t.spentSec / 60) } : {}),
  });
  const Column = (c: FocusColumn) => {
    const own = data.board.tasks.filter((t) => t.column === c);
    const groupIds = data.board.groups.filter((g) => g.column === c).map((g) => g.id);
    return [...own.filter((t) => !t.groupId || !groupIds.includes(t.groupId)), ...groupIds.flatMap((id) => own.filter((t) => t.groupId === id))].map(Card);
  };
  const today = Column("today");
  return {
    running: data.board.runningSince !== null,
    current: today.find((t) => !t.done) ?? null,
    Today: today,
    "This week": Column("week"),
    Backlog: Column("backlog"),
  };
}

export function FilterTasks(data: WorkspaceData, filter: { project?: string; query?: string; status?: "open" | "done" | "all"; limit?: number }) {
  const q = filter.query?.toLowerCase();
  const p = filter.project?.toLowerCase();
  return AllTasks(data)
    .filter((t) => (filter.status ?? "open") === "all" || (filter.status === "done" ? t.done : !t.done))
    .filter((t) => !p || (t.project ?? t.document).toLowerCase().includes(p))
    .filter((t) => !q || [t.title, t.description, t.list, t.group, t.document].some((s) => s?.toLowerCase().includes(q)))
    .slice(0, filter.limit ?? 50);
}

/**
 * Strategický výběr: co udělat dál a proč. Body za board (Today > This week >
 * Backlog), blížící se deadline listu, prioritu a stav projektu a za úkoly,
 * které dotáhnou skoro hotový list. Hotové projekty se přeskočí.
 */
export function Next(data: WorkspaceData, limit = 5) {
  const now = Date.now();
  const tasks = AllTasks(data).filter((t) => !t.done && !(t.board?.done));
  const listStats = new Map<string, { open: number; total: number }>();
  for (const t of AllTasks(data)) {
    const s = listStats.get(t.ref.listId) ?? { open: 0, total: 0 };
    s.total++;
    if (!t.done) s.open++;
    listStats.set(t.ref.listId, s);
  }
  const projectByName = new Map(Object.values(data.projects).map((p) => [p.name, p]));
  const docUpdated = new Map(data.documents.map((d) => [d.id, d.updatedAt]));
  // Pořadí otevřených úkolů v listu — první nehotový je „další na řadě".
  const openIndex = new Map<string, number>();
  const seenPerList = new Map<string, number>();
  for (const t of tasks) {
    const n = seenPerList.get(t.ref.listId) ?? 0;
    openIndex.set(`${t.ref.listId}:${t.ref.taskId}`, n);
    seenPerList.set(t.ref.listId, n + 1);
  }
  const doneStatus = data.statuses.find((s) => /done|finished|hotov/i.test(s.label))?.id ?? "done";
  const activeStatus = data.statuses.find((s) => /progress|rozprac/i.test(s.label))?.id ?? "in-progress";

  const scored = tasks.flatMap((t) => {
    const reasons: string[] = [];
    let score = 0;
    const project = t.project ? projectByName.get(t.project) : undefined;
    if (project?.status === doneStatus) return [];
    if (t.board) {
      const bonus = { today: 100, week: 60, backlog: 30 }[t.board.column];
      score += bonus;
      reasons.push(`on the board in ${COLUMN_LABEL[t.board.column]}`);
    }
    const deadline = t.deadline ?? project?.deadline;
    if (deadline) {
      const days = Math.ceil((new Date(deadline).getTime() - now) / 86400000);
      if (days < 0) (score += 60), reasons.push(`overdue by ${-days} day${days === -1 ? "" : "s"}`);
      else if (days <= 3) (score += 40), reasons.push(`deadline in ${days} day${days === 1 ? "" : "s"}`);
      else if (days <= 7) (score += 25), reasons.push(`deadline this week (${days} days)`);
      else if (days <= 14) (score += 10), reasons.push(`deadline in ${days} days`);
    }
    if (project) {
      const rank = data.priorities.findIndex((p) => p.id === project.priority);
      if (rank > 0) {
        score += Math.round((15 * rank) / Math.max(1, data.priorities.length - 1));
        reasons.push(`${data.priorities[rank].label.toLowerCase()} priority project`);
      }
      if (project.status === activeStatus) (score += 10), reasons.push("project is in progress");
    }
    const stats = listStats.get(t.ref.listId);
    if (stats && stats.total >= 3 && stats.open <= 2) (score += 12), reasons.push(`finishes the "${t.list}" list (${stats.open} left)`);
    else if (stats && stats.open < stats.total) {
      // Rozdělaný list = momentum; čím víc hotovo, tím víc bodů.
      score += Math.round(((stats.total - stats.open) / stats.total) * 10);
      reasons.push(`"${t.list}" is ${Math.round(((stats.total - stats.open) / stats.total) * 100)} % done — keeps momentum`);
    }
    if (project) (score += 5), reasons.push(`part of the ${project.name} project`);
    const updated = t.ref.docId ? docUpdated.get(t.ref.docId) : undefined;
    const ageDays = updated ? (now - new Date(updated).getTime()) / 86400000 : Infinity;
    if (ageDays <= 3) (score += 8), reasons.push("document edited in the last 3 days");
    if (openIndex.get(`${t.ref.listId}:${t.ref.taskId}`) === 0) (score += 6), reasons.push("next in its list");
    if (!reasons.length) reasons.push("open task, nothing more urgent competes with it");
    return [{ score, reasons, task: t }];
  });

  // Pestrost: nejvýš 2 tipy ze stejného listu, jinak by jeden dlouhý list zabral celý výběr.
  const perList = new Map<string, number>();
  return scored
    .sort((a, b) => b.score - a.score)
    .filter(({ task }) => {
      const n = perList.get(task.ref.listId) ?? 0;
      perList.set(task.ref.listId, n + 1);
      return n < 2;
    })
    .slice(0, limit)
    .map(({ score, reasons, task }, i) => ({ rank: i + 1, score, why: reasons, ...task }));
}

/** Poznámka jako Markdown (ve vaultu přesně obsah souboru včetně frontmatteru). */
export function Document(data: WorkspaceData, idOrName: string) {
  const wanted = idOrName.toLowerCase().replace(/\.md$/, "");
  const doc =
    data.documents.find((d) => d.id.toLowerCase() === idOrName.toLowerCase()) ??
    data.documents.find((d) => d.id.replace(/^md:/, "").replace(/\.md$/, "").toLowerCase() === wanted) ??
    data.documents.find((d) => d.name.toLowerCase() === wanted);
  if (!doc) throw new Error(`Document "${idOrName}" not found.`);
  return {
    id: doc.id,
    name: doc.name,
    project: ProjectOf(data, doc)?.name ?? null,
    markdown: data.rawFiles.get(doc.id) ?? DocToMarkdown(doc.text.json),
  };
}
