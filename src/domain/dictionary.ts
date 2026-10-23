/**
 * One lookup table for every flashcard in the app, keyed by source:
 *   v:<en>  weekly vocabulary   s:<en>  slang   x:<en>  words the learner saved
 */
import { daysBetween, type ISODate } from "../core/date";
import { SLANG, VOCAB } from "../data/curriculum";
import type { Register, SavedWord, SrsRecord } from "../types";
import { isDue, isMastered } from "./srs";

export interface Card {
  key: string;
  en: string;
  ko: string;
  example: string;
  exampleKo: string;
  week?: number;
  tag?: string;
  register?: Register;
}

export const MAX_SAVED_WORDS = 3000;

export const vocabKey = (en: string) => `v:${en}`;
export const slangKey = (en: string) => `s:${en}`;
export const savedKey = (en: string) => `x:${en}`;

export class Dictionary {
  private readonly cards = new Map<string, Card>();

  constructor() {
    for (const week of VOCAB) {
      for (const w of week.words) {
        this.cards.set(vocabKey(w.en), {
          key: vocabKey(w.en),
          en: w.en,
          ko: w.ko,
          example: w.example,
          exampleKo: w.exampleKo,
          week: week.week,
        });
      }
    }
    for (const cat of SLANG) {
      for (const s of cat.items) {
        this.cards.set(slangKey(s.en), {
          key: slangKey(s.en),
          en: s.en,
          ko: s.ko,
          example: s.example,
          exampleKo: s.exampleKo,
          tag: s.register,
          register: s.register,
        });
      }
    }
  }

  get(key: string): Card | undefined {
    return this.cards.get(key);
  }

  has(key: string): boolean {
    return this.cards.has(key);
  }

  /** True if the phrase already exists in any deck. */
  knows(en: string): boolean {
    return this.has(vocabKey(en)) || this.has(slangKey(en)) || this.has(savedKey(en));
  }

  registerSaved(word: SavedWord): void {
    this.cards.set(savedKey(word.en), {
      key: savedKey(word.en),
      en: word.en,
      ko: word.ko,
      example: word.ex,
      exampleKo: word.exko,
      tag: word.t,
    });
  }

  removeSaved(en: string): void {
    this.cards.delete(savedKey(en));
  }

  slangKeys(): string[] {
    return [...this.cards.keys()].filter((k) => k.startsWith("s:"));
  }
}

export function learnedCount(dict: Dictionary, srs: Record<string, SrsRecord>): number {
  return Object.keys(srs).filter((k) => dict.has(k) && isMastered(srs[k])).length;
}

export function dueKeys(
  dict: Dictionary,
  srs: Record<string, SrsRecord>,
  today: ISODate,
): string[] {
  return Object.keys(srs).filter((k) => dict.has(k) && isDue(srs[k], today));
}

/** A different slang card every day, stable for the whole day. */
export function slangOfTheDay(dict: Dictionary, today: ISODate): Card {
  const keys = dict.slangKeys();
  const day = daysBetween("1970-01-01", today);
  return dict.get(keys[((day % keys.length) + keys.length) % keys.length]!)!;
}
