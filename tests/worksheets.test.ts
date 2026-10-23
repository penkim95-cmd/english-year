import { describe, expect, it } from "vitest";
import { STAGES, TOTAL_WEEKS } from "../src/data/curriculum";
import {
  STAGE_TEST_SIZE,
  WEEK_SHEET_SIZE,
  isAnswered,
  isCorrect,
  scoreSheet,
  stageSheet,
  stageTest,
  weekSheet,
  type Answer,
} from "../src/domain/worksheets";
import type { Question } from "../src/types";

/** The answer a learner who knows everything would give (tokens may hold several words). */
function perfectAnswer(q: Question): Answer {
  if (q.kind === "choice") return q.answerIndex;
  const solve = (rest: string, used: number[]): number[] | null => {
    if (!rest) return used.length === q.tokens.length ? used : null;
    for (let i = 0; i < q.tokens.length; i++) {
      const t = q.tokens[i]!;
      if (used.includes(i) || !(rest === t || rest.startsWith(`${t} `))) continue;
      const found = solve(rest.slice(t.length).trimStart(), [...used, i]);
      if (found) return found;
    }
    return null;
  };
  return solve(q.answer, []) ?? [];
}

function expectWellFormed(q: Question): void {
  if (q.kind === "choice") {
    expect(q.options).toHaveLength(3);
    expect(new Set(q.options).size).toBe(3);
    expect(q.answerIndex).toBeGreaterThanOrEqual(0);
    expect(q.answerIndex).toBeLessThan(3);
  } else {
    expect(q.tokens.join(" ").split(" ").sort()).toEqual(q.answer.split(" ").sort());
  }
  expect(isCorrect(q, perfectAnswer(q))).toBe(true);
}

describe("weekSheet", () => {
  it("builds 8 solvable questions for every week", () => {
    for (let week = 1; week <= TOTAL_WEEKS; week++) {
      const sheet = weekSheet(week);
      expect(sheet).toHaveLength(WEEK_SHEET_SIZE);
      sheet.forEach(expectWellFormed);
    }
  });

  it("never shows a word-order question already in order", () => {
    for (let week = 1; week <= TOTAL_WEEKS; week++) {
      for (const q of weekSheet(week)) {
        if (q.kind === "order") expect(q.tokens.join(" ")).not.toBe(q.answer);
      }
    }
  });

  it("is deterministic", () => {
    expect(JSON.stringify(weekSheet(7))).toBe(JSON.stringify(weekSheet(7)));
  });
});

describe("stage sheets and tests", () => {
  it("has a written review sheet and a 20-question test for each stage", () => {
    for (const stage of STAGES) {
      expect(stageSheet(stage.id).length).toBeGreaterThan(0);
      stageSheet(stage.id).forEach(expectWellFormed);
      const test = stageTest(stage.id);
      expect(test).toHaveLength(STAGE_TEST_SIZE);
      test.forEach(expectWellFormed);
    }
  });
});

describe("scoring", () => {
  it("counts only complete answers", () => {
    const sheet = weekSheet(3);
    const answers: Record<number, Answer> = {};
    sheet.forEach((q, i) => (answers[i] = perfectAnswer(q)));
    expect(scoreSheet(sheet, answers)).toEqual({ correct: 8, answered: 8, total: 8 });

    const order = sheet.findIndex((q) => q.kind === "order");
    answers[order] = [0];
    expect(isAnswered(sheet[order]!, answers[order])).toBe(false);
    expect(scoreSheet(sheet, answers)).toEqual({ correct: 7, answered: 7, total: 8 });
  });
});
