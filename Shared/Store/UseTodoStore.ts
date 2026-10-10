import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { TodoGroup, TodoListConfig, TodoListStyle, TodoTask } from "@lockin/shared/Types/QuickNotes";
import { DEFAULT_TODO_LIST_STYLE, NewTodoGroup } from "@lockin/shared/Types/QuickNotes";
import { CreatePersistStorage } from "@lockin/shared/Platform/PersistStorage";

function NewList(): TodoListConfig {
  return {
    id: `todo-list-${crypto.randomUUID()}`,
    title: "New to-do list",
    deadline: null,
    deadlineTime: null,
    tasks: [],
    groups: [],
    style: DEFAULT_TODO_LIST_STYLE,
  };
}

const DEFAULT_LISTS: TodoListConfig[] = [];

interface TodoState {
  lists: TodoListConfig[];
  AddList: () => void;
  RemoveList: (listId: string) => void;
  SetListTitle: (listId: string, title: string) => void;
  SetListDeadline: (listId: string, deadline: string | null) => void;
  SetListDeadlineTime: (listId: string, deadlineTime: string | null) => void;
  UpdateListStyle: (listId: string, patch: Partial<TodoListStyle>) => void;
  ToggleTask: (listId: string, taskId: string, groupId?: string) => void;
  AddTask: (listId: string, groupId?: string) => void;
  RemoveTask: (listId: string, taskId: string, groupId?: string) => void;
  UpdateTask: (
    listId: string,
    taskId: string,
    patch: Partial<Pick<TodoTask, "title" | "description">>,
    groupId?: string,
  ) => void;
  /** Moves a task to a new position, anywhere in the list — into a
   * different group, into/out of the ungrouped section, or just reordered
   * within the same one. Pass `beforeTaskId: null` to move it to the end of
   * the destination. */
  MoveTask: (
    listId: string,
    taskId: string,
    toGroupId: string | undefined,
    beforeTaskId: string | null,
  ) => void;
  AddGroup: (listId: string) => void;
  RemoveGroup: (listId: string, groupId: string) => void;
  SetGroupTitle: (listId: string, groupId: string, title: string) => void;
  SetGroupIcon: (listId: string, groupId: string, icon: string | undefined) => void;
}

function MapList(
  lists: TodoListConfig[],
  listId: string,
  fn: (list: TodoListConfig) => TodoListConfig,
): TodoListConfig[] {
  return lists.map((list) => (list.id === listId ? fn(list) : list));
}

/** Routes a task-array edit to either the list's ungrouped tasks or one of
 * its groups, depending on whether `groupId` is given. */
function MapTasksIn(
  list: TodoListConfig,
  groupId: string | undefined,
  fn: (tasks: TodoTask[]) => TodoTask[],
): TodoListConfig {
  if (!groupId) return { ...list, tasks: fn(list.tasks) };
  return {
    ...list,
    groups: (list.groups ?? []).map((g) => (g.id === groupId ? { ...g, tasks: fn(g.tasks) } : g)),
  };
}

function MapGroup(
  list: TodoListConfig,
  groupId: string,
  fn: (group: TodoGroup) => TodoGroup,
): TodoListConfig {
  return { ...list, groups: (list.groups ?? []).map((g) => (g.id === groupId ? fn(g) : g)) };
}

/** Quick Notes to-do lists — persisted so they survive an app restart
 * (unlike the rest of Quick Notes, which is still session-only). */
