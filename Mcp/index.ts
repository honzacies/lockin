#!/usr/bin/env bun
// LockIn MCP server — stdio. Registrace do Claude Code:
//   claude mcp add lockin -- bun D:/Projects/lockin/Mcp/index.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { ListWorkspaces, LoadWorkspace, ResolveWorkspace } from "./Data";
import { Board, Document, FilterTasks, Next, Overview } from "./Views";
import { AppStatus, Send } from "./Bridge";

const server = new McpServer(
  { name: "lockin", version: "0.1.0" },
  {
    instructions: [
      "LockIn is the user's workspace for projects, notes and to-do lists.",
      "Typical flow: lockin_next to pick what to work on (each pick explains why), lockin_document for context,",
      "do the work, then lockin_complete_task with the task's `ref`. Use lockin_send_to_board to plan (Today / This week / Backlog).",
      "Reading works any time; writing needs the LockIn desktop app open on the same workspace.",
      "Task refs change when a checklist task is renamed — re-read before writing if unsure.",
    ].join(" "),
  },
);

const workspaceArg = { workspace: z.string().optional().describe("Workspace name or ID. Defaults to the one open in LockIn.") };
const refArgs = {
  docId: z.string().nullable().describe("ref.docId from a read tool (null = Quick Notes)"),
  listId: z.string().describe("ref.listId from a read tool"),
};
const column = z.enum(["today", "week", "backlog"]).describe("Board column: today, week (This week) or backlog");

/** Každý nástroj vrací JSON jako text; chyba se vrátí jako isError, ne pád serveru. */
function Tool<A>(fn: (args: A) => unknown | Promise<unknown>) {
  return async (args: A) => {
    try {
      const result = await fn(args);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { isError: true, content: [{ type: "text" as const, text: error instanceof Error ? error.message : String(error) }] };
    }
  };
}

const Load = (workspace?: string) => LoadWorkspace(ResolveWorkspace(workspace));

// ---- čtení -----------------------------------------------------------------

server.registerTool(
  "lockin_workspaces",
  { title: "Workspaces", description: "List LockIn workspaces, which one is open, and whether the app is running (needed for writes).", inputSchema: {} },
  Tool(() => {
    const { active, list } = ListWorkspaces();
    const current = ResolveWorkspace();
    return { active, workspaces: list, app: AppStatus(current) };
  }),
);

server.registerTool(
  "lockin_overview",
  {
    title: "Overview",
    description: "Everything at a glance, like the To-do Home screen: totals, board counts, and every project with its lists, progress, status and priority.",
    inputSchema: workspaceArg,
  },
  Tool(({ workspace }: { workspace?: string }) => Overview(Load(workspace))),
);

server.registerTool(
  "lockin_board",
  { title: "Board", description: "The focus board in display order: Today, This week, Backlog, plus the current task and whether a session is running.", inputSchema: workspaceArg },
  Tool(({ workspace }: { workspace?: string }) => Board(Load(workspace))),
);

server.registerTool(
  "lockin_tasks",
  {
    title: "Tasks",
    description: "Search tasks across all to-do lists. Each result has a `ref` for the write tools and shows if it's already on the board.",
    inputSchema: {
      ...workspaceArg,
      project: z.string().optional().describe("Project or document name (substring)"),
      query: z.string().optional().describe("Text to find in task, list, group or document"),
      status: z.enum(["open", "done", "all"]).optional().describe("Default: open"),
      limit: z.number().int().min(1).max(500).optional().describe("Default: 50"),
    },
  },
  Tool((args: { workspace?: string; project?: string; query?: string; status?: "open" | "done" | "all"; limit?: number }) =>
    FilterTasks(Load(args.workspace), args),
  ),
);

server.registerTool(
  "lockin_next",
  {
    title: "What next",
    description:
      "Strategic pick of what to do next, ranked. Weighs the board (Today > This week > Backlog), list and project deadlines, project priority and status, and tasks that finish an almost-done list. Each pick says why.",
    inputSchema: { ...workspaceArg, limit: z.number().int().min(1).max(30).optional().describe("Default: 5") },
  },
  Tool(({ workspace, limit }: { workspace?: string; limit?: number }) => Next(Load(workspace), limit)),
);

