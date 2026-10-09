import { BaseDirectory, exists, mkdir, readDir, readTextFile, remove, writeTextFile } from "@tauri-apps/plugin-fs";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { UseDataStore } from "@lockin/shared/Store/UseDataStore";
import { UseFocusStore } from "@lockin/shared/Store/UseFocusStore";
import { UseIgnoredListsStore } from "@lockin/shared/Store/UseIgnoredListsStore";
import { UsePriorityStore } from "@lockin/shared/Store/UsePriorityStore";
import { ActiveWorkspace } from "@lockin/shared/Lib/Workspace";
import { ApplyListEdit, ReadList, SendTaskToBoard } from "@lockin/shared/Lib/TodoActions";
import { UseTodoStore } from "@lockin/shared/Store/UseTodoStore";
import { UseSettingsStore } from "@lockin/shared/Store/UseSettingsStore";
import { BuildBlankDocument, NewDocumentId } from "@lockin/shared/Lib/CreateDocument";
import { CreateNewProject } from "@lockin/shared/Lib/CreateProject";
import { LoadDocument } from "@lockin/shared/Lib/Storage";
import {
  MCP_HEARTBEAT,
  MCP_INBOX,
  MCP_OUTBOX,
  type McpCommand,
  type McpRequest,
  type McpResponse,
} from "@lockin/shared/Lib/McpProtocol";

const APPDATA = { baseDir: BaseDirectory.AppData };
const POLL_MS = 1000;
const HEARTBEAT_EVERY = 2; // každý druhý tik

