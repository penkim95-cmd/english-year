import { describe, expect, it } from "vitest";
import { friendSystem, learnerLine, sceneSystem } from "../src/ai/prompts";
import { FRIENDS, SCENES } from "../src/data/curriculum";

const empty = { name: "", about: "" };

describe("prompts", () => {
  it("never assumes the learner's name or details", () => {
    const line = learnerLine({ week: 1, profile: empty });
    expect(line).toContain("the learner");
    expect(line).toContain("stage 1/4");
  });

  it("uses the profile the learner wrote", () => {
    const prompt = friendSystem(
      FRIENDS[0]!,
      { week: 30, profile: { name: "Sam", about: "marketer" } },
      "",
    );
    expect(prompt).toContain("texting with Sam");
    expect(prompt).toContain("(marketer)");
    expect(prompt).toContain("해석:");
  });

  it("keeps beginners on simple words in role-play", () => {
    expect(sceneSystem(SCENES[0]!, { week: 2, profile: empty })).toContain("beginner level");
    expect(sceneSystem(SCENES[0]!, { week: 40, profile: empty })).not.toContain("beginner level");
  });
});
