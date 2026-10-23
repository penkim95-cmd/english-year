import { describe, expect, it } from "vitest";
import { parseJsonLoose, parseReply } from "../src/ai/parse";

describe("parseReply", () => {
  it("splits the English message, translation and correction", () => {
    const reply = parseReply(
      "Oh nice! What do you do?\n해석: 오 좋다! 무슨 일 해?\n교정: I am a marketer. (a를 붙여요)",
    );
    expect(reply).toEqual({
      main: "Oh nice! What do you do?",
      translation: "오 좋다! 무슨 일 해?",
      correction: "I am a marketer. (a를 붙여요)",
    });
  });

  it("treats text without markers as the main message", () => {
    expect(parseReply("Hi there!")).toEqual({ main: "Hi there!", translation: "", correction: "" });
  });
});

describe("parseJsonLoose", () => {
  it("reads bare JSON, fenced JSON and JSON surrounded by prose", () => {
    expect(parseJsonLoose('{"a":1}')).toEqual({ a: 1 });
    expect(parseJsonLoose('Here:\n```json\n[{"en":"hi"}]\n```')).toEqual([{ en: "hi" }]);
    expect(parseJsonLoose('Sure! {"score": 80} Hope it helps.')).toEqual({ score: 80 });
  });

  it("returns undefined when nothing parses", () => {
    expect(parseJsonLoose("no json here")).toBeUndefined();
  });

  it("strips prototype-polluting keys", () => {
    const value = parseJsonLoose('{"__proto__":{"polluted":true},"ok":1}') as Record<
      string,
      unknown
    >;
    expect(value).toEqual({ ok: 1 });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});
