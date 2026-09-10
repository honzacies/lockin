"use client";

import { useState } from "react";
import { Button, Input } from "@heroui/react";
import { ProgressColor } from "@lockin/shared/Lib/Color";

interface ProjectProgressBarProps {
  value: number;
  /** When provided, clicking the percentage turns it into an editable field. */
  onChange?: (next: number) => void;
  className?: string;
}

function Clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function ProjectProgressBar({
  value,
  onChange,
  className,
}: ProjectProgressBarProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const clamped = Clamp(value, 0, 100);
  const color = ProgressColor(clamped);

  function StartEditing() {
    if (!onChange) return;
    setDraft(String(clamped));
    setEditing(true);
  }

  function Commit() {
    setEditing(false);
    if (!onChange) return;
    const next = Clamp(Math.round(Number(draft)) || 0, 0, 100);
    if (next !== value) onChange(next);
  }

  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <div className="h-1.5 w-[110px] overflow-hidden rounded-full bg-black/[0.06]">
        <div
          className="h-full rounded-full transition-[width]"
          style={{ width: `${clamped}%`, background: color }}
        />
      </div>
      {editing ? (
        <Input
          autoFocus
          type="number"
          min={0}
          max={100}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={Commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") setEditing(false);
          }}
          className="w-12 rounded border border-[#f0efed] px-1 py-0.5 text-xs text-[#2c2c2b] outline-none focus:border-[#c9c8c4]"
        />
      ) : (
        <Button
          variant="ghost"
          onPress={StartEditing}
          isDisabled={!onChange}
          className={`h-auto p-0 text-xs font-normal text-[#565655] ${onChange ? "cursor-pointer hover:underline" : ""}`}
        >
          {clamped}%
        </Button>
      )}
    </div>
  );
}
