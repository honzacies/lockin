"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { Checkbox, Input } from "@heroui/react";
import { ArrowUpRight, Check, CornerDownRight, FileText, ListTodo, Plus, Search, Zap } from "lucide-react";
import { UseDataStore } from "@lockin/shared/Store/UseDataStore";
import { UseTodoStore } from "@lockin/shared/Store/UseTodoStore";
import { UseUiStore } from "@lockin/shared/Store/UseUiStore";
import { UseFocusStore, type FocusColumn } from "@lockin/shared/Store/UseFocusStore";
import { DocHref, FindLists, SourceKey, SourceToImport, type FoundList } from "@lockin/shared/Lib/CollectTodoSources";
import type { TodoEdit } from "@lockin/shared/Lib/TodoEdit";
import { ApplyListEdit } from "@lockin/shared/Lib/TodoActions";
import { TodoTabs } from "@lockin/shared/Components/Focus/TodoTabs";
import { StartSessionButton } from "@lockin/shared/Components/Focus/StartSessionButton";
import { ProjectIcon } from "@lockin/shared/Components/Shared/ProjectIcon";
import { ProjectProgressBar } from "@lockin/shared/Components/Shared/ProjectProgressBar";
import { InlineEditable } from "@lockin/shared/Components/Shared/InlineEditable";
import { Popover } from "@lockin/shared/Components/Shared/Popover";
import { ContextMenuItem, ContextMenuLabel } from "@lockin/shared/Components/Shared/ContextMenu";
import { VariantToggle, VisibilityToggleList } from "@lockin/shared/Components/Shared/SettingsPanelPrimitives";
import type { TodoTask } from "@lockin/shared/Types/QuickNotes";
import { ActiveWorkspace } from "@lockin/shared/Lib/Workspace";

type ListData = Pick<FoundList, "id" | "title" | "tasks" | "groups">;

/** Jeden list na Home — odkud je (dokument / Quick Notes) a jak se upraví. */
interface ListEntry {
  list: ListData;
  /** null = Quick Notes list (žije v UseTodoStore, ne v dokumentu). */
  docId: string | null;
  docName: string;
  href: string;
}

interface CardData {
  key: string;
  title: string;
  icon: "project" | "quick" | "docs";
  projectIcon?: string;
  href?: string;
  lists: ListEntry[];
  open: number;
  total: number;
  updated: string;
}

type SortBy = "open" | "name" | "recent";

const COLUMNS: { id: FocusColumn; label: string }[] = [
  { id: "backlog", label: "Backlog" },
  { id: "week", label: "This week" },
  { id: "today", label: "Today" },
];

/** Hlášky pod celkovým progresem — podle toho, kolik je hotovo (od prahu výš). */
const MOTIVATION: [number, string[]][] = [
  [100, ["Everything's done. Go touch some grass.", "100 %. Nothing left — enjoy it.", "Board's clear. Legendary."]],
  [75, ["Almost there — finish it off.", "The end is in sight. Don't stop now.", "Most of it's done. One more push."]],
  [50, ["Past halfway. Nice momentum.", "More done than not. Keep rolling.", "Solid progress — keep it up."]],
  [25, ["Okay, this wasn't bad — but it could be better.", "Warming up. Pick the next one.", "Decent start. Now make it a streak."]],
  [1, ["A few down, a lot to go. One at a time.", "Small wins count. Grab another.", "It's a start. Let's build on it."]],
  [0, ["Clean slate. Pick one task and lock in.", "Nothing done yet — the first one's the hardest.", "Zero percent, infinite potential."]],
];

/** `seed` (0–1) se losuje jednou za otevření — hláška se nemění s každým odškrtnutím,
 * jen když progres přeskočí do jiného pásma. */
function Motivation(percent: number, seed: number): string {
  const lines = MOTIVATION.find(([min]) => percent >= min)![1];
  return lines[Math.floor(seed * lines.length)];
}

/** "2 hours ago" / "yesterday" — Intl ze stdlib, žádná knihovna. */
function TimeAgo(then: number): string {
  const seconds = (then - Date.now()) / 1000;
  const format = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, size] of [["day", 86400], ["hour", 3600], ["minute", 60]] as const) {
    if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit);
  }
  return "just now";
}

