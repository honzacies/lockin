import type { JSONContent } from "@tiptap/core";
import type { DocumentRecord } from "@lockin/shared/Types/Project";
import type { TodoListConfig, TodoTask } from "@lockin/shared/Types/QuickNotes";
import { FindLists, PlainText } from "./CollectTodoSources";

/** Změna jednoho to-do listu z Home (bez otevření dokumentu). */
export type TodoEdit =
  | { kind: "toggle"; taskId: string }
  | { kind: "rename"; taskId: string; title: string; description?: string }
  | { kind: "add"; title: string; groupId?: string; description?: string }
  | { kind: "addGroup"; title: string; icon?: string }
  | { kind: "remove"; taskId: string }
  /** Sekce zmizí; její úkoly se přesunou mezi nezařazené, ať se omylem neztratí. */
  | { kind: "removeGroup"; groupId: string }
  | { kind: "move"; taskId: string; groupId?: string };

/** Všechny úkoly listu, nezařazené i ve skupinách. */
function Everything(config: Pick<TodoListConfig, "tasks" | "groups">): TodoTask[] {
  return [...config.tasks, ...(config.groups ?? []).flatMap((g) => g.tasks)];
}

/** To-do karta / Quick Notes list — vrací nový config, původní nemění. */
export function EditConfig<C extends Pick<TodoListConfig, "tasks" | "groups">>(config: C, edit: TodoEdit): C {
  const HasTaskId = (e: TodoEdit): e is Extract<TodoEdit, { taskId: string }> => "taskId" in e;
  const Map = (tasks: TodoTask[]) =>
    tasks
      .filter((t) => !(edit.kind === "remove" && t.id === edit.taskId) && !(edit.kind === "move" && t.id === edit.taskId))
      .map((t) => {
        if (!HasTaskId(edit) || t.id !== edit.taskId) return t;
        if (edit.kind === "toggle") return { ...t, done: !t.done };
        if (edit.kind === "rename") return { ...t, title: edit.title, ...(edit.description === undefined ? {} : { description: edit.description }) };
        return t;
      });
  const task: TodoTask = {
    id: `task-${crypto.randomUUID()}`,
    title: edit.kind === "add" ? edit.title : "",
    description: (edit.kind === "add" && edit.description) || "",
    done: false,
  };
  // Přesouvaný úkol se nejdřív vyjme (Map ho odfiltruje) a pak vloží na cíl.
  const moving = edit.kind === "move" ? Everything(config).find((t) => t.id === edit.taskId) : undefined;
  if (edit.kind === "move" && !moving) throw new Error("Task not found in this list.");
  const addHere = (groupId?: string) =>
    (edit.kind === "add" && edit.groupId === groupId) || (edit.kind === "move" && edit.groupId === groupId);
  const Extra = (groupId?: string) => (addHere(groupId) ? [edit.kind === "move" ? moving! : task] : []);

  let groups = (config.groups ?? []).map((g) => ({ ...g, tasks: [...Map(g.tasks), ...Extra(g.id)] }));
  if (edit.kind === "addGroup") {
    groups.push({ id: `group-${crypto.randomUUID()}`, title: edit.title, ...(edit.icon ? { icon: edit.icon } : {}), tasks: [] });
  }
  let loose = [...Map(config.tasks), ...Extra(undefined)];
  if (edit.kind === "removeGroup") {
    const gone = groups.find((g) => g.id === edit.groupId);
    if (!gone) throw new Error("Section not found.");
    // Úkoly ze smazané sekce nemizí — spadnou mezi nezařazené.
    loose = [...loose, ...gone.tasks];
    groups = groups.filter((g) => g.id !== edit.groupId);
  }
  return { ...config, tasks: loose, groups };
}

function TaskItem(title: string): JSONContent {
  return { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph", content: [{ type: "text", text: title }] }] };
}

/** Upraví list uvnitř dokumentu a vrátí nový dokument k uložení (nebo null,
 * když list mezitím zmizel). Checkbox list (`- [ ]`) má ID úkolu = jeho text. */
export function EditDocumentList(doc: DocumentRecord, listId: string, edit: TodoEdit): DocumentRecord | null {
  const json = structuredClone(doc.text.json);
  const list = FindLists(doc.id, json).find((l) => l.id === listId);
  if (!list) return null;

  if (list.kind === "card") {
    list.node.attrs = { ...list.node.attrs, config: EditConfig(list.node.attrs!.config as TodoListConfig, edit) };
  } else if (edit.kind === "addGroup" || edit.kind === "removeGroup" || edit.kind === "move") {
    // Checkboxový list (`- [ ]`) je plochý seznam odrážek, sekce v něm neexistují.
    throw new Error("This list is a plain checklist — it has no sections to put tasks in. Only to-do cards do.");
  } else {
    const items = list.node.content ?? [];
    if (edit.kind === "add") items.push(TaskItem(edit.title));
    else {
      const at = items.findIndex((i) => PlainText(i).trim() === edit.taskId);
      if (at === -1) return null;
      const item = items[at];
      if (edit.kind === "toggle") item.attrs = { ...item.attrs, checked: !item.attrs?.checked };
      else if (edit.kind === "remove") items.splice(at, 1);
      // Přejmenování nahradí text položky (případné formátování uvnitř zmizí).
      else item.content = [{ type: "paragraph", content: [{ type: "text", text: edit.title }] }];
    }
    list.node.content = items;
  }
  return { ...doc, text: { json }, updatedAt: new Date().toISOString() };
}