/** Provede příkaz z MCP přes stejné akce jako To-do Home. Vrací výsledek nebo hodí chybu. */
function Run(command: McpCommand): unknown {
  switch (command.op) {
    case "complete_task": {
      const list = ReadList(command);
      const task = list && [...list.tasks, ...(list.groups ?? []).flatMap((g) => g.tasks)].find((t) => t.id === command.taskId);
      if (!task) throw new Error("Task not found — re-read the list, IDs may have changed.");
      if (task.done !== command.done) ApplyListEdit(command, { kind: "toggle", taskId: command.taskId });
      return ReadList(command);
    }
    case "add_task":
      if (!ApplyListEdit(command, { kind: "add", title: command.title, groupId: command.groupId, description: command.description }))
        throw new Error("List not found.");
      return ReadList(command);
    case "rename_task":
      if (!ApplyListEdit(command, { kind: "rename", taskId: command.taskId, title: command.title, description: command.description }))
        throw new Error("Task not found.");
      return ReadList(command);
    case "send_to_board":
      if (!SendTaskToBoard(command, command.taskId, command.column)) throw new Error("Task not found.");
      return { column: command.column };
    case "board_complete": {
      const task = UseFocusStore.getState().tasks.find((t) => t.id === command.boardTaskId);
      if (!task) throw new Error("Board task not found.");
      if (task.done !== command.done) UseFocusStore.getState().ToggleDone(task.id);
      return UseFocusStore.getState().tasks.find((t) => t.id === task.id);
    }
    case "ignore_list":
      UseIgnoredListsStore.getState().SetIgnored(command.listId, command.ignored);
      return { listId: command.listId, ignored: command.ignored };
    case "write_document": {
      const store = UseDataStore.getState();
      const existing = command.docId ? store.documents[command.docId] : undefined;
      if (command.docId && !existing) throw new Error("Document not found.");
      let doc = existing;
      if (!doc) {
        const name = command.name?.trim() || "Untitled";
        if (Object.values(store.documents).some((d) => d.name.toLowerCase() === name.toLowerCase())) {
          throw new Error(`"${name}" already exists — pass it as \`document\` to edit it, or pick another name.`);
        }
        doc = { ...BuildBlankDocument(NewDocumentId(name, command.folder), null), name };
      }
      const content =
        command.mode === "append" && existing ? [...(existing.text.json.content ?? []), ...(command.json.content ?? [])] : command.json.content;
      store.UpsertDocument({
        ...doc,
        name: existing && command.name ? command.name : doc.name,
        text: { json: { type: "doc", content } },
        updatedAt: new Date().toISOString(),
        revision: (doc.revision ?? 0) + 1,
      });
      return { id: doc.id, name: command.name ?? doc.name };
    }
    case "create_project": {
      const project = CreateNewProject(command.name.trim() || "Untitled", command.folder);
      const store = UseDataStore.getState();
      const root = store.documents[project.rootDocumentId];
      if (command.json?.content?.length && root) {
        store.UpsertDocument({ ...root, text: { json: { type: "doc", content: command.json.content } }, revision: (root.revision ?? 0) + 1 });
      }
      return { projectId: project.id, rootDocumentId: project.rootDocumentId, name: project.name };
    }
    case "set_project": {
      const store = UseDataStore.getState();
      const project = store.projects[command.projectId];
      if (!project) throw new Error("Project not found.");
      const { op, projectId, ...patch } = command;
      // Jen pole, která opravdu přišla — `undefined` by jinak přepsalo hodnotu.
      const changes = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
      if (!Object.keys(changes).length) throw new Error("Nothing to change — pass priority, status, tagIds, deadline or progress.");
      store.UpsertProject({ ...project, ...changes, lastEditedAt: new Date().toISOString() });
      return store.projects[command.projectId];
    }
    case "set_option": {
      const priority = UsePriorityStore.getState();
      const list = command.kind === "priority" ? priority.priorities : priority.statuses;
      if (!list.some((o) => o.id === command.optionId)) throw new Error(`No ${command.kind} with id "${command.optionId}".`);
      const patch = Object.fromEntries(
        Object.entries({ label: command.label, color: command.color }).filter(([, v]) => v !== undefined),
      );
      if (!Object.keys(patch).length) throw new Error("Nothing to change — pass label or color.");
      if (command.kind === "priority") priority.UpdatePriority(command.optionId, patch);
      else priority.UpdateStatus(command.optionId, patch);
      const after = UsePriorityStore.getState();
      return (command.kind === "priority" ? after.priorities : after.statuses).find((o) => o.id === command.optionId);
    }
    case "add_group":
      if (!ApplyListEdit(command, { kind: "addGroup", title: command.title, icon: command.icon })) throw new Error("List not found.");
      return ReadList(command);
    case "delete_task":
      if (!ApplyListEdit(command, { kind: "remove", taskId: command.taskId })) throw new Error("Task not found.");
      return ReadList(command);
    case "delete_group":
      if (!ApplyListEdit(command, { kind: "removeGroup", groupId: command.groupId })) throw new Error("List not found.");
      return ReadList(command);
    case "move_task": {
      const sameList = command.from.docId === command.to.docId && command.from.listId === command.to.listId;
      if (sameList) {
        if (!ApplyListEdit(command.from, { kind: "move", taskId: command.taskId, groupId: command.groupId }))
          throw new Error("List not found.");
        return ReadList(command.to);
      }
      // Mezi listy: nejdriv si ukol precteme, pak ho vyjmeme a vlozime do cile.
      const source = ReadList(command.from);
      const task = source && [...source.tasks, ...(source.groups ?? []).flatMap((g) => g.tasks)].find((t) => t.id === command.taskId);
      if (!task) throw new Error("Task not found in the source list.");
      if (!ApplyListEdit(command.to, { kind: "add", title: task.title, description: task.description, groupId: command.groupId }))
        throw new Error("Target list not found.");
      ApplyListEdit(command.from, { kind: "remove", taskId: command.taskId });
      return { from: ReadList(command.from), to: ReadList(command.to) };
    }
    case "set_list": {
      const patch = Object.fromEntries(
        Object.entries({ title: command.title, deadline: command.deadline, deadlineTime: command.deadlineTime }).filter(
          ([, v]) => v !== undefined,
        ),
      );
      if (!Object.keys(patch).length) throw new Error("Nothing to change - pass title, deadline or deadlineTime.");
      if (command.docId) {
        const store = UseDataStore.getState();
        const doc = store.documents[command.docId];
        if (!doc) throw new Error("Document not found.");
        const json = structuredClone(doc.text.json);
        // Najdeme uzel to-do karty podle ID v jeho configu a prepiseme jen hlavicku.
        let found = false;
        type Node = { attrs?: Record<string, unknown>; content?: Node[] };
        const Walk = (node: Node) => {
          const config = node.attrs?.config as { id?: string } | undefined;
          if (config?.id === command.listId) {
            node.attrs = { ...node.attrs, config: { ...config, ...patch } };
            found = true;
          }
          for (const child of node.content ?? []) Walk(child);
        };
        Walk(json as Node);
        if (!found) throw new Error("Only to-do cards have a title and deadline - a plain checklist does not.");
        store.UpsertDocument({ ...doc, text: { json }, updatedAt: new Date().toISOString(), revision: (doc.revision ?? 0) + 1 });
      } else {
        const exists = UseTodoStore.getState().lists.some((l) => l.id === command.listId);
        if (!exists) throw new Error("List not found.");
        UseTodoStore.setState((s) => ({ lists: s.lists.map((l) => (l.id === command.listId ? { ...l, ...patch } : l)) }));
      }
      return ReadList(command);
    }
    case "delete_document": {
      const store = UseDataStore.getState();
      const doc = store.documents[command.docId];
      if (!doc) throw new Error("Document not found.");
      const project = Object.values(store.projects).find((p) => p.rootDocumentId === command.docId);
      // U projektu maze RemoveProject i jeho podrizene dokumenty (kaskada ve store).
      if (project) store.RemoveProject(project.id);
      else store.RemoveDocument(command.docId);
      return { deleted: command.docId, wasProject: Boolean(project) };
    }
    case "set_document": {
      const store = UseDataStore.getState();
      const doc = store.documents[command.docId];
      if (!doc) throw new Error("Document not found.");
      const { op, docId, ...rest } = command;
      const patch = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));
      if (!Object.keys(patch).length) throw new Error("Nothing to change.");
      store.UpsertDocument({ ...doc, ...patch, updatedAt: new Date().toISOString() });
      return store.documents[command.docId];
    }
    case "board_remove": {
      if (!UseFocusStore.getState().tasks.some((t) => t.id === command.boardTaskId)) throw new Error("Board task not found.");
      UseFocusStore.getState().RemoveTask(command.boardTaskId);
      return { removed: command.boardTaskId };
    }
    case "board_clear": {
      const before = UseFocusStore.getState().tasks.length;
      UseFocusStore.getState().ClearColumn(command.column, command.all);
      return { column: command.column, removed: before - UseFocusStore.getState().tasks.length };
    }
    case "session": {
      const focus = UseFocusStore.getState();
      if (command.action === "start") focus.Start();
      else if (command.action === "pause") focus.Pause();
      else if (command.action === "complete") focus.CompleteCurrent();
      else focus.SkipCurrent();
      const after = UseFocusStore.getState();
      return { running: after.runningSince !== null, current: after.tasks.find((t) => !t.done && t.column === "today") ?? null };
    }
    case "add_option": {
      const priority = UsePriorityStore.getState();
      const Current = () => (command.kind === "priority" ? UsePriorityStore.getState().priorities : UsePriorityStore.getState().statuses);
      const known = new Set(Current().map((o) => o.id));
      if (command.kind === "priority") priority.AddPriority();
      else priority.AddStatus();
      const created = Current().find((o) => !known.has(o.id));
      if (!created) throw new Error("Could not create the option.");
      // AddPriority/AddStatus zalozi "New priority" se sedou - rovnou prepiseme na zadane.
      const patch = { label: command.label, ...(command.color ? { color: command.color } : {}) };
      if (command.kind === "priority") priority.UpdatePriority(created.id, patch);
      else priority.UpdateStatus(created.id, patch);
      return Current().find((o) => o.id === created.id);
    }
    case "remove_option": {
      const priority = UsePriorityStore.getState();
      const list = command.kind === "priority" ? priority.priorities : priority.statuses;
      if (!list.some((o) => o.id === command.optionId)) throw new Error(`No ${command.kind} with id "${command.optionId}".`);
      if (list.length <= 1) throw new Error(`Cannot remove the last ${command.kind}.`);
      // Projekty, ktere volbu pouzivaly, by zustaly s neplatnym ID - prepneme je na prvni zbylou.
      const fallback = list.find((o) => o.id !== command.optionId)!.id;
      const store = UseDataStore.getState();
      for (const project of Object.values(store.projects)) {
        if (project[command.kind] === command.optionId) store.UpsertProject({ ...project, [command.kind]: fallback });
      }
      if (command.kind === "priority") priority.RemovePriority(command.optionId);
      else priority.RemoveStatus(command.optionId);
      return { removed: command.optionId, movedTo: fallback };
    }
    case "board_move": {
      if (!UseFocusStore.getState().tasks.some((t) => t.id === command.boardTaskId)) throw new Error("Board task not found.");
      UseFocusStore.getState().MoveTask(command.boardTaskId, command.column);
      return UseFocusStore.getState().tasks.find((t) => t.id === command.boardTaskId);
    }
    default:
      throw new Error(`Unknown command "${(command as { op: string }).op}" — this LockIn build is older than the MCP server, update it.`);
  }
}

