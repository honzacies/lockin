import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { CreatePersistStorage } from "@lockin/shared/Platform/PersistStorage";

/**
 * Canvas ve formátu JSON Canvas (jsoncanvas.org — ten používá i Obsidian),
 * takže jde později zapsat jako `.canvas` soubor beze změny struktury.
 * `file` u dokumentové karty je ID dokumentu v LockInu; obrázek je data URL
 * v `file` (do Media/ ne — úklid médií by ho smazal, žádný dokument na něj neodkazuje).
 */
/** JSON Canvas: přednastavená barva "1"–"6", nebo libovolný hex ("#ff8800"). */
export type CanvasColor = string;

export interface CanvasNode {
  id: string;
  type: "text" | "file" | "group";
  x: number;
  y: number;
  width: number;
  height: number;
  color?: CanvasColor;
  text?: string;
  file?: string;
  label?: string;
  /** Rozšíření LockInu: tvar nebo volný text nakreslený rovnou na plochu.
   * Nese ho uzel `type: "text"`, takže dědí posun, resize i spojnice — JSON
   * Canvas tahle pole nezná a Obsidian uvidí prázdnou kartu. */
  shape?: "rect" | "ellipse" | "text";
  /** Jen tvary. Prázdné = bez výplně. */
  fill?: string;
  /** Obrys tvaru, u `shape: "text"` barva písma. */
  stroke?: string;
  strokeWidth?: number;
  /** Jen `shape: "text"` — CSS font-family z Fonts.ts a velikost v px. */
  font?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  align?: "left" | "center" | "right" | "justify";
}

export type CanvasSide = "top" | "right" | "bottom" | "left";

export interface CanvasEdge {
  id: string;
  fromNode: string;
  fromSide: CanvasSide;
  toNode: string;
  toSide: CanvasSide;
  label?: string;
  color?: CanvasColor;
  /** Rozšíření LockInu: ruční zahnutí (vzdálenost kontrolních bodů v px).
   * Prázdné = spočítá se z délky spojnice. Obsidian pole ignoruje. */
  bend?: number;
}

/** Kresba perem/tužkou (rozšíření LockInu — JSON Canvas kresbu nezná, Obsidian ji ignoruje). */
export interface CanvasStroke {
  id: string;
  tool: "pen" | "pencil";
  color: string;
  size: number;
  /** Body ve světových souřadnicích, [x, y]. */
  points: [number, number][];
}

/** Obsah plochy bez jména a ID — tvar, který si nese i dokument ve sketch mode. */
export interface CanvasScene {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  strokes: CanvasStroke[];
  showLinks?: boolean;
}

export interface CanvasFile {
  id: string;
  name: string;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  strokes?: CanvasStroke[];
  /** Čáry mezi dokumentovými kartami podle [[odkazů]]; výchozí vypnuto. */
  showLinks?: boolean;
  updatedAt: string;
}

interface CanvasState {
  canvases: CanvasFile[];
  Save: (canvas: CanvasFile) => void;
  Remove: (id: string) => void;
}

/** Uložené canvasy (za workspace). Rozpracovaný canvas žije jen v komponentě,
 * dokud uživatel nedá Save. */
export const UseCanvasStore = create<CanvasState>()(
  persist(
    (set) => ({
      canvases: [],
      Save: (canvas) =>
        set((s) => ({ canvases: [canvas, ...s.canvases.filter((c) => c.id !== canvas.id)] })),
      Remove: (id) => set((s) => ({ canvases: s.canvases.filter((c) => c.id !== id) })),
    }),
    {
      name: "lockin-canvases",
      storage: createJSONStorage(() => CreatePersistStorage("canvases.json")),
      skipHydration: true,
      partialize: ({ canvases }) => ({ canvases }),
    },
  ),
);
