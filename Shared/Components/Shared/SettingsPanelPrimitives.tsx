"use client";

import { Button, Checkbox } from "@heroui/react";
import { Check, Trash2 } from "lucide-react";

/** Tiny uppercase section label used throughout every block-settings panel
 * (color palette, scenario, to-do list). */
export const SETTINGS_SECTION_TITLE =
  "text-[10px] font-semibold uppercase tracking-wider text-[#a5a49f]";

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
        <Checkbox
          key={key}
          isSelected={Boolean(style[key])}
          onChange={(checked) => onChange({ [key]: checked } as Partial<S>)}
          className="group/checkbox relative flex cursor-pointer flex-row items-center gap-2 text-[13px] text-[#2c2c2b]"
        >
          <Checkbox.Content className="contents">
            <Checkbox.Control className="flex size-3.5 shrink-0 items-center justify-center rounded border border-[#d9d9d9] before:bg-[#2c2c2b] group-data-[selected]/checkbox:border-0">
              <Checkbox.Indicator>
                <Check size={10} strokeWidth={3} className="text-white" />
              </Checkbox.Indicator>
            </Checkbox.Control>
          </Checkbox.Content>
          {label}
        </Checkbox>
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
      className="h-auto justify-center gap-1.5 rounded-lg border border-[#f0efed] px-0 py-1.5 text-[13px] font-normal text-[#e5484d] hover:bg-[#e5484d]/[0.06]"
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
              ? "border-[#2c2c2b] bg-black/[0.03] text-[#2c2c2b]"
              : "border-[#f0efed] text-[#5f5e59] hover:border-[#c9c8c4]"
          }`}
        >
          {option}
        </Button>
      ))}
    </div>
  );
}
