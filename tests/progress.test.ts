import { describe, expect, it } from "vitest";
import { addDays, daysBetween, isISODate } from "../src/core/date";
import { currentWeek, streak } from "../src/domain/progress";

describe("currentWeek", () => {
  it("is week 1 before the course starts", () => {
    expect(currentWeek(null, "2026-03-01")).toBe(1);
  });

  it("advances every 7 days and stays within 1-52", () => {
    expect(currentWeek("2026-01-01", "2026-01-07")).toBe(1);
    expect(currentWeek("2026-01-01", "2026-01-08")).toBe(2);
    expect(currentWeek("2026-01-01", "2025-12-01")).toBe(1);
    expect(currentWeek("2024-01-01", "2026-01-01")).toBe(52);
  });
});

describe("streak", () => {
  const now = new Date(2026, 4, 20);
  const d = (offset: number) => addDays(offset, now);

  it("counts consecutive days with at least two checked tasks", () => {
    const daily = { [d(0)]: [true, true], [d(-1)]: [true, false, true], [d(-2)]: [true] };
    expect(streak(daily, now)).toBe(2);
  });

  it("keeps yesterday's streak while today is not finished", () => {
    const daily = { [d(0)]: [true], [d(-1)]: [true, true], [d(-2)]: [true, true] };
    expect(streak(daily, now)).toBe(2);
  });

  it("is zero with no history", () => {
    expect(streak({}, now)).toBe(0);
  });
});

describe("date helpers", () => {
  it("counts whole local days across month ends", () => {
    expect(daysBetween("2026-01-31", "2026-03-01")).toBe(29);
    expect(isISODate("2026-01-31")).toBe(true);
    expect(isISODate("2026-1-31")).toBe(false);
  });
});
