"use client";

import { Button } from "@heroui/react";
import { Clock, Flag } from "lucide-react";
import { Popover } from "@lockin/shared/Components/Shared/Popover";
import { DeadlinePickerPanel } from "@lockin/shared/Components/Shared/DeadlinePickerPanel";
import { FormatDeadlineLabel, FormatRelativeDate } from "@lockin/shared/Lib/FormatDate";

const PILL = "flex w-fit items-center gap-1.5 rounded-[60px] bg-[var(--lk-pill)] px-2.5 py-[5px] text-sm text-[var(--lk-text2)]";

/** „Updated …" nad názvem dokumentu i projektu — jeden vzhled pro oba. */
export function UpdatedPill({ at }: { at: string }) {
  return (
    <span className={PILL}>
      <Clock size={16} strokeWidth={1.5} />
      Updated {FormatRelativeDate(at)}
    </span>
  );
}

/** „Deadline …" ve stejné pilulce; klik otevře výběr data a času. */
export function DeadlinePill({
  date,
  time,
  onChangeDate,
  onChangeTime,
}: {
  date: string | null;
  time: string | null;
  onChangeDate: (date: string | null) => void;
  onChangeTime: (time: string | null) => void;
}) {
  return (
    <Popover
      trigger={() => (
        <Button variant="ghost" aria-label="Change deadline" className={`${PILL} h-auto min-w-0 font-normal hover:bg-[var(--lk-line2)] hover:text-[var(--lk-ink)]`}>
          <Flag size={16} strokeWidth={1.5} />
          Deadline {FormatDeadlineLabel(date, time, 24)}
        </Button>
      )}
    >
      {(close) => (
        <DeadlinePickerPanel date={date} time={time} onChangeDate={onChangeDate} onChangeTime={onChangeTime} onDone={close} />
      )}
    </Popover>
  );
}
