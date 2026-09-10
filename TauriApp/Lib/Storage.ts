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
} from "@/Types/Project";

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

export async function LoadManifest(): Promise<Manifest> {
  return ReadJson<Manifest>(MANIFEST_FILE, { entries: [] });
}

/**
 * Every manifest read-modify-write (and its shared `Manifest.json.tmp` path)
 * must run one at a time — e.g. creating a project fires a SaveProject and a
 * SaveDocument back to back, and without this queue their manifest writes
 * race, causing a lost update or a "rename .tmp: file not found" error when
 * the second rename finds the first one already moved the tmp file away.
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

export async function RemoveManifestEntry(id: string): Promise<void> {
  await QueueManifestWrite(async () => {
    const manifest = await LoadManifest();
    const entries = manifest.entries.filter((e) => e.id !== id);
    await WriteJsonAtomic(MANIFEST_FILE, { entries } satisfies Manifest);
  });
}

export async function SaveProject(project: Project): Promise<void> {
  await EnsureDataDirs();
  await WriteJsonAtomic(`${PROJECTS_DIR}/${project.id}.json`, project);
  await UpsertManifestEntry(ExtractProjectMeta(project));
}

// Projects saved before isFavorite/folderId/tagIds existed won't have them
// on disk — JSON.parse doesn't fill in defaults, so without this a project
// created before this change would load with `tagIds: undefined` and blow
// up the first time something calls `.includes()` on it.
function NormalizeProject(project: Project): Project {
  return {
    ...project,
    isFavorite: project.isFavorite ?? false,
    folderId: project.folderId ?? null,
    tagIds: project.tagIds ?? [],
  };
}

export async function LoadProject(id: string): Promise<Project | null> {
  const project = await ReadJson<Project | null>(`${PROJECTS_DIR}/${id}.json`, null);
  return project ? NormalizeProject(project) : null;
}

export async function SaveDocument(doc: DocumentRecord): Promise<void> {
  await EnsureDataDirs();
  await WriteJsonAtomic(`${DOCUMENTS_DIR}/${doc.id}.json`, doc);
  await UpsertManifestEntry(ExtractDocumentMeta(doc));
}

export async function LoadDocument(id: string): Promise<DocumentRecord | null> {
  return ReadJson<DocumentRecord | null>(`${DOCUMENTS_DIR}/${id}.json`, null);
}

export async function DeleteDocument(id: string): Promise<void> {
  await remove(`${DOCUMENTS_DIR}/${id}.json`, { baseDir: BaseDirectory.AppData }).catch(
    () => {},
  );
  await RemoveManifestEntry(id);
}

export async function DeleteProject(id: string): Promise<void> {
  await remove(`${PROJECTS_DIR}/${id}.json`, { baseDir: BaseDirectory.AppData }).catch(
    () => {},
  );
  await RemoveManifestEntry(id);
}

export async function ListProjects(): Promise<ManifestEntry[]> {
  const manifest = await LoadManifest();
  return manifest.entries.filter((e) => e.kind === "project");
}

/** Bootstrap loader — reads the manifest, then every project/document file
 * it references, so the app can hydrate from disk on startup. */
export async function LoadAllProjectsAndDocuments(): Promise<{
  projects: Project[];
  documents: DocumentRecord[];
}> {
  const manifest = await LoadManifest();

  const projects = (
    await Promise.all(
      manifest.entries
        .filter((e) => e.kind === "project")
        .map((e) => LoadProject(e.id)),
    )
  ).filter((p): p is Project => p !== null);

  const documents = (
    await Promise.all(
      manifest.entries
        .filter((e) => e.kind === "document")
        .map((e) => LoadDocument(e.id)),
    )
  ).filter((d): d is DocumentRecord => d !== null);

  return { projects, documents };
}

/**
 * Documents are the source of truth; the manifest is a derived cache.
 * If it ever drifts (crash mid-write, manual edit outside the app), this
 * rescans disk and rebuilds Manifest.json from scratch.
 */
export async function RebuildManifest(): Promise<void> {
  await EnsureDataDirs();
  const entries: ManifestEntry[] = [];

  const projectFiles = await readDir(PROJECTS_DIR, {
    baseDir: BaseDirectory.AppData,
  });
  for (const file of projectFiles) {
    if (!file.name?.endsWith(".json")) continue;
    const project = await ReadJson<Project | null>(
      `${PROJECTS_DIR}/${file.name}`,
      null,
    );
    if (project) entries.push(ExtractProjectMeta(project));
  }

  const documentFiles = await readDir(DOCUMENTS_DIR, {
    baseDir: BaseDirectory.AppData,
  });
  for (const file of documentFiles) {
    if (!file.name?.endsWith(".json")) continue;
    const doc = await ReadJson<DocumentRecord | null>(
      `${DOCUMENTS_DIR}/${file.name}`,
      null,
    );
    if (doc) entries.push(ExtractDocumentMeta(doc));
  }

  await QueueManifestWrite(() => WriteJsonAtomic(MANIFEST_FILE, { entries } satisfies Manifest));
}
