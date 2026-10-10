"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { createColGroup } from "@tiptap/extension-table";
import { Plus, Trash2, X } from "lucide-react";

// Must match TableExtension.ts's `.configure({ cellMinWidth })` — there's no
// way to read an extension's own options back out from a node view's props,
// so this has to be kept in sync by hand.
const CELL_MIN_WIDTH = 60;

interface Rect {
  offset: number;
  size: number;
}

function ColStyle(styleDeclaration: string): CSSProperties {
  const [property, value] = styleDeclaration.split(":").map((part) => part.trim());
  return property === "width" ? { width: value } : { minWidth: value };
}

/**
 * Wraps the *actual* table TipTap/ProseMirror renders and manages (cells
 * stay real, directly-editable ProseMirror content via `NodeViewContent` —
 * this view never owns or re-renders row/cell content itself) with
 * hover-revealed "add row" / "add column" strips, a delete rail per row and
 * column, and a "delete table" corner button.
 *
 * The `<colgroup>` below is what makes column resizing actually visible:
 * @tiptap/extension-table's ColumnResizing plugin drags update a cell's
 * `colwidth` attr, but nothing paints that without a `<colgroup>` reading it
 * back — the stock (non-custom) node view builds one internally, but
 * overriding `addNodeView` throws that away, so it has to be rebuilt here
 * via the extension's own exported `createColGroup` helper (kept in sync
 * with document changes on every render, same as the stock view's `update`).
 */
