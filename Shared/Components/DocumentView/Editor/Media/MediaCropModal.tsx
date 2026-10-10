"use client";

import { useRef, useState } from "react";
import { Button } from "@heroui/react";
import { Check, X } from "@lockin/shared/Components/Shared/UiIcons";

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function Clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

interface MediaCropModalProps {
  imageUrl: string;
  onApply: (blob: Blob) => void;
  onClose: () => void;
}

/** A drag-to-select crop overlay over the full image, then a canvas draws
 * just that region and hands the result back as a PNG blob — the caller
 * (MediaNodeView) is responsible for saving it as a new media file and
 * swapping the node's `path` over, same as a fresh upload.
 *
 * Hand-rolled backdrop, not HeroUI's Modal — the interaction here (drag a
 * rectangle over the image, using its own pointer handlers and a raw
 * `<img>` ref for canvas coordinate math) is custom enough that adopting
 * Modal's trigger/state composition wouldn't remove any real duplication,
 * matching the other bespoke-interaction exceptions in DESIGN.md. */
export function MediaCropModal({ imageUrl, onApply, onClose }: MediaCropModalProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  function PointFromEvent(e: React.PointerEvent): { x: number; y: number } {
    const el = imgRef.current;
    if (!el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    return {
      x: Clamp(e.clientX - r.left, 0, r.width),
      y: Clamp(e.clientY - r.top, 0, r.height),
    };
  }

  function HandlePointerDown(e: React.PointerEvent) {
    const p = PointFromEvent(e);
    dragStart.current = p;
    setRect({ x: p.x, y: p.y, w: 0, h: 0 });
  }

  function HandlePointerMove(e: React.PointerEvent) {
    if (!dragStart.current) return;
    const p = PointFromEvent(e);
    setRect({
      x: Math.min(dragStart.current.x, p.x),
      y: Math.min(dragStart.current.y, p.y),
      w: Math.abs(p.x - dragStart.current.x),
      h: Math.abs(p.y - dragStart.current.y),
    });
  }

  function HandlePointerUp() {
    dragStart.current = null;
  }

  function HandleApply() {
    const img = imgRef.current;
    if (!img || !rect || rect.w < 4 || rect.h < 4) return;
    const displayed = img.getBoundingClientRect();
    const scaleX = img.naturalWidth / displayed.width;
    const scaleY = img.naturalHeight / displayed.height;

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(rect.w * scaleX);
    canvas.height = Math.round(rect.h * scaleY);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(
      img,
      rect.x * scaleX,
      rect.y * scaleY,
      rect.w * scaleX,
      rect.h * scaleY,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    canvas.toBlob((blob) => {
      if (blob) onApply(blob);
    }, "image/png");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#000]/60 p-6"
      onMouseDown={onClose}
    >
      <div
        className="flex max-w-[720px] flex-col gap-3 rounded-2xl bg-white p-4 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-medium text-[var(--lk-ink)]">Crop image</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-[var(--lk-muted)] hover:bg-black/[0.04]"
          >
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>
        <div
          className="relative w-full cursor-crosshair select-none overflow-hidden rounded-lg"
          onPointerDown={HandlePointerDown}
          onPointerMove={HandlePointerMove}
          onPointerUp={HandlePointerUp}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- a locally-stored file loaded via Tauri's asset protocol */}
          <img
            ref={imgRef}
            src={imageUrl}
            alt=""
            draggable={false}
            className="block max-h-[60vh] w-full pointer-events-none object-contain"
          />
          {rect ? (
            <div
              className="pointer-events-none absolute border-2 border-white"
              style={{
                left: rect.x,
                top: rect.y,
                width: rect.w,
                height: rect.h,
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)",
              }}
            />
          ) : null}
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-[12px] text-[var(--lk-muted)]">Drag over the image to select a crop area.</p>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="ghost"
              onPress={onClose}
              className="h-auto rounded-lg px-3 py-1.5 text-[13px] font-medium text-[var(--lk-text2)] hover:bg-black/[0.04]"
            >
              Cancel
            </Button>
            <Button
              variant="ghost"
              onPress={HandleApply}
              isDisabled={!rect || rect.w < 4 || rect.h < 4}
              className="h-auto gap-1.5 rounded-lg bg-[var(--lk-ink)] px-3 py-1.5 text-[13px] font-medium text-white hover:bg-black disabled:opacity-40"
            >
              <Check size={14} strokeWidth={2} />
              Apply crop
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
