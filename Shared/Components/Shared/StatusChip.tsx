"use client";

import { Button } from "@heroui/react";
import { UsePriorityStore } from "@lockin/shared/Store/UsePriorityStore";
import { Popover } from "./Popover";
import { OptionPill, PriorityStatusPicker } from "./PriorityStatusPicker";

interface StatusChipProps {
  /** A StatusOption.id from UsePriorityStore. */
  status: string;
  onChange?: (next: string) => void;
}

export function StatusChip({ status, onChange }: StatusChipProps) {
  const statuses = UsePriorityStore((s) => s.statuses);
  const option = statuses.find((s) => s.id === status) ?? { id: status, label: status || "—", color: "#8b8d98" };

  if (!onChange) return <OptionPill option={option} />;

  return (
    <Popover
      trigger={() => (
        <Button variant="ghost" aria-label="Change status" className="h-auto min-w-0 cursor-pointer rounded-xl p-0">
          <OptionPill option={option} chevron />
        </Button>
      )}
      panelClassName="w-52 p-1"
    >
      {(close) => (
        <PriorityStatusPicker title="Your statuses" options={statuses} selectedId={status} onSelect={onChange} close={close} />
      )}
    </Popover>
  );
}