export function TableNodeView({ editor, node }: NodeViewProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const [rowRects, setRowRects] = useState<Rect[]>([]);
  const [colRects, setColRects] = useState<Rect[]>([]);

  useEffect(() => {
    function Recompute() {
      const table = tableRef.current;
      const wrapper = wrapperRef.current;
      if (!table || !wrapper) return;
      const wrapperBox = wrapper.getBoundingClientRect();

      // Defensive against exactly how many wrapper layers sit between
      // <table> and <tr> (tiptap-react nests an extra contentDOM div in
      // there) — walk every <tr> descendant rather than assuming a fixed
      // depth, filtering out rows that belong to some other, nested table.
      const rows = Array.from(table.querySelectorAll("tr")).filter(
        (row) => row.closest("table") === table,
      );
      setRowRects(
        rows.map((row) => {
          const box = row.getBoundingClientRect();
          return { offset: box.top - wrapperBox.top, size: box.height };
        }),
      );

      const firstRowCells = rows[0]
        ? Array.from(rows[0].querySelectorAll(":scope > td, :scope > th"))
        : [];
      setColRects(
        firstRowCells.map((cell) => {
          const box = cell.getBoundingClientRect();
          return { offset: box.left - wrapperBox.left, size: box.width };
        }),
      );
    }

    Recompute();
    editor.on("update", Recompute);
    editor.on("selectionUpdate", Recompute);
    const observer = new ResizeObserver(Recompute);
    if (tableRef.current) observer.observe(tableRef.current);
    window.addEventListener("resize", Recompute);
    return () => {
      editor.off("update", Recompute);
      editor.off("selectionUpdate", Recompute);
      observer.disconnect();
      window.removeEventListener("resize", Recompute);
    };
  }, [editor]);

  function SelectCell(cell: Element | null | undefined): boolean {
    if (!cell) return false;
    const pos = editor.view.posAtDOM(cell, 0);
    editor.chain().setTextSelection(pos).run();
    return true;
  }

  function HandleDeleteRow(index: number) {
    const table = tableRef.current;
    if (!table) return;
    const rows = Array.from(table.querySelectorAll("tr")).filter(
      (row) => row.closest("table") === table,
    );
    if (SelectCell(rows[index]?.querySelector("td, th"))) {
      editor.chain().focus().deleteRow().run();
    }
  }

  function HandleDeleteColumn(index: number) {
    const table = tableRef.current;
    if (!table) return;
    const firstRow = table.querySelector("tr");
    const cell = firstRow?.querySelectorAll(":scope > td, :scope > th")[index];
    if (SelectCell(cell)) {
      editor.chain().focus().deleteColumn().run();
    }
  }

  const { colgroup, tableWidth, tableMinWidth } = createColGroup(node, CELL_MIN_WIDTH);
  const colSpecs = Array.isArray(colgroup) ? (colgroup.slice(2) as [string, { style: string }][]) : [];
  const canRemoveRows = node.childCount > 1;
  const canRemoveColumns = colSpecs.length > 1;
  const lastCol = colRects[colRects.length - 1];
  const addColumnLeft = lastCol ? lastCol.offset + lastCol.size : 0;

  return (
    <NodeViewWrapper className="group/table relative my-1 w-fit max-w-full">
      {/* Everything positioned by a table-relative coordinate (the row/
       * column delete rails, the delete-table button, "Add column") lives
       * *inside* this scrolling div, not as a sibling of it. Resizing a
       * column can make the table wider than this wrapper — .tableWrapper's
       * own overflow-x-auto is what's supposed to absorb that (a normal,
       * contained horizontal scrollbar). Positioning these buttons relative
       * to the OUTER wrapper instead used to put them at coordinates past
       * that outer box's own (clamped) width, which silently grew ITS
       * scrollable area too and revealed an unwanted scrollbar there —
       * exactly the failure mode only a column resize could trigger. */}
      <div className="tableWrapper relative overflow-x-auto pt-6 pl-6" ref={wrapperRef}>
        {/* Native <button>s below, not HeroUI's Button, on purpose — these
         * overlay controls live inside ProseMirror's own contentEditable
         * region and need a real `contentEditable={false}` to keep the
         * browser from treating them as editable text content; HeroUI's
         * Button type doesn't expose that DOM attribute at all. */}
        <button
          type="button"
          contentEditable={false}
          onClick={() => editor.chain().focus().deleteTable().run()}
          aria-label="Delete table"
          className="absolute top-0 left-0 z-10 flex size-6 items-center justify-center rounded-md text-[var(--lk-muted)] opacity-0 transition-opacity hover:bg-[#e5484d]/10 hover:text-[#e5484d] group-hover/table:opacity-100"
        >
          <Trash2 size={13} strokeWidth={1.75} />
        </button>

        {canRemoveRows &&
          rowRects.map((rect, index) => (
            <button
              key={`row-${index}`}
              type="button"
              contentEditable={false}
              onClick={() => HandleDeleteRow(index)}
              aria-label={`Delete row ${index + 1}`}
              className="absolute left-0 z-10 flex w-6 items-center justify-center opacity-0 transition-opacity group-hover/table:opacity-100"
              style={{ top: rect.offset, height: rect.size }}
            >
              <span className="flex size-5 items-center justify-center rounded-md text-[var(--lk-muted)] hover:bg-[#e5484d]/10 hover:text-[#e5484d]">
                <X size={11} strokeWidth={2} />
              </span>
            </button>
          ))}

        {canRemoveColumns &&
          colRects.map((rect, index) => (
            <button
              key={`col-${index}`}
              type="button"
              contentEditable={false}
              onClick={() => HandleDeleteColumn(index)}
              aria-label={`Delete column ${index + 1}`}
              className="absolute top-0 z-10 flex h-6 items-center justify-center opacity-0 transition-opacity group-hover/table:opacity-100"
              style={{ left: rect.offset, width: rect.size }}
            >
              <span className="flex size-5 items-center justify-center rounded-md text-[var(--lk-muted)] hover:bg-[#e5484d]/10 hover:text-[#e5484d]">
                <X size={11} strokeWidth={2} />
              </span>
            </button>
          ))}

        <table
          ref={tableRef}
          className="lockin-table"
          style={{ width: tableWidth || undefined, minWidth: tableMinWidth || undefined }}
        >
          <colgroup>
            {colSpecs.map(([, attrs], index) => (
              <col key={index} style={ColStyle(attrs.style)} />
            ))}
          </colgroup>
          <NodeViewContent<"tbody"> as="tbody" />
        </table>

        <button
          type="button"
          contentEditable={false}
          onClick={() => editor.chain().focus().addColumnAfter().run()}
          aria-label="Add column"
          className="absolute top-6 bottom-0 z-10 flex w-2.5 items-center justify-center opacity-0 transition-opacity group-hover/table:opacity-100"
          style={{ left: addColumnLeft }}
        >
          <span className="flex h-full w-2.5 items-center justify-center rounded-full bg-[#0088ff]/10 hover:bg-[#0088ff]/20">
            <Plus size={10} strokeWidth={2.5} className="text-[#0088ff]" />
          </span>
        </button>
      </div>

      <button
        type="button"
        contentEditable={false}
        onClick={() => editor.chain().focus().addRowAfter().run()}
        aria-label="Add row"
        className="absolute inset-x-0 -bottom-2.5 z-10 flex h-2.5 items-center justify-center opacity-0 transition-opacity group-hover/table:opacity-100"
      >
        <span className="flex h-2.5 w-full items-center justify-center rounded-full bg-[#0088ff]/10 hover:bg-[#0088ff]/20">
          <Plus size={10} strokeWidth={2.5} className="text-[#0088ff]" />
        </span>
      </button>
    </NodeViewWrapper>
  );
}
