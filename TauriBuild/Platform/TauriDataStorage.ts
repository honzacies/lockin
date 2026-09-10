import {
  BaseDirectory,
  exists,
  mkdir,
  readTextFile,
  writeTextFile,
  rename,
  readDir,
  remove,
} from "@tauri-apps/plugin-fs";
import type {
  DocumentRecord,
  Manifest,
  ManifestEntry,
  Project,
} from "@lockin/shared/Types/Project";
import type { DataStorageAdapter } from "@lockin/shared/Platform/Types";

/**
 * Souborová implementace `DataStorageAdapter` — jeden JSON soubor na entitu
 * v AppData plus Manifest.json jako index. Celý tenhle soubor byl dřív
 * Shared/Lib/Storage.ts; přestěhoval se sem, protože je to detail desktopového
 * úložiště, který webová verze nepotřebuje.
 */

const PROJECTS_DIR = "Projects";
const DOCUMENTS_DIR = "Documents";
const MANIFEST_FILE = "Manifest.json";

async function EnsureDataDirs(): Promise<void> {
  for (const dir of [PROJECTS_DIR, DOCUMENTS_DIR]) {
    const dirExists = await exists(dir, { baseDir: BaseDirectory.AppData });
    if (!dirExists) {
      await mkdir(dir, { baseDir: BaseDirectory.AppData, recursive: true });
    }
  }
}

async function ReadJson<T>(path: string, fallback: T): Promise<T> {
  const fileExists = await exists(path, { baseDir: BaseDirectory.AppData });
  if (!fileExists) return fallback;
  const raw = await readTextFile(path, { baseDir: BaseDirectory.AppData });
  return JSON.parse(raw) as T;
}

async function WriteJsonAtomic(path: string, data: unknown): Promise<void> {
  const tmpPath = `${path}.tmp`;
  await writeTextFile(tmpPath, JSON.stringify(data, null, 2), {
    baseDir: BaseDirectory.AppData,
  });
  await rename(tmpPath, path, {
    oldPathBaseDir: BaseDirectory.AppData,
    newPathBaseDir: BaseDirectory.AppData,
  });
}

function ExtractProjectMeta(project: Project): ManifestEntry {
  return {
    id: project.id,
    kind: "project",
    name: project.name,
    tag: project.tag,
    priority: project.priority,
    status: project.status,
    progress: project.progress,
    deadline: project.deadline,
    updatedAt: project.lastEditedAt,
  };
}

function ExtractDocumentMeta(doc: DocumentRecord): ManifestEntry {
  return {
    id: doc.id,
    kind: "document",
    name: doc.name,
    updatedAt: doc.updatedAt,
  };
}

async function LoadManifest(): Promise<Manifest> {
  return ReadJson<Manifest>(MANIFEST_FILE, { entries: [] });
}

/**
 * Každý read-modify-write manifestu (a jeho sdílená cesta Manifest.json.tmp)
 * musí běžet po jednom — vytvoření projektu např. vystřelí SaveProject a
 * SaveDocument hned po sobě a bez téhle fronty jejich zápisy závodí, což vede
 * ke ztrátě aktualizace nebo k chybě „rename .tmp: file not found", když
 * druhý rename zjistí, že první tmp soubor už odstěhoval.
 */
let manifestQueue: Promise<unknown> = Promise.resolve();

