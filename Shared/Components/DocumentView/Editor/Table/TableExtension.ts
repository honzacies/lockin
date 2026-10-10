import { ReactNodeViewRenderer } from "@tiptap/react";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import { TableNodeView } from "./TableNodeView";

/** Notion-style table — @tiptap/extension-table's own schema/editing/
 * resize/paste-from-HTML behavior, wrapped in a custom node view
 * (TableNodeView.tsx) that adds hover-revealed add/delete row and column
 * controls plus a "delete table" corner button, and rebuilds the
 * `<colgroup>` the stock view would otherwise supply so column-resize drags
 * actually paint. Row/header/cell stay the stock extensions; only the table
 * node itself needs the custom view. */
export const TableExtension = Table.extend({
  addNodeView() {
    // The actual table markup (rows/cells) stays ProseMirror's own directly
    // -editable DOM — TableNodeView.tsx's <NodeViewContent as="table">
    // owns that, not React.
    return ReactNodeViewRenderer(TableNodeView);
  },
}).configure({
  resizable: true,
  cellMinWidth: 60,
});

export const TableRowExtension = TableRow;
export const TableHeaderExtension = TableHeader;
export const TableCellExtension = TableCell;
