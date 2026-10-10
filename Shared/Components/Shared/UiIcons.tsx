import { forwardRef, type SVGProps } from "react";
import { UI_ICON_DATA } from "./UiIcons.data";

/**
 * Ikony UI z Google Material Symbols. Stejné názvy a props jako dřív
 * lucide-react (size, className, strokeWidth…), takže se v komponentách
 * změnil jen import. `strokeWidth` Material ikony nemají — ignoruje se.
 * Plná varianta se použije, když má ikona výplň (`fill-…` v className,
 * např. hvězdička oblíbených), jinak obrysová.
 *
 * Ikony, které si vybírá uživatel (projekty, pole), řeší IconGlyph — tohle je jen UI.
 * Nová ikona: přidat do MAP v UiIcons.generate.ts, spustit ho a přidat export níž.
 */
export interface UiIconProps extends Omit<SVGProps<SVGSVGElement>, "ref"> {
  size?: number | string;
  strokeWidth?: number | string;
  absoluteStrokeWidth?: boolean;
}

export type UiIcon = ReturnType<typeof Make>;
/** Zpětná kompatibilita se jménem typu z lucide-react. */
export type LucideIcon = UiIcon;

function Make(name: string) {
  const Icon = forwardRef<SVGSVGElement, UiIconProps>(function Icon(
    { size = 24, strokeWidth: _s, absoluteStrokeWidth: _a, className, color, ...rest },
    ref,
  ) {
    const data = UI_ICON_DATA[name];
    const filled = Boolean(data?.f && className && /(^|\s)fill-/.test(className));
    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden={rest["aria-label"] ? undefined : true}
        className={className}
        style={color ? { color, ...rest.style } : rest.style}
        {...rest}
        dangerouslySetInnerHTML={{ __html: filled ? data!.f! : (data?.o ?? "") }}
      />
    );
  });
  Icon.displayName = name;
  return Icon;
}

export const AlignCenter = Make("AlignCenter");
export const AlignJustify = Make("AlignJustify");
export const AlignLeft = Make("AlignLeft");
export const AlignRight = Make("AlignRight");
export const ArrowDown = Make("ArrowDown");
export const ArrowDownToLine = Make("ArrowDownToLine");
export const ArrowUp = Make("ArrowUp");
export const ArrowUpDown = Make("ArrowUpDown");
export const ArrowUpRight = Make("ArrowUpRight");
export const ArrowUpToLine = Make("ArrowUpToLine");
export const Blocks = Make("Blocks");
export const Bold = Make("Bold");
export const Bot = Make("Bot");
export const Calendar = Make("Calendar");
export const CalendarClock = Make("CalendarClock");
export const CaseSensitive = Make("CaseSensitive");
export const Check = Make("Check");
export const CheckCheck = Make("CheckCheck");
export const CheckSquare = Make("CheckSquare");
export const ChevronDown = Make("ChevronDown");
export const ChevronLeft = Make("ChevronLeft");
export const ChevronRight = Make("ChevronRight");
export const Circle = Make("Circle");
export const CircleHelp = Make("CircleHelp");
export const Clapperboard = Make("Clapperboard");
export const ClipboardCopy = Make("ClipboardCopy");
export const ClipboardPaste = Make("ClipboardPaste");
export const Clock = Make("Clock");
export const Code = Make("Code");
export const Code2 = Make("Code2");
export const Columns3 = Make("Columns3");
export const Copy = Make("Copy");
export const CopyPlus = Make("CopyPlus");
export const CornerDownRight = Make("CornerDownRight");
export const Crop = Make("Crop");
export const Download = Make("Download");
export const Eraser = Make("Eraser");
export const ExternalLink = Make("ExternalLink");
export const Eye = Make("Eye");
export const EyeOff = Make("EyeOff");
export const FileText = Make("FileText");
export const Flag = Make("Flag");
export const Folder = Make("Folder");
export const FolderCog = Make("FolderCog");
export const FolderInput = Make("FolderInput");
export const FolderOpen = Make("FolderOpen");
export const FolderPlus = Make("FolderPlus");
export const Gauge = Make("Gauge");
export const GripVertical = Make("GripVertical");
export const HardDrive = Make("HardDrive");
export const Hash = Make("Hash");
export const Heading1 = Make("Heading1");
export const Heading2 = Make("Heading2");
export const Heading3 = Make("Heading3");
export const Home = Make("Home");
export const House = Make("House");
export const Image = Make("Image");
export const ImagePlus = Make("ImagePlus");
export const Info = Make("Info");
export const Italic = Make("Italic");
export const Keyboard = Make("Keyboard");
export const LayoutList = Make("LayoutList");
export const LayoutTemplate = Make("LayoutTemplate");
export const Library = Make("Library");
export const Link = Make("Link");
export const Link2 = Make("Link2");
export const List = Make("List");
export const ListChecks = Make("ListChecks");
export const ListMinus = Make("ListMinus");
export const ListOrdered = Make("ListOrdered");
export const ListTodo = Make("ListTodo");
export const ListX = Make("ListX");
export const Loader2 = Make("Loader2");
export const Lock = Make("Lock");
export const LockOpen = Make("LockOpen");
export const Maximize = Make("Maximize");
export const Maximize2 = Make("Maximize2");
export const Minimize2 = Make("Minimize2");
export const Minus = Make("Minus");
export const Monitor = Make("Monitor");
export const Moon = Make("Moon");
export const MousePointer2 = Make("MousePointer2");
export const Notebook = Make("Notebook");
export const Paintbrush = Make("Paintbrush");
export const Palette = Make("Palette");
export const PanelLeft = Make("PanelLeft");
export const Pause = Make("Pause");
export const Pencil = Make("Pencil");
export const PenTool = Make("PenTool");
export const PieChart = Make("PieChart");
export const Pilcrow = Make("Pilcrow");
export const Play = Make("Play");
export const Plus = Make("Plus");
export const Quote = Make("Quote");
export const Redo2 = Make("Redo2");
export const Repeat = Make("Repeat");
export const Rocket = Make("Rocket");
export const RotateCcw = Make("RotateCcw");
export const Rows3 = Make("Rows3");
export const Save = Make("Save");
export const Scissors = Make("Scissors");
export const Search = Make("Search");
export const Settings = Make("Settings");
export const Settings2 = Make("Settings2");
export const Shapes = Make("Shapes");
export const Shuffle = Make("Shuffle");
export const SkipForward = Make("SkipForward");
export const SlidersHorizontal = Make("SlidersHorizontal");
export const Square = Make("Square");
export const SquareDashed = Make("SquareDashed");
export const Star = Make("Star");
export const StickyNote = Make("StickyNote");
export const Strikethrough = Make("Strikethrough");
export const Sun = Make("Sun");
export const Table = Make("Table");
export const Tag = Make("Tag");
export const Tags = Make("Tags");
export const Target = Make("Target");
export const Timer = Make("Timer");
export const Trash2 = Make("Trash2");
export const Type = Make("Type");
export const Underline = Make("Underline");
export const Undo2 = Make("Undo2");
export const Upload = Make("Upload");
export const Video = Make("Video");
export const Volume2 = Make("Volume2");
export const Wand2 = Make("Wand2");
export const Waypoints = Make("Waypoints");
export const X = Make("X");
export const Zap = Make("Zap");
