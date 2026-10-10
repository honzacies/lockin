"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

const ReducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Když se změní `deps` (filtr, řazení, stránka), obsah v `ref` jemně vybledne dovnitř.
 * Při prvním vykreslení nic — to řeší přechod stránky. */
export function UseFadeOnChange(ref: RefObject<HTMLElement | null>, deps: unknown[]) {
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (ReducedMotion()) return;
    ref.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: "ease-out" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/**
 * Panel, který se má i zavřít s animací: po `open = false` zůstane ještě `ms`
 * vykreslený s příznakem `closing` (třída `lockin-fade-out`) a teprve pak zmizí.
 */
export function UsePresence(open: boolean, ms = 140): { mounted: boolean; closing: boolean } {
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) return setMounted(true);
    if (ReducedMotion()) return setMounted(false);
    const timer = setTimeout(() => setMounted(false), ms);
    return () => clearTimeout(timer);
  }, [open, ms]);
  return { mounted: open || mounted, closing: !open && mounted };
}
