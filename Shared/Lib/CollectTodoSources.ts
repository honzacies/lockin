import type { JSONContent } from "@tiptap/core";
import type { DocumentRecord, Project } from "@lockin/shared/Types/Project";
import type { TodoListConfig, TodoTask } from "@lockin/shared/Types/QuickNotes";

/** Jeden to-do list odkudkoliv z aplikace, ze kterého jde importovat do To-do režimu. */
export interface TodoSource {
  listId: string;
  title: string;
  /** Odkud list je — název dokumentu nebo „Quick Notes". */
  label: string;
  href: string;
  /** Jen nehotové úkoly, včetně těch ve skupinách. */
  tasks: TodoTask[];
}

function OpenTasks(list: Pick<TodoListConfig, "tasks" | "groups">): TodoTask[] {
  return [...list.tasks, ...(list.groups ?? []).flatMap((g) => g.tasks)].filter((t) => !t.done);
}

/** List nalezený v dokumentu — i s odkazem na uzel v JSONu, aby šel upravit
 * (Home v To-do režimu: odškrtnutí, přejmenování, nový úkol). */
export type FoundList = Pick<TodoListConfig, "id" | "title" | "tasks" | "groups"> & {
  kind: "card" | "checklist";
  node: JSONContent;
};

export function PlainText(node: JSONContent): string {
  return node.text ?? (node.content ?? []).map(PlainText).join("");
}

/** To-do karty (richTodoList) i obyčejné markdown checkboxy (`- [ ]`, taskList
 * z .md souborů). Checkbox list se jmenuje podle nadpisu nad ním; ID úkolu je
 * jeho text, aby se po přenačtení souboru nezměnilo a import nezdvojoval. */
export function FindLists(docId: string, node: JSONContent | undefined, out: FoundList[] = [], heading = { text: "" }): FoundList[] {
  if (!node) return out;
  if (node.type === "heading") heading.text = PlainText(node);
  if (node.type === "richTodoList" && node.attrs?.config) out.push({ ...(node.attrs.config as TodoListConfig), kind: "card", node });
  if (node.type === "taskList") {
    const title = heading.text || "Checklist";
    const tasks = (node.content ?? []).map((item) => {
      const text = PlainText(item).trim();
      return { id: text, title: text, description: "", done: !!item.attrs?.checked };
    });
    // Dva checkbox listy pod stejným nadpisem dostanou #2, #3…, jinak by se při importu slily.
    const same = out.filter((list) => list.id === `${docId}#${title}` || list.id.startsWith(`${docId}#${title}#`)).length;
    out.push({ id: same ? `${docId}#${title}#${same + 1}` : `${docId}#${title}`, title, tasks, groups: [], kind: "checklist", node });
    return out;
  }
  node.content?.forEach((child) => FindLists(docId, child, out, heading));
  return out;
}

/** Kam vede odkaz na dokument — kořen projektu otevírá projekt. */
export function DocHref(doc: Pick<DocumentRecord, "id" | "projectId">, projects: Record<string, Project>): string {
  const project = doc.projectId ? projects[doc.projectId] : undefined;
  return !doc.projectId
    ? `/Document?id=${encodeURIComponent(doc.id)}`
    : `/YourProjects/Project?id=${encodeURIComponent(doc.projectId)}${
        project?.rootDocumentId === doc.id ? "" : `&doc=${encodeURIComponent(doc.id)}`
      }`;
}

export function CollectTodoSources(
  quickLists: TodoListConfig[],
  documents: DocumentRecord[],
  projects: Record<string, Project>,
): TodoSource[] {
  const sources = quickLists.map((list) => ({
    listId: list.id,
    title: list.title,
    label: "Quick Notes",
    href: "/QuickNotes",
    tasks: OpenTasks(list),
  }));
  for (const doc of documents) {
    const href = DocHref(doc, projects);
    for (const list of FindLists(doc.id, doc.text?.json)) {
      sources.push({ listId: list.id, title: list.title, label: doc.name || "Untitled", href, tasks: OpenTasks(list) });
    }
  }
  return sources;
}

/** Klíč, podle kterého se pozná, že úkol už v To-do režimu je. */
export function SourceKey(listId: string, taskId: string): string {
  return `${listId}:${taskId}`;
}

/** Úkoly listu ve tvaru pro import do To-do režimu (celý list, nebo jen vybrané). */
export function SourceToImport(source: TodoSource, taskIds?: string[]) {
  return source.tasks
    .filter((t) => !taskIds || taskIds.includes(t.id))
    .map((t) => ({
      title: t.title,
      description: t.description || undefined,
      source: { key: SourceKey(source.listId, t.id), label: source.label, href: source.href },
    }));
}
