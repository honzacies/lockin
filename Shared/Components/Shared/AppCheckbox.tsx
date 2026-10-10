"use client";

import type { CSSProperties, ReactNode } from "react";
import { Checkbox } from "@heroui/react";
import { Check } from "@lockin/shared/Components/Shared/UiIcons";

/**
 * Jediný checkbox appky (úkoly, filtry, nastavení panelů). Nezaškrtnutý =
 * jen obrys, zaškrtnutý = modrá (nebo vlastní) výplň a bílá fajfka — v obou
 * motivech stejně čitelný. Fajfka se kreslí jen při zaškrtnutí.
 */
export function AppCheckbox({
  checked,
  onChange,
  color = "#0485f7",
  size = 16,
  label,
  ariaLabel,
  className = "",
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Barva výplně (to-do list ji má v nastavení). */
  color?: string;
  size?: 14 | 16;
  label?: ReactNode;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <Checkbox
      isSelected={checked}
      onChange={onChange}
      aria-label={ariaLabel}
      className={`relative flex shrink-0 cursor-pointer flex-row items-center gap-2 ${className}`}
    >
      <Checkbox.Content className="contents">
        <Checkbox.Control
          className={`flex shrink-0 items-center justify-center rounded-[5px] border shadow-none transition-colors before:hidden ${
            size === 14 ? "size-3.5" : "size-4"
          } ${checked ? "border-transparent" : "border-[var(--lk-faint)] bg-transparent hover:border-[var(--lk-muted)]"}`}
          style={checked ? ({ background: color } as CSSProperties) : undefined}
        >
          <Checkbox.Indicator>
            {checked ? <Check size={size === 14 ? 10 : 12} strokeWidth={3} className="text-[#fff]" /> : null}
          </Checkbox.Indicator>
        </Checkbox.Control>
        {/* Uvnitř <label> — klik na text přepne checkbox taky. */}
        {label}
      </Checkbox.Content>
    </Checkbox>
  );
}
