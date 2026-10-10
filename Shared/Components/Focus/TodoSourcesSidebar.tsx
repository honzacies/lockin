"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Check, ChevronDown, Circle, FileText, Folder, ListTodo, Plus, Search, Zap } from "@lockin/shared/Components/Shared/UiIcons";
import { Input } from "@heroui/react";
import { CollectTodoSources, SourceKey, SourceToImport, type TodoSource } from "@lockin/shared/Lib/CollectTodoSources";
import { UseDataStore } from "@lockin/shared/Store/UseDataStore";
import { UseTodoStore } from "@lockin/shared/Store/UseTodoStore";
import { UseFocusStore } from "@lockin/shared/Store/UseFocusStore";
import { UseTodoPreviewStore } from "@lockin/shared/Store/UseTodoPreviewStore";
import { ProjectIcon } from "@lockin/shared/Components/Shared/ProjectIcon";
import { VisibilityToggleList } from "@lockin/shared/Components/Shared/SettingsPanelPrimitives";
import { StartSessionButton } from "./StartSessionButton";
import { UseIgnoredListsStore } from "@lockin/shared/Store/UseIgnoredListsStore";

interface DocEntry {
  id: string;
  name: string;
  icon?: string;
  folder: string;
  sources: TodoSource[];
  openTasks: number;
}

const ROW = "flex min-w-0 items-center gap-1.5 rounded-lg px-1.5 py-0.5 text-[16px] text-[var(--lk-text2)] hover:bg-black/[0.03]";
const INDENT = "ml-[13px] flex flex-col gap-1 border-l border-[var(--lk-line)] pl-2";

/** Sidebar v To-do režimu: dokumenty podle složek, u každého jeho to-do listy
 * a úkoly. Tlačítkem + se přidají do Backlogu, klik na název otevře dokument
 * jen pro čtení vedle boardu. */
export function TodoSourcesSidebar() {
  const documents = UseDataStore((s) => s.documents);
  const projects = UseDataStore((s) => s.projects);
  const quickLists = UseTodoStore((s) => s.lists);
  const ignoredIds = UseIgnoredListsStore((s) => s.ids);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState({ onlyWithTodos: true });

  const { quickSources, byFolder } = useMemo(() => {
    const docs: DocEntry[] = Object.values(documents).map((doc) => {
      const sources = CollectTodoSources([], [doc], projects).filter((src) => !ignoredIds.includes(src.listId));
      const project = doc.projectId ? projects[doc.projectId] : undefined;
      return {
        id: doc.id,
        name: project?.rootDocumentId === doc.id ? project.name || doc.name : doc.name || "Untitled",
        icon: project?.rootDocumentId === doc.id ? project.icon : doc.icon,
        folder: doc.folderId?.replace(/^dir:/, "") ?? "",
        sources,
        openTasks: sources.reduce((sum, s) => sum + s.tasks.length, 0),
      };
    });
    const byFolder = new Map<string, DocEntry[]>();
    for (const doc of docs.sort((a, b) => a.name.localeCompare(b.name))) {
      byFolder.set(doc.folder, [...(byFolder.get(doc.folder) ?? []), doc]);
    }
    return { quickSources: CollectTodoSources(quickLists, [], projects).filter((src) => !ignoredIds.includes(src.listId)), byFolder };
  }, [documents, projects, quickLists, ignoredIds]);

  const q = query.trim().toLowerCase();
  const Show = (doc: DocEntry) =>
    (!filter.onlyWithTodos || doc.sources.length > 0) &&
    (!q || doc.name.toLowerCase().includes(q) || doc.sources.some((s) => s.tasks.some((t) => t.title.toLowerCase().includes(q))));
  const folders = [...byFolder.entries()]
    .map(([folder, docs]) => [folder, docs.filter(Show)] as const)
    .filter(([, docs]) => docs.length > 0)
    .sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b)));

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 px-[5px]">
      <div className="flex items-center gap-1.5 rounded-lg border border-[var(--lk-line)] bg-white px-2 focus-within:border-[#0485f7]">
        <Search size={14} className="shrink-0 text-[var(--lk-muted)]" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find docs or tasks…"
          className="w-full bg-transparent py-1 text-[14px] text-[var(--lk-ink)] shadow-none outline-none ring-0"
        />
      </div>
      <div className="px-1.5">
        <VisibilityToggleList style={filter} items={[{ key: "onlyWithTodos", label: "Only docs with to-dos" }]} onChange={(p) => setFilter((f) => ({ ...f, ...p }))} />
      </div>

      <div className="flex min-h-0 flex-1 select-none flex-col gap-1 overflow-y-auto pb-4">
        {quickSources.length > 0 && !q ? (
          <Expandable label="Quick Notes" icon={<Zap size={18} strokeWidth={1.5} />} count={quickSources.reduce((n, s) => n + s.tasks.length, 0)}>
            {quickSources.map((source) => (
              <SourceList key={source.listId} source={source} />
            ))}
          </Expandable>
        ) : null}
        {folders.map(([folder, docs]) => (
          <Expandable
            key={folder || "-"}
            label={folder || "No folder"}
            icon={<Folder size={18} strokeWidth={1.5} />}
            defaultOpen={Boolean(q) || folders.length <= 3}
          >
            {docs.map((doc) => (
              <DocRow key={doc.id} doc={doc} forceOpen={Boolean(q)} />
            ))}
          </Expandable>
        ))}
        {folders.length === 0 ? <p className="px-1.5 text-[13px] text-[var(--lk-faint)]">Nothing found</p> : null}
      </div>
    </div>
  );
}

