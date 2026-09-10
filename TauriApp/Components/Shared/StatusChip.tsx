"use client";

import { Button, Chip } from "@heroui/react";
import { UsePriorityStore } from "@/Store/UsePriorityStore";
import { ContrastTextColor } from "@/Lib/Color";
import { Popover } from "./Popover";
import { PriorityStatusPicker } from "./PriorityStatusPicker";

interface StatusChipProps {
  /** A StatusOption.id from UsePriorityStore. */
  status: string;
  onChange?: (next: string) => void;
  size?: "sm" | "md" | "lg";
}

export function StatusChip({ status, onChange, size = "sm" }: StatusChipProps) {
  const statuses = UsePriorityStore((s) => s.statuses);
  const AddStatus = UsePriorityStore((s) => s.AddStatus);
  const UpdateStatus = UsePriorityStore((s) => s.UpdateStatus);
  const RemoveStatus = UsePriorityStore((s) => s.RemoveStatus);

  const option = statuses.find((s) => s.id === status) ?? {
    id: status,
    label: status || "—",
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
      {option.label}
    </Chip>
  );

  if (!onChange) return chip;

  return (
    <Popover
      trigger={() => (
        <Button variant="ghost" aria-label="Click to change status" className="h-auto cursor-pointer p-0">
          {chip}
        </Button>
      )}
    >
      {(close) => (
        <PriorityStatusPicker
          title="Available statuses"
          options={statuses}
          selectedId={status}
          size={size}
          onSelect={(id) => {
            onChange(id);
            close();
          }}
          onAdd={AddStatus}
          onUpdate={UpdateStatus}
          onRemove={RemoveStatus}
        />
      )}
    </Popover>
  );
}
