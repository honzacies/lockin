"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { UsePresence } from "@lockin/shared/Lib/UseMotion";

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
  const panelRef = useRef<HTMLDivElement>(null);
  const { mounted, closing } = UsePresence(open);

  // Panel je `fixed` a vždy celý v okně: vyjede na stranu, kde je víc místa,
  // vodorovně se přisune dovnitř a když se nevejde na výšku, scrolluje uvnitř.
  useLayoutEffect(() => {
    if (!open) return;
    const MARGIN = 8;
    const GAP = 6;
    function Place() {
      const root = rootRef.current;
      const panel = panelRef.current;
      if (!root || !panel) return;
      const anchor = root.getBoundingClientRect();
      panel.style.maxHeight = "";
      const width = panel.offsetWidth;
      const height = panel.offsetHeight;
      const below = window.innerHeight - anchor.bottom - GAP - MARGIN;
      const above = anchor.top - GAP - MARGIN;
      const preferBelow = side === "bottom";
      const goBelow = preferBelow ? height <= below || below >= above : !(height <= above || above >= below);
      const room = Math.max(120, goBelow ? below : above);
      const shown = Math.min(height, room);
      const top = goBelow ? anchor.bottom + GAP : anchor.top - GAP - shown;
      const wanted = align === "right" ? anchor.right - width : anchor.left;
      const left = Math.min(Math.max(MARGIN, wanted), window.innerWidth - width - MARGIN);
      panel.style.maxHeight = `${room}px`;
      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
      // Předek s transform/filter (např. rozmazané pozadí dialogu) posouvá počátek
      // pro `fixed` — změřit, kde panel opravdu je, a rozdíl dorovnat.
      const actual = panel.getBoundingClientRect();
      if (Math.abs(actual.left - left) > 0.5) panel.style.left = `${2 * left - actual.left}px`;
      if (Math.abs(actual.top - top) > 0.5) panel.style.top = `${2 * top - actual.top}px`;
    }
    Place();
    const observer = new ResizeObserver(Place);
    if (panelRef.current) observer.observe(panelRef.current);
    window.addEventListener("resize", Place);
    window.addEventListener("scroll", Place, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", Place);
      window.removeEventListener("scroll", Place, true);
    };
  }, [open, side, align]);

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
    // Capture: HeroUI Button zastaví propagaci pointerdownu, klik na jiný trigger by panel nezavřel.
    window.addEventListener("pointerdown", OnPointerDown, true);
    window.addEventListener("keydown", OnKey);
    return () => {
      window.removeEventListener("pointerdown", OnPointerDown, true);
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
      {mounted ? (
        <div
          ref={panelRef}
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
          className={`fixed z-[250] select-none overflow-y-auto overscroll-contain rounded-xl border border-[var(--lk-line)] bg-white shadow-xl ${closing ? "lockin-fade-out" : "lockin-fade-in"} ${panelClassName ?? ""}`}
        >
          {children(() => setOpen(false))}
        </div>
      ) : null}
    </div>
  );
}
