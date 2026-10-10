"use client";

import { Button } from "@heroui/react";
import { FONT_CATEGORY_DEFAULT, FONT_OPTIONS, type FontCategory } from "@lockin/shared/Fonts";

interface FontCategoryTilesProps {
  value?: string;
  onChange: (cssValue: string) => void;
  /** "full" shows the category label plus a sample rendered in that font
   * (FontPicker's own picker step); "compact" is a label-only tile for a
   * tighter space (the settings menu's root-level quick pick). */
  variant?: "full" | "compact";
}

const CATEGORY_TILES: { category: FontCategory; label: string; font: string }[] = [
  { category: "sans", label: "Default", font: "Inter" },
  { category: "serif", label: "Serif", font: "Lora", },
  { category: "mono", label: "Mono", font: "JetBrains Mono" },
];

/** The "Default / Serif / Mono" quick-pick row shared by FontPicker.tsx's
 * full picker and the document settings menu's root-level shortcut — same
 * data and active-state logic, just two tile sizes. */
export function FontCategoryTiles({ value, onChange, variant = "full" }: FontCategoryTilesProps) {
  return (
    <div className={`grid grid-cols-3 ${variant === "full" ? "gap-2" : "gap-1"}`}>
      {CATEGORY_TILES.map(({ category, label }) => {
        const option = FONT_OPTIONS.find((f) => f.id === FONT_CATEGORY_DEFAULT[category]);
        if (!option) return null;
        const active = value === option.cssValue;
        return (
          <Button
            key={category}
            variant="ghost"
            onPress={() => onChange(option.cssValue)}
            className={
              variant === "full"
                ? `h-auto flex-col w-full gap-0.5 rounded-lg border px-2 py-2.5 text-center font-normal transition-colors ${active
                  ? "border-[var(--lk-ink)] bg-black/[0.03]"
                  : "border-[var(--lk-line)] hover:border-[var(--lk-faint)]"
                }`
                : `h-auto flex-col gap-0.5 rounded-lg w-full border px-1.5 py-1.5 text-center text-[11px] font-medium transition-colors ${active
                  ? "border-[var(--lk-ink)] bg-black/[0.03] text-[var(--lk-ink)]"
                  : "border-[var(--lk-line)] text-[var(--lk-text2)] hover:border-[var(--lk-faint)]"
                }`
            }
          >
            <>
              <span className="text-[20px] text-[var(--lk-ink)]" style={{ fontFamily: option.cssValue }}>
                Aa
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--lk-subtle)]">
                {label}
              </span>
            </>
          </Button>
        );
      })}
    </div>
  );
}
