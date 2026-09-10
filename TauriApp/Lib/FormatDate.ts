import { parseDate, Time, type CalendarDate } from "@internationalized/date";

export function FormatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const isSameDay = date.toDateString() === now.toDateString();
  if (isSameDay) {
    return `Today, ${date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`;
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function ToDateInputValue(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export function FromDateInputValue(value: string): string | null {
  if (!value) return null;
  return new Date(value).toISOString();
}

/** Converts a stored deadline (ISO date/datetime string) to a Calendar value. */
export function ToCalendarDate(iso: string | null): CalendarDate | null {
  if (!iso) return null;
  try {
    return parseDate(iso.slice(0, 10));
  } catch {
    return null;
  }
}

/** Converts a Calendar selection back to the plain "YYYY-MM-DD" string we store. */
export function FromCalendarDate(date: CalendarDate | null): string | null {
  return date ? date.toString() : null;
}

/** Converts a stored "HH:mm" deadline time into a TimeField value. */
export function ToTimeValue(hhmm: string | null | undefined): Time | null {
  if (!hhmm) return null;
  const [hour, minute] = hhmm.split(":").map(Number);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  return new Time(hour, minute);
}

/** Converts a TimeField selection back to the plain "HH:mm" string we store. */
export function FromTimeValue(time: Time | null): string | null {
  if (!time) return null;
  return `${String(time.hour).padStart(2, "0")}:${String(time.minute).padStart(2, "0")}`;
}

/** Formats a stored "HH:mm" for display, honoring a 12h/24h preference. */
export function FormatTimeValue(hhmm: string | null | undefined, hourCycle: 12 | 24): string {
  if (!hhmm) return "";
  const [hour, minute] = hhmm.split(":").map(Number);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return "";
  const mm = String(minute).padStart(2, "0");
  if (hourCycle === 24) return `${String(hour).padStart(2, "0")}:${mm}`;
  const period = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${mm} ${period}`;
}

/** Combined "Aug 5, 2026 · 14:30" label for a stored date + optional time. */
export function FormatDeadlineLabel(
  date: string | null,
  time: string | null | undefined,
  hourCycle: 12 | 24,
): string {
  if (!date) return "—";
  return [
    new Date(date).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    time ? FormatTimeValue(time, hourCycle) : null,
  ]
    .filter(Boolean)
    .join(" · ");
}
