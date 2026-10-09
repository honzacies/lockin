import { exists, mkdir, readDir, readTextFile, remove, stat, writeTextFile } from "@tauri-apps/plugin-fs";
import type { JSONContent } from "@tiptap/core";
import type { DocumentRecord, Project } from "@lockin/shared/Types/Project";
import type { LibraryFolder } from "@lockin/shared/Types/Library";
import type { DataStorageAdapter, KeyValueAdapter } from "@lockin/shared/Platform/Types";
import { DISK_CHANGED_EVENT } from "@lockin/shared/Lib/Storage";
import { UsePriorityStore } from "@lockin/shared/Store/UsePriorityStore";
import { WikiTargetsInText } from "@lockin/shared/Lib/WikiLink";
import {
  HasProjectMarker,
  JoinCanvas,
  MarkdownToDoc,
  PatchMarkdown,
  PROJECT_MARKER,
  SplitCanvas,
  SplitFrontmatter,
} from "@lockin/shared/Lib/Markdown";

/**
 * `DataStorageAdapter` nad složkou s .md soubory (Obsidian vault). Text je
 * v .md, vše ostatní (ikona, oblíbené, tagy, styl, přejmenování, data
 * projektu) jde do workspace-scoped KV, aby se cizí soubory neplnily LockIn
 * metadaty.
 *
 * ID dokumentu = "md:" + relativní cesta, složka = "dir:" + relativní cesta.
 * Soubor se značkou `{lockin.project}` je projekt ("project:" + ID dokumentu)
 * a ten soubor je jeho kořenový dokument.
 * ponytail: přejmenování dokumentu soubor nepřejmenuje (jméno je v metadatech).
 */
const META_STORE = "vault-meta.json";
const PROJECT_STORE = "vault-projects.json";
const DOC_PREFIX = "md:";
const DIR_PREFIX = "dir:";
const PROJECT_PREFIX = "project:";

type Meta = Omit<DocumentRecord, "text">;

/** Meta bez času — podle toho se pozná, jestli se kromě uložení vůbec něco změnilo. */
const MetaKey = ({ updatedAt: _, ...rest }: Meta) => JSON.stringify(rest);
/** Do KV jde vše kromě canvasu — ten se ukládá do samotného .md (viz JoinCanvas). */
const KvMeta = (meta: Meta): Meta => ({ ...meta, sketch: { strokes: meta.sketch?.strokes ?? [] } });

