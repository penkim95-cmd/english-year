/** Content integrity: the course data must cover all 52 weeks consistently. */
import { describe, expect, it } from "vitest";
import {
  FRIENDS,
  LESSONS,
  SCENES,
  SLANG,
  STAGES,
  TOTAL_WEEKS,
  VOCAB,
  WEEKS,
  WRITING_TASKS,
  defaultFriendFor,
  stageOf,
} from "../src/data/curriculum";

const weeks = Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1);

describe("curriculum", () => {
  it("has one lesson, title and word list per week, in order", () => {
    expect(LESSONS.map((l) => l.week)).toEqual(weeks);
    expect(WEEKS.map((w) => w.week)).toEqual(weeks);
    expect(VOCAB.map((v) => v.week)).toEqual(weeks);
  });

  it("gives every lesson 3 points with examples, drills and a tip", () => {
    for (const lesson of LESSONS) {
      expect(lesson.points).toHaveLength(3);
      for (const p of lesson.points) expect(p.examples.length).toBeGreaterThan(0);
      expect(lesson.drills.length).toBeGreaterThan(0);
      expect(lesson.tip.trim()).not.toBe("");
    }
  });

  it("gives every week 15 distinct words with examples", () => {
    for (const v of VOCAB) {
      expect(v.words).toHaveLength(15);
      expect(new Set(v.words.map((w) => w.en)).size).toBe(15);
      for (const w of v.words) expect(w.example && w.exampleKo && w.ko).toBeTruthy();
    }
  });

  it("splits the year into 4 contiguous stages", () => {
    expect(STAGES).toHaveLength(4);
    expect(STAGES[0]!.weeks[0]).toBe(1);
    expect(STAGES.at(-1)!.weeks[1]).toBe(TOTAL_WEEKS);
    STAGES.slice(1).forEach((s, i) => expect(s.weeks[0]).toBe(STAGES[i]!.weeks[1] + 1));
    for (const w of weeks) {
      const s = stageOf(w);
      expect(w).toBeGreaterThanOrEqual(s.weeks[0]);
      expect(w).toBeLessThanOrEqual(s.weeks[1]);
    }
  });

  it("uses unique ids for friends and scenes", () => {
    expect(new Set(FRIENDS.map((f) => f.id)).size).toBe(FRIENDS.length);
    expect(new Set(SCENES.map((s) => s.id)).size).toBe(SCENES.length);
    for (const s of STAGES) expect(defaultFriendFor(s.id).minStage).toBeLessThanOrEqual(s.id);
  });

  it("has slang categories, scene missions and writing tasks", () => {
    expect(SLANG.length).toBeGreaterThan(0);
    for (const c of SLANG) expect(c.items.length).toBeGreaterThan(0);
    for (const s of SCENES) expect(s.missions.length).toBeGreaterThan(0);
    expect(WRITING_TASKS.length).toBeGreaterThan(0);
  });
});
