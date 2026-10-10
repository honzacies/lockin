import type { DocumentRecord, Project } from "@lockin/shared/Types/Project";
import { GetPlatform } from "@lockin/shared/Platform/Platform";
import type { DataStorageAdapter } from "@lockin/shared/Platform/Types";

/**
 * Tenká vrstva nad `DataStorageAdapter`. Exportuje přesně ty funkce, které
 * volaly stránky a story dřív, takže se v nich nic měnit nemuselo — jen se
 * pod tím vyměnilo, kam data doopravdy tečou (disk vs. API).
 *
 * Atomický zápis, fronta zápisů manifestu a jeho přestavba zůstaly, ale
 * přestěhovaly se do TauriBuild/Platform/TauriDataStorage.ts, protože jsou
 * to detaily souborového úložiště — na webu za ně odpovídá server.
 */

export async function SaveProject(project: Project): Promise<void> {
  await GetPlatform().data.SaveProject(project);
}

export async function LoadProject(id: string): Promise<Project | null> {
  return GetPlatform().data.LoadProject(id);
}

export async function DeleteProject(id: string): Promise<void> {
  await GetPlatform().data.DeleteProject(id);
}

export async function SaveDocument(doc: DocumentRecord): Promise<void> {
  await GetPlatform().data.SaveDocument(doc);
}

export async function LoadDocument(id: string): Promise<DocumentRecord | null> {
  return GetPlatform().data.LoadDocument(id);
}

export async function DeleteDocument(id: string): Promise<void> {
  await GetPlatform().data.DeleteDocument(id);
}

/** Bootstrap loader — vše, z čeho se při startu hydratuje store. */
export async function LoadAllProjectsAndDocuments(): ReturnType<DataStorageAdapter["LoadAll"]> {
  return GetPlatform().data.LoadAll();
}

/**
 * Dřív RebuildManifest(). Na Tauri přestaví index podle disku, na webu se
 * neděje nic — proto obecnější jméno.
 */
export async function RebuildIndex(): Promise<void> {
  await GetPlatform().data.RebuildIndex();
}

/** Úložiště hlásí, že soubor změnil někdo jiný — viz `DataStorageAdapter.ChangedOnDisk`. */
export const DISK_CHANGED_EVENT = "lockin:disk-changed";

let syncing: Promise<void> | null = null;

/**
 * Načte znovu dokumenty, které se změnily na disku mimo aplikaci (AI agent,
 * Obsidian…). `revision` + 1 = otevřený editor se znovu připojí s novým
 * obsahem, místo aby ho při dalším uložení přepsal svou starou kopií.
 */
export function SyncFromDisk(): Promise<void> {
  syncing ??= (async () => {
    const data = GetPlatform().data;
    for (const id of (await data.ChangedOnDisk?.()) ?? []) {
      const doc = await data.LoadDocument(id);
      if (!doc) continue;
      const { UseDataStore } = await import("@lockin/shared/Store/UseDataStore");
      UseDataStore.setState((s) => ({
        documents: { ...s.documents, [id]: { ...doc, revision: (s.documents[id]?.revision ?? 0) + 1 } },
      }));
    }
  })().finally(() => (syncing = null));
  return syncing;
}
