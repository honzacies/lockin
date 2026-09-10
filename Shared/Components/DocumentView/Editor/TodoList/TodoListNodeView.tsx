"use client";

import type { NodeViewProps } from "@tiptap/core";
import { NodeViewWrapper } from "@tiptap/react";
import type { TodoGroup, TodoListConfig, TodoListStyle, TodoTask } from "@lockin/shared/Types/QuickNotes";
import { NewTodoGroup } from "@lockin/shared/Types/QuickNotes";
import { TodoListView } from "@lockin/shared/Components/QuickNotes/TodoListView";

/** Bridges a `richTodoList` Tiptap node's attrs to the shared TodoListView —
 * every edit patches the node's `config` attr so it saves with the document. */
export function TodoListNodeView({ node, updateAttributes, deleteNode }: NodeViewProps) {
  const config = node.attrs.config as TodoListConfig;

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
            { id: `task-${Date.now()}`, title: "New task", description: "", done: false },
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
