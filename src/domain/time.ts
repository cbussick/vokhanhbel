export const berlinTimeZone = "Europe/Berlin";

const berlinDayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: berlinTimeZone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The Berlin calendar day (`YYYY-MM-DD`) a timestamp falls on, matching `berlinDateSchema`. */
export function toBerlinDay(date: Date): string {
  return berlinDayFormatter.format(date);
}

/**
 * Adds (or subtracts) whole calendar days to a `YYYY-MM-DD` day string. Arithmetic runs against a
 * UTC-normalized reading of the day's own year/month/day, so it never touches a time zone offset
 * or a DST transition — the input is already a calendar label, not an instant.
 */
export function shiftCalendarDay(day: string, deltaDays: number): string {
  // SAFETY: every caller passes a `YYYY-MM-DD` string (produced by `toBerlinDay` or `berlinDateSchema`),
  // which always splits into exactly three numeric parts.
  const [year, month, dayOfMonth] = day.split("-").map(Number) as [number, number, number];

  return new Date(Date.UTC(year, month - 1, dayOfMonth + deltaDays)).toISOString().slice(0, 10);
}
