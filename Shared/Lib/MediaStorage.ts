import type { DocumentRecord } from "@lockin/shared/Types/Project";
import { GetPlatform } from "@lockin/shared/Platform/Platform";

/**
 * Tenká vrstva nad `MediaAdapter` — exporty jsou stejné jako dřív, takže
 * MediaNodeView, ImagePasteExtension ani AppShell se měnit nemusely.
 *
 * Validace vstupu (typ souboru, strop velikosti) i sanitace cest zůstaly na
 * straně implementace, protože se liší: Tauri hlídá, aby se zápis nedostal
 * mimo Media/, kdežto na webu je poslední slovo stejně na serveru.
 */

export async function SaveMediaFile(file: File): Promise<string> {
  return GetPlatform().media.Save(file);
}

/**
 * Ze uložené relativní cesty udělá URL, kterou umí webview načíst. Resolvuje
 * se při každém renderu znovu, ne že by se ukládala — v Tauri se absolutní
 * cesta do AppData liší stroj od stroje, na webu je za tím podepsaná adresa
 * s omezenou platností.
 */
export async function ResolveMediaUrl(relativePath: string): Promise<string> {
  return GetPlatform().media.ResolveUrl(relativePath);
}

export async function DeleteMediaFile(relativePath: string): Promise<void> {
  await GetPlatform().media.Delete(relativePath);
}

/**
 * Smaže média, na která už žádný dokument neodkazuje. Spouští se jednou při
 * startu (viz AppShell.tsx), až po načtení všech dokumentů — teprve tehdy je
 * bezpečné říct, že na soubor nic neukazuje.
 */
export async function SweepOrphanedMedia(documents: DocumentRecord[]): Promise<void> {
  await GetPlatform().media.SweepOrphaned(documents);
}
