"use client";

import dynamic from "next/dynamic";
import type { SketchContent } from "@lockin/shared/Types/Project";
import type { CanvasScene } from "@lockin/shared/Store/UseCanvasStore";

// Canvas sahá na window (rozměry, klávesy) — bez SSR, stejně jako dřív SketchMode.
const CanvasView = dynamic(() => import("@lockin/shared/Components/Canvas/CanvasView").then((m) => m.CanvasView), { ssr: false });

/** Starší kresby ze sketch mode (jen tahy) se převezmou jako tahy pera — nic se neztratí. */
function InitialScene(sketch: SketchContent): CanvasScene {
  if (sketch.canvas) return sketch.canvas;
  return {
    nodes: [],
    edges: [],
    strokes: sketch.strokes.map((st, i) => ({
      id: `legacy-${i}`,
      tool: "pen" as const,
      color: st.color,
      size: st.size,
      points: st.points.map((p) => [p.x, p.y] as [number, number]),
    })),
  };
}

/** Sketch mode dokumentu = celý canvas (karty, spojnice, pero, tužka). Ukládá se
 * s dokumentem jako vždy; původní `strokes` zůstávají beze změny jako záloha. */
export function DocumentCanvas({ sketch, onChange }: { sketch: SketchContent; onChange: (sketch: SketchContent) => void }) {
  return (
    <div className="relative h-[calc(100vh-240px)] min-h-[440px] overflow-hidden rounded-xl border border-[#f0efed]">
      <CanvasView embedded={{ initial: InitialScene(sketch), onChange: (canvas) => onChange({ ...sketch, canvas }) }} />
    </div>
  );
}
