import { addDays, daysBetween, type ISODate } from "../core/date";
import { TOTAL_WEEKS } from "../data/curriculum";

/** Course week (1-52) for a given start date; week 1 before the course starts. */
export function currentWeek(startDate: ISODate | null, now: ISODate): number {
  if (!startDate) return 1;
  const week = Math.floor(daysBetween(startDate, now) / 7) + 1;
  return Math.min(TOTAL_WEEKS, Math.max(1, week));
}

/** A day counts as studied when at least this many daily tasks were checked. */
export const STUDY_DAY_THRESHOLD = 2;

/**
 * Consecutive studied days ending today. If today is not finished yet the
 * streak still counts from yesterday, so it does not reset in the morning.
 */
export function streak(daily: Record<ISODate, boolean[]>, now: Date = new Date()): number {
  const studied = (day: ISODate) =>
    (daily[day] ?? []).filter(Boolean).length >= STUDY_DAY_THRESHOLD;
  let offset = studied(addDays(0, now)) ? 0 : -1;
  let count = 0;
  while (count <= 400 && studied(addDays(offset, now))) {
    count++;
    offset--;
  }
  return count;
}
