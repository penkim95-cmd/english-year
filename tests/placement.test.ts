import { describe, expect, it } from "vitest";
import { stageOf } from "../src/data/curriculum";
import { PLACEMENT, TOP_START_WEEK, countCorrect, placementWeek } from "../src/domain/placement";

describe("level check", () => {
  it("has questions of rising difficulty with one right answer each", () => {
    const weeks = PLACEMENT.map((q) => q.week);
    expect([...weeks].sort((a, b) => a - b)).toEqual(weeks);
    for (const q of PLACEMENT) {
      expect(q.options).toHaveLength(3);
      expect(new Set(q.options).size).toBe(3);
      expect(q.answerIndex).toBeGreaterThanOrEqual(0);
      expect(q.answerIndex).toBeLessThan(3);
    }
  });

  it("starts at the first level not shown yet", () => {
    expect(placementWeek(0)).toBe(1);
    expect(placementWeek(PLACEMENT.length)).toBe(TOP_START_WEEK);
  });

  it("puts someone who knows apple, cat and 'I have a boyfriend' one stage up", () => {
    // Knows words, be-verbs, likes, Do-questions and the simple past: the first five.
    const answers = PLACEMENT.map((q, i) => (i < 5 ? q.answerIndex : -1));
    const week = placementWeek(countCorrect(answers));
    expect(week).toBe(9);
    expect(stageOf(week).id).toBe(2);
  });

  it("counts 'I don't know' as wrong", () => {
    expect(countCorrect([-1, -1, PLACEMENT[2]!.answerIndex])).toBe(1);
  });
});
