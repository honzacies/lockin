"use client";

import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { Plus, Trash2, X } from "@lockin/shared/Components/Shared/UiIcons";

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Geometry {
  /** Viditelná část tabulky (`.tableWrapper` scrolluje do stran). */
  view: Box;
  table: Box;
  rows: Box[];
  cols: Box[];
}

/** Řádky jen téhle tabulky (ne vnořené) — `tr` uvnitř `tbody`. */
function Rows(table: HTMLTableElement) {
  return Array.from(table.querySelectorAll("tr")).filter((row) => row.closest("table") === table);
}

/**
 * Ovládání tabulky nad editorem: smazat řádek / sloupec / tabulku, přidat
 * řádek a sloupec. Žije mimo DOM tabulky (ten patří ProseMirroru a jeho
 * resize sloupců), takže tlačítka nic nepřelévají do scrollu tabulky.
 * Souřadnice jsou vůči `host` (relativní obal editoru), přepočítávají se při
 * změně dokumentu, scrollu tabulky a změně velikosti.
 */
export function TableControls({ editor }: { editor: Editor }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [wrapper, setWrapper] = useState<HTMLElement | null>(null);
  const [geo, setGeo] = useState<Geometry | null>(null);

  // Která tabulka je pod myší. Kurzor nad samotným ovládáním ji drží.
  useEffect(() => {
    const host = rootRef.current?.parentElement;
    if (!host) return;
    function OnMove(e: MouseEvent) {
      const target = e.target as Element;
      if (rootRef.current?.contains(target)) return;
      const found = target.closest<HTMLElement>(".tableWrapper");
      if (found && editor.view.dom.contains(found)) return setWrapper(found);
      // Kousek kolem tabulky ještě patří k ní — jinak by se tlačítka v okraji nedala trefit.
      setWrapper((current) => {
        if (!current) return null;
        const r = current.getBoundingClientRect();
        const near = e.clientX > r.left - 32 && e.clientX < r.right + 24 && e.clientY > r.top - 8 && e.clientY < r.bottom + 24;
        return near ? current : null;
      });
    }
    const OnLeave = () => setWrapper(null);
    host.addEventListener("mousemove", OnMove);
    host.addEventListener("mouseleave", OnLeave);
    return () => {
      host.removeEventListener("mousemove", OnMove);
      host.removeEventListener("mouseleave", OnLeave);
    };
  }, [editor]);

  useEffect(() => {
    const host = rootRef.current?.parentElement;
    if (!wrapper || !host) return setGeo(null);
    const table = wrapper.querySelector("table");
    if (!table) return setGeo(null);
    function Measure() {
      if (!wrapper!.isConnected) return setWrapper(null);
      const origin = host!.getBoundingClientRect();
      const Rel = (r: DOMRect): Box => ({ left: r.left - origin.left, top: r.top - origin.top, width: r.width, height: r.height });
      const rows = Rows(table!);
      setGeo({
        view: Rel(wrapper!.getBoundingClientRect()),
        table: Rel(table!.getBoundingClientRect()),
        rows: rows.map((row) => Rel(row.getBoundingClientRect())),
        cols: rows[0] ? Array.from(rows[0].children).map((cell) => Rel(cell.getBoundingClientRect())) : [],
      });
    }
    Measure();
    const observer = new ResizeObserver(Measure);
    observer.observe(table);
    observer.observe(host);
    wrapper.addEventListener("scroll", Measure);
    editor.on("update", Measure);
    return () => {
      observer.disconnect();
      wrapper.removeEventListener("scroll", Measure);
      editor.off("update", Measure);
    };
  }, [wrapper, editor]);

  /** Kurzor do buňky, pak příkaz — tiptapové příkazy pracují s výběrem. */
  function RunInCell(cell: Element | undefined, command: () => void) {
    if (!cell) return;
    editor.chain().focus().setTextSelection(editor.view.posAtDOM(cell, 0)).run();
    command();
  }
  const Table = () => wrapper?.querySelector("table") ?? null;
  const Cell = (row: number, col: number) => {
    const table = Table();
    return table ? Rows(table)[row]?.children[col] : undefined;
  };

  const show = geo && editor.isEditable;
  const visibleRight = geo ? Math.min(geo.table.left + geo.table.width, geo.view.left + geo.view.width) : 0;
  const visibleLeft = geo ? Math.max(geo.table.left, geo.view.left) : 0;
  const canRemoveRows = (geo?.rows.length ?? 0) > 1;
  const canRemoveCols = (geo?.cols.length ?? 0) > 1;
  const handle =
    "pointer-events-auto absolute z-20 flex items-center justify-center rounded-md text-[var(--lk-muted)] transition-colors";

  return (
    <div ref={rootRef} contentEditable={false} className="pointer-events-none absolute inset-0 z-10 select-none" aria-hidden={!show}>
      {show ? (
        <>
          <button
            type="button"
            aria-label="Delete table"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => RunInCell(Cell(0, 0), () => editor.chain().focus().deleteTable().run())}
            className={`${handle} size-6 hover:bg-[#e5484d]/10 hover:text-[#e5484d]`}
            style={{ left: geo.view.left - 28, top: geo.table.top - 24 }}
          >
            <Trash2 size={13} strokeWidth={1.75} />
          </button>

          {canRemoveCols &&
            geo.cols.map((col, index) => {
              const center = col.left + col.width / 2;
              if (center < visibleLeft || center > visibleRight) return null;
              return (
                <button
                  key={`col-${index}`}
                  type="button"
                  aria-label={`Delete column ${index + 1}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => RunInCell(Cell(0, index), () => editor.chain().focus().deleteColumn().run())}
                  className={`${handle} h-4 w-6 hover:bg-[#e5484d]/10 hover:text-[#e5484d]`}
                  style={{ left: center - 12, top: geo.table.top - 18 }}
                >
                  <X size={11} strokeWidth={2} />
                </button>
              );
            })}

          {canRemoveRows &&
            geo.rows.map((row, index) => (
              <button
                key={`row-${index}`}
                type="button"
                aria-label={`Delete row ${index + 1}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => RunInCell(Cell(index, 0), () => editor.chain().focus().deleteRow().run())}
                className={`${handle} w-5 hover:bg-[#e5484d]/10 hover:text-[#e5484d]`}
                style={{ left: geo.view.left - 24, top: row.top + row.height / 2 - 10, height: 20 }}
              >
                <X size={11} strokeWidth={2} />
              </button>
            ))}

          <button
            type="button"
            aria-label="Add column"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => RunInCell(Cell(0, geo.cols.length - 1), () => editor.chain().focus().addColumnAfter().run())}
            className={`${handle} w-3 rounded-full bg-[#0088ff]/10 text-[#0088ff] hover:bg-[#0088ff]/20`}
            style={{ left: visibleRight + 4, top: geo.table.top, height: geo.table.height }}
          >
            <Plus size={10} strokeWidth={2.5} />
          </button>

          <button
            type="button"
            aria-label="Add row"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => RunInCell(Cell(geo.rows.length - 1, 0), () => editor.chain().focus().addRowAfter().run())}
            className={`${handle} h-3 rounded-full bg-[#0088ff]/10 text-[#0088ff] hover:bg-[#0088ff]/20`}
            style={{ left: visibleLeft, top: geo.table.top + geo.table.height + 4, width: visibleRight - visibleLeft }}
          >
            <Plus size={10} strokeWidth={2.5} />
          </button>
        </>
      ) : null}
    </div>
  );
}