/**
 * Dokumenty, kterych se prikaz tyka. `move_task` sahá na dva.
 */
function DocIds(command: McpCommand): (string | null | undefined)[] {
  const c = command as { docId?: string | null; from?: { docId?: string | null }; to?: { docId?: string | null } };
  return [c.docId, c.from?.docId, c.to?.docId];
}

/**
 * Znovu nacte dokument, ktery nekdo prepsal na disku za behu aplikace.
 *
 * .md soubory nikdo nesleduje: MCP je cte z disku pokazde, aplikace drzi kopii
 * z chvile, kdy se nacetla. Jakmile do souboru sahne neco jineho (Claude Code,
 * git, editor), ids uzlu se mezi tim, co MCP precte, a tim, v cem aplikace
 * hleda, rozejdou — a kazdy zapis skonci na "Task not found" nebo
 * "Document not found", aniz by z hlasky slo poznat, proc. Merene na
 * projects/ali.md: cteni vracelo ref, ktery zapis neznal.
 *
 * Obnovuje se jen smerem od novejsiho souboru. Rozdelana zmena v aplikaci,
 * ktera jeste nedotekla na disk, se tim nesmi prepsat jen proto, ze MCP sahlo
 * na jiny ukol v tomtez dokumentu.
 *
 * ponytail: obnova az ve chvili prikazu, ne hlidac slozky. Sleduje presne ta
 * mista, kde na tom zalezi; az bude vadit i zastaraly obsah na obrazovce,
 * patri sem watcher nad vaultem.
 */
