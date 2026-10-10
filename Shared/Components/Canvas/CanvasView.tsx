"use client";

import { memo, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import type { DocumentRecord } from "@lockin/shared/Types/Project";
import { useRouter } from "next/navigation";
import { Button, Input } from "@heroui/react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Circle,
  Eraser,
  Italic,
  Square,
  Strikethrough,
  Type,
  Underline,
  CircleHelp,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  Maximize,
  Copy,
  ArrowUpToLine,
  ArrowDownToLine,
  Waypoints,
  MousePointer2,
  PenTool,
  Pencil,
  Minus,
  Plus,
  Redo2,
  RotateCcw,
  Save,
  SquareDashed,
  StickyNote,
  Trash2,
  Undo2,
} from "lucide-react";
import { UseDataStore } from "@lockin/shared/Store/UseDataStore";
import { UseCanvasStore, type CanvasColor, type CanvasEdge, type CanvasFile, type CanvasNode, type CanvasSide, type CanvasStroke, type CanvasScene } from "@lockin/shared/Store/UseCanvasStore";
import { DocHref } from "@lockin/shared/Lib/CollectTodoSources";
import { RichTextEditor } from "@lockin/shared/Components/DocumentView/RichTextEditor";
import { Popover } from "@lockin/shared/Components/Shared/Popover";
import { ContextMenu, ContextMenuItem, ContextMenuLabel } from "@lockin/shared/Components/Shared/ContextMenu";
import { FormatRelativeDate } from "@lockin/shared/Lib/FormatDate";
import { DocumentLinkTargets, FindWikiDocument } from "@lockin/shared/Lib/WikiLink";
import { ColorPicker } from "@lockin/shared/Components/DocumentView/StyleEditor/ColorPicker";
import { FontPicker } from "@lockin/shared/Components/DocumentView/StyleEditor/FontPicker";

// JSON Canvas barvy "1"–"6" → paleta LockInu.
const COLORS: Record<string, string> = {
  "1": "#e5484d",
  "2": "#f76b15",
  "3": "#f5a524",
  "4": "#30a46c",
  "5": "#12a594",
  "6": "#8e4ec6",
};
const DEFAULT_BORDER = "var(--lk-gray)";
/**
 * Neutrální výchozí barvy (inkoust pera, bílá výplň tvaru) se kreslí přes
 * tokeny motivu — v dark mode je tah výchozím perem světlý, ne černý na černé.
 * V datech zůstává původní hex; barvy, které si uživatel vybral sám, se nemění.
 */
const THEMED: Record<string, string> = {
  "#2c2c2b": "var(--lk-ink)",
  "#5f5e59": "var(--lk-text2)",
  "#000000": "var(--lk-fg)",
  "#ffffff": "var(--lk-bg)",
  "#d9d9d9": "var(--lk-gray)",
};
const Themed = (color: string | undefined) => (color ? (THEMED[color.toLowerCase()] ?? color) : color);
/** Preset "1"–"6" → barva palety, hex zůstává hexem. */
const ColorValue = (color: CanvasColor) => Themed(COLORS[color] ?? color)!;
const EDGE_COLOR = "var(--lk-muted)";
const GRID = 24;
const MIN_SIZE = 60;
/** Velikost úchytů v px na obrazovce; do světa se dělí zoomem, ať se při
 * oddálení nezmenší do nechytatelna. */
const HANDLE = 10;
/** Úchyty velikosti: sx/sy = která hrana se táhne (0 = tahle osa se nemění). */
const RESIZE_HANDLES = [
  { sx: -1, sy: -1, cursor: "cursor-nwse-resize" },
  { sx: 1, sy: -1, cursor: "cursor-nesw-resize" },
  { sx: 1, sy: 1, cursor: "cursor-nwse-resize" },
  { sx: -1, sy: 1, cursor: "cursor-nesw-resize" },
  { sx: 0, sy: -1, cursor: "cursor-ns-resize" },
  { sx: 0, sy: 1, cursor: "cursor-ns-resize" },
  { sx: -1, sy: 0, cursor: "cursor-ew-resize" },
  { sx: 1, sy: 0, cursor: "cursor-ew-resize" },
] as const;
type ResizeHandle = (typeof RESIZE_HANDLES)[number];
/** Průměr gumy v px na obrazovce (ve světě se dělí zoomem). */
const ERASER_SIZE = 28;
/** Výchozí styl nového tvaru a volného textu. */
const SHAPE_DEFAULTS = { fill: "#ffffff", stroke: "#2c2c2b", strokeWidth: 2 };
const TEXT_DEFAULTS = { stroke: "#2c2c2b", fontSize: 28 };

type Snapshot = { nodes: CanvasNode[]; edges: CanvasEdge[]; strokes: CanvasStroke[] };
type Selection = { kind: "node" | "edge" | "stroke"; id: string } | null;
type Tool = "select" | "pen" | "pencil" | "eraser";
type Brush = { color: string; size: number };

/** Tužka je tenčí a průsvitná, pero plné. */
const TOOL_OPACITY: Record<"pen" | "pencil", number> = { pen: 1, pencil: 0.55 };

/** Hladká čára přes středy mezi body (kvadratické křivky). */
function StrokePath(points: [number, number][]): string {
  if (points.length === 0) return "";
  if (points.length < 3) return `M ${points[0][0]} ${points[0][1]} ` + points.map(([x, y]) => `L ${x} ${y}`).join(" ");
  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length - 1; i++) {
    const [x, y] = points[i];
    const [nx, ny] = points[i + 1];
    d += ` Q ${x} ${y} ${(x + nx) / 2} ${(y + ny) / 2}`;
  }
  const [lx, ly] = points[points.length - 1];
  return `${d} L ${lx} ${ly}`;
}

const NewId = () => crypto.randomUUID().slice(0, 16);
const NoChange = () => {};

/** Vlastní kurzor pera/tužky: kroužek v barvě a velikosti štětce (podle zoomu) + malý kříž. */
function BrushCursor(brush: Brush, tool: "pen" | "pencil", zoom: number): string {
  const d = Math.min(48, Math.max(6, brush.size * zoom));
  const box = Math.ceil(d + 14);
  const c = box / 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${box}" height="${box}">
    <circle cx="${c}" cy="${c}" r="${d / 2}" fill="${brush.color}" fill-opacity="${tool === "pencil" ? 0.35 : 0.6}" stroke="white" stroke-width="1.5"/>
    <circle cx="${c}" cy="${c}" r="${d / 2 + 0.75}" fill="none" stroke="#2c2c2b" stroke-opacity="0.35" stroke-width="0.75"/>
    <path d="M ${c} ${c - 3} V ${c + 3} M ${c - 3} ${c} H ${c + 3}" stroke="#2c2c2b" stroke-width="1"/>
  </svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${Math.round(c)} ${Math.round(c)}, crosshair`;
}
/** Kurzor gumy: prázdné kolečko ve skutečné velikosti mazání. */
function EraserCursor(zoom: number): string {
  const d = Math.max(10, Math.min(64, ERASER_SIZE * zoom));
  const c = d / 2 + 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${d + 4}" height="${d + 4}"><circle cx="${c}" cy="${c}" r="${d / 2}" fill="white" fill-opacity="0.4" stroke="#5f5e59" stroke-width="1.5"/></svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}") ${c} ${c}, crosshair`;
}

/** Styl volného textu na ploše (`shape: "text"`). */
const TextStyle = (node: CanvasNode) => ({
  fontFamily: node.font,
  fontSize: node.fontSize ?? TEXT_DEFAULTS.fontSize,
  color: Themed(node.stroke ?? TEXT_DEFAULTS.stroke),
  fontWeight: node.bold ? 700 : undefined,
  fontStyle: node.italic ? "italic" : undefined,
  textDecoration: [node.underline ? "underline" : "", node.strike ? "line-through" : ""].filter(Boolean).join(" ") || undefined,
  textAlign: node.align,
  lineHeight: 1.25,
});

const SIDES: CanvasSide[] = ["top", "right", "bottom", "left"];

