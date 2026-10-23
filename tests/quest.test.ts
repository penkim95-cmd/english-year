import { describe, expect, it } from "vitest";
import {
  STEP_RULES,
  TODAY_PLAN,
  buildQuest,
  kindFor,
  newlyDone,
  skipKind,
} from "../src/domain/quest";

const plan = TODAY_PLAN; // lesson, vocab, quiz, dictation, speaking, AI chat, review

describe("today's plan", () => {
  it("is seven steps from input to output, about an hour or more", () => {
    expect(plan.map((t) => t.target)).toEqual([
      "clip",
      "vocab",
      "sheet",
      "dictation",
      "speaking",
      "friend",
      "review",
    ]);
    expect(plan.reduce((m, t) => m + t.minutes, 0)).toBeGreaterThanOrEqual(60);
  });

  it("has a measurable goal for every step", () => {
    plan.forEach((task, i) => {
      expect(STEP_RULES[task.target].goal).toBeGreaterThan(0);
      expect(kindFor(task, i)).toBe(task.target);
    });
  });
});

describe("buildQuest", () => {
  it("starts with only the first step open", () => {
    const quest = buildQuest(plan, {}, { dueCount: 3 });
    expect(quest.steps.map((s) => s.state)).toEqual([
      "current",
      "locked",
      "locked",
      "locked",
      "locked",
      "locked",
      "locked",
    ]);
  });

  it("opens the next step once the goal is reached and caps progress", () => {
    const quest = buildQuest(plan, { clip: 1, vocab: 30, sheet: 3 }, { dueCount: 3 });
    expect(quest.steps.slice(0, 3).map((s) => s.state)).toEqual(["done", "done", "current"]);
    expect(quest.steps[1]!.progress).toBe(15);
    expect(quest.steps[2]).toMatchObject({ progress: 3, goal: 8 });
  });

  it("passes review when nothing is due and lets a step be skipped", () => {
    const quest = buildQuest(plan, { [skipKind(4)]: 1 }, { dueCount: 0 });
    expect(quest.steps[6]).toMatchObject({ done: true, note: "오늘은 복습할 카드가 없어요." });
    expect(quest.steps[4]).toMatchObject({ done: true, note: "오늘은 건너뛰었어요." });
    expect(quest.current?.index).toBe(0);
  });

  it("completes when every goal is met", () => {
    const all = {
      clip: 1,
      vocab: 15,
      sheet: 8,
      dictation: 10,
      speaking: 10,
      friend: 8,
      review: 10,
    };
    const quest = buildQuest(plan, all, { dueCount: 4 });
    expect(quest.complete).toBe(true);
    expect(quest.current).toBeNull();
  });
});

describe("newlyDone", () => {
  it("reports only the steps finished by the latest activity", () => {
    const before = buildQuest(plan, { clip: 1, vocab: 14 }, { dueCount: 2 });
    const after = buildQuest(plan, { clip: 1, vocab: 15 }, { dueCount: 2 });
    expect(newlyDone(before, after).map((s) => s.index)).toEqual([1]);
  });
});