/** Řádek s šipkou, který rozbalí obsah pod sebou (složka, dokument, list). */
function Expandable({
  label,
  icon,
  count,
  defaultOpen = false,
  onLabelClick,
  action,
  children,
}: {
  label: string;
  icon: ReactNode;
  count?: number;
  defaultOpen?: boolean;
  onLabelClick?: () => void;
  action?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="flex flex-col gap-1">
      <div className={`${ROW} group/row`}>
        <button type="button" aria-label={open ? "Collapse" : "Expand"} onClick={() => setOpen((v) => !v)} className="flex shrink-0 items-center gap-1.5">
          <ChevronDown size={14} className={`shrink-0 text-[var(--lk-muted)] transition-transform ${open ? "" : "-rotate-90"}`} />
          {icon}
        </button>
        <button type="button" onClick={onLabelClick ?? (() => setOpen((v) => !v))} className="min-w-0 flex-1 truncate text-left">
          {label}
        </button>
        {count ? <span className="shrink-0 text-[12px] tabular-nums text-[var(--lk-subtle)]">{count}</span> : null}
        {action}
      </div>
      {open ? <div className={INDENT}>{children}</div> : null}
    </div>
  );
}

function DocRow({ doc, forceOpen }: { doc: DocEntry; forceOpen: boolean }) {
  const openPreview = UseTodoPreviewStore((s) => s.Open);
  const previewId = UseTodoPreviewStore((s) => s.docId);
  return (
    <Expandable
      key={String(forceOpen)}
      label={doc.name}
      icon={doc.icon ? <ProjectIcon icon={doc.icon} size={18} /> : <FileText size={18} strokeWidth={1.5} />}
      count={doc.openTasks}
      defaultOpen={forceOpen}
      onLabelClick={() => openPreview(previewId === doc.id ? null : doc.id)}
    >
      {doc.sources.length === 0 ? (
        <p className="px-1.5 text-[13px] text-[var(--lk-faint)]">No to-do lists</p>
      ) : (
        doc.sources.map((source) => <SourceList key={source.listId} source={source} />)
      )}
    </Expandable>
  );
}

/** To-do list dokumentu: + přidá celý list, pod ním jednotlivé úkoly. */
function SourceList({ source }: { source: TodoSource }) {
  const focusTasks = UseFocusStore((s) => s.tasks);
  const importTasks = UseFocusStore((s) => s.ImportTasks);
  const imported = new Set(focusTasks.map((t) => t.source?.key));
  const fresh = source.tasks.filter((t) => !imported.has(SourceKey(source.listId, t.id)));

  return (
    <Expandable
      label={source.title || "To-do list"}
      icon={<ListTodo size={16} strokeWidth={1.5} />}
      count={source.tasks.length}
      action={
        <>
        <StartSessionButton source={source} className="opacity-0 group-hover/row:opacity-100" />
        <AddButton
          label={`Add ${fresh.length} tasks to Backlog`}
          done={fresh.length === 0}
          onPress={() =>
            importTasks(SourceToImport(source, fresh.map((t) => t.id)), "backlog", { id: source.listId, title: source.title })
          }
        />
        </>
      }
    >
      {source.tasks.length === 0 ? <p className="px-1.5 text-[13px] text-[var(--lk-faint)]">All done</p> : null}
      {source.tasks.map((task) => {
        const done = imported.has(SourceKey(source.listId, task.id));
        return (
          <div key={task.id} className={`${ROW} group/row text-[14px]`}>
            <Circle size={12} strokeWidth={1.75} className="shrink-0 text-[var(--lk-subtle)]" />
            <span className={`min-w-0 flex-1 truncate ${done ? "text-[var(--lk-subtle)]" : ""}`}>{task.title || "Untitled task"}</span>
            <AddButton label="Add task to Backlog" done={done} onPress={() => importTasks(SourceToImport(source, [task.id]), "backlog")} />
          </div>
        );
      })}
    </Expandable>
  );
}

function AddButton({ label, done, onPress }: { label: string; done: boolean; onPress: () => void }) {
  if (done) return <Check size={14} aria-label="Already in To-do" className="shrink-0 text-[#30a46c]" />;
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onPress}
      className="shrink-0 rounded p-0.5 text-[var(--lk-muted)] opacity-0 hover:bg-black/[0.05] hover:text-[var(--lk-ink)] focus:opacity-100 group-hover/row:opacity-100"
    >
      <Plus size={14} strokeWidth={1.75} />
    </button>
  );
}
