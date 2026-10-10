"use client";

import { IconGlyph } from "@lockin/shared/Components/Shared/IconGlyph";
import { Button, Chip } from "@heroui/react";
import { UsePriorityStore } from "@lockin/shared/Store/UsePriorityStore";
import { ContrastTextColor } from "@lockin/shared/Lib/Color";
import { Popover } from "./Popover";
import { PriorityStatusPicker } from "./PriorityStatusPicker";

interface PriorityChipProps {
  /** A PriorityOption.id from UsePriorityStore. */
  priority: string;
  onChange?: (next: string) => void;
  size?: "sm" | "md" | "lg";
}

export function PriorityChip({ priority, onChange, size = "sm" }: PriorityChipProps) {
  const priorities = UsePriorityStore((s) => s.priorities);
  const AddPriority = UsePriorityStore((s) => s.AddPriority);
  const UpdatePriority = UsePriorityStore((s) => s.UpdatePriority);
  const RemovePriority = UsePriorityStore((s) => s.RemovePriority);

  const option = priorities.find((p) => p.id === priority) ?? {
    id: priority,
    label: priority || "—",
    color: "#8b8d98",
  };

  const chip = (
    <Chip
      size={size}
      style={
        {
          "--chip-bg": option.color,
          "--chip-fg": ContrastTextColor(option.color),
        } as React.CSSProperties
      }
    >
      <span className="flex items-center gap-1">
        {option.icon ? <IconGlyph icon={option.icon} size={12} /> : null}
        {option.label}
      </span>
    </Chip>
  );

  if (!onChange) return chip;

  return (
    <Popover
      trigger={() => (
        <Button variant="ghost" aria-label="Click to change priority" className="h-auto cursor-pointer p-0">
          {chip}
        </Button>
      )}
    >
      {(close) => (
        <PriorityStatusPicker
          title="Available priorities"
          options={priorities}
          selectedId={priority}
          size={size}
          onSelect={(id) => {
            onChange(id);
            close();
          }}
          onAdd={AddPriority}
          onUpdate={UpdatePriority}
          onRemove={RemovePriority}
        />
      )}
    </Popover>
  );
}
