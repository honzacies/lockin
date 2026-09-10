import { BaseDirectory, exists, mkdir, readDir, remove, writeFile } from "@tauri-apps/plugin-fs";
import { appDataDir, join } from "@tauri-apps/api/path";
import { convertFileSrc } from "@tauri-apps/api/core";
import type { JSONContent } from "@tiptap/core";
import type { DocumentRecord } from "@/Types/Project";

const MEDIA_DIR = "Media";

// A real `File` picked via <input type="file"> or dragged from the OS file
// explorer always has its `.name` stripped down to a bare leaf filename by
// the browser — no "/", "\", or "..' can ride along that way. The one path
// this doesn't cover is a `File` constructed *programmatically* (`new
// File([...], "../../evil")`), which can carry an arbitrary string as
// `.name`; nothing in this app does that today, but the extension is the
// only piece of that name this code ever uses, so it's validated against an
// explicit allow-list regardless — a rejected/absent extension just means
// the file gets saved without one, never a path outside `Media/`.
const SAFE_EXTENSION = /^\.[a-zA-Z0-9]{1,10}$/;
const MAX_UPLOAD_BYTES = 250 * 1024 * 1024; // 250MB — generous for video, not unbounded

function SafeExtension(filename: string): string {
  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex < 0) return "";
  const ext = filename.slice(dotIndex);
  return SAFE_EXTENSION.test(ext) ? ext : "";
}

async function EnsureMediaDir(): Promise<void> {
  const dirExists = await exists(MEDIA_DIR, { baseDir: BaseDirectory.AppData });
  if (!dirExists) {
    await mkdir(MEDIA_DIR, { baseDir: BaseDirectory.AppData, recursive: true });
  }
}

/**
 * Copies an uploaded image/video into the app's own Media directory instead
 * of inlining it as base64 — a document's JSON would otherwise carry the
 * full file (re-serialized on every keystroke-triggered autosave) for as
 * long as the media stayed in it. Only a relative path is meant to be
 * persisted in the node's attrs; the actual displayable URL is resolved
 * separately via `ResolveMediaUrl` at render time, since it depends on
 * this machine's AppData location.
 *
 * Rejects anything whose declared MIME type isn't image/video (so a
 * disguised executable dropped onto the block doesn't quietly land in
 * AppData) and anything past a sane size ceiling.
 */
export async function SaveMediaFile(file: File): Promise<string> {
  if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
    throw new Error("Only image or video files can be uploaded here.");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("That file is too large (250MB max).");
  }
  await EnsureMediaDir();
  const ext = SafeExtension(file.name);
  const relativePath = `${MEDIA_DIR}/media-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
  const buffer = new Uint8Array(await file.arrayBuffer());
  await writeFile(relativePath, buffer, { baseDir: BaseDirectory.AppData });
  return relativePath;
}

/** Turns a stored relative path (e.g. `Media/media-....png`) into a URL the
 * webview can actually load — resolved fresh each time rather than stored,
 * since the absolute AppData path (and Tauri's asset-protocol scheme) can
 * differ per machine/install. */
export async function ResolveMediaUrl(relativePath: string): Promise<string> {
  if (!IsWithinMediaDir(relativePath)) return "";
  const dir = await appDataDir();
  const absolutePath = await join(dir, relativePath);
  return convertFileSrc(absolutePath);
}

export async function DeleteMediaFile(relativePath: string): Promise<void> {
  if (!IsWithinMediaDir(relativePath)) return;
  await remove(relativePath, { baseDir: BaseDirectory.AppData }).catch(() => {});
}

// Belt-and-suspenders: `relativePath` here always comes from a node's own
// stored attrs, which SaveMediaFile is the only thing that ever sets — but
// documents are plain local JSON files a user could hand-edit, so this
// re-checks the shape before it's ever used to read or delete something
// (rejects any ".." segment or a leading "/" that could walk it outside
// Media/, same as the write-side sanitizing above).
function IsWithinMediaDir(relativePath: string): boolean {
  return (
    relativePath.startsWith(`${MEDIA_DIR}/`) &&
    !relativePath.includes("..") &&
    !relativePath.includes("\\")
  );
}

function CollectMediaPaths(node: JSONContent, into: Set<string>): void {
  if (node.type === "media" && typeof node.attrs?.path === "string") {
    into.add(node.attrs.path);
  }
  for (const child of node.content ?? []) {
    CollectMediaPaths(child, into);
  }
}

/**
 * Deletes any file under Media/ that no document references anymore — a
 * media block only ever deletes its own file when removed via its own
 * trash button (MediaNodeView.tsx); backspacing it away, deleting/undoing
 * the whole block, deleting the document it lived in, or deleting a whole
 * project never goes through that, so nothing else was actually cleaning
 * these up. Run once at startup (see AppShell.tsx) after every document
 * has loaded, so a file only disappears once it's confirmed gone from
 * *every* document, never while something might still be pointing at it.
 */
export async function SweepOrphanedMedia(documents: DocumentRecord[]): Promise<void> {
  const referenced = new Set<string>();
  for (const doc of documents) {
    if (doc.text?.json) CollectMediaPaths(doc.text.json, referenced);
  }

  const dirExists = await exists(MEDIA_DIR, { baseDir: BaseDirectory.AppData });
  if (!dirExists) return;

  const entries = await readDir(MEDIA_DIR, { baseDir: BaseDirectory.AppData });
  for (const entry of entries) {
    if (!entry.name) continue;
    const relativePath = `${MEDIA_DIR}/${entry.name}`;
    if (!referenced.has(relativePath)) {
      await remove(relativePath, { baseDir: BaseDirectory.AppData }).catch(() => {});
    }
  }
}
