import { UseDataStore } from "@lockin/shared/Store/UseDataStore";
import { UseTodoStore } from "@lockin/shared/Store/UseTodoStore";
import { UseFocusStore, type FocusColumn } from "@lockin/shared/Store/UseFocusStore";
import { GetPlatform } from "@lockin/shared/Platform/Platform";
import { DocHref, FindLists, SourceToImport, type TodoSource } from "./CollectTodoSources";
import { EditConfig, EditDocumentList, type TodoEdit } from "./TodoEdit";

/** Kde list žije: v dokumentu (docId), nebo v Quick Notes (docId = null). */
export interface ListRef {
  docId: string | null;
  listId: string;
}

/** Uloží změnu listu tam, kde list žije: do dokumentu (i .md souboru), nebo do Quick Notes.
 * Sdílí To-do Home i MCP bridge, aby šly změny vždy stejnou cestou. */
export function ApplyListEdit(ref: ListRef, edit: TodoEdit): boolean {
  if (!ref.docId) {
    const exists = UseTodoStore.getState().lists.some((l) => l.id === ref.listId);
    UseTodoStore.setState((s) => ({ lists: s.lists.map((l) => (l.id === ref.listId ? EditConfig(l, edit) : l)) }));
    return exists;
  }
  const doc = UseDataStore.getState().documents[ref.docId];
  const next = doc && EditDocumentList(doc, ref.listId, edit);
  if (next) UseDataStore.getState().UpsertDocument(next);
  return Boolean(next);
}

/** Aktuální podoba listu (po změně) — pro odpověď MCP. */
export function ReadList(ref: ListRef) {
  if (!ref.docId) return UseTodoStore.getState().lists.find((l) => l.id === ref.listId) ?? null;
  const doc = UseDataStore.getState().documents[ref.docId];
  const list = doc && FindLists(doc.id, doc.text?.json).find((l) => l.id === ref.listId);
  return list ? { id: list.id, title: list.title, tasks: list.tasks, groups: list.groups } : null;
}

/** Pošle úkol z listu na To-do board (Backlog / This week / Today). */
export function SendTaskToBoard(ref: ListRef, taskId: string, column: FocusColumn): boolean {
  const list = ReadList(ref);
  const task = list && [...list.tasks, ...(list.groups ?? []).flatMap((g) => g.tasks)].find((t) => t.id === taskId);
  if (!list || !task) return false;
  const { documents, projects } = UseDataStore.getState();
  const doc = ref.docId ? documents[ref.docId] : undefined;
  const source = {
    listId: list.id,
    title: list.title,
    label: doc ? doc.name || "Untitled" : "Quick Notes",
    href: doc ? DocHref(doc, projects) : "/QuickNotes",
    tasks: [task],
  };
  UseFocusStore.getState().ImportTasks(SourceToImport(source), column);
  return true;
}

/**
 * „Chci teď dělat na tomhle listu": otevřené úkoly listu jdou na úplný začátek
 * Today (i ty, co už na boardu byly jinde) a spustí se session — aktuální úkol
 * je vždy první nehotový v Today, takže session začne právě tímhle listem.
 * Vrací false, když list nemá žádný otevřený úkol.
 */
export function StartListSession(source: TodoSource): boolean {
  const open = source.tasks.filter((t) => !t.done);
  if (!open.length) return false;
  const focus = UseFocusStore.getState();
  // Běžící úsek se nejdřív připíše úkolu, na kterém se dělalo, než se pořadí změní.
  focus.Pause();
  focus.ImportTasks(SourceToImport({ ...source, tasks: open }), "today");
  const prefix = `${source.listId}:`;
  UseFocusStore.setState((s) => {
    // Pořadí podle listu, ne podle toho, kdy se který úkol dostal na board.
    const order = new Map(source.tasks.map((t, i) => [`${prefix}${t.id}`, i]));
    const mine = s.tasks
      .filter((t) => !t.done && t.source?.key.startsWith(prefix))
      .sort((a, b) => (order.get(a.source!.key) ?? 0) - (order.get(b.source!.key) ?? 0))
      .map((t) => ({ ...t, column: "today" as const, groupId: undefined }));
    const ids = new Set(mine.map((t) => t.id));
    const rest = s.tasks.filter((t) => !ids.has(t.id));
    // Skupina po importu celého listu, která teď zůstala prázdná, zmizí.
    const groups = s.groups.filter((g) => g.sourceListId !== source.listId || rest.some((t) => t.groupId === g.id));
    return { tasks: [...mine, ...rest], groups };
  });
  UseFocusStore.getState().Start();
  return true;
}

/** Ukáže běžící session: na desktopu připnuté okno na hlavním monitoru, na webu
 * vrátí false a volající přejde na Board (ten běžící session ukáže sám). */
export async function ShowSession(): Promise<boolean> {
  const win = GetPlatform().window;
  if (!win.isAvailable) return false;
  const monitors = await win.ListMonitors();
  const primary = Math.max(0, monitors.findIndex((name) => name.includes("(primary)")));
  await win.OpenSessionWindow(primary).catch((error: unknown) => console.warn("OpenSessionWindow failed", error));
  return true;
}
