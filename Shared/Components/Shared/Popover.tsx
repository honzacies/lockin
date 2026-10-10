"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

interface PopoverProps {
  /** Renders the clickable trigger; `open` lets it reflect active state. */
  trigger: (open: boolean) => ReactNode;
  /** Renders the panel content; call `close()` after a selection. */
  children: (close: () => void) => ReactNode;
  align?: "left" | "right";
  /** Na kterou stranu triggeru panel vyjede. "top" je pro triggery u spodní
   * hrany okna — panel by jinak vyjel pod ni a byl nedosažitelný. */
  side?: "bottom" | "top";
  panelClassName?: string;
}

/**
 * Minimal trigger + panel popover. Owns its own open state and closes on
 * outside click or Escape. The trigger is wrapped in a plain div (not a
 * button) so it can itself contain an interactive element like a Chip button.
 */
export function Popover({
  trigger,
  children,
  align = "left",
  side = "bottom",
  panelClassName,
}: PopoverProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function OnPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function OnKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("pointerdown", OnPointerDown);
    window.addEventListener("keydown", OnKey);
    return () => {
      window.removeEventListener("pointerdown", OnPointerDown);
      window.removeEventListener("keydown", OnKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative inline-block">
      {/* Capture-phase pointerdown, not click or bubble-phase pointerdown —
       * HeroUI's Button (react-aria-components) manages presses through its
       * own pointer-event handling and stops the left-click pointerdown
       * from propagating any further once it takes over (so it doesn't also
       * register as a press on some ancestor), which meant a bubble-phase
       * listener here only ever saw right-clicks get through. Capture fires
       * on the way *down* to the target, before Button has a chance to stop
       * anything, so this always sees it — filtered to the left button so
       * a right-click (context menu) doesn't also toggle the popover. */}
      <div
        onPointerDownCapture={(e) => {
          if (e.button !== 0) return;
          setOpen((o) => !o);
        }}
        // Klávesnice: Enter / mezerník na fokusovaném triggeru (tlačítku) otevře i zavře panel.
        onKeyDownCapture={(e) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
          e.preventDefault();
          setOpen((o) => !o);
        }}
        className="contents cursor-pointer"
      >
        {trigger(open)}
      </div>
      {open ? (
        <div
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          // Panels frequently sit inside a `[data-marquee-zone]` (e.g. the
          // project header's deadline/priority/status/tag popovers) — without
          // this, a pointerdown on anything inside that isn't a plain
          // `<button>`/`<input>` (e.g. HeroUI's Calendar date cells) bubbles
          // up to the marquee zone's own listener and gets hijacked into
          // starting a block-drag on the editor, capturing the pointer away
          // before the panel's own control ever sees its pointerup — so e.g.
          // clicking a date visually did nothing. Same fix already applied
          // to ContextMenu.tsx's panel for the same reason.
          data-marquee-ignore="true"
          className={`absolute z-30 select-none rounded-xl border border-[var(--lk-line)] bg-white shadow-xl ${
            side === "top" ? "bottom-[calc(100%+6px)]" : "top-[calc(100%+6px)]"
          } ${align === "right" ? "right-0" : "left-0"} ${panelClassName ?? ""}`}
        >
          {children(() => setOpen(false))}
        </div>
      ) : null}
    </div>
  );
}
