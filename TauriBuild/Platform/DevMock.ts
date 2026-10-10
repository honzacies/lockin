/**
 * Testovací náhrada Tauri IPC pro běh v obyčejném prohlížeči — jen build
 * s `NEXT_PUBLIC_LOCKIN_MOCK=1` (release ji nemá, podmínka se při buildu
 * vyhodnotí a kód vypadne). Souborový systém i plugin-store jsou mapa
 * „cesta → text" v localStorage, na začátku naplněná z `/mock-fixture.json`
 * (kopie AppData výchozího workspace, položená do `out/` jen pro test).
 *
 * ponytail: jen příkazy, které LockIn opravdu volá; neznámý příkaz vrací null.
 */
const STORAGE_KEY = "lockin-mock-fs";

type Files = Record<string, string>;

function Install() {
  let files: Files | null = null;
  const ready: Promise<Files> = (async () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return (files = JSON.parse(saved) as Files);
    } catch {}
    const res = await fetch("/mock-fixture.json").catch(() => null);
    return (files = res?.ok ? ((await res.json()) as Files) : {});
  })();
  const Persist = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
    } catch {}
  };
  const Norm = (p: unknown) => String(p ?? "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  const IsDir = (p: string) => Object.keys(files!).some((f) => f.startsWith(`${p}/`));

  const stores = new Map<number, string>();
  const ReadStore = (name: string): Record<string, unknown> => {
    try {
      return JSON.parse(files![name] ?? "{}") as Record<string, unknown>;
    } catch {
      return {};
    }
  };
  const WriteStore = (name: string, data: Record<string, unknown>) => {
    files![name] = JSON.stringify(data);
    Persist();
  };
  let nextId = 1;
  const callbacks = new Map<number, (payload: unknown) => void>();

  async function Invoke(cmd: string, args: Record<string, unknown> = {}, options?: { headers?: Record<string, string> }) {
    await ready;
    const fs = files!;
    const path = Norm(args.path);
    switch (cmd) {
      case "plugin:fs|exists":
        return path in fs || IsDir(path);
      case "plugin:fs|mkdir":
        return null;
      case "plugin:fs|read_text_file":
      case "plugin:fs|read_file":
        if (!(path in fs)) throw new Error(`mock: ${path} not found`);
        return Array.from(new TextEncoder().encode(fs[path]));
      case "plugin:fs|write_text_file":
      case "plugin:fs|write_file": {
        const target = Norm(decodeURIComponent(options?.headers?.path ?? ""));
        fs[target] = new TextDecoder().decode(args as unknown as Uint8Array);
        Persist();
        return null;
      }
      case "plugin:fs|rename":
        fs[Norm(args.newPath)] = fs[Norm(args.oldPath)];
        delete fs[Norm(args.oldPath)];
        Persist();
        return null;
      case "plugin:fs|remove":
        for (const f of Object.keys(fs)) if (f === path || f.startsWith(`${path}/`)) delete fs[f];
        Persist();
        return null;
      case "plugin:fs|read_dir": {
        const prefix = path ? `${path}/` : "";
        const names = new Map<string, boolean>();
        for (const f of Object.keys(fs)) {
          if (!f.startsWith(prefix)) continue;
          const [name, ...rest] = f.slice(prefix.length).split("/");
          names.set(name, rest.length > 0 || Boolean(names.get(name)));
        }
        return [...names].map(([name, isDirectory]) => ({ name, isDirectory, isFile: !isDirectory, isSymlink: false }));
      }
      case "plugin:fs|stat": {
        const now = Date.now();
        return { isFile: path in fs, isDirectory: IsDir(path), isSymlink: false, size: fs[path]?.length ?? 0, mtime: now, atime: now, birthtime: now, readonly: false };
      }
      case "plugin:store|load":
      case "plugin:store|get_store": {
        const id = nextId++;
        stores.set(id, Norm(args.path));
        return id;
      }
      case "plugin:store|get": {
        const data = ReadStore(stores.get(args.rid as number)!);
        const key = args.key as string;
        return [data[key] ?? null, key in data];
      }
      case "plugin:store|set": {
        const name = stores.get(args.rid as number)!;
        WriteStore(name, { ...ReadStore(name), [args.key as string]: args.value });
        return null;
      }
      case "plugin:store|delete": {
        const name = stores.get(args.rid as number)!;
        const data = ReadStore(name);
        const had = (args.key as string) in data;
        delete data[args.key as string];
        WriteStore(name, data);
        return had;
      }
      case "plugin:store|keys":
        return Object.keys(ReadStore(stores.get(args.rid as number)!));
      case "plugin:path|resolve_directory":
        return "C:/mock/AppData";
      case "plugin:path|join":
        return (args.paths as string[]).join("/");
      case "plugin:event|listen":
        return nextId++;
      case "plugin:window|is_maximized":
      case "plugin:window|is_fullscreen":
        return false;
      case "plugin:window|available_monitors":
        return [];
      default:
        return null;
    }
  }

  (window as unknown as { __TAURI_INTERNALS__: unknown }).__TAURI_INTERNALS__ = {
    invoke: Invoke,
    transformCallback(cb: (payload: unknown) => void) {
      const id = nextId++;
      callbacks.set(id, cb);
      return id;
    },
    unregisterCallback: (id: number) => callbacks.delete(id),
    convertFileSrc: (p: string) => p,
    metadata: { currentWindow: { label: "main" }, currentWebview: { windowLabel: "main", label: "main" } },
  };
  (window as unknown as { __TAURI_EVENT_PLUGIN_INTERNALS__: unknown }).__TAURI_EVENT_PLUGIN_INTERNALS__ = {
    unregisterListener: () => {},
  };
}

if (process.env.NEXT_PUBLIC_LOCKIN_MOCK === "1" && typeof window !== "undefined" && !("__TAURI_INTERNALS__" in window)) Install();
