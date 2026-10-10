"use client";

import { UseFadeOnChange } from "@lockin/shared/Lib/UseMotion";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CheckSquare, Code2, FileText, Search, Square } from "lucide-react";
import { UseDataStore } from "@lockin/shared/Store/UseDataStore";
import { UseTodoStore } from "@lockin/shared/Store/UseTodoStore";
import { UseUiStore } from "@lockin/shared/Store/UseUiStore";
import { Fold, SearchWorkspace, type SearchHit, type SearchKind } from "@lockin/shared/Lib/Search";

const FILTERS: { id: SearchKind | "all"; label: string; icon: ReactNode }[] = [
  { id: "all", label: "All", icon: <Search size={14} strokeWidth={1.75} /> },
  { id: "document", label: "Documents", icon: <FileText size={14} strokeWidth={1.75} /> },
  { id: "task", label: "To-dos", icon: <CheckSquare size={14} strokeWidth={1.75} /> },
  { id: "code", label: "Code", icon: <Code2 size={14} strokeWidth={1.75} /> },
];
const MAX_SHOWN = 200;

/** Zvýrazní hledaná slova (bez ohledu na diakritiku — Fold zachovává délku znaků
 * u běžných písmen s háčkem/čárkou, takže indexy sedí na původní text). */
function Highlight({ text, terms }: { text: string; terms: string[] }) {
  const folded = Fold(text);
  if (folded.length !== text.length || !terms.length) return <>{text}</>;
  const marks = new Array<boolean>(text.length).fill(false);
  for (const term of terms) {
    for (let at = folded.indexOf(term); at >= 0; at = folded.indexOf(term, at + 1)) marks.fill(true, at, at + term.length);
  }
  const parts: ReactNode[] = [];
  for (let i = 0; i < text.length; ) {
    let j = i;
    while (j < text.length && marks[j] === marks[i]) j++;
    const chunk = text.slice(i, j);
    parts.push(marks[i] ? <mark key={i} className="rounded-[3px] bg-[#0088ff]/15 text-inherit">{chunk}</mark> : chunk);
    i = j;
  }
  return <>{parts}</>;
}

function HitIcon({ hit }: { hit: SearchHit }) {
  const className = "mt-0.5 shrink-0 text-[var(--lk-muted)]";
  if (hit.kind === "document") return <FileText size={16} strokeWidth={1.5} className={className} />;
  if (hit.kind === "code") return <Code2 size={16} strokeWidth={1.5} className={className} />;
  return hit.done ? <CheckSquare size={16} strokeWidth={1.5} className={className} /> : <Square size={16} strokeWidth={1.5} className={className} />;
}

/** Hledání napříč dokumenty, úkoly a úryvky kódu, s filtry pod polem. */
export default function SearchPage() {
  const router = useRouter();
  const openTab = UseUiStore((s) => s.OpenTab);
  const documents = UseDataStore((s) => s.documents);
  const projects = UseDataStore((s) => s.projects);
  const quickLists = UseTodoStore((s) => s.lists);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<SearchKind | "all">("all");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  UseFadeOnChange(listRef, [filter]);

  useEffect(() => {
    openTab({ id: "search", title: "Search", href: "/Search" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hits = useMemo(
    () => SearchWorkspace(query, { documents: Object.values(documents), projects, quickLists }),
    [query, documents, projects, quickLists],
  );
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: hits.length, document: 0, task: 0, code: 0 };
    for (const hit of hits) c[hit.kind]++;
    return c;
  }, [hits]);
  const shown = useMemo(() => (filter === "all" ? hits : hits.filter((h) => h.kind === filter)).slice(0, MAX_SHOWN), [hits, filter]);
  const terms = Fold(query).split(/\s+/).filter(Boolean);

  useEffect(() => setActive(0), [query, filter]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function HandleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") setActive((i) => Math.min(i + 1, shown.length - 1));
    else if (e.key === "ArrowUp") setActive((i) => Math.max(i - 1, 0));
    else if (e.key === "Enter" && shown[active]) router.push(shown[active].href);
    else if (e.key === "Tab") {
      // Tab přepíná filtry, ať jde všechno ovládat z klávesnice.
      e.preventDefault();
      const i = FILTERS.findIndex((f) => f.id === filter);
      setFilter(FILTERS[(i + (e.shiftKey ? FILTERS.length - 1 : 1)) % FILTERS.length].id);
    } else return;
    if (e.key !== "Tab") e.preventDefault();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 px-[50px] pt-6 pb-6">
      <div className="flex items-center gap-2.5">
        <Search size={56} strokeWidth={1.5} className="text-black" />
        <p className="text-[40px] font-medium tracking-[-0.8px] text-black">Search</p>
      </div>

      <div className="flex max-w-[760px] flex-col gap-3">
        <div className="relative">
          <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--lk-muted)]" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={HandleKeyDown}
            placeholder="Search documents, to-dos and code…"
            aria-label="Search"
            className="w-full rounded-xl border border-[var(--lk-line2)] bg-white py-3 pr-4 pl-10 text-[15px] text-[var(--lk-ink)] outline-none placeholder:text-[var(--lk-subtle)] focus:border-[#0088ff] focus:ring-3 focus:ring-[#0088ff]/15"
          />
        </div>
        <div role="tablist" aria-label="Filter results" className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] font-medium transition-colors ${
                filter === f.id
                  ? "border-[#0088ff]/30 bg-[#0088ff]/10 text-[#0077e0]"
                  : "border-[var(--lk-line)] bg-[var(--lk-panel)] text-[var(--lk-text2)] hover:bg-black/[0.04]"
              }`}
            >
              {f.icon}
              {f.label}
              {query.trim() ? <span className="tabular-nums text-[var(--lk-muted)]">{counts[f.id]}</span> : null}
            </button>
          ))}
        </div>
      </div>

      <div ref={listRef} className="flex max-w-[760px] min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
        {!query.trim() ? (
          <p className="px-1 py-6 text-sm text-[var(--lk-muted)]">
            Type to search every document, to-do and code block in this workspace. Use ↑ ↓ to move, Enter to open, Tab to switch filters.
          </p>
        ) : shown.length === 0 ? (
          <p className="px-1 py-6 text-sm text-[var(--lk-muted)]">Nothing found for “{query.trim()}”.</p>
        ) : (
          shown.map((hit, index) => (
            <button
              key={hit.key}
              type="button"
              data-index={index}
              onMouseMove={() => setActive(index)}
              onClick={() => router.push(hit.href)}
              className={`flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left ${index === active ? "bg-black/[0.04]" : ""}`}
            >
              <HitIcon hit={hit} />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex items-baseline gap-2">
                  <span className={`truncate text-sm font-medium ${hit.done ? "text-[var(--lk-muted)] line-through" : "text-[var(--lk-ink)]"}`}>
                    <Highlight text={hit.title} terms={terms} />
                  </span>
                  <span className="shrink-0 truncate text-xs text-[var(--lk-subtle)]">{hit.label}</span>
                </span>
                {hit.snippet ? (
                  hit.kind === "code" ? (
                    <pre className="overflow-hidden rounded-md bg-black/[0.03] px-2 py-1 font-mono text-xs leading-5 text-[var(--lk-text2)]">
                      <Highlight text={hit.snippet} terms={terms} />
                    </pre>
                  ) : (
                    <span className="line-clamp-2 text-[13px] text-[var(--lk-text2)]">
                      <Highlight text={hit.snippet} terms={terms} />
                    </span>
                  )
                ) : null}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