export const UseTodoStore = create<TodoState>()(
  persist(
    (set) => ({
      lists: DEFAULT_LISTS,
      AddList: () => set((state) => ({ lists: [...state.lists, NewList()] })),
      RemoveList: (listId) =>
        set((state) => ({ lists: state.lists.filter((l) => l.id !== listId) })),
      SetListTitle: (listId, title) =>
        set((state) => ({ lists: MapList(state.lists, listId, (l) => ({ ...l, title })) })),
      SetListDeadline: (listId, deadline) =>
        set((state) => ({
          lists: MapList(state.lists, listId, (l) => ({ ...l, deadline })),
        })),
      SetListDeadlineTime: (listId, deadlineTime) =>
        set((state) => ({
          lists: MapList(state.lists, listId, (l) => ({ ...l, deadlineTime })),
        })),
      UpdateListStyle: (listId, patch) =>
        set((state) => ({
          lists: MapList(state.lists, listId, (l) => ({
            ...l,
            style: { ...l.style, ...patch },
          })),
        })),
      ToggleTask: (listId, taskId, groupId) =>
        set((state) => ({
          lists: MapList(state.lists, listId, (l) =>
            MapTasksIn(l, groupId, (tasks) =>
              tasks.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t)),
            ),
          ),
        })),
      AddTask: (listId, groupId) =>
        set((state) => ({
          lists: MapList(state.lists, listId, (l) =>
            MapTasksIn(l, groupId, (tasks) => [
              ...tasks,
              { id: `task-${crypto.randomUUID()}`, title: "New task", description: "", done: false },
            ]),
          ),
        })),
      RemoveTask: (listId, taskId, groupId) =>
        set((state) => ({
          lists: MapList(state.lists, listId, (l) =>
            MapTasksIn(l, groupId, (tasks) => tasks.filter((t) => t.id !== taskId)),
          ),
        })),
      UpdateTask: (listId, taskId, patch, groupId) =>
        set((state) => ({
          lists: MapList(state.lists, listId, (l) =>
            MapTasksIn(l, groupId, (tasks) =>
              tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t)),
            ),
          ),
        })),
      MoveTask: (listId, taskId, toGroupId, beforeTaskId) =>
        set((state) => ({
          lists: MapList(state.lists, listId, (l) => {
            let moved: TodoTask | undefined;
            const RemoveFrom = (tasks: TodoTask[]) =>
              tasks.filter((t) => {
                if (t.id !== taskId) return true;
                moved = t;
                return false;
              });

            const tasks = RemoveFrom(l.tasks);
            const groups = (l.groups ?? []).map((g) =>
              moved ? g : { ...g, tasks: RemoveFrom(g.tasks) },
            );
            if (!moved) return l;
            const movedTask = moved;

            function InsertInto(list: TodoTask[]): TodoTask[] {
              const next = [...list];
              const index = beforeTaskId ? next.findIndex((t) => t.id === beforeTaskId) : -1;
              if (index === -1) next.push(movedTask);
              else next.splice(index, 0, movedTask);
              return next;
            }

            if (!toGroupId) return { ...l, tasks: InsertInto(tasks), groups };
            const nextGroups = groups.map((g) =>
              g.id === toGroupId ? { ...g, tasks: InsertInto(g.tasks) } : g,
            );
            return { ...l, tasks, groups: nextGroups };
          }),
        })),
      AddGroup: (listId) =>
        set((state) => ({
          lists: MapList(state.lists, listId, (l) => ({
            ...l,
            groups: [...(l.groups ?? []), NewTodoGroup()],
          })),
        })),
      RemoveGroup: (listId, groupId) =>
        set((state) => ({
          lists: MapList(state.lists, listId, (l) => ({
            ...l,
            groups: (l.groups ?? []).filter((g) => g.id !== groupId),
          })),
        })),
      SetGroupTitle: (listId, groupId, title) =>
        set((state) => ({
          lists: MapList(state.lists, listId, (l) => MapGroup(l, groupId, (g) => ({ ...g, title }))),
        })),
      SetGroupIcon: (listId, groupId, icon) =>
        set((state) => ({
          lists: MapList(state.lists, listId, (l) => MapGroup(l, groupId, (g) => ({ ...g, icon }))),
        })),
    }),
    {
      name: "lockin-todo-lists",
      storage: createJSONStorage(() => CreatePersistStorage("todo-lists.json")),
      skipHydration: true,
    },
  ),
);