/** Kdy byl Home naposledy otevřený (v tomhle workspacu) — a hned zapíše teď.
 * Jen pohodlí pro jednoho uživatele, proto localStorage. */
function UseLastVisit(): number | null {
  const [last, setLast] = useState<number | null>(null);
  useEffect(() => {
    const key = `lockin-todo-home-visit-${ActiveWorkspace().id}`;
    try {
      const saved = Number(localStorage.getItem(key));
      if (saved) setLast(saved);
      localStorage.setItem(key, String(Date.now()));
    } catch {
      // bez úložiště se hláška o poslední návštěvě prostě neukáže
    }
  }, []);
  return last;
}

const AllTasks = (list: ListData) => [...list.tasks, ...(list.groups ?? []).flatMap((g) => g.tasks)];

function ApplyEdit(entry: ListEntry, edit: TodoEdit) {
  ApplyListEdit({ docId: entry.docId, listId: entry.list.id }, edit);
}

/**
 * To-do → Home: všechny projekty a jejich to-do listy v jednom přehledu.
 * Úkoly jde odškrtnout, přejmenovat, přidat a poslat na board rovnou odsud —
 * změna se zapíše do zdrojového dokumentu.
 */
export default function TodoHomePage() {
  const openTab = UseUiStore((state) => state.OpenTab);
  const documents = UseDataStore((s) => s.documents);
  const projects = UseDataStore((s) => s.projects);
  const quickLists = UseTodoStore((s) => s.lists);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState({ hideDone: true, onlyWithOpen: true });
  const [sortBy, setSortBy] = useState<SortBy>("open");

  useEffect(() => {
    openTab({ id: "todo", title: "To-do", href: "/Todo" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cards = useMemo(() => {
    const byKey = new Map<string, CardData>();
    const Card = (key: string, init: Omit<CardData, "key" | "lists" | "open" | "total" | "updated">) => {
      if (!byKey.has(key)) byKey.set(key, { key, ...init, lists: [], open: 0, total: 0, updated: "" });
      return byKey.get(key)!;
    };
    const Add = (card: CardData, entry: ListEntry, updated: string) => {
      const tasks = AllTasks(entry.list);
      card.lists.push(entry);
      card.total += tasks.length;
      card.open += tasks.filter((t) => !t.done).length;
      if (updated > card.updated) card.updated = updated;
    };

    for (const doc of Object.values(documents)) {
      const lists = FindLists(doc.id, doc.text?.json);
      if (!lists.length) continue;
      const project = doc.projectId ? projects[doc.projectId] : undefined;
      const card = project
        ? Card(project.id, { title: project.name || "Untitled", icon: "project", projectIcon: project.icon, href: DocHref({ id: project.rootDocumentId, projectId: project.id }, projects) })
        : Card("docs", { title: "Other documents", icon: "docs" });
      for (const list of lists) Add(card, { list, docId: doc.id, docName: doc.name || "Untitled", href: DocHref(doc, projects) }, doc.updatedAt);
    }
    for (const list of quickLists) {
      Add(Card("quick", { title: "Quick Notes", icon: "quick", href: "/QuickNotes" }), { list, docId: null, docName: "Quick Notes", href: "/QuickNotes" }, "");
    }
    return [...byKey.values()];
  }, [documents, projects, quickLists]);

  const totals = cards.reduce((sum, c) => ({ open: sum.open + c.open, total: sum.total + c.total }), { open: 0, total: 0 });
  const done = totals.total - totals.open;
  const percent = totals.total ? Math.round((done / totals.total) * 100) : 0;
  const [motivationSeed] = useState(() => Math.random());
  const motivation = Motivation(percent, motivationSeed);
  const lastVisit = UseLastVisit();
  const q = query.trim().toLowerCase();
  const Matches = (text: string) => !q || text.toLowerCase().includes(q);

  const shown = cards
    .filter((c) => !filter.onlyWithOpen || c.open > 0)
    .filter((c) => !q || Matches(c.title) || c.lists.some((e) => Matches(e.list.title) || AllTasks(e.list).some((t) => Matches(t.title))))
    .sort((a, b) =>
      sortBy === "name" ? a.title.localeCompare(b.title) : sortBy === "recent" ? b.updated.localeCompare(a.updated) : b.open - a.open,
    );

  return (
    <div className="h-full overflow-y-auto px-[50px] pb-16 pt-8">
      <div className="mb-6 flex flex-col gap-2.5">
        <div className="flex items-center gap-2.5">
          <ListTodo size={56} strokeWidth={1.5} className="text-black" />
          <p className="select-none text-[40px] font-medium tracking-[-0.8px] text-black">To-do</p>
        </div>
        <p className="select-none text-[20px] leading-[32px] text-[#5f5e59]">Every list in your workspace, in one place.</p>
        <TodoTabs />
      </div>

      <div className="mb-6 grid select-none grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Open tasks" value={totals.open} />
        <Stat label="Done" value={done} />
        <Stat label="Projects with work" value={cards.filter((c) => c.icon === "project" && c.open > 0).length} />
        <div className="flex flex-col justify-between gap-2 rounded-xl border border-[#f0efed] bg-[#faf9f8] p-4">
          <p className="text-[13px] text-[#91918e]">Overall progress</p>
          <ProjectProgressBar value={percent} />
          <p className="text-[13px] leading-[18px] text-[#5f5e59]">{motivation}</p>
          {lastVisit ? <p className="text-[12px] text-[#a5a49f]">You last opened this tab {TimeAgo(lastVisit)}.</p> : null}
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-4">
        <div className="flex w-full max-w-[360px] items-center gap-1.5 rounded-xl border border-[#f0efed] bg-[#faf9f8] px-3 focus-within:border-[#0485f7]">
          <Search size={16} className="shrink-0 text-[#91918e]" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects, lists and tasks…"
            className="h-9 w-full bg-transparent text-[14px] shadow-none outline-none ring-0"
          />
        </div>
        <div className="flex select-none gap-4">
          <VisibilityToggleList
            style={filter}
            items={[
              { key: "hideDone", label: "Hide done" },
              { key: "onlyWithOpen", label: "Only with open tasks" },
            ]}
            onChange={(patch) => setFilter((f) => ({ ...f, ...patch }))}
          />
        </div>
        <div className="w-[260px] select-none">
          <VariantToggle options={["open", "name", "recent"] as SortBy[]} value={sortBy} onChange={setSortBy} />
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="select-none text-[15px] text-[#91918e]">
          {cards.length === 0 ? "No to-do lists yet — add one to any document." : "Nothing matches."}
        </p>
      ) : (
        // Masonry: karty různé výšky se skládají do sloupců bez děr.
        <div className="columns-1 gap-4 xl:columns-2 2xl:columns-3">
          {shown.map((card) => (
            <ProjectCard key={card.key} card={card} hideDone={filter.hideDone} query={q} />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-[#f0efed] bg-[#faf9f8] p-4">
      <p className="text-[13px] text-[#91918e]">{label}</p>
      <p className="text-[28px] font-medium tabular-nums tracking-[-0.56px] text-[#0f0f0f]">{value}</p>
    </div>
  );
}

function ProjectCard({ card, hideDone, query }: { card: CardData; hideDone: boolean; query: string }) {
  const Icon =
    card.icon === "project" ? (
      <ProjectIcon icon={card.projectIcon} size={22} />
    ) : card.icon === "quick" ? (
      <Zap size={20} strokeWidth={1.5} className="text-[#5f5e59]" />
    ) : (
      <FileText size={20} strokeWidth={1.5} className="text-[#5f5e59]" />
    );
  const Title = <span className="truncate text-[18px] font-medium text-[#0f0f0f]">{card.title}</span>;

  return (
    <div className="mb-4 flex break-inside-avoid flex-col gap-3 rounded-xl border border-[#f0efed] bg-white p-4">
      <div className="flex select-none items-center gap-2">
        {Icon}
        {card.href ? (
          <Link href={card.href} className="min-w-0 truncate hover:underline">
            {Title}
          </Link>
        ) : (
          Title
        )}
        <span className="ml-auto shrink-0 text-[13px] tabular-nums text-[#91918e]">
          {card.open} open · {card.total - card.open} done
        </span>
      </div>
      <ProjectProgressBar value={card.total ? Math.round(((card.total - card.open) / card.total) * 100) : 0} />
      {card.lists.map((entry) => (
        <ListBlock key={`${entry.docId}:${entry.list.id}`} entry={entry} hideDone={hideDone} query={query} showDoc={card.icon !== "quick"} />
      ))}
    </div>
  );
}

function ListBlock({ entry, hideDone, query, showDoc }: { entry: ListEntry; hideDone: boolean; query: string; showDoc: boolean }) {
  const [adding, setAdding] = useState<{ groupId?: string } | null>(null);
  const Visible = (t: TodoTask) => (!hideDone || !t.done) && (!query || t.title.toLowerCase().includes(query) || entry.list.title.toLowerCase().includes(query));
  const ungrouped = entry.list.tasks.filter(Visible);
  const groups = (entry.list.groups ?? []).map((g) => ({ ...g, visible: g.tasks.filter(Visible) }));
  const open = AllTasks(entry.list).filter((t) => !t.done).length;
  // Se skrytými hotovými úkoly nemá list bez jediného viditelného úkolu co ukázat.
  const empty = ungrouped.length === 0 && groups.every((g) => g.visible.length === 0);
  if (empty && !adding && (hideDone || query)) return null;

  return (
    <div className="flex flex-col gap-1 border-t border-[#f0efed] pt-3">
      <div className="group/list flex select-none items-center gap-1.5 text-[14px]">
        <ListTodo size={15} strokeWidth={1.5} className="shrink-0 text-[#5f5e59]" />
        <span className="truncate font-medium text-[#2c2c2b]">{entry.list.title || "To-do list"}</span>
        {showDoc ? (
          <Link href={entry.href} className="flex min-w-0 items-center gap-0.5 truncate text-[12px] text-[#a5a49f] hover:text-[#5f5e59]">
            <CornerDownRight size={11} className="shrink-0" />
            <span className="truncate">{entry.docName}</span>
          </Link>
        ) : null}
        <span className="ml-auto shrink-0 text-[12px] tabular-nums text-[#a5a49f]">{open}</span>
        <StartSessionButton
          source={{ listId: entry.list.id, title: entry.list.title, label: entry.docName, href: entry.href, tasks: AllTasks(entry.list) }}
          className="opacity-0 group-hover/list:opacity-100"
        />
        <AddTaskButton onPress={() => setAdding({})} />
      </div>

      {ungrouped.map((task) => (
        <TaskRow key={task.id} entry={entry} task={task} />
      ))}
      {adding && !adding.groupId ? <NewTaskInput onDone={() => setAdding(null)} onAdd={(title) => ApplyEdit(entry, { kind: "add", title })} /> : null}

      {groups.map((group) =>
        group.visible.length === 0 && adding?.groupId !== group.id && (hideDone || query) ? null : (
          <div key={group.id} className="mt-1 flex flex-col gap-1">
            <div className="group/list flex select-none items-center gap-1.5 pl-1 text-[13px] text-[#5f5e59]">
              {group.icon ? <span className="leading-none">{group.icon}</span> : null}
              <span className="truncate font-medium">{group.title || "Group"}</span>
              <span className="text-[12px] tabular-nums text-[#a5a49f]">
                {group.tasks.filter((t) => t.done).length}/{group.tasks.length}
              </span>
              <span className="ml-auto" />
              <AddTaskButton onPress={() => setAdding({ groupId: group.id })} />
            </div>
            {group.visible.map((task) => (
              <TaskRow key={task.id} entry={entry} task={task} />
            ))}
            {adding?.groupId === group.id ? (
              <NewTaskInput onDone={() => setAdding(null)} onAdd={(title) => ApplyEdit(entry, { kind: "add", title, groupId: group.id })} />
            ) : null}
          </div>
        ),
      )}

      {ungrouped.length === 0 && groups.every((g) => g.visible.length === 0) && !adding ? (
        <p className="select-none pl-6 text-[13px] text-[#c9c8c4]">{hideDone ? "All done" : "No tasks"}</p>
      ) : null}
    </div>
  );
}

function TaskRow({ entry, task }: { entry: ListEntry; task: TodoTask }) {
  const focusTasks = UseFocusStore((s) => s.tasks);
  const importTasks = UseFocusStore((s) => s.ImportTasks);
  const key = SourceKey(entry.list.id, task.id);
  const onBoard = focusTasks.some((t) => t.source?.key === key);

  return (
    <div className="group/task flex items-start gap-2 rounded-lg px-1 py-0.5 hover:bg-black/[0.02]">
      <Checkbox
        isSelected={task.done}
        onChange={() => ApplyEdit(entry, { kind: "toggle", taskId: task.id })}
        className="group/checkbox relative mt-[3px] flex shrink-0 flex-row items-center"
      >
        <Checkbox.Content className="contents">
          <Checkbox.Control
            className="flex size-4 shrink-0 items-center justify-center rounded-md border border-[#d9d9d9] before:bg-[var(--todo-checkbox-color)] group-data-[selected]/checkbox:border-0"
            style={{ "--todo-checkbox-color": "#0485f7" } as CSSProperties}
          >
            <Checkbox.Indicator>
              <Check size={12} strokeWidth={3} className="text-white" />
            </Checkbox.Indicator>
          </Checkbox.Control>
        </Checkbox.Content>
      </Checkbox>
      <div className={`min-w-0 flex-1 text-[14px] leading-[22px] ${task.done ? "text-[#a5a49f] line-through" : "text-[#2c2c2b]"}`}>
        <InlineEditable
          value={task.title}
          placeholder="Untitled task"
          seamless
          onCommit={(title) => title.trim() && title !== task.title && ApplyEdit(entry, { kind: "rename", taskId: task.id, title: title.trim() })}
        />
      </div>
      <div className="flex shrink-0 select-none items-center gap-0.5 opacity-0 group-hover/task:opacity-100">
        {onBoard ? (
          <span title="Already on the board" className="p-0.5">
            <Check size={14} className="text-[#30a46c]" />
          </span>
        ) : (
          <Popover
            align="right"
            panelClassName="w-44 p-1"
            trigger={() => (
              <span title="Send to board" className="flex rounded p-0.5 text-[#91918e] hover:bg-black/[0.05] hover:text-[#2c2c2b]">
                <ArrowUpRight size={14} />
              </span>
            )}
          >
            {(close) => (
              <div className="flex flex-col gap-px">
                <ContextMenuLabel first>Send to</ContextMenuLabel>
                {COLUMNS.map((column) => (
                  <ContextMenuItem
                    key={column.id}
                    onClick={() => {
                      importTasks(
                        SourceToImport({ listId: entry.list.id, title: entry.list.title, label: entry.docName, href: entry.href, tasks: [task] }),
                        column.id,
                      );
                      close();
                    }}
                  >
                    {column.label}
                  </ContextMenuItem>
                ))}
              </div>
            )}
          </Popover>
        )}
      </div>
    </div>
  );
}

function AddTaskButton({ onPress }: { onPress: () => void }) {
  return (
    <button
      type="button"
      aria-label="Add task"
      title="Add task"
      onClick={onPress}
      className="shrink-0 rounded p-0.5 text-[#91918e] opacity-0 hover:bg-black/[0.05] hover:text-[#2c2c2b] focus:opacity-100 group-hover/list:opacity-100"
    >
      <Plus size={14} strokeWidth={1.75} />
    </button>
  );
}

/** Řádek pro nový úkol: Enter přidá a nechá psát další, Esc / klik mimo zavře. */
function NewTaskInput({ onAdd, onDone }: { onAdd: (title: string) => void; onDone: () => void }) {
  const [draft, setDraft] = useState("");
  return (
    <div className="flex items-center gap-2 px-1">
      <span className="size-4 shrink-0 rounded-md border border-dashed border-[#d9d9d9]" />
      <Input
        autoFocus
        value={draft}
        placeholder="New task…"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={onDone}
        onKeyDown={(e) => {
          if (e.key === "Escape") onDone();
          if (e.key !== "Enter" || !draft.trim()) return;
          onAdd(draft.trim());
          setDraft("");
        }}
        className="w-full rounded-lg border border-[#d9d9d9] bg-white px-1.5 py-0.5 text-[14px] text-[#2c2c2b] outline-none focus:border-[#0485f7]"
      />
    </div>
  );
}
