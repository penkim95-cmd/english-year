/**
 * Persistent state. Two documents are stored on the device:
 *   progress  — course progress (start date, daily checks, scores, SRS)
 *   personal  — AI conversations, saved words, writing history, settings
 * Keys are unchanged from the first release so existing data keeps working.
 * The API key is stored separately (see ai/client.ts) and never included in backups.
 */
import { isISODate, today } from "../core/date";
import { STORAGE_KEYS, isRecord, readJson, sanitizeJson, writeJson } from "../core/storage";
import { Dictionary, MAX_SAVED_WORDS } from "../domain/dictionary";
import type { Personal, Progress, SavedWord } from "../types";

export function defaultProgress(): Progress {
  return { startDate: null, daily: {}, known: {}, scores: {}, clips: {}, srs: {}, activity: {} };
}

export function defaultPersonal(): Personal {
  return {
    friends: {},
    extra: [],
    writes: [],
    evals: [],
    rate: 0.85,
    voice: "",
    voiceMode: false,
    autoListen: true,
    profile: { name: "", about: "" },
  };
}

const PROGRESS_FIELDS = ["daily", "known", "scores", "clips", "srs", "activity"] as const;
/** Days of activity history kept on the device. */
const ACTIVITY_DAYS = 60;
const PERSONAL_OBJECT_FIELDS = ["friends", "profile"] as const;
const PERSONAL_ARRAY_FIELDS = ["writes", "evals"] as const;

/** Merges untrusted data into defaults, keeping only known fields of the right shape. */
export function normalizeProgress(raw: unknown): Progress {
  const out = defaultProgress();
  const data = sanitizeJson(raw);
  if (!isRecord(data)) return out;
  if (isISODate(data.startDate)) out.startDate = data.startDate;
  for (const f of PROGRESS_FIELDS) {
    if (isRecord(data[f])) (out as unknown as Record<string, unknown>)[f] = data[f];
  }
  return out;
}

export function normalizeSavedWord(raw: unknown): SavedWord | null {
  if (!isRecord(raw) || typeof raw.en !== "string" || !raw.en.trim()) return null;
  const str = (v: unknown, max: number) => (typeof v === "string" ? v : "").slice(0, max);
  return {
    en: raw.en.trim().slice(0, 300),
    ko: str(raw.ko, 300),
    ex: str(raw.ex, 300),
    exko: str(raw.exko, 300),
    t: str(raw.t, 60),
  };
}

export function normalizePersonal(raw: unknown): Personal {
  const out = defaultPersonal();
  const data = sanitizeJson(raw);
  if (!isRecord(data)) return out;
  for (const f of PERSONAL_OBJECT_FIELDS) {
    if (isRecord(data[f])) (out as unknown as Record<string, unknown>)[f] = data[f];
  }
  for (const f of PERSONAL_ARRAY_FIELDS) {
    if (Array.isArray(data[f])) (out as unknown as Record<string, unknown>)[f] = data[f];
  }
  if (Array.isArray(data.extra)) {
    out.extra = data.extra
      .map(normalizeSavedWord)
      .filter((w): w is SavedWord => w !== null)
      .slice(0, MAX_SAVED_WORDS);
  }
  if (typeof data.rate === "number" && data.rate >= 0.5 && data.rate <= 1.5) out.rate = data.rate;
  if (typeof data.voice === "string") out.voice = data.voice;
  if (typeof data.voiceMode === "boolean") out.voiceMode = data.voiceMode;
  if (typeof data.autoListen === "boolean") out.autoListen = data.autoListen;
  out.profile = {
    name: typeof out.profile?.name === "string" ? out.profile.name.slice(0, 30) : "",
    about: typeof out.profile?.about === "string" ? out.profile.about.slice(0, 300) : "",
  };
  return out;
}

export class Store {
  progress: Progress;
  personal: Personal;
  readonly dictionary = new Dictionary();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor() {
    this.progress = normalizeProgress(readJson(STORAGE_KEYS.progress));
    this.personal = normalizePersonal(readJson(STORAGE_KEYS.personal));
    this.personal.extra.forEach((w) => this.dictionary.registerSaved(w));
  }

  saveProgress(): void {
    writeJson(STORAGE_KEYS.progress, this.progress);
  }

  savePersonal(): void {
    // Conversations can be large; coalesce rapid saves.
    clearTimeout(this.timers.get("personal"));
    this.timers.set(
      "personal",
      setTimeout(() => writeJson(STORAGE_KEYS.personal, this.personal), 300),
    );
  }

  /** Writes pending changes immediately (before reloads and in tests). */
  flush(): void {
    clearTimeout(this.timers.get("personal"));
    writeJson(STORAGE_KEYS.personal, this.personal);
    writeJson(STORAGE_KEYS.progress, this.progress);
  }

  /** Today's activity counters. */
  activityOn(day: string): Record<string, number> {
    const counts = this.progress.activity[day];
    return counts && typeof counts === "object" ? counts : {};
  }

  /**
   * Counts something the learner did today. "max" keeps the highest value seen
   * (for totals that can be recomputed, like answered questions on a sheet).
   */
  track(kind: string, amount = 1, mode: "add" | "max" = "add"): void {
    const day = today();
    const counts = { ...this.activityOn(day) };
    const prev = typeof counts[kind] === "number" ? counts[kind] : 0;
    counts[kind] = mode === "max" ? Math.max(prev, amount) : prev + amount;
    const activity = { ...this.progress.activity, [day]: counts };
    const keep = Object.keys(activity).sort().slice(-ACTIVITY_DAYS);
    this.progress.activity = Object.fromEntries(keep.map((d) => [d, activity[d]!]));
    this.ensureStarted();
    this.saveProgress();
  }

  ensureStarted(): void {
    if (!this.progress.startDate) {
      this.progress.startDate = today();
      this.saveProgress();
    }
  }

  /** Adds words that are not in any deck yet. Returns how many were added. */
  addSavedWords(items: unknown[], topic: string): number {
    let added = 0;
    for (const item of items) {
      const word = normalizeSavedWord({ ...(isRecord(item) ? item : {}), t: topic });
      if (!word || this.dictionary.knows(word.en)) continue;
      if (this.personal.extra.length >= MAX_SAVED_WORDS) break;
      this.personal.extra.push(word);
      this.dictionary.registerSaved(word);
      added++;
    }
    if (added) this.savePersonal();
    return added;
  }

  removeSavedWord(en: string): void {
    this.personal.extra = this.personal.extra.filter((w) => w.en !== en);
    this.dictionary.removeSaved(en);
    Reflect.deleteProperty(this.progress.srs, `x:${en}`);
    this.savePersonal();
    this.saveProgress();
  }

  // ---------- Backup ----------

  exportBackup(): string {
    return JSON.stringify({
      app: "eng-year",
      at: new Date().toISOString(),
      S: this.progress,
      A: this.personal,
    });
  }

  /** Replaces state from a backup file. Throws if the file is not a valid backup. */
  importBackup(text: string): void {
    const data = sanitizeJson(JSON.parse(text));
    if (!isRecord(data) || data.app !== "eng-year" || !isRecord(data.S)) {
      throw new Error("Not an English Year backup");
    }
    this.progress = normalizeProgress(data.S);
    this.personal = normalizePersonal(data.A);
    this.personal.extra.forEach((w) => this.dictionary.registerSaved(w));
    this.flush();
  }
}
