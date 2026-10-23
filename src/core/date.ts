/** Local-calendar date helpers. Dates are stored as YYYY-MM-DD strings. */

export type ISODate = string;

export function toISODate(d: Date): ISODate {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function today(now: Date = new Date()): ISODate {
  return toISODate(now);
}

export function addDays(days: number, now: Date = new Date()): ISODate {
  const d = new Date(now);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** Whole days from `from` to `to` (both YYYY-MM-DD, local). */
export function daysBetween(from: ISODate, to: ISODate): number {
  const a = new Date(`${from}T00:00:00`);
  const b = new Date(`${to}T00:00:00`);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export function isISODate(value: unknown): value is ISODate {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}
