"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const SELECTOR = "button[aria-label], a[aria-label], [role='button'][aria-label], [data-tooltip]";
const DELAY_MS = 450;

interface Tip {
  text: string;
  x: number;
  y: number;
  above: boolean;
  /** U okraje okna se tooltip zarovná k tlačítku z jedné strany, aby nevyjel ven. */
  align: "center" | "left" | "right";
}

/** Popisek pro prvek pod kurzorem: `data-tooltip`, jinak `aria-label` u
 * tlačítek bez viditelného textu (ikonová tlačítka). Prvky s nativním `title`
 * si popisek ukazují samy. */
function LabelOf(el: Element): string | null {
  if (el.hasAttribute("title")) return null;
  const explicit = el.getAttribute("data-tooltip");
  if (explicit) return explicit;
  const label = el.getAttribute("aria-label");
  if (!label) return null;
  return (el.textContent ?? "").trim() ? null : label;
}

/**
 * Jeden tooltip pro celou appku: po chvilce nad ikonovým tlačítkem ukáže, co
 * dělá. Delegovaný posluchač na dokumentu — nové tlačítko stačí opatřit
 * `aria-label` (což ikonová tlačítka kvůli přístupnosti mají mít stejně).
 */
export function GlobalTooltip() {
  const [tip, setTip] = useState<Tip | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let current: Element | null = null;
    const Hide = () => {
      clearTimeout(timer);
      current = null;
      setTip(null);
    };
    function OnOver(e: PointerEvent) {
      const el = (e.target as Element).closest?.(SELECTOR) ?? null;
      if (el === current) return;
      Hide();
      if (!el || (el as HTMLButtonElement).disabled) return;
      const text = LabelOf(el);
      if (!text) return;
      current = el;
      timer = setTimeout(() => {
        if (!current?.isConnected) return;
        const r = current.getBoundingClientRect();
        const above = r.bottom + 40 > window.innerHeight;
        const center = r.left + r.width / 2;
        const align = center < 140 ? "left" : center > window.innerWidth - 140 ? "right" : "center";
        const x = align === "left" ? r.left : align === "right" ? r.right : center;
        setTip({ text, x, y: above ? r.top - 6 : r.bottom + 6, above, align });
      }, DELAY_MS);
    }
    document.addEventListener("pointerover", OnOver);
    document.addEventListener("pointerdown", Hide, true);
    document.addEventListener("wheel", Hide, { capture: true, passive: true });
    document.addEventListener("keydown", Hide, true);
    return () => {
      Hide();
      document.removeEventListener("pointerover", OnOver);
      document.removeEventListener("pointerdown", Hide, true);
      document.removeEventListener("wheel", Hide, true);
      document.removeEventListener("keydown", Hide, true);
    };
  }, []);

  if (!tip) return null;
  return createPortal(
    <div
      role="tooltip"
      className="lockin-fade-in pointer-events-none fixed z-[300] w-max max-w-[260px] rounded-md bg-[#1f1f1e] px-2 py-1 text-[12px] leading-4 font-medium text-[#f4f4f2] shadow-lg ring-1 ring-[#fff]/10"
      style={{
        left: tip.x,
        top: tip.y,
        transform: `translate(${tip.align === "center" ? "-50%" : tip.align === "right" ? "-100%" : "0"}, ${tip.above ? "-100%" : "0"})`,
      }}
    >
      {tip.text}
    </div>,
    document.body,
  );
}
