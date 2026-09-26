"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Check, ChevronLeft } from "lucide-react";

interface ContextMenuProps {
  /** The row/element that should react to a right-click. */
  children: ReactNode;
  /** Renders the menu content; call `close()` after an action. */
  menu: (close: () => void) => ReactNode;
  className?: string;
}

/**
 * Wraps `children` with a right-click handler that opens a compact floating
 * menu at the cursor position. Modeled on `Popover.tsx` (outside-click +
 * Escape to close) but positioned at the click point instead of anchored to
 * a trigger element, and clamped to stay within the viewport.
 */
export function ContextMenu({ children, menu, className }: ContextMenuProps) {
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  function HandleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    // Vnořená menu (řádek uvnitř plochy s vlastním menu) — otevře se jen to nejvnitřnější.
    e.stopPropagation();
    setPoint({ x: e.clientX, y: e.clientY });
  }

  useLayoutEffect(() => {
    if (!point || !panelRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width - 8;
    const maxY = window.innerHeight - rect.height - 8;
    const clampedX = Math.min(point.x, Math.max(8, maxX));
    const clampedY = Math.min(point.y, Math.max(8, maxY));
    if (clampedX !== point.x || clampedY !== point.y) {
      panelRef.current.style.left = `${clampedX}px`;
      panelRef.current.style.top = `${clampedY}px`;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [point]);

  useEffect(() => {
    if (!point) return;
    function OnPointerDown(e: PointerEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setPoint(null);
      }
    }
    function OnKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPoint(null);
    }
    window.addEventListener("pointerdown", OnPointerDown);
    window.addEventListener("keydown", OnKey);
    return () => {
      window.removeEventListener("pointerdown", OnPointerDown);
      window.removeEventListener("keydown", OnKey);
    };
  }, [point]);

  return (
    <div onContextMenu={HandleContextMenu} className={className}>
      {children}
      {point ? (
        <div
          ref={panelRef}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          // The panel can sit inside a `[data-marquee-zone]` (e.g. a
          // project's document pills) — `data-marquee-ignore` tells the
          // marquee/block-drag machinery (BlockSelectionExtension.ts) to
          // never treat anything in here as a drag start, no matter what
          // it's clicked on (the IconPicker trigger, a row's own wrapper
          // div, ...). The `stopPropagation` above is a second layer for
          // the same reason, in case the panel is ever nested somewhere
          // that check doesn't look.
          data-marquee-ignore="true"
          style={{ position: "fixed", left: point.x, top: point.y }}
          className="z-50 flex w-52 select-none flex-col gap-px rounded-xl border border-[#f0efed] bg-white p-1 shadow-lg"
        >
          {menu(() => setPoint(null))}
        </div>
      ) : null}
    </div>
  );
}

/** A tiny uppercase section header, grouping related rows — see
 * `Components/DocumentView/Editor/SlashCommand/SlashCommandMenu.tsx`, the reference for
 * this compact menu style (documented in DESIGN.md). Pass `first` for the
 * very first group in a menu, which needs less top padding since there's no
 * preceding row to separate from. */
export function ContextMenuLabel({ children, first }: { children: ReactNode; first?: boolean }) {
  return (
    <div
      className={`px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[#a5a49f] ${
        first ? "pt-1" : "pt-2.5"
      }`}
    >
      {children}
    </div>
  );
}

/** A single row inside a ContextMenu panel — small icon + label, tight
 * padding. The hover/selected background lives on the wrapping div (not the
 * button itself), matching the slash-command menu, so a row can later grow a
 * secondary trailing action without losing the shared highlight.
 *
 * Pass `selected` for a checkable row (an active tag/folder/toggle) — it
 * renders a trailing checkmark instead of needing a separate hand-rolled row
 * pattern just to add one. */
export function ContextMenuItem({
  icon,
  children,
  onClick,
  disabled,
  danger,
  selected,
}: {
  icon?: ReactNode;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  selected?: boolean;
}) {
  return (
    <div
      className={`flex items-center rounded-md ${
        disabled ? "" : danger ? "hover:bg-[#e5484d]/[0.08]" : "hover:bg-black/[0.04]"
      }`}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className={`flex flex-1 items-center gap-2.5 px-2 py-1 text-left text-[13px] font-medium disabled:cursor-not-allowed disabled:opacity-40 ${
          danger ? "text-[#e5484d]" : "text-[#2c2c2b]"
        }`}
      >
        {icon}
        <span className="flex-1 truncate">{children}</span>
        {selected ? <Check size={14} strokeWidth={2} className="shrink-0 text-[#0088ff]" /> : null}
      </button>
    </div>
  );
}

/** A "‹ Back" row for a menu's multi-step sub-screens (e.g. a tag/folder
 * picker step) — shared so every step-based compact menu goes back the same
 * way instead of each hand-rolling its own back button. */
export function ContextMenuBackRow({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-[#91918e] hover:text-[#2c2c2b]"
    >
      <ChevronLeft size={12} strokeWidth={1.75} />
      BACK
    </button>
  );
}
