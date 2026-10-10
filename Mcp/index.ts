#!/usr/bin/env bun
// LockIn MCP server — stdio. Registrace do Claude Code:
//   claude mcp add lockin -- bun D:/Projects/lockin/Mcp/index.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { ListWorkspaces, LoadWorkspace, ResolveWorkspace } from "./Data";
import { Board, Canvases, Document, FilterTasks, FindDocument, FindOption, FindProject, Graph, Next, Options, Overview } from "./Views";
import { AppStatus, ImportMedia, Send } from "./Bridge";
import { HasProjectMarker, MarkdownToDoc, SplitFrontmatter } from "@lockin/shared/Lib/Markdown";

const server = new McpServer(
  { name: "lockin", version: "0.1.0" },
  {
    instructions: [
      "LockIn is the user's workspace for projects, notes and to-do lists.",
      "Typical flow: lockin_next to pick what to work on (each pick explains why), lockin_document for context,",
      "do the work, then lockin_complete_task with the task's `ref`. lockin_write_document writes notes with any editor block (to-do lists, palettes, scenarios, media, tables…).",
      "Use lockin_send_to_board to plan (Today / This week / Backlog).",
      "Reading works any time; writing needs the LockIn desktop app open on the same workspace.",
      "Task refs change when a checklist task is renamed — re-read before writing if unsure.",
      "Projects exist only through lockin_create_project — folders (even one named \"projects\") and plain .md files are never projects.",
      "Prefer these tools over editing a folder workspace's .md files directly; if you do edit files, LockIn reloads them when its window regains focus.",
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
    inputSchema: { ...workspaceArg, limit: z.number().int().min(1).max(1000).optional().describe("Default: 5. Use a high number (e.g. 500) to rank every open task.") },
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

server.registerTool(
  "lockin_options",
  {
    title: "Priorities and statuses",
    description:
      "The priority and status options a project can use, with their colors, plus the library tags. Pass a label (e.g. \"High\") or id to lockin_set_project; change labels/colors with lockin_set_option.",
    inputSchema: workspaceArg,
  },
  Tool(({ workspace }: { workspace?: string }) => Options(Load(workspace))),
);

server.registerTool(
  "lockin_graph",
  {
    title: "Graph data",
    description:
      "The note graph as data: every note with its folder and link count, the links between them, notes nothing links to (orphans) and [[links]] pointing nowhere (brokenLinks). Built for auditing a vault. Reads from disk, so it works even when LockIn isn't running.",
    inputSchema: {
      ...workspaceArg,
      includeEdges: z.boolean().optional().describe("Default: true. False returns only totals, orphans and broken links — much smaller."),
    },
  },
  Tool(({ workspace, includeEdges }: { workspace?: string; includeEdges?: boolean }) => Graph(Load(workspace), { includeEdges })),
);

server.registerTool(
  "lockin_canvases",
  {
    title: "Canvases",
    description: "Boards (canvas) as data: cards, what document each card points at, and the links between them. Read-only. Reads from disk, so it works without LockIn running.",
    inputSchema: { ...workspaceArg, name: z.string().optional().describe("Only canvases whose name contains this") },
  },
  Tool(({ workspace, name }: { workspace?: string; name?: string }) => Canvases(Load(workspace), name)),
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
    description:
      "Add a task to an existing to-do list (optionally into one of its groups). Keep titles short and actionable; put the detail in description.",
    inputSchema: {
      ...workspaceArg,
      ...refArgs,
      title: z.string().min(1),
      groupId: z.string().optional(),
      description: z.string().optional().describe("Longer detail shown under the title (to-do cards only)"),
    },
  },
  Tool(async (a: { workspace?: string; docId: string | null; listId: string; title: string; groupId?: string; description?: string }) =>
    Send(ResolveWorkspace(a.workspace), {
      op: "add_task",
      docId: a.docId,
      listId: a.listId,
      title: a.title,
      groupId: a.groupId,
      description: a.description,
    }),
  ),
);

server.registerTool(
  "lockin_rename_task",
  {
    title: "Rename task",
    description: "Change a task's title and/or its description.",
    inputSchema: {
      ...workspaceArg,
      ...refArgs,
      taskId: z.string(),
      title: z.string().min(1),
      description: z.string().optional().describe("Replaces the detail text (to-do cards only)"),
    },
  },
  Tool(async (a: { workspace?: string; docId: string | null; listId: string; taskId: string; title: string; description?: string }) =>
    Send(ResolveWorkspace(a.workspace), {
      op: "rename_task",
      docId: a.docId,
      listId: a.listId,
      taskId: a.taskId,
      title: a.title,
      description: a.description,
    }),
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
  "lockin_ignore_list",
  {
    title: "Ignore list",
    description:
      "Stop counting a to-do list as tasks (e.g. a reusable checklist template in a guide) — it disappears from next/tasks/overview and from To-do Home. ignored:false brings it back.",
    inputSchema: { ...workspaceArg, listId: z.string().describe("ref.listId from a read tool"), ignored: z.boolean().optional().describe("Default: true") },
  },
  Tool(async (a: { workspace?: string; listId: string; ignored?: boolean }) =>
    Send(ResolveWorkspace(a.workspace), { op: "ignore_list", listId: a.listId, ignored: a.ignored ?? true }),
  ),
);

const DIALECT = `LockIn Markdown — mix any blocks freely:
- Text: paragraphs, # / ## / ### headings, **bold** *italic* ~~strike~~ \`code\`, [link](https://…), [[Wiki link]], > quote, \`\`\`lang code block\`\`\`, --- divider.
- Lists: "- " bulleted, "+ " dashed, "1. " numbered, "- [ ] " / "- [x] " simple checklist, | pipe | tables |.
- Components — each alone on its own line as {lockin.<name> <JSON>}; every field is optional, defaults fill the rest:
  {lockin.todolist {"title":"Launch","deadline":"2026-10-10","tasks":["Write copy",{"title":"Ship","done":true,"description":"…"}],"groups":[{"title":"Later","tasks":["…"]}]}}  ← rich to-do list (these become LockIn tasks)
  {lockin.palette {"title":"Brand","description":"…","groups":[{"title":"Primary","swatches":["#0088ff",{"color":"#111111","label":"Ink"}]}],"style":{"colorFormat":"hex|rgb|rgba|hsl","variant":"solid|transparent"}}}
  {lockin.scenario {"name":"Intro video","description":"…","beats":[{"time":"0:00–0:10","title":"Hook","text":"Words to say"}]}}
  {lockin.media {"src":"C:/path/image.png","alt":"…","align":"left|center|right|block","width":100}}  ← local image/video file, copied into LockIn
  {lockin.youtube {"url":"https://youtu.be/…"}}
  {lockin.project}  ← alone on a line, turns the note into a LockIn project (then lockin_set_project sets its priority/status).`;

server.registerTool(
  "lockin_write_document",
  {
    title: "Write document",
    description: `Create a document, or replace/append to an existing one, from Markdown. This makes a plain document, never a project — use lockin_create_project for that. ${DIALECT}\nlockin_document returns the same format, so read → edit → write round-trips.`,
    inputSchema: {
      ...workspaceArg,
      document: z.string().optional().describe("Existing document ID, path or name. Omit to create a new document."),
      name: z.string().optional().describe("Name of the new document (or rename the existing one)"),
      folder: z.string().optional().describe("Folder workspaces only: subfolder for a new document, e.g. \"areas/health\". Folders are just organization — they never make a document a project."),
      markdown: z.string().describe("Content in LockIn Markdown"),
      mode: z.enum(["replace", "append"]).optional().describe("For an existing document. Default: replace"),
    },
  },
  Tool(async (a: { workspace?: string; document?: string; name?: string; folder?: string; markdown: string; mode?: "replace" | "append" }) => {
    const workspace = ResolveWorkspace(a.workspace);
    const docId = a.document ? FindDocument(LoadWorkspace(workspace), a.document).id : null;
    const json = ImportMedia(MarkdownToDoc(SplitFrontmatter(a.markdown).body));
    if (HasProjectMarker(json)) throw new Error("Don't put {lockin.project} in a document — create projects with lockin_create_project.");
    return Send(workspace, { op: "write_document", docId, name: a.name, folder: a.folder, json, mode: a.mode ?? "replace" });
  }),
);

server.registerTool(
  "lockin_create_project",
  {
    title: "Create project",
    description:
      "Create a LockIn project (status, priority, progress, deadline, sub-documents) with an optional root document in LockIn Markdown. " +
      "This is the ONLY way to make a project: a document does not become one by living in a folder called \"projects\", and writing .md files directly never creates one. " +
      "Set status/priority/deadline afterwards with lockin_set_project.",
    inputSchema: {
      ...workspaceArg,
      name: z.string().min(1).describe("Project name (also the root document's name)"),
      folder: z.string().optional().describe("Folder workspaces only: subfolder for the root document's file"),
      markdown: z.string().optional().describe("Root document content in LockIn Markdown"),
    },
  },
  Tool(async (a: { workspace?: string; name: string; folder?: string; markdown?: string }) => {
    const workspace = ResolveWorkspace(a.workspace);
    const json = a.markdown === undefined ? undefined : ImportMedia(MarkdownToDoc(SplitFrontmatter(a.markdown).body));
    return Send(workspace, { op: "create_project", name: a.name, folder: a.folder, json });
  }),
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

server.registerTool(
  "lockin_set_project",
  {
    title: "Set project",
    description:
      "Change a project's priority, status, tags, deadline, progress or icon. Priority and status accept the label (\"High\") or the id — see lockin_options. Only the fields you pass change.",
    inputSchema: {
      ...workspaceArg,
      project: z.string().describe("Project name or ID (e.g. \"aura\")"),
      priority: z.string().optional().describe("Label or id, e.g. \"High\""),
      status: z.string().optional().describe("Label or id, e.g. \"In Progress\""),
      tagIds: z.array(z.string()).optional().describe("Library tag IDs (same tags as documents) — replaces the current set"),
      tags: z.array(z.string()).optional().describe("Tag names to add; missing tags are created"),
      deadline: z.string().nullable().optional().describe("\"YYYY-MM-DD\", or null to clear"),
      progress: z.number().int().min(0).max(100).optional(),
      icon: z.string().optional().describe('Emoji, "lucide:<icon-name>", "material:<icon-name>" or an image data: URL'),
    },
  },
  Tool(async (a: {
    workspace?: string;
    project: string;
    priority?: string;
    status?: string;
    tagIds?: string[];
    tags?: string[];
    deadline?: string | null;
    progress?: number;
    icon?: string;
  }) => {
    const workspace = ResolveWorkspace(a.workspace);
    const data = LoadWorkspace(workspace);
    const project = FindProject(data, a.project);
    return Send(workspace, {
      op: "set_project",
      projectId: project.id,
      // Popisek na ID se překládá tady, aby aplikace dostala vždycky platnou hodnotu.
      priority: a.priority === undefined ? undefined : FindOption(data, "priority", a.priority).id,
      status: a.status === undefined ? undefined : FindOption(data, "status", a.status).id,
      tagIds: a.tagIds,
      tagNames: a.tags,
      deadline: a.deadline,
      progress: a.progress,
      icon: a.icon,
    });
  }),
);

server.registerTool(
  "lockin_set_option",
  {
    title: "Set priority/status option",
    description:
      "Rename a priority or status, or change its color (e.g. make High red). Applies across every project. Use lockin_options to see what exists.",
    inputSchema: {
      ...workspaceArg,
      kind: z.enum(["priority", "status"]),
      option: z.string().describe("Label or id of the option to change, e.g. \"High\""),
      label: z.string().min(1).optional().describe("New label"),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().describe("Hex color, e.g. #e5484d"),
    },
  },
  Tool(async (a: { workspace?: string; kind: "priority" | "status"; option: string; label?: string; color?: string }) => {
    const workspace = ResolveWorkspace(a.workspace);
    const option = FindOption(LoadWorkspace(workspace), a.kind, a.option);
    return Send(workspace, { op: "set_option", kind: a.kind, optionId: option.id, label: a.label, color: a.color });
  }),
);

server.registerTool(
  "lockin_add_group",
  {
    title: "Add group",
    description:
      "Add a named section (group) to a to-do list, then pass its id as groupId to lockin_add_task. Only works on to-do cards — a plain `- [ ]` checklist has no sections.",
    inputSchema: { ...workspaceArg, ...refArgs, title: z.string().min(1), icon: z.string().optional().describe("Emoji shown before the title") },
  },
  Tool(async (a: { workspace?: string; docId: string | null; listId: string; title: string; icon?: string }) =>
    Send(ResolveWorkspace(a.workspace), { op: "add_group", docId: a.docId, listId: a.listId, title: a.title, icon: a.icon }),
  ),
);

server.registerTool(
  "lockin_delete_task",
  {
    title: "Delete task",
    description: "Remove a task from its list for good. There is no undo — tick it with lockin_complete_task if you only mean to finish it.",
    inputSchema: { ...workspaceArg, ...refArgs, taskId: z.string() },
  },
  Tool(async (a: { workspace?: string; docId: string | null; listId: string; taskId: string }) =>
    Send(ResolveWorkspace(a.workspace), { op: "delete_task", docId: a.docId, listId: a.listId, taskId: a.taskId }),
  ),
);

server.registerTool(
  "lockin_delete_group",
  {
    title: "Delete section",
    description: "Remove a section from a to-do list. Its tasks are kept — they move to the ungrouped tasks above.",
    inputSchema: { ...workspaceArg, ...refArgs, groupId: z.string() },
  },
  Tool(async (a: { workspace?: string; docId: string | null; listId: string; groupId: string }) =>
    Send(ResolveWorkspace(a.workspace), { op: "delete_group", docId: a.docId, listId: a.listId, groupId: a.groupId }),
  ),
);

server.registerTool(
  "lockin_move_task",
  {
    title: "Move task",
    description:
      "Move a task into another section, or into a different list entirely. Omit groupId to put it among the ungrouped tasks. Plain `- [ ]` checklists have no sections.",
    inputSchema: {
      ...workspaceArg,
      docId: z.string().nullable().describe("Source ref.docId"),
      listId: z.string().describe("Source ref.listId"),
      taskId: z.string(),
      toDocId: z.string().nullable().optional().describe("Target ref.docId — defaults to the source list"),
      toListId: z.string().optional().describe("Target ref.listId — defaults to the source list"),
      groupId: z.string().optional().describe("Target section; omit for ungrouped"),
    },
  },
  Tool(async (a: {
    workspace?: string;
    docId: string | null;
    listId: string;
    taskId: string;
    toDocId?: string | null;
    toListId?: string;
    groupId?: string;
  }) =>
    Send(ResolveWorkspace(a.workspace), {
      op: "move_task",
      from: { docId: a.docId, listId: a.listId },
      to: { docId: a.toDocId === undefined ? a.docId : a.toDocId, listId: a.toListId ?? a.listId },
      taskId: a.taskId,
      groupId: a.groupId,
    }),
  ),
);

server.registerTool(
  "lockin_set_list",
  {
    title: "Set list",
    description: "Rename a to-do list or set its deadline. Only to-do cards have these — a plain checklist does not.",
    inputSchema: {
      ...workspaceArg,
      ...refArgs,
      title: z.string().min(1).optional(),
      deadline: z.string().nullable().optional().describe('"YYYY-MM-DD", or null to clear'),
      deadlineTime: z.string().nullable().optional().describe('"HH:mm", or null to clear'),
    },
  },
  Tool(async (a: {
    workspace?: string;
    docId: string | null;
    listId: string;
    title?: string;
    deadline?: string | null;
    deadlineTime?: string | null;
  }) =>
    Send(ResolveWorkspace(a.workspace), {
      op: "set_list",
      docId: a.docId,
      listId: a.listId,
      title: a.title,
      deadline: a.deadline,
      deadlineTime: a.deadlineTime,
    }),
  ),
);

server.registerTool(
  "lockin_delete_document",
  {
    title: "Delete document",
    description:
      "Delete a document for good. In a folder workspace this deletes the .md file. If the document is a project, the project and its sub-documents go with it. There is no undo — make sure this is what the user asked for.",
    inputSchema: { ...workspaceArg, document: z.string().describe("Document ID, path or name") },
  },
  Tool(async (a: { workspace?: string; document: string }) => {
    const workspace = ResolveWorkspace(a.workspace);
    const doc = FindDocument(LoadWorkspace(workspace), a.document);
    return Send(workspace, { op: "delete_document", docId: doc.id });
  }),
);

server.registerTool(
  "lockin_set_document",
  {
    title: "Set document",
    description: "Document metadata: name, description, icon, folder, tags, favorite, locked. Only the fields you pass change.",
    inputSchema: {
      ...workspaceArg,
      document: z.string().describe("Document ID, path or name"),
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      icon: z.string().optional().describe('Emoji, "lucide:<icon-name>", "material:<icon-name>" or an image data: URL'),
      folderId: z.string().nullable().optional().describe('Library folder, e.g. "dir:projects"; null for none'),
      tagIds: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional().describe("Tag names to add; missing tags are created"),
      isFavorite: z.boolean().optional(),
      isLocked: z.boolean().optional().describe("Read-only — the editor stops accepting input"),
    },
  },
  Tool(async (a: {
    workspace?: string;
    document: string;
    name?: string;
    description?: string;
    icon?: string;
    folderId?: string | null;
    tagIds?: string[];
    tags?: string[];
    isFavorite?: boolean;
    isLocked?: boolean;
  }) => {
    const workspace = ResolveWorkspace(a.workspace);
    const { workspace: _w, document, tags, ...patch } = a;
    const doc = FindDocument(LoadWorkspace(workspace), document);
    return Send(workspace, { op: "set_document", docId: doc.id, ...patch, tagNames: tags });
  }),
);

server.registerTool(
  "lockin_board_remove",
  {
    title: "Remove board card",
    description: "Take a card off the focus board. The task in its to-do list stays untouched.",
    inputSchema: { ...workspaceArg, boardTaskId: z.string() },
  },
  Tool(async (a: { workspace?: string; boardTaskId: string }) =>
    Send(ResolveWorkspace(a.workspace), { op: "board_remove", boardTaskId: a.boardTaskId }),
  ),
);

server.registerTool(
  "lockin_board_clear",
  {
    title: "Clear board column",
    description: "Clear finished cards from a column, or with all:true everything in it including its sections.",
    inputSchema: { ...workspaceArg, column, all: z.boolean().optional().describe("Default: false — only finished cards") },
  },
  Tool(async (a: { workspace?: string; column: "today" | "week" | "backlog"; all?: boolean }) =>
    Send(ResolveWorkspace(a.workspace), { op: "board_clear", column: a.column, all: a.all ?? false }),
  ),
);

server.registerTool(
  "lockin_session",
  {
    title: "Focus session",
    description:
      "Run the focus session: start the timer, pause it, complete the current task (timer carries on with the next) or skip it to the end of Today.",
    inputSchema: { ...workspaceArg, action: z.enum(["start", "pause", "complete", "skip"]) },
  },
  Tool(async (a: { workspace?: string; action: "start" | "pause" | "complete" | "skip" }) =>
    Send(ResolveWorkspace(a.workspace), { op: "session", action: a.action }),
  ),
);

server.registerTool(
  "lockin_add_option",
  {
    title: "Add priority/status",
    description: "Create a new priority or status option, app-wide.",
    inputSchema: {
      ...workspaceArg,
      kind: z.enum(["priority", "status"]),
      label: z.string().min(1),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().describe("Hex color; defaults to grey"),
    },
  },
  Tool(async (a: { workspace?: string; kind: "priority" | "status"; label: string; color?: string }) =>
    Send(ResolveWorkspace(a.workspace), { op: "add_option", kind: a.kind, label: a.label, color: a.color }),
  ),
);

server.registerTool(
  "lockin_remove_option",
  {
    title: "Remove priority/status",
    description:
      "Delete a priority or status option. Projects still using it fall back to the first remaining one, so nothing is left pointing at a value that no longer exists. The last option can't be removed.",
    inputSchema: { ...workspaceArg, kind: z.enum(["priority", "status"]), option: z.string().describe("Label or id") },
  },
  Tool(async (a: { workspace?: string; kind: "priority" | "status"; option: string }) => {
    const workspace = ResolveWorkspace(a.workspace);
    const option = FindOption(LoadWorkspace(workspace), a.kind, a.option);
    return Send(workspace, { op: "remove_option", kind: a.kind, optionId: option.id });
  }),
);

server.registerTool(
  "lockin_create_tag",
  {
    title: "Create tag",
    description:
      "Create a library tag (tags are shared by documents and projects). If a tag with the same name exists, it is returned instead. Assign tags with lockin_set_project / lockin_set_document (`tags` by name also creates missing ones).",
    inputSchema: {
      ...workspaceArg,
      name: z.string().min(1),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().describe("Hex color"),
    },
  },
  Tool(async (a: { workspace?: string; name: string; color?: string }) =>
    Send(ResolveWorkspace(a.workspace), { op: "create_tag", name: a.name.trim(), color: a.color }),
  ),
);

server.registerTool(
  "lockin_delete_tag",
  {
    title: "Delete tag",
    description: "Delete a library tag and remove it from every document and project. See lockin_options for the existing tags.",
    inputSchema: { ...workspaceArg, tag: z.string().describe("Tag name or id") },
  },
  Tool(async (a: { workspace?: string; tag: string }) => {
    const workspace = ResolveWorkspace(a.workspace);
    const { tags } = LoadWorkspace(workspace);
    const wanted = a.tag.trim().toLowerCase();
    const tag = tags.find((t) => t.id === a.tag || t.name.toLowerCase() === wanted);
    if (!tag) throw new Error(`Unknown tag "${a.tag}". Existing: ${tags.map((t) => t.name).join(", ") || "none"}`);
    return Send(workspace, { op: "delete_tag", tagId: tag.id });
  }),
);

await server.connect(new StdioServerTransport());
