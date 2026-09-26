import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { DocumentRecord, Project } from "@lockin/shared/Types/Project";
import type { TodoListConfig } from "@lockin/shared/Types/QuickNotes";
import type { PriorityOption, StatusOption } from "@lockin/shared/Types/PriorityStatus";
import type { FocusGroup, FocusTask } from "@lockin/shared/Store/UseFocusStore";
import { HasProjectMarker, MarkdownToDoc, SplitFrontmatter } from "@lockin/shared/Lib/Markdown";

/**
 * Čte data LockInu přímo z disku, stejně jako je načítá desktopová aplikace
 * (AppData + složkové workspacy). Jen čtení — zápisy jdou přes Bridge.ts.
 * ponytail: logika načtení vaultu je zkopírovaná z TauriBuild/Platform/VaultStorage.ts
 * (jiný runtime: node:fs místo plugin-fs); při změně formátu upravit obě místa.
 */

export interface Workspace {
  id: string;
  name: string;
  path: string | null;
}

export interface WorkspaceData {
  workspace: Workspace;
  documents: DocumentRecord[];
  projects: Record<string, Project>;
  quickLists: TodoListConfig[];
  board: { tasks: FocusTask[]; groups: FocusGroup[]; runningSince: number | null };
  priorities: PriorityOption[];
  statuses: StatusOption[];
  /** Surový obsah .md souboru podle ID dokumentu (jen vault) — pro nástroj document. */
  rawFiles: Map<string, string>;
}

const IDENTIFIER = "app.lockin.desktop";
const DEFAULT_WORKSPACE: Workspace = { id: "default", name: "Your Workspace", path: null };
const DEFAULT_PRIORITIES: PriorityOption[] = [
  { id: "low", label: "Low", color: "#8b8d98" },
  { id: "medium", label: "Medium", color: "#f5a524" },
  { id: "high", label: "High", color: "#e5484d" },
];
const DEFAULT_STATUSES: StatusOption[] = [
  { id: "not-started", label: "Not Started", color: "#8b8d98" },
  { id: "in-progress", label: "In Progress", color: "#3b7cff" },
  { id: "done", label: "Done", color: "#30a46c" },
];

/** Tauri appDataDir: Windows %APPDATA%, macOS Application Support, Linux XDG data. */
export function AppDataDir(): string {
  const base =
    process.env.LOCKIN_APPDATA ??
    (process.platform === "win32"
      ? process.env.APPDATA ?? join(homedir(), "AppData", "Roaming")
      : process.platform === "darwin"
        ? join(homedir(), "Library", "Application Support")
        : process.env.XDG_DATA_HOME ?? join(homedir(), ".local", "share"));
  return process.env.LOCKIN_APPDATA ? base : join(base, IDENTIFIER);
}

function ReadJson<T>(path: string): T | null {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return null;
  }
}

/** Hodnota z tauri-plugin-store souboru; zustand `persist` ukládá `{state, version}` jako string. */
function ReadPersisted<T>(file: string, key: string): T | null {
  const store = ReadJson<Record<string, string>>(join(AppDataDir(), file));
  const raw = store?.[key];
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { state?: T };
    return parsed.state ?? (parsed as T);
  } catch {
    return null;
  }
}

export function ListWorkspaces(): { active: string; list: Workspace[] } {
  const mirror = ReadPersisted<{ active: string; list: Workspace[] }>("workspaces.json", "state");
  if (!mirror?.list?.length) return { active: DEFAULT_WORKSPACE.id, list: [DEFAULT_WORKSPACE] };
  return mirror;
}

/** Workspace podle ID nebo názvu (bez ohledu na velikost písmen); bez zadání aktivní. */
export function ResolveWorkspace(idOrName?: string): Workspace {
  const { active, list } = ListWorkspaces();
  if (!idOrName) return list.find((w) => w.id === active) ?? list[0];
  const wanted = idOrName.toLowerCase();
  const found = list.find((w) => w.id.toLowerCase() === wanted || w.name.toLowerCase() === wanted);
  if (!found) throw new Error(`Unknown workspace "${idOrName}". Available: ${list.map((w) => w.name).join(", ")}`);
  return found;
}

