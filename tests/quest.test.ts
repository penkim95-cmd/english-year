import { describe, expect, it } from "vitest";
import { STAGES } from "../src/data/curriculum";
import { STEP_RULES, buildQuest, kindFor, manualKind, newlyDone } from "../src/domain/quest";

const stage1 = STAGES[0]!.daily; // clip, vocab, sheet, review, none

describe("buildQuest", () => {
  it("starts with only the first step open", () => {
    const quest = buildQuest(stage1, {}, { dueCount: 3 });
    expect(quest.steps.map((s) => s.state)).toEqual([
      "current",
      "locked",
      "locked",
      "locked",
      "locked",
    ]);
    expect(quest.current?.index).toBe(0);
    expect(quest.doneCount).toBe(0);
  });

  it("opens the next step once the goal is reached", () => {
    const quest = buildQuest(stage1, { clip: 1, vocab: 7 }, { dueCount: 3 });
    expect(quest.steps.map((s) => s.state)).toEqual([
      "done",
      "current",
      "locked",
      "locked",
      "locked",
    ]);
    expect(quest.steps[1]).toMatchObject({ progress: 7, goal: 15 });
  });

  it("caps progress at the goal and keeps work done ahead of time", () => {
    const quest = buildQuest(stage1, { clip: 1, vocab: 30, sheet: 8 }, { dueCount: 3 });
    expect(quest.steps[1]!.progress).toBe(15);
    expect(quest.steps[2]!.state).toBe("done");
    expect(quest.current?.target).toBe("review");
  });

  it("passes the review step when nothing is due", () => {
    const quest = buildQuest(stage1, {}, { dueCount: 0 });
    expect(quest.steps[3]).toMatchObject({ done: true, note: "오늘은 복습할 카드가 없어요." });
    expect(quest.current?.index).toBe(0);
  });

  it("needs a manual confirmation for off-app tasks", () => {
    const all = { clip: 1, vocab: 15, sheet: 8, review: 10 };
    expect(buildQuest(stage1, all, { dueCount: 5 }).complete).toBe(false);
    const quest = buildQuest(stage1, { ...all, [manualKind(4)]: 1 }, { dueCount: 5 });
    expect(quest.complete).toBe(true);
    expect(quest.current).toBeNull();
  });

  it("has a rule and a measurable counter for every daily task of every stage", () => {
    for (const stage of STAGES) {
      stage.daily.forEach((task, i) => {
        expect(STEP_RULES[task.target].goal).toBeGreaterThan(0);
        expect(kindFor(task, i)).toBeTruthy();
      });
    }
  });
});

describe("newlyDone", () => {
  it("reports only the steps finished by the latest activity", () => {
    const before = buildQuest(stage1, { clip: 1, vocab: 14 }, { dueCount: 2 });
    const after = buildQuest(stage1, { clip: 1, vocab: 15 }, { dueCount: 2 });
    expect(newlyDone(before, after).map((s) => s.index)).toEqual([1]);
  });
});
