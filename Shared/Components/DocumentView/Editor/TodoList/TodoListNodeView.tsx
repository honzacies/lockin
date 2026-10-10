"use client";

import type { NodeViewProps } from "@tiptap/core";
import { NodeViewWrapper, useEditorState } from "@tiptap/react";
import type { TodoGroup, TodoListConfig, TodoListStyle, TodoTask } from "@lockin/shared/Types/QuickNotes";
import { NewTodoGroup } from "@lockin/shared/Types/QuickNotes";
import { TodoListView } from "@lockin/shared/Components/QuickNotes/TodoListView";
import { Button } from "@heroui/react";
import { Check, Circle, ListTodo, Plus } from "@lockin/shared/Components/Shared/UiIcons";
import { UseDataStore } from "@lockin/shared/Store/UseDataStore";
import { UseFocusStore } from "@lockin/shared/Store/UseFocusStore";
import { DocHref, FindLists, SourceKey, SourceToImport } from "@lockin/shared/Lib/CollectTodoSources";

/** List v zamčeném dokumentu (náhled vedle To-do boardu, zamčená stránka):
 * nic se needituje, jediná akce je poslat otevřené úkoly do Backlogu. */
function ReadOnlyTodoList({ config }: { config: TodoListConfig }) {
  const focusTasks = UseFocusStore((s) => s.tasks);
  const all = [...config.tasks, ...(config.groups ?? []).flatMap((g) => g.tasks)];
  const imported = new Set(focusTasks.map((t) => t.source?.key));
  const fresh = all.filter((t) => !t.done && !imported.has(SourceKey(config.id, t.id)));

  function Import() {
    const { documents, projects } = UseDataStore.getState();
    const doc = Object.values(documents).find((d) => FindLists(d.id, d.text?.json).some((l) => l.id === config.id));
    const source = {
      listId: config.id,
      title: config.title,
      label: doc ? doc.name || "Untitled" : "Quick Notes",
      href: doc ? DocHref(doc, projects) : "/QuickNotes",
      tasks: fresh,
    };
    UseFocusStore.getState().ImportTasks(SourceToImport(source), "backlog", { id: config.id, title: config.title || "To-do list" });
  }

  return (
    <div className="my-2 flex flex-col gap-2 rounded-xl border border-[var(--lk-line)] p-3">
      <div className="flex items-center gap-2">
        <ListTodo size={16} strokeWidth={1.5} className="shrink-0 text-[var(--lk-text2)]" />
        <p className="min-w-0 flex-1 truncate text-[15px] font-medium text-[var(--lk-ink)]">{config.title || "To-do list"}</p>
        <span className="shrink-0 text-xs tabular-nums text-[var(--lk-muted)]">
          {all.filter((t) => t.done).length}/{all.length}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        {all.map((task) => (
          <div key={task.id} className="flex items-start gap-2 text-sm">
            {task.done ? (
              <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-[5px] bg-[#0485f7] text-[#fff]">
                <Check size={12} strokeWidth={3} />
              </span>
            ) : (
              <Circle size={14} strokeWidth={1.75} className="mt-[3px] shrink-0 text-[var(--lk-subtle)]" />
            )}
            <span className={task.done ? "text-[var(--lk-subtle)] line-through" : "text-[var(--lk-ink)]"}>{task.title || "Untitled task"}</span>
          </div>
        ))}
      </div>
      <Button
        variant="ghost"
        isDisabled={fresh.length === 0}
        onPress={Import}
        className="h-8 w-fit gap-1.5 rounded-lg bg-[#0088ff]/10 px-3 text-[13px] font-medium text-[#0077e0] hover:bg-[#0088ff]/15 disabled:bg-black/[0.04] disabled:text-[var(--lk-muted)]"
      >
        {fresh.length ? <Plus size={14} /> : <Check size={14} />}
        {fresh.length ? `Import ${fresh.length} to Backlog` : "In Backlog"}
      </Button>
    </div>
  );
}

/** Bridges a `richTodoList` Tiptap node's attrs to the shared TodoListView —
 * every edit patches the node's `config` attr so it saves with the document. */
export function TodoListNodeView({ node, editor, updateAttributes, deleteNode }: NodeViewProps) {
  const config = node.attrs.config as TodoListConfig;
  // Zamčení stránky se mění za běhu — node view se musí překreslit i bez změny uzlu.
  const editable = useEditorState({ editor, selector: (ctx) => ctx.editor.isEditable });

  function Patch(patch: Partial<TodoListConfig>) {
    updateAttributes({ config: { ...config, ...patch } });
  }

  /** Routes a task-array edit to either the ungrouped tasks or one group,
   * mirroring Store/UseTodoStore.ts's MapTasksIn for the Quick Notes side. */
  function PatchTasksIn(groupId: string | undefined, fn: (tasks: TodoTask[]) => TodoTask[]) {
    if (!groupId) {
      Patch({ tasks: fn(config.tasks) });
      return;
    }
    Patch({
      groups: (config.groups ?? []).map((g) => (g.id === groupId ? { ...g, tasks: fn(g.tasks) } : g)),
    });
  }

  function PatchGroup(groupId: string, fn: (group: TodoGroup) => TodoGroup) {
    Patch({ groups: (config.groups ?? []).map((g) => (g.id === groupId ? fn(g) : g)) });
  }

  if (!config) return null;
  if (!editable) {
    return (
      <NodeViewWrapper data-type="rich-todo-list" contentEditable={false} draggable={false}>
        <ReadOnlyTodoList config={config} />
      </NodeViewWrapper>
    );
  }

  return (
    // See ScenarioNodeView.tsx's comment on `draggable={false}` — Chromium
    // makes a contentEditable={false} island natively draggable by default,
    // which hijacks drag-to-select-text gestures on any real input nested
    // inside it into a native "not-allowed" element drag instead.
    <NodeViewWrapper data-type="rich-todo-list" contentEditable={false} draggable={false}>
      <TodoListView
        config={config}
        onChangeTitle={(title) => Patch({ title })}
        onChangeDeadline={(deadline) => Patch({ deadline })}
        onChangeDeadlineTime={(deadlineTime) => Patch({ deadlineTime })}
        onChangeStyle={(stylePatch: Partial<TodoListStyle>) =>
          Patch({ style: { ...config.style, ...stylePatch } })
        }
        onToggleTask={(taskId, groupId) =>
          PatchTasksIn(groupId, (tasks) =>
            tasks.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t)),
          )
        }
        onAddTask={(groupId) =>
          PatchTasksIn(groupId, (tasks) => [
            ...tasks,
            { id: `task-${crypto.randomUUID()}`, title: "New task", description: "", done: false },
          ])
        }
        onRemoveTask={(taskId, groupId) =>
          PatchTasksIn(groupId, (tasks) => tasks.filter((t) => t.id !== taskId))
        }
        onUpdateTask={(taskId, patch, groupId) =>
          PatchTasksIn(groupId, (tasks) =>
            tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t)),
          )
        }
        onMoveTask={(taskId, toGroupId, beforeTaskId) => {
          let moved: TodoTask | undefined;
          const RemoveFrom = (tasks: TodoTask[]) =>
            tasks.filter((t) => {
              if (t.id !== taskId) return true;
              moved = t;
              return false;
            });

          const tasks = RemoveFrom(config.tasks);
          const groups = (config.groups ?? []).map((g) =>
            moved ? g : { ...g, tasks: RemoveFrom(g.tasks) },
          );
          if (!moved) return;
          const movedTask = moved;

          function InsertInto(list: TodoTask[]): TodoTask[] {
            const next = [...list];
            const index = beforeTaskId ? next.findIndex((t) => t.id === beforeTaskId) : -1;
            if (index === -1) next.push(movedTask);
            else next.splice(index, 0, movedTask);
            return next;
          }

          if (!toGroupId) {
            Patch({ tasks: InsertInto(tasks), groups });
            return;
          }
          Patch({
            tasks,
            groups: groups.map((g) => (g.id === toGroupId ? { ...g, tasks: InsertInto(g.tasks) } : g)),
          });
        }}
        onAddGroup={() => Patch({ groups: [...(config.groups ?? []), NewTodoGroup()] })}
        onRemoveGroup={(groupId) =>
          Patch({ groups: (config.groups ?? []).filter((g) => g.id !== groupId) })
        }
        onChangeGroupTitle={(groupId, title) => PatchGroup(groupId, (g) => ({ ...g, title }))}
        onChangeGroupIcon={(groupId, icon) => PatchGroup(groupId, (g) => ({ ...g, icon }))}
        onDeleteList={() => deleteNode()}
      />
    </NodeViewWrapper>
  );
}