function LoadInApp(): Pick<WorkspaceData, "documents" | "projects"> {
  const dir = AppDataDir();
  const Load = <T>(sub: string) =>
    existsSync(join(dir, sub))
      ? readdirSync(join(dir, sub))
          .filter((f) => f.endsWith(".json"))
          .map((f) => ReadJson<T>(join(dir, sub, f)))
          .filter((x): x is NonNullable<T> => x !== null)
      : [];
  const projects = Load<Project>("Projects");
  return { documents: Load<DocumentRecord>("Documents"), projects: Object.fromEntries(projects.map((p) => [p.id, p])) };
}

function LoadVault(workspace: Workspace, prefix: string, rawFiles: Map<string, string>): Pick<WorkspaceData, "documents" | "projects"> {
  const root = workspace.path!;
  const meta = ReadJson<Record<string, string>>(join(AppDataDir(), `${prefix}vault-meta.json`)) ?? {};
  const savedProjects = ReadJson<Record<string, string>>(join(AppDataDir(), `${prefix}vault-projects.json`)) ?? {};
  const files: string[] = [];
  const Walk = (rel: string) => {
    for (const name of readdirSync(rel ? join(root, rel) : root)) {
      if (name.startsWith(".")) continue;
      const child = rel ? `${rel}/${name}` : name;
      if (statSync(join(root, child)).isDirectory()) Walk(child);
      else if (name.endsWith(".md")) files.push(child);
    }
  };
  Walk("");

  const documents: DocumentRecord[] = [];
  const projects: Record<string, Project> = {};
  for (const rel of files) {
    const id = `md:${rel}`;
    const raw = readFileSync(join(root, rel), "utf8");
    rawFiles.set(id, raw);
    const json = MarkdownToDoc(SplitFrontmatter(raw).body);
    const info = statSync(join(root, rel));
    const dir = rel.includes("/") ? rel.slice(0, rel.lastIndexOf("/")) : null;
    const name = rel.split("/").pop()!.replace(/\.md$/, "");
    const saved = meta[id] ? (JSON.parse(meta[id]) as Partial<DocumentRecord>) : {};
    const projectId = HasProjectMarker(json) ? `project:${id}` : null;
    documents.push({
      name,
      description: "",
      createdAt: info.birthtime.toISOString(),
      updatedAt: info.mtime.toISOString(),
      lastMode: "text",
      folderId: dir ? `dir:${dir}` : null,
      tagIds: [],
      isFavorite: false,
      sketch: { strokes: [] },
      ...saved,
      id,
      projectId,
      text: { json },
    });
    if (projectId) {
      const stored = savedProjects[projectId] ? (JSON.parse(savedProjects[projectId]) as Partial<Project>) : {};
      projects[projectId] = {
        id: projectId,
        name,
        tag: "",
        priority: DEFAULT_PRIORITIES[0].id,
        status: DEFAULT_STATUSES[0].id,
        progress: 0,
        deadline: null,
        createdAt: info.birthtime.toISOString(),
        lastEditedAt: info.mtime.toISOString(),
        rootDocumentId: id,
        documentIds: [],
        isFavorite: false,
        folderId: null,
        tagIds: [],
        ...stored,
      };
    }
  }
  return { documents, projects };
}

export function LoadWorkspace(workspace: Workspace): WorkspaceData {
  // Složkové workspacy mají drobné kolekce v souborech s prefixem svého ID (viz TauriBuild/Platform/Register.ts).
  const prefix = workspace.path ? `${workspace.id}-` : "";
  const rawFiles = new Map<string, string>();
  const data = workspace.path ? LoadVault(workspace, prefix, rawFiles) : LoadInApp();
  const board = ReadPersisted<WorkspaceData["board"]>(`${prefix}focus.json`, "lockin-focus");
  const options = ReadPersisted<{ priorities: PriorityOption[]; statuses: StatusOption[] }>(
    `${prefix}priority-status.json`,
    "lockin-priority-status",
  );
  return {
    workspace,
    ...data,
    quickLists: ReadPersisted<{ lists: TodoListConfig[] }>(`${prefix}todo-lists.json`, "lockin-todo-lists")?.lists ?? [],
    board: { tasks: board?.tasks ?? [], groups: board?.groups ?? [], runningSince: board?.runningSince ?? null },
    priorities: options?.priorities?.length ? options.priorities : DEFAULT_PRIORITIES,
    statuses: options?.statuses?.length ? options.statuses : DEFAULT_STATUSES,
    rawFiles,
  };
}
