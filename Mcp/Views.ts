import type { DocumentRecord, Project } from "@lockin/shared/Types/Project";
import type { TodoTask } from "@lockin/shared/Types/QuickNotes";
import type { FocusColumn, FocusTask } from "@lockin/shared/Store/UseFocusStore";
import { FindLists, SourceKey } from "@lockin/shared/Lib/CollectTodoSources";
import { DocToMarkdown } from "@lockin/shared/Lib/Markdown";
import { DocumentLinkTargets, FindWikiDocument, WikiTarget } from "@lockin/shared/Lib/WikiLink";
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
      if (data.ignoredLists.has(list.id)) continue;
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
    if (data.ignoredLists.has(list.id)) continue;
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

  // Pestrost: nahoře nejvýš 2 úkoly ze stejného listu (jinak by jeden dlouhý list
  // zabral celý začátek). Ostatní se nezahodí — jdou za ně, pořád podle skóre.
  const perList = new Map<string, number>();
  const sorted = scored.sort((a, b) => b.score - a.score);
  const [front, rest] = [[] as typeof sorted, [] as typeof sorted];
  for (const item of sorted) {
    const n = perList.get(item.task.ref.listId) ?? 0;
    perList.set(item.task.ref.listId, n + 1);
    (n < 2 ? front : rest).push(item);
  }
  return [...front, ...rest]
    .slice(0, limit)
    .map(({ score, reasons, task }, i) => ({ rank: i + 1, score, why: reasons, ...task }));
}

/** Poznámka jako Markdown (ve vaultu přesně obsah souboru včetně frontmatteru). */
export function FindDocument(data: WorkspaceData, idOrName: string) {
  const wanted = idOrName.toLowerCase().replace(/\.md$/, "");
  const doc =
    data.documents.find((d) => d.id.toLowerCase() === idOrName.toLowerCase()) ??
    data.documents.find((d) => d.id.replace(/^md:/, "").replace(/\.md$/, "").toLowerCase() === wanted) ??
    data.documents.find((d) => d.name.toLowerCase() === wanted);
  if (!doc) throw new Error(`Document "${idOrName}" not found.`);
  return doc;
}

export function Document(data: WorkspaceData, idOrName: string) {
  const doc = FindDocument(data, idOrName);
  return {
    id: doc.id,
    name: doc.name,
    project: ProjectOf(data, doc)?.name ?? null,
    markdown: data.rawFiles.get(doc.id) ?? DocToMarkdown(doc.text.json),
  };
}

/** Projekt podle ID nebo názvu (bez ohledu na velikost písmen). */
export function FindProject(data: WorkspaceData, idOrName: string): Project {
  const wanted = idOrName.toLowerCase();
  const all = Object.values(data.projects);
  const project =
    all.find((p) => p.id.toLowerCase() === wanted) ??
    all.find((p) => p.name.toLowerCase() === wanted) ??
    // Ve vaultu je ID projektu "project:md:projects/aura.md" — ať jde psát i cestu.
    all.find((p) => p.rootDocumentId.replace(/^md:/, "").replace(/\.md$/, "").toLowerCase() === wanted);
  if (!project) throw new Error(`Project "${idOrName}" not found. Available: ${all.map((p) => p.name).join(", ")}`);
  return project;
}

/**
 * Priorita/stav podle ID nebo popisku. Volby jsou uložené jako ID ("high"),
 * ale člověk i AI je přirozeně píšou popiskem ("High") — bez tohohle překladu
 * zápis tiše uložil neexistující hodnotu.
 */
export function FindOption(data: WorkspaceData, kind: "priority" | "status", idOrLabel: string) {
  const options = kind === "priority" ? data.priorities : data.statuses;
  const wanted = idOrLabel.toLowerCase();
  const option = options.find((o) => o.id.toLowerCase() === wanted) ?? options.find((o) => o.label.toLowerCase() === wanted);
  if (!option) throw new Error(`Unknown ${kind} "${idOrLabel}". Available: ${options.map((o) => o.label).join(", ")}`);
  return option;
}

/** Volby priorit a stavů i s barvami — co smí project priority/status obsahovat. */
export function Options(data: WorkspaceData) {
  return { priorities: data.priorities, statuses: data.statuses, tags: data.tags };
}

