// Spuštění: bun Shared/Components/Shared/UiIcons.generate.ts
// Vygeneruje UiIcons.data.ts: Lucide název → těla SVG z Material Symbols.
// Preferuje obrysovou variantu (-outline), plná se přidá, kde existuje (hvězdička oblíbených apod.).
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

const require = createRequire(join(here, "../../package.json"));
const set = JSON.parse(readFileSync(require.resolve("@iconify-json/material-symbols/icons.json"), "utf8"));
const icons: Record<string, { body: string }> = set.icons;
const aliases: Record<string, { parent: string }> = set.aliases ?? {};
const Body = (name: string): string | null => icons[name]?.body ?? (aliases[name] ? Body(aliases[name].parent) : null);

const MAP: Record<string, string> = {
  AlignCenter: "format-align-center", AlignJustify: "format-align-justify", AlignLeft: "format-align-left", AlignRight: "format-align-right",
  ArrowDown: "arrow-downward", ArrowDownToLine: "vertical-align-bottom", ArrowUp: "arrow-upward", ArrowUpToLine: "vertical-align-top",
  Blocks: "widgets", Bold: "format-bold", Bot: "smart-toy", Calendar: "calendar-today", CaseSensitive: "match-case",
  Check: "check", CheckCheck: "done-all", CheckSquare: "check-box", ChevronDown: "keyboard-arrow-down", ChevronLeft: "chevron-left",
  ChevronRight: "chevron-right", Circle: "circle", CircleHelp: "help", Clapperboard: "movie", ClipboardCopy: "content-copy",
  ClipboardPaste: "content-paste", Clock: "schedule", Code: "code", Code2: "code-blocks", Copy: "content-copy", CopyPlus: "library-add",
  Crop: "crop", Download: "download", Eraser: "ink-eraser", ExternalLink: "open-in-new", Eye: "visibility", EyeOff: "visibility-off",
  FileText: "description", Flag: "flag", Folder: "folder", FolderCog: "folder-managed", FolderInput: "drive-file-move",
  FolderOpen: "folder-open", FolderPlus: "create-new-folder", Gauge: "speed", GripVertical: "drag-indicator", Hash: "tag",
  Heading1: "format-h1", Heading2: "format-h2", Heading3: "format-h3", Image: "image", ImagePlus: "add-photo-alternate", Info: "info",
  Italic: "format-italic", Keyboard: "keyboard", LayoutTemplate: "dashboard", Library: "library-books", Link: "link", Link2: "link",
  List: "format-list-bulleted", ListChecks: "checklist", ListMinus: "list", ListOrdered: "format-list-numbered", ListTodo: "checklist-rtl",
  ListX: "playlist-remove", Loader2: "progress-activity", Lock: "lock", LockOpen: "lock-open-right", Maximize: "open-in-full",
  Minus: "remove", Monitor: "desktop-windows", Moon: "dark-mode", MousePointer2: "arrow-selector-tool", Notebook: "menu-book",
  Paintbrush: "brush", Palette: "palette", PanelLeft: "side-navigation", PenTool: "ink-pen", Pencil: "edit", Pilcrow: "format-paragraph",
  Plus: "add", Quote: "format-quote", Redo2: "redo", Repeat: "repeat", Rocket: "rocket-launch", RotateCcw: "restart-alt",
  Rows3: "table-rows", Save: "save", Scissors: "content-cut", Search: "search", Settings: "settings", Settings2: "tune", Shapes: "shapes",
  SlidersHorizontal: "tune", Square: "check-box-outline-blank", SquareDashed: "select", Star: "star", StickyNote: "sticky-note-2",
  Strikethrough: "format-strikethrough", Sun: "light-mode", Table: "table", Tag: "sell", Tags: "style", Timer: "timer", Trash2: "delete",
  Type: "title", Underline: "format-underlined", Undo2: "undo", Upload: "upload", Video: "videocam", Volume2: "volume-up",
  Wand2: "auto-fix-high", Waypoints: "hub", X: "close", Zap: "bolt",
  // nové pro filtry Your Projects
  Maximize2: "open-in-full", Minimize2: "close-fullscreen", ArrowUpRight: "arrow-outward", HardDrive: "hard-drive",
  Pause: "pause", Play: "play-arrow", SkipForward: "skip-next", Columns3: "view-column", House: "home", Home: "home",
  Shuffle: "shuffle", CornerDownRight: "subdirectory-arrow-right",
  Target: "target", PieChart: "clock-loader-40", ArrowUpDown: "swap-vert", CalendarClock: "event-upcoming", LayoutList: "lists",
};

const out: Record<string, { o: string; f?: string }> = {};
const missing: string[] = [];
for (const [lucide, material] of Object.entries(MAP)) {
  const outline = Body(`${material}-outline`);
  const base = Body(material);
  if (!outline && !base) {
    missing.push(`${lucide} → ${material}`);
    continue;
  }
  out[lucide] = outline && base && outline !== base ? { o: outline, f: base } : { o: (outline ?? base)! };
}
if (missing.length) {
  console.error("Chybí:", missing.join(", "));
  process.exit(1);
}
const file = `// Vygenerováno z @iconify-json/material-symbols (Apache 2.0) přes UiIcons.generate.ts — needitovat ručně.
// Klíč = původní název z lucide-react, o = obrysová varianta, f = plná (je-li jiná).
export const UI_ICON_DATA: Record<string, { o: string; f?: string }> = ${JSON.stringify(out)};
`;
writeFileSync(join(here, "UiIcons.data.ts"), file);
console.log(Object.keys(out).length, "ikon,", Math.round(file.length / 1024), "kB");
