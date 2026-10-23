import { describe, expect, it } from "vitest";
import { cardStatus, isDue, isMastered, prioritize, review } from "../src/domain/srs";

const day = new Date(2026, 0, 10);

describe("review", () => {
  it("walks a card up the 1 → 3 → 7 → 14 → 30 day ladder", () => {
    let record = review(undefined, true, day);
    expect(record).toEqual({ b: 1, d: "2026-01-11" });
    const dates = [record.d];
    for (let i = 0; i < 5; i++) {
      record = review(record, true, day);
      dates.push(record.d);
    }
    expect(dates).toEqual([
      "2026-01-11",
      "2026-01-13",
      "2026-01-17",
      "2026-01-24",
      "2026-02-09",
      "2026-02-09", // capped at the last box
    ]);
  });

  it("sends a missed card back to box 0, due today", () => {
    expect(review({ b: 4, d: "2026-01-24" }, false, day)).toEqual({ b: 0, d: "2026-01-10" });
  });
});

describe("status helpers", () => {
  it("classifies cards", () => {
    expect(cardStatus(undefined)).toBe("new");
    expect(cardStatus({ b: 0, d: "2026-01-10" })).toBe("relearn");
    expect(cardStatus({ b: 2, d: "2026-01-10" })).toBe("learning");
    expect(cardStatus({ b: 3, d: "2026-01-10" })).toBe("mastered");
    expect(isMastered({ b: 3, d: "" })).toBe(true);
  });

  it("treats only scheduled cards on or before today as due", () => {
    expect(isDue(undefined, "2026-01-10")).toBe(false);
    expect(isDue({ b: 1, d: "2026-01-10" }, "2026-01-10")).toBe(true);
    expect(isDue({ b: 1, d: "2026-01-11" }, "2026-01-10")).toBe(false);
  });

  it("puts unlearned cards first and keeps order within groups", () => {
    const srs = { a: { b: 3, d: "" }, c: { b: 1, d: "" } };
    expect(prioritize(["a", "b", "c", "d"], srs)).toEqual(["b", "c", "d", "a"]);
  });
});