server.registerTool(
  "lockin_document",
  {
    title: "Document",
    description: "Read a note/document as Markdown (in folder workspaces the exact file, frontmatter included). Use it for context around a task.",
    inputSchema: { ...workspaceArg, document: z.string().describe("Document ID, path (e.g. projects/lockin) or name") },
  },
  Tool(({ workspace, document }: { workspace?: string; document: string }) => Document(Load(workspace), document)),
);

// ---- zápis (přes běžící aplikaci) -------------------------------------------

server.registerTool(
  "lockin_complete_task",
  {
    title: "Complete task",
    description: "Tick (or untick) a task in its to-do list. The change is saved into the source document.",
    inputSchema: { ...workspaceArg, ...refArgs, taskId: z.string(), done: z.boolean().optional().describe("Default: true") },
  },
  Tool(async (a: { workspace?: string; docId: string | null; listId: string; taskId: string; done?: boolean }) =>
    Send(ResolveWorkspace(a.workspace), { op: "complete_task", docId: a.docId, listId: a.listId, taskId: a.taskId, done: a.done ?? true }),
  ),
);

server.registerTool(
  "lockin_add_task",
  {
    title: "Add task",
    description: "Add a task to an existing to-do list (optionally into one of its groups). Keep titles short and actionable.",
    inputSchema: { ...workspaceArg, ...refArgs, title: z.string().min(1), groupId: z.string().optional() },
  },
  Tool(async (a: { workspace?: string; docId: string | null; listId: string; title: string; groupId?: string }) =>
    Send(ResolveWorkspace(a.workspace), { op: "add_task", docId: a.docId, listId: a.listId, title: a.title, groupId: a.groupId }),
  ),
);

server.registerTool(
  "lockin_rename_task",
  {
    title: "Rename task",
    description: "Change a task's title in its list.",
    inputSchema: { ...workspaceArg, ...refArgs, taskId: z.string(), title: z.string().min(1) },
  },
  Tool(async (a: { workspace?: string; docId: string | null; listId: string; taskId: string; title: string }) =>
    Send(ResolveWorkspace(a.workspace), { op: "rename_task", docId: a.docId, listId: a.listId, taskId: a.taskId, title: a.title }),
  ),
);

server.registerTool(
  "lockin_send_to_board",
  {
    title: "Send to board",
    description: "Plan a list task onto the focus board: Today, This week or Backlog. Tasks already on the board are skipped.",
    inputSchema: { ...workspaceArg, ...refArgs, taskId: z.string(), column },
  },
  Tool(async (a: { workspace?: string; docId: string | null; listId: string; taskId: string; column: "today" | "week" | "backlog" }) =>
    Send(ResolveWorkspace(a.workspace), { op: "send_to_board", docId: a.docId, listId: a.listId, taskId: a.taskId, column: a.column }),
  ),
);

server.registerTool(
  "lockin_board_complete",
  {
    title: "Complete board task",
    description: "Tick (or untick) a card on the focus board by its boardTaskId (from lockin_board).",
    inputSchema: { ...workspaceArg, boardTaskId: z.string(), done: z.boolean().optional().describe("Default: true") },
  },
  Tool(async (a: { workspace?: string; boardTaskId: string; done?: boolean }) =>
    Send(ResolveWorkspace(a.workspace), { op: "board_complete", boardTaskId: a.boardTaskId, done: a.done ?? true }),
  ),
);

server.registerTool(
  "lockin_board_move",
  {
    title: "Move board task",
    description: "Move a board card to another column (Today / This week / Backlog).",
    inputSchema: { ...workspaceArg, boardTaskId: z.string(), column },
  },
  Tool(async (a: { workspace?: string; boardTaskId: string; column: "today" | "week" | "backlog" }) =>
    Send(ResolveWorkspace(a.workspace), { op: "board_move", boardTaskId: a.boardTaskId, column: a.column }),
  ),
);

await server.connect(new StdioServerTransport());
