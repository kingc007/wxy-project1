// Single source for every date shown to the reader (memo, PDF, Markdown, filenames).
// Envelope timestamps (generatedAt, fetchedAt) stay ISO UTC; only displays go through here.
export const DISPLAY_TZ = "America/New_York";

/** yyyy-mm-dd in the given IANA time zone. Accepts a Date or an ISO string; "—" when missing/invalid. */
export function formatLocalDate(date: Date | string | null | undefined, tz: string = DISPLAY_TZ): string {
  if (date === null || date === undefined || date === "") return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** yyyymmdd in the display time zone (for filenames). */
export function compactLocalDate(date: Date, tz: string = DISPLAY_TZ): string {
  return formatLocalDate(date, tz).replace(/-/g, "");
}
