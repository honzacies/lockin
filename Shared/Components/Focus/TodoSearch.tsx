"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Input } from "@heroui/react";
import { Circle, ListTodo, Search } from "@lockin/shared/Components/Shared/UiIcons";
import { ContextMenuItem, ContextMenuLabel } from "@lockin/shared/Components/Shared/ContextMenu";
import { CollectTodoSources, SourceKey, SourceToImport, type TodoSource } from "@lockin/shared/Lib/CollectTodoSources";
import { UseDataStore } from "@lockin/shared/Store/UseDataStore";
import { UseTodoStore } from "@lockin/shared/Store/UseTodoStore";
import { UseFocusStore, type ImportedTask } from "@lockin/shared/Store/UseFocusStore";
import { UseFocusDrag, type DragPayload } from "./FocusBoard";
import { UseIgnoredListsStore } from "@lockin/shared/Store/UseIgnoredListsStore";

const MAX_RESULTS = 8;

/** Velký vyhledávací input na stránce To-do — import celých listů nebo
 * jednotlivých úkolů z Quick Notes a dokumentů do Backlogu. */
export function TodoSearch() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const { draggingId } = UseFocusDrag();

  // Jakmile se z výsledků začne táhnout, dropdown zmizí — jinak by zakrýval sloupce.
  useEffect(() => {
    if (draggingId) setOpen(false);
  }, [draggingId]);

  useEffect(() => {
    if (!open) return;
    function OnPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", OnPointerDown);
    return () => document.removeEventListener("pointerdown", OnPointerDown);
  }, [open]);

  return (
    <div ref={rootRef} className="relative w-full max-w-[640px]">
      <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-[var(--lk-muted)]" />
      <Input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        placeholder="Import lists or tasks from your docs…"
        aria-label="Import lists or tasks from your documents"
        className="h-11 w-full rounded-xl border border-[var(--lk-line)] bg-[var(--lk-panel)] pl-10 text-[15px] shadow-none"
      />
      {open && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1.5 max-h-[360px] overflow-y-auto rounded-xl border border-[var(--lk-line)] bg-white p-1 shadow-lg">
          <SearchResults
            query={query}
            close={() => {
              setQuery("");
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}

function SearchResults({ query, close }: { query: string; close: () => void }) {
  const quickLists = UseTodoStore((s) => s.lists);
  const documents = UseDataStore((s) => s.documents);
  const projects = UseDataStore((s) => s.projects);
  const focusTasks = UseFocusStore((s) => s.tasks);
  const importTasks = UseFocusStore((s) => s.ImportTasks);

  const ignoredIds = UseIgnoredListsStore((s) => s.ids);
  const sources = useMemo(
    () => CollectTodoSources(quickLists, Object.values(documents), projects).filter((src) => !ignoredIds.includes(src.listId)),
    [quickLists, documents, projects, ignoredIds],
  );
  const imported = new Set(focusTasks.map((t) => t.source?.key));
  const q = query.trim().toLowerCase();
  const matches = (text: string) => text.toLowerCase().includes(q);

  const lists = sources.filter((s) => matches(s.title) || matches(s.label)).slice(0, MAX_RESULTS);
  const tasks = q
    ? sources
        .flatMap((source) => source.tasks.map((task) => ({ source, task })))
        .filter(({ task }) => matches(task.title))
        .slice(0, MAX_RESULTS)
    : [];

  const ToImport = (source: TodoSource, taskIds?: string[]): ImportedTask[] => SourceToImport(source, taskIds);

  const newCount = (source: TodoSource) =>
    source.tasks.filter((t) => !imported.has(SourceKey(source.listId, t.id))).length;

  return (
    <div className="flex flex-col gap-px">

      <ContextMenuLabel first>Lists</ContextMenuLabel>
      {lists.length === 0 && <p className="px-2 py-1 text-[13px] text-[var(--lk-muted)]">No to-do lists found</p>}
      {lists.map((source) => (
        <Draggable
          key={source.listId}
          payload={newCount(source) ? { items: ToImport(source), list: { id: source.listId, title: source.title } } : null}
        >
        <ContextMenuItem
          disabled={newCount(source) === 0}
          icon={<ListTodo size={14} strokeWidth={1.75} className="text-[var(--lk-text2)]" />}
          onClick={() => {
            importTasks(ToImport(source), "backlog", { id: source.listId, title: source.title });
            close();
          }}
        >
          <span className="flex min-w-0 flex-1 items-baseline justify-between gap-2">
            <span className="truncate">{source.title}</span>
            <span className="shrink-0 text-xs font-normal text-[var(--lk-muted)]">
              {source.label} · {newCount(source)} new
            </span>
          </span>
        </ContextMenuItem>
        </Draggable>
      ))}

      {q && (
        <>
          <ContextMenuLabel>Tasks</ContextMenuLabel>
          {tasks.length === 0 && <p className="px-2 py-1 text-[13px] text-[var(--lk-muted)]">No tasks found</p>}
          {tasks.map(({ source, task }) => (
            <Draggable
              key={SourceKey(source.listId, task.id)}
              payload={imported.has(SourceKey(source.listId, task.id)) ? null : { items: ToImport(source, [task.id]) }}
            >
            <ContextMenuItem
              disabled={imported.has(SourceKey(source.listId, task.id))}
              icon={<Circle size={13} strokeWidth={1.75} className="text-[var(--lk-text2)]" />}
              onClick={() => {
                importTasks(ToImport(source, [task.id]), "backlog");
                close();
              }}
            >
              <span className="flex min-w-0 flex-1 items-baseline justify-between gap-2">
                <span className="truncate">{task.title || "Untitled task"}</span>
                <span className="shrink-0 truncate text-xs font-normal text-[var(--lk-muted)]">{source.title}</span>
              </span>
            </ContextMenuItem>
            </Draggable>
          ))}
        </>
      )}
      <p className="border-t border-[var(--lk-line)] px-2 pb-1 pt-1.5 text-[11px] text-[var(--lk-subtle)]">
        Click to add to Backlog, or drag into any column.
      </p>
    </div>
  );
}

/** Obal řádku výsledku — chycením a tažením se list/úkol pustí rovnou do sloupce. */
function Draggable({ payload, children }: { payload: DragPayload | null; children: ReactNode }) {
  const { StartDrag } = UseFocusDrag();
  return (
    <div onPointerDown={payload ? (e) => StartDrag(e, payload) : undefined} className={payload ? "cursor-grab" : ""}>
      {children}
    </div>
  );
}
