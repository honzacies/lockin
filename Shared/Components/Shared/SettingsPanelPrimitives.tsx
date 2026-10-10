"use client";

import { Button } from "@heroui/react";
import { Trash2 } from "@lockin/shared/Components/Shared/UiIcons";
import { AppCheckbox } from "@lockin/shared/Components/Shared/AppCheckbox";

/** Tiny uppercase section label used throughout every block-settings panel
 * (color palette, scenario, to-do list). */
export const SETTINGS_SECTION_TITLE =
  "text-[10px] font-semibold uppercase tracking-wider text-[var(--lk-subtle)]";

/** The "Show: [x] Title [x] Icon ..." checkbox list shared by every block
 * settings panel — each just differs in which style object and fields it
 * toggles, so this takes the style object directly and patches it the same
 * way each panel's own `onChange` already expects. */
export function VisibilityToggleList<S extends object>({
  style,
  items,
  onChange,
}: {
  style: S;
  items: { key: keyof S & string; label: string }[];
  onChange: (patch: Partial<S>) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      {items.map(({ key, label }) => (
        <AppCheckbox
          key={key}
          checked={Boolean(style[key])}
          onChange={(checked) => onChange({ [key]: checked } as Partial<S>)}
          size={14}
          label={label}
          className="text-[13px] text-[var(--lk-ink)]"
        />
      ))}
    </div>
  );
}

/** The "Delete palette/scenario/list" danger button at the bottom of every
 * block settings panel. */
export function SettingsDeleteButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Button
      variant="ghost"
      onPress={onPress}
      className="h-auto justify-center gap-1.5 rounded-lg border border-[var(--lk-line)] px-0 py-1.5 text-[13px] font-normal text-[#e5484d] hover:bg-[#e5484d]/[0.06]"
    >
      <Trash2 size={13} strokeWidth={1.75} />
      {label}
    </Button>
  );
}

/** The "solid / transparent" variant tiles shared by the color palette and
 * to-do list settings panels. */
export function VariantToggle<V extends string>({
  options,
  value,
  onChange,
}: {
  options: V[];
  value: V;
  onChange: (next: V) => void;
}) {
  return (
    // Sloupců tolik, kolik je možností (dřív natvrdo 2 — třetí padala na nový řádek).
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((option) => (
        <Button
          key={option}
          variant="ghost"
          onPress={() => onChange(option)}
          className={`h-auto w-full min-w-0 rounded-lg border px-2.5 py-1.5 text-[13px] font-normal capitalize transition-colors ${
            value === option
              ? "border-[var(--lk-ink)] bg-black/[0.03] text-[var(--lk-ink)]"
              : "border-[var(--lk-line)] text-[var(--lk-text2)] hover:border-[var(--lk-faint)]"
          }`}
        >
          {option}
        </Button>
      ))}
    </div>
  );
}