/**
 * Data grafu poznámek — stejné uzly a hrany, jaké kreslí GraphView, ale jako
 * JSON. Počítá se z disku, takže na rozdíl od zapisovacích nástrojů funguje
 * i když LockIn neběží.
 *
 * Postavené pro lintování vaultu: `orphans` jsou poznámky, na které nikdo
 * neodkazuje a samy nikam neodkazují, `brokenLinks` jsou `[[odkazy]]` mířící
 * na neexistující poznámku.
 * ponytail: O(n×odkazy) s lineárním hledáním cíle uvnitř — na tisících poznámek
 * by chtělo cíle předindexovat.
 */
export function Graph(data: WorkspaceData, options: { includeEdges?: boolean } = {}) {
  const docs = data.documents;
  const TopFolder = (folderId: string | null) => folderId?.replace(/^dir:/, "").split("/")[0] ?? "";
  const index = new Map(docs.map((doc, i) => [doc.id, i]));
  const degree = docs.map(() => 0);
  const edges: { from: string; to: string }[] = [];
  const brokenLinks: { from: string; target: string }[] = [];
  const seen = new Set<string>();

  docs.forEach((doc, from) => {
    for (const target of DocumentLinkTargets(doc)) {
      const found = FindWikiDocument(target, docs);
      if (!found) {
        brokenLinks.push({ from: Path(doc), target: WikiTarget(target) });
        continue;
      }
      const to = index.get(found.id)!;
      if (to === from) continue;
      const key = from < to ? `${from}-${to}` : `${to}-${from}`;
      if (seen.has(key)) continue;
      seen.add(key);
      degree[from]++;
      degree[to]++;
      if (options.includeEdges !== false) edges.push({ from: Path(doc), to: Path(docs[to]) });
    }
  });

  const nodes = docs.map((doc, i) => ({
    path: Path(doc),
    label: doc.name || "Untitled",
    folder: TopFolder(doc.folderId),
    degree: degree[i],
    isProject: Boolean(doc.projectId),
  }));

  return {
    workspace: data.workspace.name,
    totals: { notes: nodes.length, links: edges.length, orphans: nodes.filter((n) => !n.degree).length, brokenLinks: brokenLinks.length },
    folders: [...new Set(nodes.map((n) => n.folder))].filter(Boolean).sort(),
    orphans: nodes.filter((n) => !n.degree).map((n) => n.path),
    brokenLinks,
    nodes,
    ...(options.includeEdges === false ? {} : { edges }),
  };
}

/** Cesta ve vaultu bez `md:` a `.md` — tak se na poznámky odkazuje i v lintu. */
function Path(doc: DocumentRecord): string {
  return doc.id.startsWith("md:") ? doc.id.slice(3).replace(/\.md$/, "") : doc.name || doc.id;
}


/**
 * Nástěnky (canvas) jako data — karty, spojnice a na co odkazují. Jen čtení:
 * kreslit přes MCP nedává smysl, ale přečíst si, co na nástěnce je, ano.
 */
export function Canvases(data: WorkspaceData, name?: string) {
  const wanted = name?.toLowerCase();
  const picked = wanted ? data.canvases.filter((c) => c.name.toLowerCase().includes(wanted)) : data.canvases;
  if (wanted && !picked.length) {
    throw new Error(`No canvas matches "${name}". Available: ${data.canvases.map((c) => c.name).join(", ") || "none"}`);
  }
  return picked.map((canvas) => ({
    id: canvas.id,
    name: canvas.name,
    updatedAt: canvas.updatedAt,
    totals: { cards: canvas.nodes.length, links: canvas.edges.length, drawings: canvas.strokes?.length ?? 0 },
    cards: canvas.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      // U karty s dokumentem je `file` jeho ID — ať je vidět, na co ukazuje.
      ...(n.file ? { document: n.file.startsWith("md:") ? n.file.slice(3).replace(/\.md$/, "") : n.file } : {}),
      ...(n.text ? { text: n.text } : {}),
      ...(n.label ? { label: n.label } : {}),
    })),
    links: canvas.edges.map((e) => ({ from: e.fromNode, to: e.toNode, ...(e.label ? { label: e.label } : {}) })),
  }));
}
