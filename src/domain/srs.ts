/**
 * Leitner-style spaced repetition.
 * A correct answer moves a card up one box; the next review is scheduled
 * 1 → 3 → 7 → 14 → 30 days later. A miss sends it back to box 0 (due today).
 */
import { addDays, type ISODate } from "../core/date";
import type { SrsRecord } from "../types";

export const INTERVAL_DAYS = [0, 1, 3, 7, 14, 30] as const;
export const MAX_BOX = INTERVAL_DAYS.length - 1;
/** Cards in this box or higher count as "learned". */
export const MASTERED_BOX = 3;

export function review(
  record: SrsRecord | undefined,
  correct: boolean,
  now: Date = new Date(),
): SrsRecord {
  const box = correct ? Math.min(MAX_BOX, (record?.b ?? 0) + 1) : 0;
  return { b: box, d: addDays(INTERVAL_DAYS[box]!, now) };
}

export function isMastered(record: SrsRecord | undefined): boolean {
  return (record?.b ?? 0) >= MASTERED_BOX;
}

export function isDue(record: SrsRecord | undefined, today: ISODate): boolean {
  return record !== undefined && record.d <= today;
}

export type CardStatus = "new" | "relearn" | "learning" | "mastered";

export function cardStatus(record: SrsRecord | undefined): CardStatus {
  if (!record) return "new";
  if (record.b >= MASTERED_BOX) return "mastered";
  if (record.b === 0) return "relearn";
  return "learning";
}

/** Not-yet-mastered cards first, keeping the original order within each group. */
export function prioritize(keys: string[], srs: Record<string, SrsRecord>): string[] {
  const learning = keys.filter((k) => !isMastered(srs[k]));
  const mastered = keys.filter((k) => isMastered(srs[k]));
  return [...learning, ...mastered];
}
