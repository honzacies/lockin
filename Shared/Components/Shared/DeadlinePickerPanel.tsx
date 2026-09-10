"use client";

import { useState } from "react";
import { Button, Calendar, TimeField } from "@heroui/react";
import type { CalendarDate, Time } from "@internationalized/date";
import { Clock } from "lucide-react";
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
      <Calendar
        aria-label="Deadline date"
        value={ToCalendarDate(date)}
        onChange={(next) => onChangeDate(FromCalendarDate((next as CalendarDate) ?? null))}
      >
        <Calendar.Header>
          <Calendar.Heading />
          <Calendar.NavButton slot="previous" />
          <Calendar.NavButton slot="next" />
        </Calendar.Header>
        <Calendar.Grid>
          <Calendar.GridHeader>
            {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
          </Calendar.GridHeader>
          <Calendar.GridBody>
            {(cellDate) => <Calendar.Cell date={cellDate} />}
          </Calendar.GridBody>
        </Calendar.Grid>
      </Calendar>

      <TimeField
        aria-label="Deadline time"
        className="w-full"
        hourCycle={hourCycle}
        value={ToTimeValue(time)}
        onChange={(next) => onChangeTime(FromTimeValue((next as Time) ?? null))}
      >
        <TimeField.Group>
          <TimeField.Prefix>
            <Clock size={14} strokeWidth={1.5} className="text-[#91918e]" />
          </TimeField.Prefix>
          <TimeField.Input>
            {(segment) => <TimeField.Segment segment={segment} />}
          </TimeField.Input>
          <TimeField.Suffix>
            <Button
              variant="ghost"
              aria-label="Toggle 12h/24h"
              onPress={() => setHourCycle((h) => (h === 24 ? 12 : 24))}
              className="h-auto rounded px-1 text-[10px] font-semibold text-[#91918e] hover:bg-black/[0.06] hover:text-[#2c2c2b]"
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
            className="h-auto justify-start rounded-lg px-2 py-1 text-left text-xs font-normal text-[#91918e] hover:bg-black/[0.04] hover:text-[#5f5e59]"
          >
            Clear deadline
          </Button>
        ) : (
          <span />
        )}
        <Button
          variant="ghost"
          onPress={onDone}
          className="h-auto rounded-lg bg-[#2c2c2b] px-2.5 py-1 text-xs font-medium text-white hover:bg-black"
        >
          Done
        </Button>
      </div>
    </div>
  );
}
