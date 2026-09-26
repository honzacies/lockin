/**
 * Workspacy: výchozí "in-app" (data v AppData / na serveru) a složkové
 * (Obsidian vault apod. — .md soubory na disku, jen desktop).
 *
 * Seznam žije v localStorage, protože ho adaptéry potřebují synchronně už při
 * registraci platformy — dřív, než se cokoliv hydratuje. Přepnutí = reload,
 * takže se všechny story a adaptéry postaví znovu nad novým workspacem.
 */
export interface Workspace {
  id: string;
  name: string;
  icon?: string;
  /** Absolutní cesta ke složce; null = výchozí in-app úložiště. */
  path: string | null;
}

const LIST_KEY = "lockin-workspaces";
const ACTIVE_KEY = "lockin-active-workspace";
export const DEFAULT_WORKSPACE: Workspace = { id: "default", name: "Your Workspace", path: null };

function Read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function ListWorkspaces(): Workspace[] {
  const saved = Read<Workspace[]>(LIST_KEY, []);
  return saved.some((w) => w.id === DEFAULT_WORKSPACE.id) ? saved : [DEFAULT_WORKSPACE, ...saved];
}

function SaveList(list: Workspace[]) {
  localStorage.setItem(LIST_KEY, JSON.stringify(list));
}

export function ActiveWorkspace(): Workspace {
  if (typeof window === "undefined") return DEFAULT_WORKSPACE;
  const id = Read<string>(ACTIVE_KEY, DEFAULT_WORKSPACE.id);
  return ListWorkspaces().find((w) => w.id === id) ?? DEFAULT_WORKSPACE;
}

export function SwitchWorkspace(id: string) {
  localStorage.setItem(ACTIVE_KEY, JSON.stringify(id));
  window.location.reload();
}

/** Přidá složku jako workspace (nebo vrátí existující se stejnou cestou). */
export function AddFolderWorkspace(path: string): Workspace {
  const clean = path.trim().replace(/^["']|["']$/g, "").replace(/[\\/]+$/, "");
  const list = ListWorkspaces();
  const existing = list.find((w) => w.path?.toLowerCase() === clean.toLowerCase());
  if (existing) return existing;
  // "D:\Claude Brain" -> "Claude Brain"
  const workspace: Workspace = { id: `ws-${Date.now()}`, name: clean.split(/[\\/]/).pop() || clean, path: clean };
  SaveList([...list, workspace]);
  return workspace;
}

export function UpdateWorkspace(id: string, patch: Partial<Pick<Workspace, "name" | "icon">>) {
  SaveList(ListWorkspaces().map((w) => (w.id === id ? { ...w, ...patch } : w)));
}

export function RemoveWorkspace(id: string) {
  if (id === DEFAULT_WORKSPACE.id) return;
  SaveList(ListWorkspaces().filter((w) => w.id !== id));
}
