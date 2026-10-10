import type { JSONContent } from "@tiptap/core";
import type { DocumentRecord, Project } from "@lockin/shared/Types/Project";
import type { TodoListConfig } from "@lockin/shared/Types/QuickNotes";
import { DocHref, FindLists, PlainText } from "./CollectTodoSources";
import { ExtractPlainText } from "./ExtractPlainText";

export type SearchKind = "document" | "task" | "code";

export interface SearchHit {
  kind: SearchKind;
  /** Unikátní v rámci výsledků (React key). */
  key: string;
  title: string;
  /** Úryvek kolem nálezu (u kódu celé řádky). */
  snippet: string;
  /** Odkud nález je — dokument, list, Quick Notes. */
  label: string;
  href: string;
  done?: boolean;
  language?: string | null;
  score: number;
  updatedAt: string;
}

/** Malá písmena bez diakritiky — "Přehrávač" najde i "prehravac". */
export function Fold(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/** Skóre podle toho, kde se slova našla; 0 = nesedí všechna slova. */
function Score(terms: string[], fields: [text: string, weight: number][]): number {
  let score = 0;
  for (const term of terms) {
    const best = Math.max(0, ...fields.map(([text, weight]) => (Fold(text).includes(term) ? weight : 0)));
    if (!best) return 0;
    score += best;
  }
  return score;
}

/** ~140 znaků kolem prvního nálezu kteréhokoli slova. */
function Excerpt(text: string, terms: string[]): string {
  const flat = text.replace(/\s+/g, " ").trim();
  const folded = Fold(flat);
  const at = Math.min(...terms.map((t) => folded.indexOf(t)).filter((i) => i >= 0), Infinity);
  if (!Number.isFinite(at)) return flat.slice(0, 140);
  const start = Math.max(0, at - 50);
  return `${start ? "…" : ""}${flat.slice(start, start + 140)}${start + 140 < flat.length ? "…" : ""}`;
}

function CodeBlocks(node: JSONContent | undefined, out: JSONContent[] = []): JSONContent[] {
  if (!node) return out;
  if (node.type === "codeBlock") out.push(node);
  else node.content?.forEach((child) => CodeBlocks(child, out));
  return out;
}

/** Řádky kódu, kde je nález, s jedním řádkem kontextu nad a pod. */
function CodeExcerpt(code: string, terms: string[]): string {
  const lines = code.split("\n");
  const hit = lines.findIndex((line) => terms.some((t) => Fold(line).includes(t)));
  const from = Math.max(0, hit - 1);
  return lines.slice(from, from + 3).join("\n");
}

export function SearchWorkspace(
  query: string,
  data: { documents: DocumentRecord[]; projects: Record<string, Project>; quickLists: TodoListConfig[] },
): SearchHit[] {
  const terms = Fold(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const hits: SearchHit[] = [];

  for (const doc of data.documents) {
    const href = DocHref(doc, data.projects);
    const name = doc.name || "Untitled";
    const body = ExtractPlainText(doc.text?.json ?? {});
    const score = Score(terms, [[name, 4], [doc.description, 2], [body, 1]]);
    if (score) {
      hits.push({ kind: "document", key: `d:${doc.id}`, title: name, snippet: Excerpt(doc.description || body, terms) || Excerpt(body, terms), label: "Document", href, score, updatedAt: doc.updatedAt });
    }
    for (const list of FindLists(doc.id, doc.text?.json)) {
      for (const task of [...list.tasks, ...(list.groups ?? []).flatMap((g) => g.tasks)]) {
        const s = Score(terms, [[task.title, 3], [task.description ?? "", 2], [list.title, 1]]);
        if (s) hits.push({ kind: "task", key: `t:${list.id}:${task.id}`, title: task.title, snippet: task.description ?? "", label: `${list.title || "To-do"} · ${name}`, href, done: task.done, score: s, updatedAt: doc.updatedAt });
      }
    }
    CodeBlocks(doc.text?.json).forEach((block, i) => {
      const code = PlainText(block);
      const language = (block.attrs?.language as string | null) ?? null;
      const s = Score(terms, [[code, 2], [language ?? "", 1]]);
      if (s) hits.push({ kind: "code", key: `c:${doc.id}:${i}`, title: name, snippet: CodeExcerpt(code, terms), label: language ?? "code", href, language, score: s, updatedAt: doc.updatedAt });
    });
  }

  for (const list of data.quickLists) {
    for (const task of [...list.tasks, ...(list.groups ?? []).flatMap((g) => g.tasks)]) {
      const s = Score(terms, [[task.title, 3], [task.description ?? "", 2], [list.title, 1]]);
      if (s) hits.push({ kind: "task", key: `q:${list.id}:${task.id}`, title: task.title, snippet: task.description ?? "", label: `${list.title || "To-do"} · Quick Notes`, href: "/QuickNotes", done: task.done, score: s, updatedAt: "" });
    }
  }

  // Otevřené úkoly před hotovými, pak skóre, pak čerstvost.
  return hits.sort((a, b) => Number(!!a.done) - Number(!!b.done) || b.score - a.score || b.updatedAt.localeCompare(a.updatedAt));
}
