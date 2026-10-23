import { beforeEach, describe, expect, it } from "vitest";
import { STORAGE_KEYS, sanitizeJson } from "../src/core/storage";
import { VOCAB } from "../src/data/curriculum";
import { Store, normalizePersonal, normalizeProgress } from "../src/state/store";

beforeEach(() => localStorage.clear());

describe("sanitizeJson", () => {
  it("drops functions, prototype keys and over-deep values", () => {
    let deep: unknown = "bottom";
    for (let i = 0; i < 12; i++) deep = { next: deep };
    const out = sanitizeJson(JSON.parse('{"constructor":1,"a":[1,"x",true,null]}')) as object;
    expect(out).toEqual({ a: [1, "x", true, undefined] });
    expect(JSON.stringify(sanitizeJson(deep))).not.toContain("bottom");
  });

  it("caps string length", () => {
    expect((sanitizeJson("x".repeat(9000)) as string).length).toBe(5000);
  });
});

describe("normalize", () => {
  it("keeps only known, well-typed progress fields", () => {
    const p = normalizeProgress({
      startDate: "not a date",
      daily: [],
      scores: { w1: 7 },
      extra: 1,
    });
    expect(p).toEqual({
      startDate: null,
      daily: {},
      known: {},
      scores: { w1: 7 },
      clips: {},
      srs: {},
      activity: {},
    });
  });

  it("validates saved words and settings", () => {
    const p = normalizePersonal({
      extra: [{ en: " no cap ", ko: "진짜로" }, { ko: "missing en" }, "junk"],
      rate: 9,
      voiceMode: "yes",
      profile: { name: "x".repeat(50), about: 3 },
    });
    expect(p.extra).toEqual([{ en: "no cap", ko: "진짜로", ex: "", exko: "", t: "" }]);
    expect(p.rate).toBe(0.85);
    expect(p.voiceMode).toBe(false);
    expect(p.profile).toEqual({ name: "x".repeat(30), about: "" });
  });
});

describe("Store", () => {
  it("reads data saved under the original storage keys", () => {
    localStorage.setItem(
      STORAGE_KEYS.progress,
      JSON.stringify({ startDate: "2026-01-05", srs: { "v:hello": { b: 2, d: "2026-01-09" } } }),
    );
    localStorage.setItem(
      STORAGE_KEYS.personal,
      JSON.stringify({ extra: [{ en: "rain check", ko: "다음에" }] }),
    );
    const store = new Store();
    expect(store.progress.startDate).toBe("2026-01-05");
    expect(store.progress.srs["v:hello"]).toEqual({ b: 2, d: "2026-01-09" });
    expect(store.dictionary.get("x:rain check")?.ko).toBe("다음에");
  });

  it("does not add duplicates of built-in or saved words", () => {
    const store = new Store();
    const existing = VOCAB[0]!.words[0]!.en;
    expect(store.addSavedWords([{ en: existing, ko: "dup" }], "t")).toBe(0);
    expect(store.addSavedWords([{ en: "zzz new phrase", ko: "새것" }], "t")).toBe(1);
    expect(store.addSavedWords([{ en: "zzz new phrase", ko: "again" }], "t")).toBe(0);
  });

  it("round-trips a backup without the API key", () => {
    localStorage.setItem(STORAGE_KEYS.apiKey, "sk-ant-secret");
    const store = new Store();
    store.ensureStarted();
    expect(store.addSavedWords([{ en: "zzz backup phrase", ko: "백업" }], "test")).toBe(1);
    const backup = store.exportBackup();
    expect(backup).not.toContain("sk-ant-secret");

    localStorage.clear();
    const fresh = new Store();
    fresh.importBackup(backup);
    expect(fresh.personal.extra.map((w) => w.en)).toEqual(["zzz backup phrase"]);
    expect(fresh.progress.startDate).toBe(store.progress.startDate);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.personal)!).extra).toHaveLength(1);
  });

  it("rejects files that are not backups", () => {
    const store = new Store();
    expect(() => store.importBackup('{"app":"other","S":{}}')).toThrow();
    expect(() => store.importBackup("not json")).toThrow();
  });
});
