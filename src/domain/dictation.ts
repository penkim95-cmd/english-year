/**
 * Listening (dictation) and speaking (shadowing) practice share one sentence
 * set per week and one scorer: a word-level longest-common-subsequence match
 * that ignores case and punctuation.
 */
import { seededRng, shuffle } from "../core/random";
import { lessonOf, vocabOf } from "../data/curriculum";
import type { Example } from "../types";

export const SENTENCES_PER_WEEK = 10;

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9' ]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export interface Comparison {
  /** Display words of the target sentence. */
  words: string[];
  /** Indexes of target words that the attempt matched. */
  hit: Set<number>;
  /** Attempt equals the target after normalization. */
  exact: boolean;
  /** Matched share of target words, 0-100. */
  accuracy: number;
}

export function compare(target: string, attempt: string): Comparison {
  const a = tokenize(target);
  const g = tokenize(attempt);
  const n = a.length;
  const m = g.length;
  const t: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      t[i]![j] = a[i] === g[j] ? t[i + 1]![j + 1]! + 1 : Math.max(t[i + 1]![j]!, t[i]![j + 1]!);
    }
  }
  const hit = new Set<number>();
  for (let i = 0, j = 0; i < n && j < m;) {
    if (a[i] === g[j]) {
      hit.add(i);
      i++;
      j++;
    } else if (t[i + 1]![j]! >= t[i]![j + 1]!) i++;
    else j++;
  }
  return {
    words: target.split(/\s+/),
    hit,
    exact: a.join(" ") === g.join(" "),
    accuracy: Math.round((100 * hit.size) / Math.max(1, n)),
  };
}

const cache = new Map<number, Example[]>();

/** Ten 3-12 word sentences from the week's lesson examples, drills and vocabulary. */
export function sentencesFor(week: number): Example[] {
  const hit = cache.get(week);
  if (hit) return hit;
  const seen = new Set<string>();
  const out: Example[] = [];
  const add = (en: string, ko: string) => {
    const n = tokenize(en).length;
    if (n < 3 || n > 12 || /→|\s\/\s|~/.test(en) || seen.has(en)) return;
    seen.add(en);
    out.push({ en, ko });
  };
  const lesson = lessonOf(week);
  lesson.points.forEach((p) => p.examples.forEach((x) => add(x.en, x.ko.split("·")[0]!.trim())));
  lesson.drills.forEach((d) => add(d.en, d.ko));
  vocabOf(week).words.forEach((w) => add(w.example, w.exampleKo));
  const set = shuffle(out, seededRng(week * 31337)).slice(0, SENTENCES_PER_WEEK);
  cache.set(week, set);
  return set;
}