function SidePoint(n: CanvasNode, side: CanvasSide) {
  if (side === "top") return { x: n.x + n.width / 2, y: n.y };
  if (side === "bottom") return { x: n.x + n.width / 2, y: n.y + n.height };
  if (side === "left") return { x: n.x, y: n.y + n.height / 2 };
  return { x: n.x + n.width, y: n.y + n.height / 2 };
}
const NORMAL: Record<CanvasSide, { x: number; y: number }> = {
  top: { x: 0, y: -1 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

/** Strana cílové karty, kterou spojnice přirozeně vstupuje — podle směru,
 * odkud přilétá. (Dřív se brala strana nejblíž bodu pustění, což u široké
 * karty skončilo nahoře i pro šipku zleva.) Dělení rozměrem srovnává
 * nepoměr stran, jinak u ploché karty vždy vyhrává vodorovná strana. */
function EntrySide(n: CanvasNode, from: { x: number; y: number }): CanvasSide {
  const dx = (from.x - (n.x + n.width / 2)) / n.width;
  const dy = (from.y - (n.y + n.height / 2)) / n.height;
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "bottom" : "top";
}

/** Strana, kterou by karta v bodě `to` koukala zpátky na `from` (pro náhled tažení). */
function FacingSide(from: { x: number; y: number }, to: { x: number; y: number }): CanvasSide {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "left" : "right") : dy > 0 ? "top" : "bottom";
}

/** Výchozí zahnutí spojnice, dokud si ho uživatel neutáhne vlastní. */
const DefaultBend = (from: { x: number; y: number }, to: { x: number; y: number }) =>
  Math.max(40, Math.hypot(to.x - from.x, to.y - from.y) * 0.35);

/** Bézierova spojnice + hrot šipky + střed (pro popisek). */
function EdgeGeometry(from: { x: number; y: number }, fromSide: CanvasSide, to: { x: number; y: number }, toSide: CanvasSide, bend?: number) {
  const b = bend ?? DefaultBend(from, to);
  const c1 = { x: from.x + NORMAL[fromSide].x * b, y: from.y + NORMAL[fromSide].y * b };
  const c2 = { x: to.x + NORMAL[toSide].x * b, y: to.y + NORMAL[toSide].y * b };
  const angle = Math.atan2(to.y - c2.y, to.x - c2.x);
  const size = 9;
  const head = [
    `${to.x},${to.y}`,
    `${to.x - size * Math.cos(angle - 0.45)},${to.y - size * Math.sin(angle - 0.45)}`,
    `${to.x - size * Math.cos(angle + 0.45)},${to.y - size * Math.sin(angle + 0.45)}`,
  ].join(" ");
  // bod na křivce v t = 0.5
  const mid = {
    x: 0.125 * from.x + 0.375 * c1.x + 0.375 * c2.x + 0.125 * to.x,
    y: 0.125 * from.y + 0.375 * c1.y + 0.375 * c2.y + 0.125 * to.y,
  };
  return { d: `M ${from.x} ${from.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${to.x} ${to.y}`, head, mid };
}

/** Obrázek zmenšený na max. 1600 px — ukládá se do canvasu jako data URL. */
async function ImageToDataUrl(file: File): Promise<{ url: string; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const url = canvas.toDataURL(file.type === "image/png" ? "image/png" : "image/jpeg", 0.85);
  return { url, width: canvas.width, height: canvas.height };
}

/**
 * Canvas jako v Obsidianu: nekonečná plocha s kartami (text, dokument,
 * obrázek, skupina) a spojnicemi. Rozpracovaný canvas se nikam neukládá —
 * až tlačítkem Save (nebo Ctrl+S) do UseCanvasStore.
 */
/**
 * Rozpracovaný (neuložený) samostatný canvas přežije přepnutí záložky — žije jen
 * v paměti běžící appky, na disk jde až po Save. Po restartu appky je pryč.
 */
let draft: (CanvasScene & { meta: { id: string | null; name: string; dirty: boolean }; view: { x: number; y: number; k: number } }) | null = null;

/** Náhled dokumentu v kartě (zamčený editor). `memo` — při posunu jiných karet
 * nebo plochy se celý editor nepřekresluje. */
const DocPreview = memo(function DocPreview({ doc }: { doc: DocumentRecord }) {
  return (
    <div className="pointer-events-none -mx-3 min-h-0 flex-1 overflow-hidden">
      <RichTextEditor initialContent={doc.text.json} onChange={NoChange} style={doc.style} compact smallText locked />
    </div>
  );
});

interface CanvasViewProps {
  /** Canvas uvnitř dokumentu (sketch mode): bez jména a Save — každá změna jde
   * přes `onChange` do dokumentu, který se ukládá sám jako vždy. */
  embedded?: { initial: CanvasScene; onChange: (scene: CanvasScene) => void };
  /** Id uloženého canvasu z URL (/Canvas?id=…) — otevře se, jakmile dorazí. */
  openId?: string;
}

export function CanvasView({ embedded, openId }: CanvasViewProps = {}) {
  const router = useRouter();
  const documents = UseDataStore((s) => s.documents);
  const projects = UseDataStore((s) => s.projects);
  const saved = UseCanvasStore((s) => s.canvases);
  const saveCanvas = UseCanvasStore((s) => s.Save);
  const removeCanvas = UseCanvasStore((s) => s.Remove);

  const restored = embedded ? null : draft;
  const [nodes, setNodes] = useState<CanvasNode[]>(embedded?.initial.nodes ?? restored?.nodes ?? []);
  const [edges, setEdges] = useState<CanvasEdge[]>(embedded?.initial.edges ?? restored?.edges ?? []);
  const [strokes, setStrokes] = useState<CanvasStroke[]>(embedded?.initial.strokes ?? restored?.strokes ?? []);
  const [tool, setTool] = useState<Tool>("select");
  const [brushes, setBrushes] = useState<Record<"pen" | "pencil", Brush>>({ pen: { color: "#2c2c2b", size: 3 }, pencil: { color: "#5f5e59", size: 2 } });
  const [drawing, setDrawing] = useState<CanvasStroke | null>(null);
  /** Čáry mezi dokumentovými kartami podle jejich [[odkazů]] (jako v grafu). Ve výchozím stavu vypnuté. */
  const [showLinks, setShowLinks] = useState(embedded?.initial.showLinks ?? restored?.showLinks ?? false);

  // Sketch mode: každá změna plochy jde do dokumentu (první render je jen načtení).
  const loaded = useRef(false);
  useEffect(() => {
    if (!embedded) return;
    if (!loaded.current) {
      loaded.current = true;
      return;
    }
    embedded.onChange({ nodes, edges, strokes, showLinks });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, strokes, showLinks]);
  const [meta, setMeta] = useState<{ id: string | null; name: string; dirty: boolean }>(restored?.meta ?? { id: null, name: "Untitled", dirty: false });
  const [, setViewState] = useState({ x: 0, y: 0, k: 1 });
  const [selection, setSelection] = useState<Selection>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<{ from: { x: number; y: number }; side: CanvasSide; to: { x: number; y: number } } | null>(null);
  const history = useRef<{ past: Snapshot[]; future: Snapshot[] }>({ past: [], future: [] });
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const spaceRef = useRef(false);
  const stateRef = useRef<Snapshot>({ nodes, edges, strokes });
  stateRef.current = { nodes, edges, strokes };
  // Aktuální pohled žije v refu a do DOMu se píše přímo (ApplyView) — React se
  // o něm dozví až po 120 ms klidu. Jinak by každý pixel panu/zoomu překreslil
  // všechny karty a na 120 Hz monitoru by to nestíhalo.
  const viewRef = useRef({ x: 0, y: 0, k: 1 });
  const worldRef = useRef<HTMLDivElement>(null);
  const commitTimer = useRef(0);
  type View = { x: number; y: number; k: number };
  function setView(next: View | ((v: View) => View)) {
    const v = typeof next === "function" ? next(viewRef.current) : next;
    viewRef.current = v;
    if (worldRef.current) worldRef.current.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.k})`;
    const c = containerRef.current;
    if (c) {
      c.style.backgroundSize = `${GRID * v.k}px ${GRID * v.k}px`;
      c.style.backgroundPosition = `${v.x}px ${v.y}px`;
    }
    window.clearTimeout(commitTimer.current);
    commitTimer.current = window.setTimeout(() => setViewState(viewRef.current), 120);
  }

  // ---- historie (undo/redo) -------------------------------------------------
  /** Uloží krok do historie; `next` stačí jen s tím, co se změnilo. */
  function Commit(next: Partial<Snapshot>, before: Snapshot = stateRef.current) {
    history.current.past.push(before);
    history.current.future = [];
    Restore({ ...stateRef.current, ...next });
  }
  function Restore(snapshot: Snapshot) {
    setNodes(snapshot.nodes);
    setEdges(snapshot.edges);
    setStrokes(snapshot.strokes);
    setMeta((m) => ({ ...m, dirty: true }));
  }
  function Undo() {
    const prev = history.current.past.pop();
    if (!prev) return;
    history.current.future.push(stateRef.current);
    Restore(prev);
  }
  function Redo() {
    const next = history.current.future.pop();
    if (!next) return;
    history.current.past.push(stateRef.current);
    Restore(next);
  }

  // ---- souřadnice ----------------------------------------------------------
  function ToWorld(clientX: number, clientY: number) {
    const rect = containerRef.current!.getBoundingClientRect();
    const v = viewRef.current;
    return { x: (clientX - rect.left - v.x) / v.k, y: (clientY - rect.top - v.y) / v.k };
  }
  function Center() {
    const rect = containerRef.current!.getBoundingClientRect();
    return ToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2);
  }
  // Plynulý zoom: kolečko mění jen cíl, přiblížení k němu dojede po snímcích.
  const zoomGoal = useRef<{ k: number; sx: number; sy: number } | null>(null);
  const zoomFrame = useRef(0);
  function SmoothZoom(factor: number, clientX: number, clientY: number) {
    const rect = containerRef.current!.getBoundingClientRect();
    const base = zoomGoal.current?.k ?? viewRef.current.k;
    zoomGoal.current = { k: Math.min(3, Math.max(0.15, base * factor)), sx: clientX - rect.left, sy: clientY - rect.top };
    if (zoomFrame.current) return;
    const Step = () => {
      const goal = zoomGoal.current!;
      setView((v) => {
        const k = Math.abs(goal.k - v.k) < 0.001 ? goal.k : v.k + (goal.k - v.k) * 0.25;
        return { k, x: goal.sx - ((goal.sx - v.x) / v.k) * k, y: goal.sy - ((goal.sy - v.y) / v.k) * k };
      });
      if (Math.abs(goal.k - viewRef.current.k) < 0.001) {
        zoomFrame.current = 0;
        zoomGoal.current = null;
        return;
      }
      zoomFrame.current = requestAnimationFrame(Step);
    };
    zoomFrame.current = requestAnimationFrame(Step);
  }
  function ZoomAt(factor: number, clientX?: number, clientY?: number) {
    const rect = containerRef.current!.getBoundingClientRect();
    const sx = (clientX ?? rect.left + rect.width / 2) - rect.left;
    const sy = (clientY ?? rect.top + rect.height / 2) - rect.top;
    setView((v) => {
      const k = Math.min(3, Math.max(0.15, v.k * factor));
      return { k, x: sx - ((sx - v.x) / v.k) * k, y: sy - ((sy - v.y) / v.k) * k };
    });
  }
  function Fit() {
    const rect = containerRef.current!.getBoundingClientRect();
    // Hranice karet i kreseb.
    const xs = [...nodes.flatMap((n) => [n.x, n.x + n.width]), ...stateRef.current.strokes.flatMap((st) => st.points.map((p) => p[0]))];
    const ys = [...nodes.flatMap((n) => [n.y, n.y + n.height]), ...stateRef.current.strokes.flatMap((st) => st.points.map((p) => p[1]))];
    if (!xs.length) return setView({ x: rect.width / 2, y: rect.height / 2, k: 1 });
    const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const k = Math.min(1.5, (rect.width - 160) / (maxX - minX), (rect.height - 200) / (maxY - minY));
    setView({ k, x: rect.width / 2 - ((minX + maxX) / 2) * k, y: rect.height / 2 - ((minY + maxY) / 2) * k });
  }

  // Start: bod (0,0) uprostřed plochy.
  useEffect(() => {
    const rect = containerRef.current!.getBoundingClientRect();
    setView(restored?.view ?? { x: rect.width / 2, y: rect.height / 2, k: 1 });
    // Dokument s obsahem se otevře tak, aby byl vidět celý.
    if (embedded && (nodes.length || strokes.length)) requestAnimationFrame(() => Fit());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Při odchodu ze stránky si samostatný canvas odloží rozpracovaný stav do paměti.
  const latest = useRef({ nodes, edges, strokes, showLinks, meta, view: viewRef.current });
  latest.current = { nodes, edges, strokes, showLinks, meta, view: viewRef.current };
  useEffect(
    () => () => {
      if (!embedded) draft = { ...latest.current };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // ---- přidávání -----------------------------------------------------------
  function AddNode(node: Omit<CanvasNode, "id" | "x" | "y"> & { x?: number; y?: number }, at = Center()) {
    const created: CanvasNode = { id: NewId(), x: Math.round(at.x - node.width / 2), y: Math.round(at.y - node.height / 2), ...node };
    // Skupina patří dospod, ať karty v ní zůstanou nahoře.
    Commit({ ...stateRef.current, nodes: node.type === "group" ? [created, ...nodes] : [...nodes, created] });
    setSelection({ kind: "node", id: created.id });
    return created;
  }
  async function AddImage(file: File) {
    const { url, width, height } = await ImageToDataUrl(file);
    const scale = Math.min(1, 400 / width);
    AddNode({ type: "file", file: url, width: Math.round(width * scale), height: Math.round(height * scale) });
  }

  // ---- mazání, barvy -------------------------------------------------------
  function DeleteSelection() {
    if (!selection) return;
    if (selection.kind === "stroke") {
      Commit({ strokes: strokes.filter((st) => st.id !== selection.id) });
      return setSelection(null);
    }
    if (selection.kind === "edge") Commit({ nodes, edges: edges.filter((e) => e.id !== selection.id) });
    else Commit({ nodes: nodes.filter((n) => n.id !== selection.id), edges: edges.filter((e) => e.fromNode !== selection.id && e.toNode !== selection.id) });
    setSelection(null);
  }
  // HeroUI picker volá onChange průběžně při tahu — změny barvy téhož prvku
  // do 1 s se slijí do jednoho kroku historie, jinak by undo šlo po pixelech.
  const lastColor = useRef<{ id: string; at: number } | null>(null);
  /** Změna stylu vybraného tvaru / textu. */
  function PatchNode(id: string, patch: Partial<CanvasNode>) {
    Commit({ nodes: nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)) });
  }
  function SetColor(color: CanvasColor | undefined) {
    if (!selection) return;
    const next =
      selection.kind === "node"
        ? { nodes: nodes.map((n) => (n.id === selection.id ? { ...n, color } : n)) }
        : { edges: edges.map((e) => (e.id === selection.id ? { ...e, color } : e)) };
    const merge = lastColor.current?.id === selection.id && Date.now() - lastColor.current.at < 1000;
    lastColor.current = { id: selection.id, at: Date.now() };
    if (merge) Restore({ ...stateRef.current, ...next });
    else Commit(next);
  }

  // ---- ukládání ------------------------------------------------------------
  function SaveNow() {
    const id = meta.id ?? NewId();
    const file: CanvasFile = { id, name: meta.name.trim() || "Untitled", nodes, edges, strokes, showLinks, updatedAt: new Date().toISOString() };
    saveCanvas(file);
    setMeta({ id, name: file.name, dirty: false });
  }
  function Open(canvas: CanvasFile | null) {
    if (meta.dirty && !window.confirm("Discard unsaved changes on this canvas?")) return;
    setNodes(canvas?.nodes ?? []);
    setStrokes(canvas?.strokes ?? []);
    setShowLinks(canvas?.showLinks ?? false);
    setEdges(canvas?.edges ?? []);
    setMeta({ id: canvas?.id ?? null, name: canvas?.name ?? "Untitled", dirty: false });
    history.current = { past: [], future: [] };
    setSelection(null);
    setEditing(null);
    requestAnimationFrame(() => (canvas ? Fit() : setView((v) => ({ ...v, k: 1 }))));
  }

  // Odkaz ze sidebaru (/Canvas?id=…). `saved` je po startu prázdné, dokud se
  // store nenačte z disku — proto je v závislostech a otevře se, až dorazí.
  useEffect(() => {
    if (embedded || !openId || openId === meta.id) return;
    const canvas = saved.find((c) => c.id === openId);
    if (canvas) Open(canvas);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId, saved]);

  /** Smaže všechno na ploše. Jde přes Commit, takže to vrátí Ctrl+Z. */
  function ClearAll() {
    if (!nodes.length && !edges.length && !strokes.length) return;
    if (!window.confirm("Clear everything on this canvas?")) return;
    setSelection(null);
    setEditing(null);
    Commit({ nodes: [], edges: [], strokes: [] });
  }

  // ---- klávesnice ----------------------------------------------------------
  useEffect(() => {
    function OnKey(e: KeyboardEvent) {
      const typing = e.target instanceof Element && e.target.closest("input, textarea, [contenteditable=true]");
      if (e.key === " " && !typing) {
        spaceRef.current = e.type === "keydown";
        if (!typing) e.preventDefault();
      }
      if (e.type !== "keydown" || typing) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "s") (e.preventDefault(), !embedded && SaveNow());
      else if (mod && e.key.toLowerCase() === "z") (e.preventDefault(), e.shiftKey ? Redo() : Undo());
      else if (mod && e.key.toLowerCase() === "y") (e.preventDefault(), Redo());
      else if (e.key === "Delete" || e.key === "Backspace") DeleteSelection();
      else if (e.key === "Escape") (setSelection(null), setEditing(null), setTool("select"));
      else if (!mod && e.key.toLowerCase() === "v") setTool("select");
      else if (!mod && e.key.toLowerCase() === "p") setTool("pen");
      else if (!mod && e.key.toLowerCase() === "b") setTool("pencil");
      else if (!mod && e.key.toLowerCase() === "e") setTool("eraser");
    }
    window.addEventListener("keydown", OnKey);
    window.addEventListener("keyup", OnKey);
    return () => {
      window.removeEventListener("keydown", OnKey);
      window.removeEventListener("keyup", OnKey);
    };
  });

  // ---- tažení (posun plochy, karty, velikost, spojnice) --------------------
  function Drag(e: ReactPointerEvent, onMove: (dx: number, dy: number, ev: PointerEvent) => void, onEnd?: (ev: PointerEvent) => void) {
    e.stopPropagation();
    const start = { x: e.clientX, y: e.clientY };
    function Move(ev: PointerEvent) {
      const k = viewRef.current.k;
      onMove((ev.clientX - start.x) / k, (ev.clientY - start.y) / k, ev);
    }
    function Up(ev: PointerEvent) {
      window.removeEventListener("pointermove", Move);
      window.removeEventListener("pointerup", Up);
      onEnd?.(ev);
    }
    window.addEventListener("pointermove", Move);
    window.addEventListener("pointerup", Up);
  }
  function PanDrag(e: ReactPointerEvent) {
    const origin = viewRef.current;
    const start = { x: e.clientX, y: e.clientY };
    Drag(e, (_dx, _dy, ev) => setView({ ...origin, x: origin.x + ev.clientX - start.x, y: origin.y + ev.clientY - start.y }));
  }
  function MoveDrag(e: ReactPointerEvent, node: CanvasNode) {
    if (spaceRef.current) return PanDrag(e);
    setSelection({ kind: "node", id: node.id });
    const before = stateRef.current;
    // Skupina bere s sebou karty, které leží celé uvnitř ní.
    const inside =
      node.type === "group"
        ? new Set(nodes.filter((n) => n.id !== node.id && n.x >= node.x && n.y >= node.y && n.x + n.width <= node.x + node.width && n.y + n.height <= node.y + node.height).map((n) => n.id))
        : new Set<string>();
    const origin = new Map(before.nodes.map((n) => [n.id, { x: n.x, y: n.y }]));
    let moved = false;
    Drag(
      e,
      (dx, dy) => {
        moved = moved || Math.abs(dx) + Math.abs(dy) > 2;
        setNodes((list) => list.map((n) => (n.id === node.id || inside.has(n.id) ? { ...n, x: Math.round(origin.get(n.id)!.x + dx), y: Math.round(origin.get(n.id)!.y + dy) } : n)));
      },
      () => moved && Commit(stateRef.current, before),
    );
  }
  /** Změna velikosti. Strana mění jeden rozměr, roh dva; protilehlá hrana
   * zůstává na místě, takže se karta netáhne za kurzorem. Roh kruhu drží
   * poměr stran — jinak by z kruhu vznikla elipsa. */
  function ResizeDrag(e: ReactPointerEvent, node: CanvasNode, h: ResizeHandle) {
    const before = stateRef.current;
    setSelection({ kind: "node", id: node.id });
    Drag(
      e,
      (dx, dy) => {
        let width = h.sx ? Math.max(MIN_SIZE, node.width + h.sx * dx) : node.width;
        let height = h.sy ? Math.max(MIN_SIZE, node.height + h.sy * dy) : node.height;
        if (node.shape === "ellipse" && h.sx && h.sy) {
          const k = Math.max((width / node.width + height / node.height) / 2, MIN_SIZE / node.width, MIN_SIZE / node.height);
          width = node.width * k;
          height = node.height * k;
        }
        width = Math.round(width);
        height = Math.round(height);
        setNodes((list) =>
          list.map((n) =>
            n.id === node.id
              ? { ...n, width, height, x: h.sx < 0 ? node.x + node.width - width : node.x, y: h.sy < 0 ? node.y + node.height - height : node.y }
              : n,
          ),
        );
      },
      () => Commit(stateRef.current, before),
    );
  }

  /** Tažení za spojnici mění její zahnutí. Zahnutí posouvá kontrolní body po
   * normálách obou stran, takže střed křivky jde přesně za kurzorem; u
   * protilehlých stran se normály vyruší a bere se kolmice na spojnici. */
  function BendDrag(e: ReactPointerEvent, edge: CanvasEdge) {
    const a = byId.get(edge.fromNode);
    const b = byId.get(edge.toNode);
    if (!a || !b) return;
    const from = SidePoint(a, edge.fromSide);
    const to = SidePoint(b, edge.toSide);
    const base = edge.bend ?? DefaultBend(from, to);
    const sum = { x: NORMAL[edge.fromSide].x + NORMAL[edge.toSide].x, y: NORMAL[edge.fromSide].y + NORMAL[edge.toSide].y };
    const len = Math.hypot(sum.x, sum.y);
    const perp = { x: -(to.y - from.y), y: to.x - from.x };
    const plen = Math.hypot(perp.x, perp.y) || 1;
    const unit = len > 0.01 ? { x: sum.x / len, y: sum.y / len } : { x: perp.x / plen, y: perp.y / plen };
    const gain = len > 0.01 ? 1 / (0.375 * len) : 1;
    const before = stateRef.current;
    let moved = false;
    Drag(
      e,
      (dx, dy) => {
        moved = moved || Math.abs(dx) + Math.abs(dy) > 2;
        if (!moved) return;
        const bend = Math.max(0, Math.round(base + (dx * unit.x + dy * unit.y) * gain));
        setEdges((list) => list.map((x) => (x.id === edge.id ? { ...x, bend } : x)));
      },
      () => moved && Commit(stateRef.current, before),
    );
  }
  function ConnectDrag(e: ReactPointerEvent, node: CanvasNode, side: CanvasSide) {
    const from = SidePoint(node, side);
    setConnecting({ from, side, to: from });
    Drag(
      e,
      (_dx, _dy, ev) => setConnecting({ from, side, to: ToWorld(ev.clientX, ev.clientY) }),
      (ev) => {
        setConnecting(null);
        const p = ToWorld(ev.clientX, ev.clientY);
        // Pustit o několik pixelů mimo kartu je pořád záměr ji napojit.
        const pad = HANDLE / viewRef.current.k;
        const hits = nodes.filter((n) => n.id !== node.id && p.x >= n.x - pad && p.x <= n.x + n.width + pad && p.y >= n.y - pad && p.y <= n.y + n.height + pad);
        // Cíl = nejvrchnější karta pod kurzorem, skupina až jako poslední možnost.
        const target = [...hits].reverse().find((n) => n.type !== "group") ?? hits[hits.length - 1];
        if (!target) return;
        const edge: CanvasEdge = { id: NewId(), fromNode: node.id, fromSide: side, toNode: target.id, toSide: EntrySide(target, from) };
        Commit({ edges: [...stateRef.current.edges, edge] });
        setSelection({ kind: "edge", id: edge.id });
      },
    );
  }

  /** Pero / tužka: tah se sbírá ve světových souřadnicích, do historie jde až po puštění. */
  function DrawDrag(e: ReactPointerEvent) {
    if (tool === "select" || tool === "eraser" || e.button !== 0) return;
    e.stopPropagation();
    (document.activeElement as HTMLElement | null)?.blur();
    const brush = brushes[tool];
    const start = ToWorld(e.clientX, e.clientY);
    let stroke: CanvasStroke = { id: NewId(), tool, color: brush.color, size: brush.size, points: [[Math.round(start.x), Math.round(start.y)]] };
    setDrawing(stroke);
    Drag(
      e,
      (_dx, _dy, ev) => {
        // Prohlížeč slučuje pohyby myši do jednoho eventu za snímek — getCoalescedEvents
        // vrátí všechny, takže je čára hladká i při rychlém tahu.
        const points = [...stroke.points];
        for (const e2 of ev.getCoalescedEvents?.() ?? [ev]) {
          const p = ToWorld(e2.clientX, e2.clientY);
          const [lx, ly] = points[points.length - 1];
          // Body hustší než ~1.5 px na obrazovce nic nepřidají, jen zvětší soubor.
          if (Math.hypot(p.x - lx, p.y - ly) < 1.5 / viewRef.current.k) continue;
          points.push([Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10]);
        }
        if (points.length === stroke.points.length) return;
        stroke = { ...stroke, points };
        setDrawing(stroke);
      },
      () => {
        setDrawing(null);
        Commit({ strokes: [...stateRef.current.strokes, stroke] });
      },
    );
  }

  /** Guma: maže kresby, kterých se tah dotkne. Karty se mažou Deletem — guma
   * je na kreslení, ne na obsah. Nový stav se drží v `next`, ne ve stavu
   * komponenty: setStrokes je asynchronní a do historie potřebujeme jistotu. */
  function EraseDrag(e: ReactPointerEvent) {
    if (e.button !== 0) return;
    e.stopPropagation();
    const before = stateRef.current;
    let next = before.strokes;
    function EraseAt(p: { x: number; y: number }) {
      const reach = ERASER_SIZE / 2 / viewRef.current.k;
      const kept = next.filter((st) => !st.points.some(([x, y]) => Math.hypot(x - p.x, y - p.y) <= reach + st.size / 2));
      if (kept.length === next.length) return;
      next = kept;
      setStrokes(kept);
    }
    EraseAt(ToWorld(e.clientX, e.clientY));
    Drag(
      e,
      (_dx, _dy, ev) => {
        for (const e2 of ev.getCoalescedEvents?.() ?? [ev]) EraseAt(ToWorld(e2.clientX, e2.clientY));
      },
      () => next !== before.strokes && Commit({ strokes: next }, before),
    );
  }

  function OnBackgroundDown(e: ReactPointerEvent) {
    if (e.button !== 0 && e.button !== 1) return;
    // Nejdřív blur — onBlur editovaného pole uloží text. Kdyby se editace jen
    // zavřela, React pole odebere dřív, než blur stihne proběhnout, a text zmizí.
    (document.activeElement as HTMLElement | null)?.blur();
    setSelection(null);
    setEditing(null);
    PanDrag(e);
  }

  // Kolečko: posun plochy, s Ctrl/⌘ (a pinch na touchpadu) zoom.
  useEffect(() => {
    const el = containerRef.current!;
    function OnWheel(e: WheelEvent) {
      e.preventDefault();
      // ~18 % na cvak kolečka (deltaY ≈ 100), plynule dojede; pinch na touchpadu posílá malé delty.
      if (e.ctrlKey || e.metaKey) SmoothZoom(Math.exp(-Math.max(-100, Math.min(100, e.deltaY)) * 0.002), e.clientX, e.clientY);
      else setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
    }
    el.addEventListener("wheel", OnWheel, { passive: false });
    return () => el.removeEventListener("wheel", OnWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const view = viewRef.current;

  // ---- kontextové menu -----------------------------------------------------
  const [menu, setMenu] = useState<{ target: Selection; at: { x: number; y: number } }>({ target: null, at: { x: 0, y: 0 } });
  const MenuIcon = ({ icon: Icon }: { icon: typeof Plus }) => <Icon size={14} strokeWidth={1.75} className="text-[var(--lk-text2)]" />;
  function Reorder(id: string, front: boolean) {
    const node = nodes.find((n) => n.id === id)!;
    const rest = nodes.filter((n) => n.id !== id);
    Commit({ nodes: front ? [...rest, node] : [node, ...rest] });
  }
  function Duplicate(id: string) {
    const node = nodes.find((n) => n.id === id)!;
    const copy = { ...node, id: NewId(), x: node.x + 24, y: node.y + 24 };
    Commit({ nodes: [...nodes, copy] });
    setSelection({ kind: "node", id: copy.id });
  }
  function CanvasMenu({ close }: { close: () => void }) {
    const Do = (fn: () => void) => () => (fn(), close());
    const target = menu.target;
    const node = target?.kind === "node" ? byId.get(target.id) : undefined;
    const doc = node?.type === "file" && node.file && !node.file.startsWith("data:") ? documents[node.file] : undefined;
    if (node) {
      return (
        <>
          <ContextMenuLabel first>{node.type === "group" ? "Group" : node.type === "text" ? "Card" : doc ? "Document" : "Image"}</ContextMenuLabel>
          {doc ? <ContextMenuItem icon={<MenuIcon icon={FileText} />} onClick={Do(() => router.push(DocHref(doc, projects)))}>Open document</ContextMenuItem> : null}
          {node.type === "text" || node.type === "group" ? (
            <ContextMenuItem icon={<MenuIcon icon={Pencil} />} onClick={Do(() => setEditing(node.id))}>{node.type === "group" ? "Rename" : "Edit text"}</ContextMenuItem>
          ) : null}
          <ContextMenuItem icon={<MenuIcon icon={Copy} />} onClick={Do(() => Duplicate(node.id))}>Duplicate</ContextMenuItem>
          <ContextMenuItem icon={<MenuIcon icon={ArrowUpToLine} />} onClick={Do(() => Reorder(node.id, true))}>Bring to front</ContextMenuItem>
          <ContextMenuItem icon={<MenuIcon icon={ArrowDownToLine} />} onClick={Do(() => Reorder(node.id, false))}>Send to back</ContextMenuItem>
          <ContextMenuItem danger icon={<Trash2 size={14} strokeWidth={1.75} />} onClick={Do(DeleteSelection)}>Delete</ContextMenuItem>
        </>
      );
    }
    if (target?.kind === "edge") {
      return (
        <>
          <ContextMenuLabel first>Connection</ContextMenuLabel>
          <ContextMenuItem icon={<MenuIcon icon={Pencil} />} onClick={Do(() => setEditing(target.id))}>Edit label</ContextMenuItem>
          <ContextMenuItem danger icon={<Trash2 size={14} strokeWidth={1.75} />} onClick={Do(DeleteSelection)}>Delete</ContextMenuItem>
        </>
      );
    }
    return (
      <>
        <ContextMenuLabel first>Add here</ContextMenuLabel>
        <ContextMenuItem icon={<MenuIcon icon={StickyNote} />} onClick={Do(() => setEditing(AddNode({ type: "text", text: "", width: 260, height: 140 }, menu.at).id))}>Card</ContextMenuItem>
        <ContextMenuItem icon={<MenuIcon icon={SquareDashed} />} onClick={Do(() => AddNode({ type: "group", label: "Group", width: 560, height: 380 }, menu.at))}>Group</ContextMenuItem>
        <ContextMenuItem icon={<MenuIcon icon={Square} />} onClick={Do(() => AddNode({ type: "text", shape: "rect", text: "", width: 200, height: 140, ...SHAPE_DEFAULTS }, menu.at))}>Square</ContextMenuItem>
        <ContextMenuItem icon={<MenuIcon icon={Circle} />} onClick={Do(() => AddNode({ type: "text", shape: "ellipse", text: "", width: 160, height: 160, ...SHAPE_DEFAULTS }, menu.at))}>Circle</ContextMenuItem>
        <ContextMenuItem icon={<MenuIcon icon={Type} />} onClick={Do(() => setEditing(AddNode({ type: "text", shape: "text", text: "", width: 240, height: 44, ...TEXT_DEFAULTS }, menu.at).id))}>Text</ContextMenuItem>
        <ContextMenuLabel>Tools</ContextMenuLabel>
        <ContextMenuItem icon={<MenuIcon icon={MousePointer2} />} selected={tool === "select"} onClick={Do(() => setTool("select"))}>Select</ContextMenuItem>
        <ContextMenuItem icon={<MenuIcon icon={PenTool} />} selected={tool === "pen"} onClick={Do(() => setTool("pen"))}>Pen</ContextMenuItem>
        <ContextMenuItem icon={<MenuIcon icon={Pencil} />} selected={tool === "pencil"} onClick={Do(() => setTool("pencil"))}>Pencil</ContextMenuItem>
        <ContextMenuItem icon={<MenuIcon icon={Eraser} />} selected={tool === "eraser"} onClick={Do(() => setTool("eraser"))}>Eraser</ContextMenuItem>
        <ContextMenuLabel>View</ContextMenuLabel>
        <ContextMenuItem icon={<MenuIcon icon={Maximize} />} onClick={Do(Fit)}>Zoom to fit</ContextMenuItem>
        <ContextMenuItem icon={<MenuIcon icon={Waypoints} />} selected={showLinks} onClick={Do(() => (setShowLinks((v) => !v), setMeta((m) => ({ ...m, dirty: true }))))}>
          Document links
        </ContextMenuItem>
      </>
    );
  }
  // Dvojice dokumentových karet, kde jeden dokument odkazuje na druhý.
  const docLinks = useMemo(() => {
    if (!showLinks) return [];
    const all = Object.values(documents);
    const cards = nodes.filter((n) => n.type === "file" && n.file && documents[n.file]);
    const pairs: [CanvasNode, CanvasNode][] = [];
    for (const a of cards) {
      const targets = [...DocumentLinkTargets(documents[a.file!])].map((t) => FindWikiDocument(t, all)?.id);
      for (const b of cards) {
        if (a.id !== b.id && targets.includes(b.file) && !pairs.some(([x, y]) => x.id === b.id && y.id === a.id)) pairs.push([a, b]);
      }
    }
    return pairs;
  }, [showLinks, nodes, documents]);
  const selectedNode = selection?.kind === "node" ? byId.get(selection.id) : undefined;
  const selectedEdge = selection?.kind === "edge" ? edges.find((e) => e.id === selection.id) : undefined;

  return (
    <div className="relative flex h-full flex-col bg-white text-[var(--lk-ink)]">
      <ContextMenu className="flex min-h-0 flex-1 flex-col" menu={(close) => <CanvasMenu close={close} />}>
      <div
        ref={containerRef}
        onContextMenuCapture={(e) => {
          const el = e.target instanceof Element ? e.target : null;
          const nodeId = el?.closest("[data-node-id]")?.getAttribute("data-node-id");
          const edgeId = el?.closest("[data-edge-id]")?.getAttribute("data-edge-id");
          const target = nodeId ? { kind: "node" as const, id: nodeId } : edgeId ? { kind: "edge" as const, id: edgeId } : null;
          setMenu({ target, at: ToWorld(e.clientX, e.clientY) });
          if (target) setSelection(target);
        }}
        onPointerDown={OnBackgroundDown}
        onDoubleClick={(e) => {
          if (e.target !== e.currentTarget) return;
          const node = AddNode({ type: "text", text: "", width: 260, height: 140 }, ToWorld(e.clientX, e.clientY));
          setEditing(node.id);
        }}
        className="relative min-h-0 flex-1 cursor-grab overflow-hidden bg-[var(--lk-raised)] active:cursor-grabbing"
        style={{
          backgroundImage: "radial-gradient(circle, var(--lk-line2) 1px, transparent 1.2px)",
          backgroundSize: `${GRID * view.k}px ${GRID * view.k}px`,
          backgroundPosition: `${view.x}px ${view.y}px`,
        }}
      >
        <div ref={worldRef} className="pointer-events-none absolute left-0 top-0 origin-top-left" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
          {/* Spojnice pod kartami */}
          <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width="1" height="1">
            {docLinks.map(([a, b]) => (
              <line
                key={`link-${a.id}-${b.id}`}
                x1={a.x + a.width / 2}
                y1={a.y + a.height / 2}
                x2={b.x + b.width / 2}
                y2={b.y + b.height / 2}
                stroke="#c9c8c4"
                strokeWidth={1.5}
                strokeDasharray="5 5"
              />
            ))}
            {edges.map((edge) => {
              const a = byId.get(edge.fromNode);
              const b = byId.get(edge.toNode);
              if (!a || !b) return null;
              const g = EdgeGeometry(SidePoint(a, edge.fromSide), edge.fromSide, SidePoint(b, edge.toSide), edge.toSide, edge.bend);
              const color = edge.color ? ColorValue(edge.color) : EDGE_COLOR;
              const selected = selection?.kind === "edge" && selection.id === edge.id;
              return (
                <g key={edge.id}>
                  <path
                    d={g.d}
                    stroke="transparent"
                    strokeWidth={14}
                    fill="none"
                    className="pointer-events-auto cursor-pointer"
                    data-edge-id={edge.id}
                    onPointerDown={(e) => (e.stopPropagation(), setSelection({ kind: "edge", id: edge.id }), BendDrag(e, edge))}
                    onDoubleClick={(e) => (e.stopPropagation(), setEditing(edge.id))}
                  />
                  <path d={g.d} stroke={color} strokeWidth={selected ? 3 : 2} fill="none" />
                  <polygon points={g.head} fill={color} />
                </g>
              );
            })}
            {connecting ? (
              <path
                d={EdgeGeometry(connecting.from, connecting.side, connecting.to, FacingSide(connecting.from, connecting.to)).d}
                stroke="#0088ff"
                strokeWidth={2}
                strokeDasharray="6 4"
                fill="none"
              />
            ) : null}
          </svg>

          {/* Popisky spojnic */}
          {edges.map((edge) => {
            const a = byId.get(edge.fromNode);
            const b = byId.get(edge.toNode);
            if (!a || !b || (!edge.label && editing !== edge.id)) return null;
            const { mid } = EdgeGeometry(SidePoint(a, edge.fromSide), edge.fromSide, SidePoint(b, edge.toSide), edge.toSide, edge.bend);
            return (
              <div key={`l-${edge.id}`} className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2" style={{ left: mid.x, top: mid.y }}>
                {editing === edge.id ? (
                  <Input
                    autoFocus
                    defaultValue={edge.label ?? ""}
                    onBlur={(e) => (setEditing(null), Commit({ nodes, edges: edges.map((x) => (x.id === edge.id ? { ...x, label: e.target.value.trim() || undefined } : x)) }))}
                    onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                    className="w-40 rounded-md border border-[#0485f7] bg-white px-1.5 py-0.5 text-center text-[13px] outline-none"
                  />
                ) : (
                  <span
                    onDoubleClick={() => setEditing(edge.id)}
                    className="select-none whitespace-nowrap rounded-md bg-[var(--lk-raised)] px-1.5 py-0.5 text-[13px] text-[var(--lk-text2)]"
                  >
                    {edge.label}
                  </span>
                )}
              </div>
            );
          })}

          {/* Karty */}
          {nodes.map((node) => {
            const selected = selection?.kind === "node" && selection.id === node.id;
            const border = node.color ? ColorValue(node.color) : DEFAULT_BORDER;
            const doc = node.type === "file" && node.file && !node.file.startsWith("data:") ? documents[node.file] : undefined;
            const isImage = node.type === "file" && node.file?.startsWith("data:");
            return (
              <div
                key={node.id}
                data-node-id={node.id}
                onPointerDown={(e) => editing !== node.id && MoveDrag(e, node)}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  if (node.type === "text") setEditing(node.id);
                  if (doc) router.push(DocHref(doc, projects));
                  if (node.type === "group") setEditing(node.id);
                }}
                className={`group/card pointer-events-auto absolute select-none ${
                  // Tvar i volný text jsou běžné uzly, jen bez kartové chrome —
                  // zdědí tak posun, resize, spojnice i pořadí ve vrstvách.
                  node.shape === "ellipse"
                    ? "rounded-full"
                    : node.shape === "rect"
                      ? "rounded-md"
                      : node.shape === "text"
                        ? ""
                        : isImage
                          ? "rounded-xl"
                          : `rounded-xl ${node.type === "group" ? "border-2" : "border-2 bg-white shadow-sm"}`
                } ${selected ? "ring-2 ring-[#0088ff]/40" : ""}`}
                style={{
                  left: node.x,
                  top: node.y,
                  width: node.width,
                  height: node.height,
                  ...(node.shape === "text" || isImage
                    ? {}
                    : node.shape
                      ? { background: Themed(node.fill) || "transparent", border: `${node.strokeWidth ?? 2}px solid ${Themed(node.stroke ?? SHAPE_DEFAULTS.stroke)}` }
                      : {
                          borderColor: border,
                          background:
                            node.type === "group"
                              ? `${node.color ? ColorValue(node.color) : "#91918e"}0d`
                              : node.color
                                ? `color-mix(in srgb, ${ColorValue(node.color)} 6%, white)`
                                : undefined,
                        }),
                }}
              >
                {node.type === "group" ? (
                  <div className="absolute -top-7 left-0 text-[14px] font-medium text-[var(--lk-text2)]">
                    {editing === node.id ? (
                      <Input
                        autoFocus
                        defaultValue={node.label ?? ""}
                        onPointerDown={(e) => e.stopPropagation()}
                        onBlur={(e) => (setEditing(null), Commit({ edges, nodes: nodes.map((n) => (n.id === node.id ? { ...n, label: e.target.value } : n)) }))}
                        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                        className="w-48 rounded-md border border-[#0485f7] bg-white px-1.5 py-0.5 text-[14px] outline-none"
                      />
                    ) : (
                      node.label || "Group"
                    )}
                  </div>
                ) : node.shape === "rect" || node.shape === "ellipse" ? null : node.type === "text" ? (
                  editing === node.id ? (
                    <textarea
                      autoFocus
                      defaultValue={node.text}
                      onPointerDown={(e) => e.stopPropagation()}
                      onBlur={(e) => (setEditing(null), e.target.value !== (node.text ?? "") && Commit({ edges, nodes: nodes.map((n) => (n.id === node.id ? { ...n, text: e.target.value } : n)) }))}
                      style={node.shape === "text" ? TextStyle(node) : undefined}
                      className={`size-full resize-none bg-transparent outline-none ${node.shape === "text" ? "p-0" : "rounded-xl p-3 text-[15px] leading-[22px] text-[var(--lk-ink)]"}`}
                      placeholder={node.shape === "text" ? "Text…" : "Write something…"}
                    />
                  ) : (
                    <p
                      style={node.shape === "text" ? TextStyle(node) : undefined}
                      className={`size-full overflow-hidden whitespace-pre-wrap ${node.shape === "text" ? "p-0" : "p-3 text-[15px] leading-[22px] text-[var(--lk-ink)]"}`}
                    >
                      {node.text || <span className="text-[var(--lk-faint)]">Double-click to write</span>}
                    </p>
                  )
                ) : isImage ? (
                  // eslint-disable-next-line @next/next/no-img-element -- data URL z canvasu
                  <img src={node.file} alt="" draggable={false} className="size-full rounded-xl object-cover" />
                ) : (
                  <div className="flex size-full flex-col gap-1.5 overflow-hidden p-3">
                    <p className="flex items-center gap-1.5 text-[15px] font-medium text-[var(--lk-fg)]">
                      <FileText size={15} strokeWidth={1.75} className="shrink-0 text-[var(--lk-text2)]" />
                      <span className="truncate">{doc?.name || "Missing document"}</span>
                    </p>
                    {doc ? (
                      // Dokument vykreslený jako v normálním zobrazení, jen zamčený (nic se neuloží).
                      <DocPreview key={`${doc.id}:${doc.updatedAt}`} doc={doc} />
                    ) : (
                      <p className="text-[13px] text-[var(--lk-text2)]">This document no longer exists.</p>
                    )}
                  </div>
                )}

                {/* Úchyty pro spojnice — kousek vedle karty, ať nekolidují s úchyty
                    velikosti na hranách. Rozměry dělené zoomem = stejná velikost na
                    obrazovce při jakémkoli přiblížení. */}
                {SIDES.map((side) => {
                  const p = SidePoint({ ...node, x: 0, y: 0 }, side);
                  const d = (HANDLE + 2) / view.k;
                  const off = (HANDLE + 7) / view.k;
                  return (
                    <span
                      key={side}
                      onPointerDown={(e) => ConnectDrag(e, node, side)}
                      className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-crosshair rounded-full border-2 border-white bg-[#0088ff] shadow ${selected ? "opacity-100" : "opacity-0 group-hover/card:opacity-100"}`}
                      style={{ left: p.x + NORMAL[side].x * off, top: p.y + NORMAL[side].y * off, width: d, height: d }}
                    />
                  );
                })}
                {/* Úchyty velikosti: rohové body jsou vidět, stěny jsou neviditelné
                    pásky na hranách (zvýrazní se při najetí). */}
                {(editing === node.id ? [] : RESIZE_HANDLES).map((h) => {
                  const t = HANDLE / view.k;
                  const corner = h.sx !== 0 && h.sy !== 0;
                  return (
                    <span
                      key={`${h.sx},${h.sy}`}
                      onPointerDown={(e) => ResizeDrag(e, node, h)}
                      className={`absolute ${h.cursor} ${
                        corner
                          ? `rounded-sm bg-[#0088ff] ${selected ? "opacity-100" : "opacity-0 group-hover/card:opacity-60"}`
                          : "hover:bg-[#0088ff]/30"
                      }`}
                      style={{
                        left: h.sx === 0 ? t : h.sx < 0 ? -t / 2 : node.width - t / 2,
                        top: h.sy === 0 ? t : h.sy < 0 ? -t / 2 : node.height - t / 2,
                        width: h.sx === 0 ? Math.max(0, node.width - 2 * t) : t,
                        height: h.sy === 0 ? Math.max(0, node.height - 2 * t) : t,
                      }}
                    />
                  );
                })}
              </div>
            );
          })}

          {/* Kresby nad kartami — ve výběru jdou kliknutím vybrat a smazat */}
          <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width="1" height="1">
            {[...strokes, ...(drawing ? [drawing] : [])].map((st) => {
              const d = StrokePath(st.points);
              const selected = selection?.kind === "stroke" && selection.id === st.id;
              return (
                <g key={st.id}>
                  {tool === "select" && st !== drawing ? (
                    <path
                      d={d}
                      stroke="transparent"
                      strokeWidth={Math.max(12, st.size + 8)}
                      fill="none"
                      className="pointer-events-auto cursor-pointer"
                      onPointerDown={(e) => (e.stopPropagation(), setSelection({ kind: "stroke", id: st.id }))}
                    />
                  ) : null}
                  {selected ? <path d={d} stroke="#0088ff" strokeOpacity={0.25} strokeWidth={st.size + 8} fill="none" strokeLinecap="round" strokeLinejoin="round" /> : null}
                  <path d={d} stroke={Themed(st.color)} strokeOpacity={TOOL_OPACITY[st.tool]} strokeWidth={st.size} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </g>
              );
            })}
          </svg>

          {/* Plovoucí lišta u vybrané karty / spojnice */}
          {selectedNode || selectedEdge ? (
            <SelectionBar
              at={
                selectedNode
                  ? { x: selectedNode.x + selectedNode.width / 2, y: selectedNode.y - (selectedNode.type === "group" ? 36 : 8) }
                  : (() => {
                      const a = byId.get(selectedEdge!.fromNode);
                      const b = byId.get(selectedEdge!.toNode);
                      return a && b ? EdgeGeometry(SidePoint(a, selectedEdge!.fromSide), selectedEdge!.fromSide, SidePoint(b, selectedEdge!.toSide), selectedEdge!.toSide, selectedEdge!.bend).mid : { x: 0, y: 0 };
                    })()
              }
              scale={view.k}
              color={(selectedNode ?? selectedEdge)!.color}
              onColor={SetColor}
              shapeNode={selectedNode?.shape ? selectedNode : undefined}
              onPatchNode={(patch) => selectedNode && PatchNode(selectedNode.id, patch)}
              onDelete={DeleteSelection}
              onLabel={selectedEdge ? () => setEditing(selectedEdge.id) : undefined}
            />
          ) : null}
        </div>
        {/* Kreslicí vrstva — uvnitř plochy, ať kolečko dál posouvá a zoomuje. */}
        {tool !== "select" ? (
          <div
            onPointerDown={tool === "eraser" ? EraseDrag : DrawDrag}
            className="absolute inset-0 touch-none"
            style={{ cursor: tool === "eraser" ? EraserCursor(view.k) : BrushCursor(brushes[tool], tool, view.k) }}
            aria-label={tool === "eraser" ? "Erasing" : `Drawing with ${tool}`}
          />
        ) : null}
      </div>
      </ContextMenu>

      {/* Nahoře vlevo: název, uložení, otevření — v dokumentu se ukládá samo, lišta tam není. */}
      {!embedded ? (
        <>
      <div className="absolute left-4 top-4 flex select-none items-center gap-2 rounded-2xl border border-[var(--lk-line)] bg-white/80 p-1.5 pl-3 shadow-sm backdrop-blur-sm">
        <input
          value={meta.name}
          onChange={(e) => setMeta((m) => ({ ...m, name: e.target.value, dirty: true }))}
          className="w-44 bg-transparent text-[15px] font-medium text-[var(--lk-fg)] outline-none"
          aria-label="Canvas name"
        />
        {meta.dirty ? <span className="rounded-full bg-[#f5a524]/15 px-2 py-0.5 text-[12px] text-[#b27400]">Unsaved</span> : null}
        <ToolButton label="Save (Ctrl+S)" onPress={SaveNow} strong>
          <Save size={15} />
        </ToolButton>
        <Popover
          panelClassName="w-64 p-1"
          trigger={() => (
            <ToolButton label="Open or create a canvas">
              <FolderOpen size={15} />
            </ToolButton>
          )}
        >
          {(close) => (
            <div className="flex flex-col gap-px">
              <ContextMenuItem icon={<Plus size={14} />} onClick={() => (Open(null), close())}>
                New canvas
              </ContextMenuItem>
              <ContextMenuLabel>Saved</ContextMenuLabel>
              {saved.length === 0 ? <p className="px-2 py-1 text-[13px] text-[var(--lk-muted)]">Nothing saved yet</p> : null}
              {saved.map((c) => (
                <div key={c.id} className="group/saved flex items-center">
                  <div className="min-w-0 flex-1">
                    <ContextMenuItem selected={c.id === meta.id} onClick={() => (Open(c), close())}>
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate">{c.name}</span>
                        <span className="shrink-0 text-[11px] font-normal text-[var(--lk-subtle)]">{FormatRelativeDate(c.updatedAt)}</span>
                      </span>
                    </ContextMenuItem>
                  </div>
                  <button
                    type="button"
                    aria-label={`Delete ${c.name}`}
                    onClick={() => window.confirm(`Delete canvas "${c.name}"?`) && removeCanvas(c.id)}
                    className="hidden rounded p-1 text-[var(--lk-muted)] hover:text-[#e5484d] group-hover/saved:block"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Popover>
      </div>

        </>
      ) : null}

      {/* Vpravo: zoom a historie */}
      <div className="absolute right-4 top-4 flex select-none flex-col gap-2">
        <ToolColumn>
          <ToolButton label="Zoom in" onPress={() => ZoomAt(1.2)}>
            <Plus size={15} />
          </ToolButton>
          <ToolButton label="Reset zoom" onPress={() => ZoomAt(1 / view.k)}>
            <RotateCcw size={15} />
          </ToolButton>
          <ToolButton label="Zoom to fit" onPress={Fit}>
            <Maximize size={15} />
          </ToolButton>
          <ToolButton label="Zoom out" onPress={() => ZoomAt(1 / 1.2)}>
            <Minus size={15} />
          </ToolButton>
        </ToolColumn>
        <ToolColumn>
          <ToolButton
            label={showLinks ? "Hide document links" : "Show document links (like Graph)"}
            active={showLinks}
            onPress={() => (setShowLinks((v) => !v), setMeta((m) => ({ ...m, dirty: true })))}
          >
            <Waypoints size={15} />
          </ToolButton>
        </ToolColumn>
        <ToolColumn>
          <ToolButton label="Undo (Ctrl+Z)" onPress={Undo}>
            <Undo2 size={15} />
          </ToolButton>
          <ToolButton label="Redo (Ctrl+Shift+Z)" onPress={Redo}>
            <Redo2 size={15} />
          </ToolButton>
        </ToolColumn>
        <ToolColumn>
          <ToolButton label="Clear canvas" onPress={ClearAll}>
            <Trash2 size={15} />
          </ToolButton>
        </ToolColumn>
        <ToolColumn>
          <Popover
            align="right"
            panelClassName="w-64 p-3"
            trigger={() => (
              <ToolButton label="Help">
                <CircleHelp size={15} />
              </ToolButton>
            )}
          >
            {() => (
              <ul className="flex flex-col gap-1.5 text-[13px] text-[var(--lk-text2)]">
                <li>Double-click empty space for a card</li>
                <li>Drag the blue dots to connect cards</li>
                <li>Drag empty space or Space + drag to pan</li>
                <li>Scroll to pan, Ctrl + scroll to zoom</li>
                <li>Delete removes the selection</li>
                <li>Ctrl+S saves — nothing is saved until you do</li>
              </ul>
            )}
          </Popover>
        </ToolColumn>
      </div>

      {/* Dole: přidávání karet */}
      <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 select-none items-center gap-1 rounded-2xl border border-[var(--lk-line)] bg-white/80 p-1.5 shadow-sm backdrop-blur-sm">
        <ToolButton label="Select (V)" onPress={() => setTool("select")} active={tool === "select"}>
          <MousePointer2 size={18} strokeWidth={1.5} />
        </ToolButton>
        {(["pen", "pencil"] as const).map((t) => (
          <Popover
            key={t}
            side="top"
            panelClassName="w-64 p-3"
            trigger={() => (
              <ToolButton label={t === "pen" ? "Pen — solid ink (P)" : "Pencil — light, see-through (B)"} active={tool === t} onPress={() => setTool(t)}>
                {/* Pero = hrot plnicího pera, tužka = tužka; pod ikonou vzorek čáry, jak ten nástroj kreslí. */}
                <span className="-mt-1.5">{t === "pen" ? <PenTool size={17} strokeWidth={1.5} /> : <Pencil size={17} strokeWidth={1.5} />}</span>
                <svg viewBox="0 0 20 4" className="absolute bottom-1 left-1/2 h-1 w-5 -translate-x-1/2" aria-hidden>
                  <path
                    d="M 1 2 Q 5 0.5 10 2 T 19 2"
                    stroke={Themed(brushes[t].color)}
                    strokeOpacity={TOOL_OPACITY[t]}
                    strokeWidth={t === "pen" ? 2.4 : 1.1}
                    strokeLinecap="round"
                    fill="none"
                  />
                </svg>
              </ToolButton>
            )}
          >
            {() => (
              <BrushSettings
                tool={t}
                brush={brushes[t]}
                onChange={(patch) => setBrushes((b) => ({ ...b, [t]: { ...b[t], ...patch } }))}
              />
            )}
          </Popover>
        ))}
        <ToolButton label="Eraser — drag over drawings to remove them (E)" active={tool === "eraser"} onPress={() => setTool("eraser")}>
          <Eraser size={18} strokeWidth={1.5} />
        </ToolButton>
        <span className="mx-1 h-5 w-px bg-[var(--lk-line)]" />
        <ToolButton
          label="Add square"
          onPress={() => AddNode({ type: "text", shape: "rect", text: "", width: 200, height: 140, ...SHAPE_DEFAULTS })}
        >
          <Square size={18} strokeWidth={1.5} />
        </ToolButton>
        <ToolButton
          label="Add circle"
          onPress={() => AddNode({ type: "text", shape: "ellipse", text: "", width: 160, height: 160, ...SHAPE_DEFAULTS })}
        >
          <Circle size={18} strokeWidth={1.5} />
        </ToolButton>
        <ToolButton
          label="Add text"
          onPress={() => setEditing(AddNode({ type: "text", shape: "text", text: "", width: 240, height: 44, ...TEXT_DEFAULTS }).id)}
        >
          <Type size={18} strokeWidth={1.5} />
        </ToolButton>
        <span className="mx-1 h-5 w-px bg-[var(--lk-line)]" />
        <ToolButton label="Add card" onPress={() => setEditing(AddNode({ type: "text", text: "", width: 260, height: 140 }).id)}>
          <StickyNote size={18} strokeWidth={1.5} />
        </ToolButton>
        <Popover
          side="top"
          panelClassName="w-72 p-1"
          trigger={() => (
            <ToolButton label="Add document">
              <FileText size={18} strokeWidth={1.5} />
            </ToolButton>
          )}
        >
          {(close) => <DocumentPicker onPick={(id) => (AddNode({ type: "file", file: id, width: 320, height: 220 }), close())} />}
        </Popover>
        <ToolButton label="Add image" onPress={() => fileInputRef.current?.click()}>
          <ImageIcon size={18} strokeWidth={1.5} />
        </ToolButton>
        <ToolButton label="Add group" onPress={() => AddNode({ type: "group", label: "Group", width: 560, height: 380 })}>
          <SquareDashed size={18} strokeWidth={1.5} />
        </ToolButton>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) AddImage(file).catch((error: unknown) => console.warn("Image failed", error));
          }}
        />
      </div>
    </div>
  );
}

function ToolColumn({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-0.5 rounded-xl border border-[var(--lk-line)] bg-white/80 p-1 shadow-sm backdrop-blur-sm">{children}</div>;
}

/** Ikonové tlačítko lišty (HeroUI Button). `onPress` chybí u tlačítek, která jen
 * otevírají Popover — ten se ovládá sám (myš i klávesnice). */
function ToolButton({ label, onPress, strong, active, children }: { label: string; onPress?: () => void; strong?: boolean; active?: boolean; children: ReactNode }) {
  return (
    <span title={label} className="flex">
      <Button
        variant="ghost"
        isIconOnly
        aria-label={label}
        onPress={onPress}
        className={`relative size-9 min-w-0 rounded-lg p-0 ${
          active ? "bg-[#0088ff]/10 text-[#0088ff]" : strong ? "text-[#0088ff] hover:bg-[#0088ff]/10" : "text-[var(--lk-text2)] hover:bg-black/[0.04]"
        }`}
      >
        {children}
      </Button>
    </span>
  );
}

function SelectionBar({
  at,
  scale,
  color,
  onColor,
  onDelete,
  onLabel,
  shapeNode,
  onPatchNode,
}: {
  at: { x: number; y: number };
  scale: number;
  color?: CanvasColor;
  onColor: (c: CanvasColor | undefined) => void;
  onDelete: () => void;
  onLabel?: () => void;
  /** Vybraný tvar nebo volný text — dostane vlastní ovládání místo palety karet. */
  shapeNode?: CanvasNode;
  onPatchNode?: (patch: Partial<CanvasNode>) => void;
}) {
  if (shapeNode && onPatchNode) {
    return (
      <ShapeToolbar at={at} scale={scale} node={shapeNode} onPatch={onPatchNode} onDelete={onDelete} />
    );
  }
  return (
    // Lišta drží stejnou velikost bez ohledu na zoom.
    <div
      onPointerDown={(e) => e.stopPropagation()}
      className="pointer-events-auto absolute flex items-center gap-1 rounded-xl border border-[var(--lk-line)] bg-white p-1 shadow-sm"
      style={{ left: at.x, top: at.y, transform: `translate(-50%, -100%) scale(${1 / scale})`, transformOrigin: "bottom center" }}
    >
      <button type="button" title="No color" onClick={() => onColor(undefined)} className={`size-4 rounded-full border border-[var(--lk-gray)] bg-white ${!color ? "ring-2 ring-[#0088ff]/50" : ""}`} />
      {Object.keys(COLORS).map((c) => (
        <button key={c} type="button" title={`Color ${c}`} onClick={() => onColor(c)} className={`size-4 rounded-full ${color === c ? "ring-2 ring-[#0088ff]/50" : ""}`} style={{ background: COLORS[c] }} />
      ))}
      <Popover
        panelClassName="w-60 p-3"
        trigger={() => {
          const custom = color && !COLORS[color] ? color : undefined;
          return (
            <span
              title="Custom color"
              className={`flex size-4 items-center justify-center rounded-full border border-dashed border-[var(--lk-faint)] text-[var(--lk-muted)] ${custom ? "ring-2 ring-[#0088ff]/50" : ""}`}
              style={custom ? { background: custom, borderStyle: "solid" } : undefined}
            >
              {custom ? null : <Plus size={10} strokeWidth={2.5} />}
            </span>
          );
        }}
      >
        {() => <ColorPicker value={color && !COLORS[color] ? color : undefined} onChange={onColor} />}
      </Popover>
      {onLabel ? (
        <button type="button" onClick={onLabel} className="rounded-md px-1.5 text-[12px] text-[var(--lk-text2)] hover:bg-black/[0.04]">
          Label
        </button>
      ) : null}
      <button type="button" title="Delete" onClick={onDelete} className="rounded-md p-1 text-[var(--lk-muted)] hover:bg-[#e5484d]/[0.08] hover:text-[#e5484d]">
        <Trash2 size={13} />
      </button>
    </div>
  );
}

/** Lišta vybraného tvaru / textu. Záměrně stejný tvar i třídy jako
 * SelectionToolbar.tsx v editoru — ať je to jedna vizuální řeč. */
const TOOLBAR_BUTTON =
  "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--lk-text2)] hover:bg-black/[0.06]";
const TOOLBAR_SEPARATOR = <div className="mx-0.5 h-4 w-px bg-[var(--lk-line)]" />;

const TEXT_MARKS = [
  { key: "bold", icon: Bold, label: "Bold" },
  { key: "italic", icon: Italic, label: "Italic" },
  { key: "underline", icon: Underline, label: "Underline" },
  { key: "strike", icon: Strikethrough, label: "Strikethrough" },
] as const;

const TEXT_ALIGN = [
  { value: "left", icon: AlignLeft, label: "Align left" },
  { value: "center", icon: AlignCenter, label: "Align center" },
  { value: "right", icon: AlignRight, label: "Align right" },
  { value: "justify", icon: AlignJustify, label: "Justify" },
] as const;

function ShapeToolbar({
  at,
  scale,
  node,
  onPatch,
  onDelete,
}: {
  at: { x: number; y: number };
  scale: number;
  node: CanvasNode;
  onPatch: (patch: Partial<CanvasNode>) => void;
  onDelete: () => void;
}) {
  const isText = node.shape === "text";
  // Text ladí velikost písma, tvar tloušťku obrysu — jeden stepper pro obojí.
  const size = isText ? (node.fontSize ?? TEXT_DEFAULTS.fontSize) : (node.strokeWidth ?? SHAPE_DEFAULTS.strokeWidth);
  const limits = isText ? { min: 8, max: 96 } : { min: 0, max: 24 };
  const SetSize = (next: number) => {
    const clamped = Math.min(limits.max, Math.max(limits.min, next));
    onPatch(isText ? { fontSize: clamped } : { strokeWidth: clamped });
  };

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      className="pointer-events-auto absolute flex items-center gap-0.5 rounded-xl border border-[var(--lk-line)] bg-white p-1 shadow-lg"
      style={{ left: at.x, top: at.y, transform: `translate(-50%, -100%) scale(${1 / scale})`, transformOrigin: "bottom center" }}
    >
      {isText ? (
        <>
          {TEXT_MARKS.map(({ key, icon: Icon, label }) => (
            <Button
              key={key}
              variant="ghost"
              isIconOnly
              aria-label={label}
              onPress={() => onPatch({ [key]: !node[key] } as Partial<CanvasNode>)}
              className={`${TOOLBAR_BUTTON} ${node[key] ? "bg-black/[0.06] text-[var(--lk-ink)]" : ""}`}
            >
              <Icon size={15} strokeWidth={1.75} />
            </Button>
          ))}
          {TOOLBAR_SEPARATOR}
          <Popover
            panelClassName="w-64 p-3"
            trigger={(open) => (
              <Button variant="ghost" isIconOnly aria-label="Font" className={`${TOOLBAR_BUTTON} ${open ? "bg-black/[0.06] text-[var(--lk-ink)]" : ""}`}>
                <Type size={15} strokeWidth={1.75} />
              </Button>
            )}
          >
            {() => <FontPicker value={node.font} onChange={(font) => onPatch({ font })} />}
          </Popover>
        </>
      ) : (
        <>
          <Popover
            panelClassName="w-64 p-3"
            trigger={(open) => (
              <Button variant="ghost" isIconOnly aria-label="Fill" className={`${TOOLBAR_BUTTON} ${open ? "bg-black/[0.06]" : ""}`}>
                <span className="size-4 rounded-md border border-black/10" style={{ background: node.fill || "transparent" }} />
              </Button>
            )}
          >
            {() => (
              <div className="flex flex-col gap-2">
                <Button
                  variant="ghost"
                  onPress={() => onPatch({ fill: "" })}
                  className="h-auto self-start rounded-md px-1.5 py-0.5 text-[13px] font-normal text-[var(--lk-text2)] hover:bg-black/[0.04]"
                >
                  No fill
                </Button>
                <ColorPicker value={node.fill || undefined} onChange={(fill) => onPatch({ fill })} />
              </div>
            )}
          </Popover>
        </>
      )}

      {TOOLBAR_SEPARATOR}

      <Button variant="ghost" isIconOnly aria-label={isText ? "Decrease size" : "Thinner outline"} onPress={() => SetSize(size - 1)} className={TOOLBAR_BUTTON}>
        <Minus size={14} strokeWidth={1.75} />
      </Button>
      <span className="w-7 shrink-0 text-center text-[13px] font-medium text-[var(--lk-ink)] tabular-nums">{size}</span>
      <Button variant="ghost" isIconOnly aria-label={isText ? "Increase size" : "Thicker outline"} onPress={() => SetSize(size + 1)} className={TOOLBAR_BUTTON}>
        <Plus size={14} strokeWidth={1.75} />
      </Button>

      {TOOLBAR_SEPARATOR}

      <Popover
        panelClassName="w-64 p-3"
        trigger={(open) => (
          <Button variant="ghost" isIconOnly aria-label={isText ? "Text color" : "Outline color"} className={`${TOOLBAR_BUTTON} ${open ? "bg-black/[0.06]" : ""}`}>
            <span className="size-4 rounded-full border border-black/10" style={{ background: node.stroke ?? SHAPE_DEFAULTS.stroke }} />
          </Button>
        )}
      >
        {() => <ColorPicker value={node.stroke ?? SHAPE_DEFAULTS.stroke} onChange={(stroke) => onPatch({ stroke })} />}
      </Popover>

      {isText ? (
        <>
          {TOOLBAR_SEPARATOR}
          {TEXT_ALIGN.map(({ value, icon: Icon, label }) => (
            <Button
              key={value}
              variant="ghost"
              isIconOnly
              aria-label={label}
              onPress={() => onPatch({ align: value })}
              className={`${TOOLBAR_BUTTON} ${(node.align ?? "left") === value ? "bg-black/[0.06] text-[var(--lk-ink)]" : ""}`}
            >
              <Icon size={15} strokeWidth={1.75} />
            </Button>
          ))}
        </>
      ) : null}

      {TOOLBAR_SEPARATOR}

      <Button
        variant="ghost"
        isIconOnly
        aria-label="Delete"
        onPress={onDelete}
        className={`${TOOLBAR_BUTTON} hover:bg-[#e5484d]/[0.08] hover:text-[#e5484d]`}
      >
        <Trash2 size={14} strokeWidth={1.75} />
      </Button>
    </div>
  );
}

function DocumentPicker({ onPick }: { onPick: (id: string) => void }) {
  const documents = UseDataStore((s) => s.documents);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const list = Object.values(documents)
    .filter((d) => !q || d.name.toLowerCase().includes(q))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 12);
  return (
    <div className="flex flex-col gap-px">
      <Input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Find a document…"
        className="mb-1 w-full rounded-lg border border-[var(--lk-gray)] bg-white px-2 py-1 text-[13px] outline-none focus:border-[#0485f7]"
      />
      {list.map((d) => (
        <ContextMenuItem key={d.id} icon={<FileText size={14} strokeWidth={1.75} className="text-[var(--lk-text2)]" />} onClick={() => onPick(d.id)}>
          {d.name || "Untitled"}
        </ContextMenuItem>
      ))}
      {list.length === 0 ? <p className="px-2 py-1 text-[13px] text-[var(--lk-muted)]">No documents found</p> : null}
    </div>
  );
}

/** Nastavení pera / tužky v popoveru: tloušťka a barva (+ náhled čáry). */
function BrushSettings({ tool, brush, onChange }: { tool: "pen" | "pencil"; brush: Brush; onChange: (patch: Partial<Brush>) => void }) {
  return (
    <div className="flex select-none flex-col gap-3">
      <p className="text-[13px] font-medium text-[var(--lk-ink)]">{tool === "pen" ? "Pen" : "Pencil"}</p>
      <svg viewBox="0 0 200 24" className="h-6 w-full">
        <path d="M 6 16 Q 50 2 100 12 T 194 8" stroke={Themed(brush.color)} strokeOpacity={TOOL_OPACITY[tool]} strokeWidth={brush.size} fill="none" strokeLinecap="round" />
      </svg>
      <label className="flex flex-col gap-1 text-[13px] text-[var(--lk-ink)]">
        <span className="flex items-center justify-between">
          Thickness
          <span className="tabular-nums text-[var(--lk-muted)]">{brush.size}px</span>
        </span>
        <input
          type="range"
          min={1}
          max={tool === "pen" ? 24 : 12}
          value={brush.size}
          onChange={(e) => onChange({ size: Number(e.target.value) })}
          className="h-1 w-full cursor-pointer accent-[var(--lk-ink)]"
        />
      </label>
      <ColorPicker value={brush.color} onChange={(color) => onChange({ color })} />
    </div>
  );
}
