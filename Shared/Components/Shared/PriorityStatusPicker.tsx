"use client";

import { useState } from "react";
import { Pencil, Plus, X } from "lucide-react";
import { Button, Chip, Input } from "@heroui/react";
import { ContrastTextColor } from "@lockin/shared/Lib/Color";
import { ColorPicker } from "@lockin/shared/Components/DocumentView/StyleEditor/ColorPicker";

export interface ChipOption {
  id: string;
  label: string;
  color: string;
}

interface PriorityStatusPickerProps {
  /** e.g. "Available priorities" — rendered as a 10px uppercase label. */
  title: string;
  options: ChipOption[];
  selectedId: string;
  size: "sm" | "md" | "lg";
  onSelect: (id: string) => void;
  onAdd: () => void;
  onUpdate: (id: string, patch: Partial<Omit<ChipOption, "id">>) => void;
  onRemove: (id: string) => void;
}

/** Shared dropdown body for PriorityChip/StatusChip: a row of colored chips
 * to pick from, with a pencil that flips into a global manage view (add,
 * rename, recolor, remove) — the definitions are shared across the app. */
export function PriorityStatusPicker({
  title,
  options,
  selectedId,
  size,
  onSelect,
  onAdd,
  onUpdate,
  onRemove,
}: PriorityStatusPickerProps) {
  const [managing, setManaging] = useState(false);
  const [colorEditingId, setColorEditingId] = useState<string | null>(null);

  return (
    <div className={`flex flex-col gap-2 p-2 ${managing ? "w-64" : "w-[150px]"}`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#a5a49f]">
          {title}
        </span>
        <Button
          variant="ghost"
          isIconOnly
          onPress={() => {
            setManaging((m) => !m);
            setColorEditingId(null);
          }}
          className={`h-auto w-auto rounded p-0.5 hover:bg-black/[0.06] ${
            managing ? "text-[#2c2c2b]" : "text-[#91918e]"
          }`}
          aria-label="Manage options"
        >
          <Pencil size={11} strokeWidth={1.75} />
        </Button>
      </div>

      {managing ? (
        <div className="flex flex-col gap-1.5">
          {options.map((option) => (
            <div key={option.id} className="flex flex-col gap-1">
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  isIconOnly
                  onPress={() =>
                    setColorEditingId((id) => (id === option.id ? null : option.id))
                  }
                  className="h-4 w-4 shrink-0 rounded-full border border-black/10 p-0"
                  style={{ background: option.color }}
                  aria-label="Change color"
                />
                <Input
                  value={option.label}
                  onChange={(e) => onUpdate(option.id, { label: e.target.value })}
                  className="min-w-0 flex-1 rounded border border-transparent px-1 py-0.5 text-xs text-[#2c2c2b] outline-none hover:border-[#f0efed] focus:border-[#c9c8c4]"
                />
                <Button
                  variant="ghost"
                  isIconOnly
                  onPress={() => onRemove(option.id)}
                  className="h-auto w-auto shrink-0 rounded p-0.5 text-[#c9c8c4] hover:bg-black/[0.06] hover:text-[#e5484d]"
                  aria-label="Remove"
                >
                  <X size={12} strokeWidth={1.75} />
                </Button>
              </div>
              {colorEditingId === option.id ? (
                <ColorPicker
                  value={option.color}
                  onChange={(color) => onUpdate(option.id, { color })}
                />
              ) : null}
            </div>
          ))}
          <Button
            variant="ghost"
            onPress={onAdd}
            className="h-auto justify-center gap-1 rounded-lg border border-dashed border-[#e2e0dc] px-0 py-1 text-xs font-normal text-[#91918e] hover:border-[#0088ff]/40 hover:text-[#0088ff]"
          >
            <Plus size={12} strokeWidth={1.75} />
            Add
          </Button>
        </div>
      ) : (
        <div className="flex flex-row flex-wrap gap-1">
          {options.map((option) => (
            <Button key={option.id} variant="ghost" onPress={() => onSelect(option.id)} className="h-auto p-0">
              <Chip
                size={size}
                style={
                  {
                    "--chip-bg": option.color,
                    "--chip-fg": ContrastTextColor(option.color),
                  } as React.CSSProperties
                }
                className={selectedId === option.id ? "ring-2 ring-black/20" : ""}
              >
                {option.label}
              </Chip>
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
