import type { JSONContent } from "@tiptap/core";
import type { DocumentRecord } from "@lockin/shared/Types/Project";
import type { TodoListConfig, TodoTask } from "@lockin/shared/Types/QuickNotes";
import { FindLists, PlainText } from "./CollectTodoSources";

/** Změna jednoho to-do listu z Home (bez otevření dokumentu). */
export type TodoEdit =
  | { kind: "toggle"; taskId: string }
  | { kind: "rename"; taskId: string; title: string }
  | { kind: "add"; title: string; groupId?: string };

/** To-do karta / Quick Notes list — vrací nový config, původní nemění. */
export function EditConfig<C extends Pick<TodoListConfig, "tasks" | "groups">>(config: C, edit: TodoEdit): C {
  const Map = (tasks: TodoTask[]) =>
    tasks.map((t) => {
      if (edit.kind === "add" || t.id !== edit.taskId) return t;
      return edit.kind === "toggle" ? { ...t, done: !t.done } : { ...t, title: edit.title };
    });
  const task: TodoTask = { id: `task-${Date.now()}`, title: edit.kind === "add" ? edit.title : "", description: "", done: false };
  const addHere = (groupId?: string) => edit.kind === "add" && edit.groupId === groupId;
  return {
    ...config,
    tasks: [...Map(config.tasks), ...(addHere(undefined) ? [task] : [])],
    groups: (config.groups ?? []).map((g) => ({ ...g, tasks: [...Map(g.tasks), ...(addHere(g.id) ? [task] : [])] })),
  };
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
  } else {
    const items = list.node.content ?? [];
    if (edit.kind === "add") items.push(TaskItem(edit.title));
    else {
      const item = items.find((i) => PlainText(i).trim() === edit.taskId);
      if (!item) return null;
      if (edit.kind === "toggle") item.attrs = { ...item.attrs, checked: !item.attrs?.checked };
      // Přejmenování nahradí text položky (případné formátování uvnitř zmizí).
      else item.content = [{ type: "paragraph", content: [{ type: "text", text: edit.title }] }];
    }
    list.node.content = items;
  }
  return { ...doc, text: { json }, updatedAt: new Date().toISOString() };
}
