import { BaseDirectory, exists, mkdir, readDir, remove, writeFile } from "@tauri-apps/plugin-fs";
import { appDataDir, join } from "@tauri-apps/api/path";
import { convertFileSrc } from "@tauri-apps/api/core";
import type { JSONContent } from "@tiptap/core";
import type { DocumentRecord } from "@lockin/shared/Types/Project";
import type { MediaAdapter } from "@lockin/shared/Platform/Types";

/**
 * Souborová implementace `MediaAdapter` — média jdou do AppData/Media, do
 * dokumentu se ukládá jen relativní cesta. Dřív Shared/Lib/MediaStorage.ts.
 */

const MEDIA_DIR = "Media";

// Skutečný `File` z <input type="file"> nebo přetažený z průzkumníka má
// `.name` vždy oříznuté prohlížečem na holé jméno souboru — žádné "/", "\"
// ani ".." se tudy nedostane. Jediné, co tohle nepokrývá, je `File` vyrobený
// programově (`new File([...], "../../evil")`), který si může nést libovolný
// řetězec. Nic v aplikaci to dnes nedělá, ale protože se z toho jména stejně
// používá jen přípona, ověřuje se proti explicitnímu seznamu — odmítnutá nebo
// chybějící přípona znamená uložení bez ní, nikdy cestu mimo Media/.
const SAFE_EXTENSION = /^\.[a-zA-Z0-9]{1,10}$/;
const MAX_UPLOAD_BYTES = 250 * 1024 * 1024; // 250 MB — velkorysé pro video, ne neomezené

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

// Pás i kšandy: `relativePath` sem vždycky přichází z attrs uzlu, které
// nastavuje jedině Save — ale dokumenty jsou obyčejné JSON soubory, do kterých
// může uživatel ručně sáhnout, takže se tvar radši překontroluje, než se podle
// něj něco přečte nebo smaže.
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

export const TauriMedia: MediaAdapter = {
  /**
   * Kopíruje nahraný obrázek/video do Media/ místo inlinování do base64 —
   * JSON dokumentu by ho jinak nesl celý a re-serializoval při každém
   * autosave vyvolaném stiskem klávesy.
   */
  async Save(file) {
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
  },

  async ResolveUrl(relativePath) {
    if (!IsWithinMediaDir(relativePath)) return "";
    const dir = await appDataDir();
    const absolutePath = await join(dir, relativePath);
    return convertFileSrc(absolutePath);
  },

  async Delete(relativePath) {
    if (!IsWithinMediaDir(relativePath)) return;
    await remove(relativePath, { baseDir: BaseDirectory.AppData }).catch(() => {});
  },

  /**
   * Smaže cokoliv pod Media/, na co už žádný dokument neodkazuje. Blok médií
   * maže svůj soubor jen při odstranění vlastním košem (MediaNodeView.tsx);
   * smazání backspacem, smazání/undo celého bloku, smazání dokumentu ani
   * celého projektu tudy neprojde, takže tohle je jediný skutečný úklid.
   */
  async SweepOrphaned(documents: DocumentRecord[]) {
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
  },
};
