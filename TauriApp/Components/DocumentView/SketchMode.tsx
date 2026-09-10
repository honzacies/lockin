"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@heroui/react";
import { Eraser } from "lucide-react";
import type { SketchStroke, SketchPoint } from "@/Types/Project";

interface SketchModeProps {
  initialStrokes: SketchStroke[];
  onChange: (strokes: SketchStroke[]) => void;
}

const STROKE_COLOR = "#2c2c2b";
const STROKE_SIZE = 2.5;

function DrawStrokes(ctx: CanvasRenderingContext2D, allStrokes: SketchStroke[]) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  for (const stroke of allStrokes) {
    if (stroke.points.length < 2) continue;
    ctx.beginPath();
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (const point of stroke.points.slice(1)) {
      ctx.lineTo(point.x, point.y);
    }
    ctx.stroke();
  }
}

export default function SketchMode({ initialStrokes, onChange }: SketchModeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const strokesRef = useRef<SketchStroke[]>(initialStrokes);
  const drawingRef = useRef(false);
  const currentStrokeRef = useRef<SketchPoint[]>([]);
  const [, forceRerenderTick] = useState(0);

  useEffect(() => {
    function ResizeCanvas() {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) DrawStrokes(ctx, strokesRef.current);
    }
    ResizeCanvas();
    window.addEventListener("resize", ResizeCanvas);
    return () => window.removeEventListener("resize", ResizeCanvas);
  }, []);

  function GetRelativePoint(e: React.PointerEvent<HTMLCanvasElement>): SketchPoint {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function HandlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    drawingRef.current = true;
    currentStrokeRef.current = [GetRelativePoint(e)];
    canvasRef.current?.setPointerCapture(e.pointerId);
  }

  function HandlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    currentStrokeRef.current.push(GetRelativePoint(e));
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    DrawStrokes(ctx, [
      ...strokesRef.current,
      { points: currentStrokeRef.current, color: STROKE_COLOR, size: STROKE_SIZE },
    ]);
  }

  function HandlePointerUp() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    if (currentStrokeRef.current.length > 1) {
      strokesRef.current = [
        ...strokesRef.current,
        { points: currentStrokeRef.current, color: STROKE_COLOR, size: STROKE_SIZE },
      ];
      onChange(strokesRef.current);
      forceRerenderTick((t) => t + 1);
    }
    currentStrokeRef.current = [];
  }

  function HandleClear() {
    strokesRef.current = [];
    onChange([]);
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) DrawStrokes(ctx, []);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex justify-end px-[50px] py-2">
        <Button
          variant="ghost"
          onPress={HandleClear}
          className="h-auto gap-1.5 rounded-lg border border-[#f0efed] px-2.5 py-1.5 text-sm font-normal text-[#5f5e59] hover:bg-black/[0.03]"
        >
          <Eraser size={16} strokeWidth={1.5} />
          Clear
        </Button>
      </div>
      <div ref={containerRef} className="min-h-[500px] flex-1 px-[50px] pb-8">
        <canvas
          ref={canvasRef}
          onPointerDown={HandlePointerDown}
          onPointerMove={HandlePointerMove}
          onPointerUp={HandlePointerUp}
          onPointerLeave={HandlePointerUp}
          className="h-full w-full touch-none rounded-xl border border-[#f0efed] bg-white"
        />
      </div>
    </div>
  );
}
