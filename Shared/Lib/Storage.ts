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
