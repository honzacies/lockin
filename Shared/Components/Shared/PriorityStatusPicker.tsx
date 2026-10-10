"use client";

import type { ReactNode } from "react";
import { Button } from "@heroui/react";
import { ChevronDown, Settings } from "@lockin/shared/Components/Shared/UiIcons";
import { IconGlyph } from "@lockin/shared/Components/Shared/IconGlyph";
import { ContextMenuItem } from "@lockin/shared/Components/Shared/ContextMenu";
import { ContrastTextColor } from "@lockin/shared/Lib/Color";
import { UseSettingsStore } from "@lockin/shared/Store/UseSettingsStore";

export interface ChipOption {
  id: string;
  label: string;
  color: string;
  icon?: string;
}

/** Stejná velikost a tvar jako trigger výběru štítků (TagSelector). */
export const PILL_CLASS = "h-auto min-w-0 gap-1.5 rounded-xl px-2 py-1 text-xs font-medium";

/** Barevná pilulka priority / statusu — i jako trigger jejich výběru. */
export function OptionPill({ option, chevron }: { option: ChipOption; chevron?: boolean }) {
  const fg = ContrastTextColor(option.color);
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap ${PILL_CLASS}`}
      style={{ background: option.color, color: fg }}
    >
      {option.icon ? <IconGlyph icon={option.icon} size={14} /> : null}
      {option.label}
      {chevron ? <ChevronDown size={12} strokeWidth={1.75} className="opacity-70" /> : null}
    </span>
  );
}

/** Malý nadpis panelu výběru, vpravo volitelná akce (ozubené kolo, plus). */
export function PickerHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-2 pt-1 pb-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--lk-subtle)]">{title}</span>
      {action}
    </div>
  );
}

/** Ozubené kolo v hlavičce panelu — otevře Nastavení → Priorities & statuses. */
export function ManageOptionsButton({ label, onNavigate }: { label: string; onNavigate: () => void }) {
  return (
    <Button
      variant="ghost"
      isIconOnly
      aria-label={label}
      onPress={() => {
        onNavigate();
        UseSettingsStore.getState().Open("options");
      }}
      className="h-5 w-5 min-w-0 rounded p-0.5 text-[var(--lk-muted)] hover:bg-black/[0.06] hover:text-[var(--lk-ink)]"
    >
      <Settings size={12} strokeWidth={1.75} />
    </Button>
  );
}

/** Ikona volby (status, priorita) v její barvě — bez ikony prázdné místo, ať texty lícují. */
export function OptionIcon({ option }: { option: ChipOption }) {
  return (
    <span className="flex size-4 shrink-0 items-center justify-center" style={{ color: option.color }}>
      {option.icon ? <IconGlyph icon={option.icon} size={15} /> : null}
    </span>
  );
}

/** Panel výběru priority nebo statusu — stejný styl jako výběr štítků. */
export function PriorityStatusPicker({
  title,
  options,
  selectedId,
  onSelect,
  close,
}: {
  /** Např. "Your priorities" — 10px uppercase nadpis. */
  title: string;
  options: ChipOption[];
  selectedId: string;
  onSelect: (id: string) => void;
  close: () => void;
}) {
  return (
    <div className="flex flex-col gap-px">
      <PickerHeader title={title} action={<ManageOptionsButton label={`Manage ${title.toLowerCase().replace("your ", "")}`} onNavigate={close} />} />
      {options.map((option) => (
        <ContextMenuItem
          key={option.id}
          icon={<OptionIcon option={option} />}
          selected={option.id === selectedId}
          onClick={() => {
            onSelect(option.id);
            close();
          }}
        >
          {option.label}
        </ContextMenuItem>
      ))}
    </div>
  );
}
