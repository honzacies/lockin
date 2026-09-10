"use client";

import type { ReactNode } from "react";
import { Button } from "@heroui/react";
import { Minus, Plus } from "lucide-react";

/** A toolbar-style trigger button (used as a Popover trigger for font/color
 * pickers) — highlights when its dropdown is open. */
export function ToolButton({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Button
      variant="ghost"
      className={`h-auto gap-1.5 rounded-lg border px-2.5 py-1.5 text-[13px] font-normal text-[#2c2c2b] transition-colors ${
        active
          ? "border-[#2c2c2b] bg-black/[0.03]"
          : "border-[#f0efed] hover:border-[#c9c8c4]"
      }`}
    >
      {children}
    </Button>
  );
}

/** Small round color swatch, e.g. shown inside a ToolButton. */
export function Swatch({ color }: { color: string }) {
  return (
    <span
      className="size-3.5 rounded-full border border-black/10"
      style={{ background: color }}
    />
  );
}

/** A compact −/value/+ numeric stepper. */
export function Stepper({
  label,
  value,
  unit,
  onDec,
  onInc,
}: {
  label?: string;
  value: number;
  unit: string;
  onDec: () => void;
  onInc: () => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-[#f0efed] px-1 py-0.5">
      {label ? (
        <span className="px-1 text-[11px] text-[#91918e]">{label}</span>
      ) : null}
      <Button
        variant="ghost"
        isIconOnly
        onPress={onDec}
        className="h-auto w-auto rounded p-1 text-[#5f5e59] hover:bg-black/[0.05]"
        aria-label="Decrease"
      >
        <Minus size={13} strokeWidth={2} />
      </Button>
      <span className="min-w-11 text-center text-[13px] tabular-nums text-[#2c2c2b]">
        {value}
        {unit}
      </span>
      <Button
        variant="ghost"
        isIconOnly
        onPress={onInc}
        className="h-auto w-auto rounded p-1 text-[#5f5e59] hover:bg-black/[0.05]"
        aria-label="Increase"
      >
        <Plus size={13} strokeWidth={2} />
      </Button>
    </div>
  );
}
