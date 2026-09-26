import { BaseDirectory, exists, mkdir, readDir, readTextFile, remove, writeTextFile } from "@tauri-apps/plugin-fs";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { UseDataStore } from "@lockin/shared/Store/UseDataStore";
import { UseFocusStore } from "@lockin/shared/Store/UseFocusStore";
import { ActiveWorkspace } from "@lockin/shared/Lib/Workspace";
import { ApplyListEdit, ReadList, SendTaskToBoard } from "@lockin/shared/Lib/TodoActions";
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
      if (!ApplyListEdit(command, { kind: "add", title: command.title, groupId: command.groupId })) throw new Error("List not found.");
      return ReadList(command);
    case "rename_task":
      if (!ApplyListEdit(command, { kind: "rename", taskId: command.taskId, title: command.title })) throw new Error("Task not found.");
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
    case "board_move": {
      if (!UseFocusStore.getState().tasks.some((t) => t.id === command.boardTaskId)) throw new Error("Board task not found.");
      UseFocusStore.getState().MoveTask(command.boardTaskId, command.column);
      return UseFocusStore.getState().tasks.find((t) => t.id === command.boardTaskId);
    }
  }
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
