/**
 * `paidForMonth` is stored as a Postgres `date` pinned to the first day of the
 * month in UTC, so month comparisons never drift across timezones.
 */

/** `2026-08` -> Date(2026-08-01T00:00:00Z). Throws on malformed input. */
export function monthKeyToDate(monthKey: string): Date {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) throw new Error(`Invalid month key: ${monthKey}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) throw new Error(`Invalid month key: ${monthKey}`);
  return new Date(Date.UTC(year, month - 1, 1));
}

/** Date -> `2026-08`. */
export function dateToMonthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Current month as `2026-08` (UTC). */
export function currentMonthKey(): string {
  return dateToMonthKey(new Date());
}

/** `2026-08` -> `August 2026`. */
export function formatMonthKey(monthKey: string): string {
  const date = monthKeyToDate(monthKey);
  return date.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** `2026-08` -> `Aug 2026`. */
export function formatMonthKeyShort(monthKey: string): string {
  const date = monthKeyToDate(monthKey);
  return date.toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Shifts a month key by `delta` months. `addMonths("2026-01", -1) === "2025-12"`. */
export function addMonths(monthKey: string, delta: number): string {
  const date = monthKeyToDate(monthKey);
  date.setUTCMonth(date.getUTCMonth() + delta);
  return dateToMonthKey(date);
}

/** Inclusive list of month keys from `start` to `end`, oldest first. */
export function monthRange(start: string, end: string): string[] {
  const keys: string[] = [];
  let cursor = start;
  // Guard against an inverted range producing an unbounded loop.
  for (let i = 0; i < 600 && cursor <= end; i += 1) {
    keys.push(cursor);
    cursor = addMonths(cursor, 1);
  }
  return keys;
}

/** The last `count` months ending at `endMonthKey`, oldest first. */
export function lastNMonths(count: number, endMonthKey = currentMonthKey()): string[] {
  return monthRange(addMonths(endMonthKey, -(count - 1)), endMonthKey);
}

/** Society financial years run on the calendar year (Dept. of Cooperatives filing). */
export function yearBounds(year: number): { start: Date; end: Date } {
  return {
    start: new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0)),
    end: new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999)),
  };
}

/** Clamps a month key into `[start, end]`. */
export function clampMonthKey(monthKey: string, start: string, end: string): string {
  if (monthKey < start) return start;
  if (monthKey > end) return end;
  return monthKey;
}

/** Whether a month key falls inside `[start, end]`. */
export function isMonthInWindow(monthKey: string, start: string, end: string): boolean {
  return monthKey >= start && monthKey <= end;
}

/** Every year touched by `[start, end]`, newest first. */
export function yearsInWindow(start: string, end: string): number[] {
  const first = Number(start.slice(0, 4));
  const last = Number(end.slice(0, 4));
  const years: number[] = [];
  for (let y = last; y >= first; y -= 1) years.push(y);
  return years;
}
