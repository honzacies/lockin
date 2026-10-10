"use client";

import { Button } from "@heroui/react";
import { UsePriorityStore } from "@lockin/shared/Store/UsePriorityStore";
import { Popover } from "./Popover";
import { OptionPill, PriorityStatusPicker } from "./PriorityStatusPicker";

interface PriorityChipProps {
  /** A PriorityOption.id from UsePriorityStore. */
  priority: string;
  onChange?: (next: string) => void;
}

export function PriorityChip({ priority, onChange }: PriorityChipProps) {
  const priorities = UsePriorityStore((s) => s.priorities);
  const option = priorities.find((p) => p.id === priority) ?? { id: priority, label: priority || "—", color: "#8b8d98" };

  if (!onChange) return <OptionPill option={option} />;

  return (
    <Popover
      trigger={() => (
        <Button variant="ghost" aria-label="Change priority" className="h-auto min-w-0 cursor-pointer rounded-xl p-0">
          <OptionPill option={option} chevron />
        </Button>
      )}
      panelClassName="w-52 p-1"
    >
      {(close) => (
        <PriorityStatusPicker title="Your priorities" options={priorities} selectedId={priority} onSelect={onChange} close={close} />
      )}
    </Popover>
  );
}
