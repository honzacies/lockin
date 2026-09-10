"use client";

import { useRef, useState, type ReactNode } from "react";

const MIN_WIDTH = 380;
const MAX_WIDTH = 960;
const DEFAULT_WIDTH = 600;

interface ResizableSidePanelProps {
  children: ReactNode;
}

/** A right-hand side panel (Library's document/project preview) with a
 * drag handle on its left edge. Width lives in local state, not a store —
 * it's a transient view preference for whatever's currently open, not
 * something that needs to survive a reload. */
export function ResizableSidePanel({ children }: ResizableSidePanelProps) {
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const draggingRef = useRef(false);

  function HandlePointerDown(event: React.PointerEvent) {
    event.preventDefault();
    draggingRef.current = true;
    const startX = event.clientX;
    const startWidth = width;

    function OnMove(moveEvent: PointerEvent) {
      if (!draggingRef.current) return;
      // The panel sits on the right edge of the window — dragging the
      // handle *left* (negative clientX delta) should widen it.
      const delta = startX - moveEvent.clientX;
      setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + delta)));
    }
    function OnUp() {
      draggingRef.current = false;
      window.removeEventListener("pointermove", OnMove);
      window.removeEventListener("pointerup", OnUp);
    }
    window.addEventListener("pointermove", OnMove);
    window.addEventListener("pointerup", OnUp);
  }

  return (
    <div className="relative flex shrink-0" style={{ width }}>
      {/* A hair wider than it looks (px-1.5 straddling the border) so it's
       * actually easy to grab, not just the literal 1px border line. */}
      <div
        onPointerDown={HandlePointerDown}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize panel"
        className="group/resize absolute -left-1.5 top-0 z-10 flex h-full w-3 cursor-col-resize items-center justify-center"
      >
        <div className="h-full w-px bg-[#f0efed] transition-colors group-hover/resize:bg-[#0088ff]/40" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">{children}</div>
    </div>
  );
}