export function CreateVaultStorage(root: string, kv: KeyValueAdapter) {
  const Abs = (rel: string) => `${root}/${rel}`;
  // Poslední stav každého souboru, jak je na disku — z něj se při uložení
  // skládá výstup, aby nezměněné bloky zůstaly bajt po bajtu stejné.
  const onDisk = new Map<string, { frontmatter: string; body: string; meta: string }>();
  // Kořenové dokumenty projektů — ty musí značku `{lockin.project}` mít vždy.
  const projectRoots = new Set<string>();
  // Časy souboru kořenového dokumentu — projekt je přebírá (jinak by „Created" byl čas načtení).
  const fileTimes = new Map<string, { created: string; updated: string }>();
  // Nové dokumenty (id z aplikace, ne "md:") dostanou soubor v kořeni.
  const PathOf = (id: string) => (id.startsWith(DOC_PREFIX) ? id.slice(DOC_PREFIX.length) : `${id}.md`);

  async function Walk(rel: string, files: string[], dirs: string[]) {
    for (const entry of await readDir(rel ? Abs(rel) : root)) {
      if (entry.name.startsWith(".")) continue; // .obsidian, .git, .trash
      const child = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory) {
        dirs.push(child);
        await Walk(child, files, dirs);
      } else if (entry.name.endsWith(".md")) files.push(child);
    }
  }

  async function LoadDocument(id: string): Promise<DocumentRecord | null> {
    const rel = PathOf(id);
    if (!(await exists(Abs(rel)))) return null;
    const [raw, info, metaRaw] = await Promise.all([readTextFile(Abs(rel)), stat(Abs(rel)), kv.GetItem(META_STORE, id)]);
    const { frontmatter, body } = SplitFrontmatter(raw);
    const { doc: json, canvas } = SplitCanvas(MarkdownToDoc(body));
    const dir = rel.includes("/") ? rel.slice(0, rel.lastIndexOf("/")) : null;
    const base: Meta = {
      id,
      projectId: null,
      name: rel.split("/").pop()!.replace(/\.md$/, ""),
      description: "",
      createdAt: (info.birthtime ?? info.mtime ?? new Date()).toISOString(),
      updatedAt: (info.mtime ?? new Date()).toISOString(),
      lastMode: "text",
      folderId: dir ? DIR_PREFIX + dir : null,
      tagIds: [],
      isFavorite: false,
      sketch: { strokes: [] },
    };
    /**
     * Casy drzi soubor, ne ulozena metadata. KV je od ikony, oblibenych, tagu
     * a prejmenovani — kdyz z nej prebije i `updatedAt`, tvari se dokument
     * porad stejne stary, i kdyz ho na disku nekdo prepsal. Tim se rozbije
     * vsechno, co se podle toho casu rozhoduje: MCP most pak necte zmeneny
     * soubor znovu a radi se podle verze, ktera uz na disku neni.
     */
    const meta: Meta = {
      ...base,
      ...(metaRaw ? (JSON.parse(metaRaw) as Partial<Meta>) : {}),
      id,
      createdAt: base.createdAt,
      updatedAt: base.updatedAt,
    };
    // Projekt určuje značka v souboru, ne uložená metadata.
    meta.projectId = HasProjectMarker(json) ? PROJECT_PREFIX + id : null;
    // Canvas ze souboru má přednost; starší canvas z KV se do souboru přesune při dalším uložení.
    if (canvas) meta.sketch = { strokes: meta.sketch?.strokes ?? [], canvas };
    fileTimes.set(id, { created: base.createdAt, updated: base.updatedAt });
    if (meta.projectId) projectRoots.add(id);
    onDisk.set(id, { frontmatter, body, meta: MetaKey(KvMeta(meta)) });
    return { ...meta, text: { json }, extraLinks: WikiTargetsInText(frontmatter) };
  }

  async function LoadProject(id: string): Promise<Project | null> {
    const rootId = id.slice(PROJECT_PREFIX.length);
    if (!id.startsWith(PROJECT_PREFIX) || !projectRoots.has(rootId)) return null;
    const saved = await kv.GetItem(PROJECT_STORE, id);
    const { priorities, statuses } = UsePriorityStore.getState();
    const now = new Date().toISOString();
    const times = fileTimes.get(rootId);
    const base: Project = {
      id,
      name: PathOf(rootId).split("/").pop()!.replace(/\.md$/, ""),
      priority: priorities[0]?.id ?? "",
      status: statuses[0]?.id ?? "",
      progress: 0,
      deadline: null,
      deadlineTime: null,
      createdAt: times?.created ?? now,
      lastEditedAt: times?.updated ?? now,
      rootDocumentId: rootId,
      documentIds: [],
      isFavorite: false,
      folderId: null,
      tagIds: [],
    };
    return { ...base, ...(saved ? (JSON.parse(saved) as Partial<Project>) : {}), id, rootDocumentId: rootId };
  }

  const storage: DataStorageAdapter = {
    async LoadAll() {
      const files: string[] = [];
      const dirs: string[] = [];
      await Walk("", files, dirs);
      const documents = (await Promise.all(files.map((rel) => LoadDocument(DOC_PREFIX + rel)))).filter(
        (d): d is DocumentRecord => d !== null,
      );
      const projects = (await Promise.all([...projectRoots].map((rootId) => LoadProject(PROJECT_PREFIX + rootId)))).filter(
        (p): p is Project => p !== null,
      );
      const now = new Date().toISOString();
      const folders: LibraryFolder[] = dirs.map((dir) => ({
        id: DIR_PREFIX + dir,
        name: dir,
        description: "",
        isFavorite: false,
        createdAt: now,
        updatedAt: now,
      }));
      return { projects, documents, folders };
    },

    LoadDocument,

    async SaveDocument(doc) {
      // extraLinks se počítají ze souboru při načtení — do metadat nepatří.
      const { text, extraLinks: _links, ...meta } = doc;
      let json: JSONContent = JoinCanvas(text.json, meta.sketch?.canvas);
      if (projectRoots.has(doc.id) && !HasProjectMarker(json)) {
        json = { ...json, content: [{ type: "hiddenRaw", attrs: { raw: PROJECT_MARKER } }, ...(json.content ?? [])] };
      }
      const rel = PathOf(doc.id);
      // Dokument, který tahle instance nenačetla (hot reload, nový soubor),
      // si stav z disku přečte teď — jinak by zápis zahodil frontmatter.
      let previous = onDisk.get(doc.id);
      const current = SplitFrontmatter((await exists(Abs(rel))) ? await readTextFile(Abs(rel)) : "");
      if (!previous) previous = { ...current, meta: "" };
      // Soubor mezitím změnil někdo jiný (AI agent, Obsidian…) — náš obsah je
      // starý, přepsat ho by jeho změnu zahodilo. Aplikace ho místo toho načte znovu.
      else if (current.body !== previous.body || current.frontmatter !== previous.frontmatter) {
        window.dispatchEvent(new Event(DISK_CHANGED_EVENT));
        return;
      }
      const body = PatchMarkdown(previous.body, json);
      const metaKey = MetaKey(KvMeta(meta));
      // Editor hlásí změnu i při pouhém otevření — bez téhle kontroly by se
      // soubor přepsal (a posunul v Recents), i když uživatel na nic nesáhl.
      if (body === previous.body && metaKey === previous.meta) return;
      // Pojistka: prázdný dokument nikdy nepřepíše poznámku s obsahem
      // (2026-09-26 takhle rozbitý editor při hot reloadu smazal 4 poznámky).
      if (!body.trim() && previous.body.trim()) {
        console.warn("VaultStorage: refusing to overwrite non-empty note with empty content", rel);
        return;
      }

      if (body !== previous.body) {
        if (rel.includes("/")) await mkdir(Abs(rel.slice(0, rel.lastIndexOf("/"))), { recursive: true });
        await writeTextFile(Abs(rel), previous.frontmatter + body);
      }
      await kv.SetItem(META_STORE, doc.id, JSON.stringify(KvMeta(meta)));
      onDisk.set(doc.id, { frontmatter: previous.frontmatter, body, meta: metaKey });
    },

    async DeleteDocument(id) {
      await remove(Abs(PathOf(id))).catch(() => {});
      await kv.RemoveItem(META_STORE, id);
      onDisk.delete(id);
    },

    async SaveProject(project) {
      // Synchronně před prvním await — CreateNewProject hned potom ukládá
      // kořenový dokument a ten už musí vědět, že má dostat značku.
      projectRoots.add(project.rootDocumentId);
      await kv.SetItem(PROJECT_STORE, project.id, JSON.stringify(project));
    },

    LoadProject,

    async DeleteProject(id) {
      // Soubor zůstává, jen přestane být projektem až po odstranění značky.
      await kv.RemoveItem(PROJECT_STORE, id);
    },

    // Index je samotná složka, není co přestavovat.
    async RebuildIndex() {},

    async ChangedOnDisk() {
      const files: string[] = [];
      await Walk("", files, []);
      const changed: string[] = [];
      for (const rel of files) {
        const id = DOC_PREFIX + rel;
        const known = onDisk.get(id);
        if (!known) {
          changed.push(id); // nový soubor
          continue;
        }
        const { frontmatter, body } = SplitFrontmatter(await readTextFile(Abs(rel)));
        if (body !== known.body || frontmatter !== known.frontmatter) changed.push(id);
      }
      return changed;
    },
  };
  return storage;
}