async function Refresh(docId: string | null | undefined): Promise<void> {
  if (!docId) return;
  const fresh = await LoadDocument(docId).catch(() => null);
  if (!fresh) return;

  const current = UseDataStore.getState().documents[docId];
  if (current && Date.parse(fresh.updatedAt) <= Date.parse(current.updatedAt)) return;

  // Rovnou do store, ne pres UpsertDocument: ten by cerstve precteny obsah
  // hned zapsal zpatky na disk, coz je prace navic a zbytecne riziko.
  UseDataStore.setState((state) => ({ documents: { ...state.documents, [fresh.id]: fresh } }));
}

async function Handle(file: string, workspaceId: string) {
  const path = `${MCP_INBOX}/${file}`;
  let response: McpResponse;
  let id = file.replace(/\.json$/, "");
  try {
    const request = JSON.parse(await readTextFile(path, APPDATA)) as McpRequest;
    id = request.id;
    if (request.workspaceId !== workspaceId) {
      throw new Error(`LockIn has a different workspace open (${workspaceId}). Switch to ${request.workspaceId} in the sidebar first.`);
    }
    // Dokud se data nenačetla z disku, by příkaz sáhl do prázdného store.
    if (!UseDataStore.getState().hydrated) throw new Error("LockIn is still loading, try again in a moment.");
    for (const docId of DocIds(request.command)) await Refresh(docId);
    if (!UseSettingsStore.getState().mcpWrites) {
      throw new Error("Changes from AI agents are turned off in LockIn (Settings → AI & MCP). Reading still works.");
    }
    response = { id, ok: true, result: Run(request.command) };
  } catch (error) {
    response = { id, ok: false, error: error instanceof Error ? error.message : String(error) };
  }
  await writeTextFile(`${MCP_OUTBOX}/${id}.json`, JSON.stringify(response), APPDATA);
  await remove(path, APPDATA).catch(() => {});
}

let started = false;

/** Spustí se jednou v hlavním okně: heartbeat + zpracování příkazů z MCP. */
export async function StartMcpBridge(): Promise<void> {
  if (started) return;
  started = true;
  try {
    if (getCurrentWindow().label !== "main") return;
  } catch {
    return; // mimo Tauri
  }
  const workspaceId = ActiveWorkspace().id;
  for (const dir of [MCP_INBOX, MCP_OUTBOX]) {
    if (!(await exists(dir, APPDATA))) await mkdir(dir, { ...APPDATA, recursive: true });
  }

  let tick = 0;
  let busy = false;
  setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      if (tick++ % HEARTBEAT_EVERY === 0) {
        await writeTextFile(MCP_HEARTBEAT, JSON.stringify({ workspaceId, at: Date.now() }), APPDATA);
      }
      const files = (await readDir(MCP_INBOX, APPDATA)).filter((e) => e.isFile && e.name.endsWith(".json"));
      for (const file of files) await Handle(file.name, workspaceId);
    } catch (error) {
      console.warn("McpBridge tick failed", error);
    } finally {
      busy = false;
    }
  }, POLL_MS);
}
