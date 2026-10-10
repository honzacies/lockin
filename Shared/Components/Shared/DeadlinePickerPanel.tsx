"use client";

import { useState } from "react";
import { Button, Calendar, TimeField } from "@heroui/react";
import type { CalendarDate, Time } from "@internationalized/date";
import { Clock } from "@lockin/shared/Components/Shared/UiIcons";
import {
  FromCalendarDate,
  FromTimeValue,
  ToCalendarDate,
  ToTimeValue,
} from "@lockin/shared/Lib/FormatDate";

interface DeadlinePickerPanelProps {
  /** Stored "YYYY-MM-DD" date, or null. */
  date: string | null;
  /** Stored "HH:mm" time, or null. */
  time: string | null;
  onChangeDate: (date: string | null) => void;
  onChangeTime: (time: string | null) => void;
  onDone: () => void;
}

/** Calendar + TimeField (12h/24h toggle) popover body, reused by every
 * deadline picker in the app (project header, to-do list, …). */
export function DeadlinePickerPanel({
  date,
  time,
  onChangeDate,
  onChangeTime,
  onDone,
}: DeadlinePickerPanelProps) {
  const [hourCycle, setHourCycle] = useState<12 | 24>(24);

  return (
    <div className="flex w-fit flex-col gap-2 p-2">
      <DateCalendar label="Deadline date" date={date} onChange={onChangeDate} />

      <TimeField
        aria-label="Deadline time"
        className="w-full"
        hourCycle={hourCycle}
        value={ToTimeValue(time)}
        onChange={(next) => onChangeTime(FromTimeValue((next as Time) ?? null))}
      >
        <TimeField.Group>
          <TimeField.Prefix>
            <Clock size={14} strokeWidth={1.5} className="text-[var(--lk-muted)]" />
          </TimeField.Prefix>
          <TimeField.Input>
            {(segment) => <TimeField.Segment segment={segment} />}
          </TimeField.Input>
          <TimeField.Suffix>
            <Button
              variant="ghost"
              aria-label="Toggle 12h/24h"
              onPress={() => setHourCycle((h) => (h === 24 ? 12 : 24))}
              className="h-auto rounded px-1 text-[10px] font-semibold text-[var(--lk-muted)] hover:bg-black/[0.06] hover:text-[var(--lk-ink)]"
            >
              {hourCycle}h
            </Button>
          </TimeField.Suffix>
        </TimeField.Group>
      </TimeField>

      <div className="flex items-center justify-between pt-1">
        {date ? (
          <Button
            variant="ghost"
            onPress={() => {
              onChangeDate(null);
              onChangeTime(null);
            }}
            className="h-auto justify-start rounded-lg px-2 py-1 text-left text-xs font-normal text-[var(--lk-muted)] hover:bg-black/[0.04] hover:text-[var(--lk-text2)]"
          >
            Clear deadline
          </Button>
        ) : (
          <span />
        )}
        <Button
          variant="ghost"
          onPress={onDone}
          className="h-auto rounded-lg bg-[var(--lk-ink)] px-2.5 py-1 text-xs font-medium text-white hover:bg-black"
        >
          Done
        </Button>
      </div>
    </div>
  );
}

/** Samotný kalendář (HeroUI) nad uloženým „YYYY-MM-DD" — deadline i vlastní pole s datem. */
export function DateCalendar({ date, onChange, label }: { date: string | null; onChange: (date: string | null) => void; label: string }) {
  return (
    <Calendar aria-label={label} value={ToCalendarDate(date)} onChange={(next) => onChange(FromCalendarDate((next as CalendarDate) ?? null))}>
      <Calendar.Header>
        <Calendar.Heading />
        <Calendar.NavButton slot="previous" />
        <Calendar.NavButton slot="next" />
      </Calendar.Header>
      <Calendar.Grid>
        <Calendar.GridHeader>{(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}</Calendar.GridHeader>
        <Calendar.GridBody>{(cellDate) => <Calendar.Cell date={cellDate} />}</Calendar.GridBody>
      </Calendar.Grid>
    </Calendar>
  );
}
