import { describe, expect, it } from "vitest";
import { TOTAL_WEEKS } from "../src/data/curriculum";
import { SENTENCES_PER_WEEK, compare, sentencesFor, tokenize } from "../src/domain/dictation";

describe("tokenize", () => {
  it("ignores case, punctuation and curly apostrophes", () => {
    expect(tokenize("I’m FINE, thanks!")).toEqual(["i'm", "fine", "thanks"]);
  });
});

describe("compare", () => {
  it("accepts an exact answer regardless of punctuation", () => {
    const r = compare("Nice to meet you.", "nice to meet you");
    expect(r.exact).toBe(true);
    expect(r.accuracy).toBe(100);
  });

  it("marks matched words with a longest-common-subsequence alignment", () => {
    const r = compare("I would like a coffee", "I like coffee please");
    expect(r.exact).toBe(false);
    expect([...r.hit]).toEqual([0, 2, 4]);
    expect(r.accuracy).toBe(60);
  });

  it("scores an empty attempt as zero", () => {
    expect(compare("Hello there friend", "").accuracy).toBe(0);
  });
});

describe("sentencesFor", () => {
  it("returns a stable set of 3-12 word sentences for every week", () => {
    for (let week = 1; week <= TOTAL_WEEKS; week++) {
      const set = sentencesFor(week);
      expect(set.length).toBeGreaterThan(0);
      expect(set.length).toBeLessThanOrEqual(SENTENCES_PER_WEEK);
      for (const s of set) {
        const n = tokenize(s.en).length;
        expect(n).toBeGreaterThanOrEqual(3);
        expect(n).toBeLessThanOrEqual(12);
      }
      expect(sentencesFor(week)).toBe(set);
    }
  });
});
