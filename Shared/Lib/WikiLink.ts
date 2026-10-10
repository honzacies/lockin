import type { JSONContent } from "@tiptap/core";
import type { DocumentRecord } from "@lockin/shared/Types/Project";

/**
 * Obsidian `[[wiki odkazy]]`. V dokumentu jsou to obyčejné link marky
 * s href `wiki:<obsah závorek>` (URI-encoded), takže `[[x#h|text]]` se při
 * uložení zapíše zpět přesně tak, jak bylo.
 */
export const WIKI_SCHEME = "wiki";
const PREFIX = `${WIKI_SCHEME}:`;

export const IsWikiHref = (href: unknown): href is string => typeof href === "string" && href.startsWith(PREFIX);
export const WikiHref = (inner: string) => PREFIX + encodeURIComponent(inner);
export const WikiInner = (href: string) => decodeURIComponent(href.slice(PREFIX.length));

/** "projects/lockin#Stav|text" -> "projects/lockin" */
export function WikiTarget(inner: string): string {
  return inner.split("|")[0].split("#")[0].trim();
}

/** Co se ukáže místo závorek: alias, jinak cíl (i s nadpisem). */
export function WikiDisplay(inner: string): string {
  const [target, alias] = inner.split("|");
  return (alias ?? target).trim();
}

/** Najde dokument jako Obsidian: podle názvu souboru, případně cesty ve vaultu. */
export function FindWikiDocument(target: string, documents: DocumentRecord[]): DocumentRecord | undefined {
  const wanted = target.toLowerCase().replace(/\.md$/, "");
  const PathOf = (doc: DocumentRecord) => doc.id.replace(/^md:/, "").replace(/\.md$/, "").toLowerCase();
  return (
    documents.find((doc) => PathOf(doc) === wanted || PathOf(doc).endsWith(`/${wanted}`)) ??
    documents.find((doc) => doc.name.toLowerCase() === wanted)
  );
}

/** Všechny cíle wiki odkazů v dokumentu (pro "Linked from"). */
export function WikiTargets(node: JSONContent | undefined, out = new Set<string>()): Set<string> {
  if (!node) return out;
  for (const mark of node.marks ?? []) {
    if (mark.type === "link" && IsWikiHref(mark.attrs?.href)) out.add(WikiTarget(WikiInner(mark.attrs.href)));
  }
  node.content?.forEach((child) => WikiTargets(child, out));
  return out;
}

/** Cíle odkazů v libovolném textu (např. YAML frontmatter) — `[[x|alias]]` → "x". */
export function WikiTargetsInText(text: string): string[] {
  return [...text.matchAll(/\[\[([^[\]\n]+)\]\]/g)].map((m) => WikiTarget(m[1]));
}

/** Všechny odkazy dokumentu jako v Obsidianu: z textu i z frontmatteru. */
export function DocumentLinkTargets(doc: { text?: { json?: JSONContent }; extraLinks?: string[] }): Set<string> {
  const out = WikiTargets(doc.text?.json);
  for (const target of doc.extraLinks ?? []) out.add(target);
  return out;
}