function QueueManifestWrite<T>(task: () => Promise<T>): Promise<T> {
  const result = manifestQueue.then(task, task);
  manifestQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

async function UpsertManifestEntry(entry: ManifestEntry): Promise<void> {
  await QueueManifestWrite(async () => {
    const manifest = await LoadManifest();
    const entries = manifest.entries.filter((e) => e.id !== entry.id);
    entries.push(entry);
    await WriteJsonAtomic(MANIFEST_FILE, { entries } satisfies Manifest);
  });
}

async function RemoveManifestEntry(id: string): Promise<void> {
  await QueueManifestWrite(async () => {
    const manifest = await LoadManifest();
    const entries = manifest.entries.filter((e) => e.id !== id);
    await WriteJsonAtomic(MANIFEST_FILE, { entries } satisfies Manifest);
  });
}

// Projekty uložené dřív, než existovaly isFavorite/folderId/tagIds, je na
// disku nemají — JSON.parse defaulty nedoplní, takže bez tohohle by se projekt
// z té doby načetl s `tagIds: undefined` a rozbil se při prvním `.includes()`.
function NormalizeProject(project: Project): Project {
  return {
    ...project,
    isFavorite: project.isFavorite ?? false,
    folderId: project.folderId ?? null,
    tagIds: project.tagIds ?? [],
  };
}

export const TauriDataStorage: DataStorageAdapter = {
  async SaveProject(project) {
    await EnsureDataDirs();
    await WriteJsonAtomic(`${PROJECTS_DIR}/${project.id}.json`, project);
    await UpsertManifestEntry(ExtractProjectMeta(project));
  },

  async LoadProject(id) {
    const project = await ReadJson<Project | null>(`${PROJECTS_DIR}/${id}.json`, null);
    return project ? NormalizeProject(project) : null;
  },

  async DeleteProject(id) {
    await remove(`${PROJECTS_DIR}/${id}.json`, { baseDir: BaseDirectory.AppData }).catch(
      () => {},
    );
    await RemoveManifestEntry(id);
  },

  async SaveDocument(doc) {
    await EnsureDataDirs();
    await WriteJsonAtomic(`${DOCUMENTS_DIR}/${doc.id}.json`, doc);
    await UpsertManifestEntry(ExtractDocumentMeta(doc));
  },

  async LoadDocument(id) {
    return ReadJson<DocumentRecord | null>(`${DOCUMENTS_DIR}/${id}.json`, null);
  },

  async DeleteDocument(id) {
    await remove(`${DOCUMENTS_DIR}/${id}.json`, { baseDir: BaseDirectory.AppData }).catch(
      () => {},
    );
    await RemoveManifestEntry(id);
  },

  /** Přečte manifest a pak každý projekt/dokument, na který odkazuje. */
  async LoadAll() {
    const manifest = await LoadManifest();

    const projects = (
      await Promise.all(
        manifest.entries
          .filter((e) => e.kind === "project")
          .map((e) => TauriDataStorage.LoadProject(e.id)),
      )
    ).filter((p): p is Project => p !== null);

    const documents = (
      await Promise.all(
        manifest.entries
          .filter((e) => e.kind === "document")
          .map((e) => TauriDataStorage.LoadDocument(e.id)),
      )
    ).filter((d): d is DocumentRecord => d !== null);

    return { projects, documents };
  },

  /**
   * Zdrojem pravdy jsou samotné soubory, manifest je jen odvozená cache.
   * Když se rozejde (pád uprostřed zápisu, ruční editace mimo aplikaci),
   * tohle projde disk a postaví Manifest.json znovu od nuly.
   */
  async RebuildIndex() {
    await EnsureDataDirs();
    const entries: ManifestEntry[] = [];

    const projectFiles = await readDir(PROJECTS_DIR, {
      baseDir: BaseDirectory.AppData,
    });
    for (const file of projectFiles) {
      if (!file.name?.endsWith(".json")) continue;
      const project = await ReadJson<Project | null>(`${PROJECTS_DIR}/${file.name}`, null);
      if (project) entries.push(ExtractProjectMeta(project));
    }

    const documentFiles = await readDir(DOCUMENTS_DIR, {
      baseDir: BaseDirectory.AppData,
    });
    for (const file of documentFiles) {
      if (!file.name?.endsWith(".json")) continue;
      const doc = await ReadJson<DocumentRecord | null>(`${DOCUMENTS_DIR}/${file.name}`, null);
      if (doc) entries.push(ExtractDocumentMeta(doc));
    }

    await QueueManifestWrite(() =>
      WriteJsonAtomic(MANIFEST_FILE, { entries } satisfies Manifest),
    );
  },
};
