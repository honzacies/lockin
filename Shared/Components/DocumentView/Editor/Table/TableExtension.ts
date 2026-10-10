import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";

/** Tabulka = standardní @tiptap/extension-table včetně jeho DOM (`.tableWrapper`
 * + `<colgroup>`), na kterém stojí resize sloupců. Ovládání (přidat / smazat
 * řádek, sloupec, tabulku) kreslí TableControls.tsx jako vrstvu nad editorem.
 * Poslední sloupec se netahá — tabulka je široká jako stránka a jeho šířka je
 * zbytek, takže tah za vnitřní okraje vždy dělá to, co čekáš. */
export const TableExtension = Table.configure({
  resizable: true,
  cellMinWidth: 60,
  lastColumnResizable: false,
});

export const TableRowExtension = TableRow;
export const TableHeaderExtension = TableHeader;
export const TableCellExtension = TableCell;
