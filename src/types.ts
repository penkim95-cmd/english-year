/**
 * Shared domain types. Content types mirror the JSON files in `src/data`;
 * state types describe what is persisted on the device.
 */

// ---------- Content ----------

export interface Example {
  en: string;
  ko: string;
}

export interface LessonPoint {
  title: string;
  explanation: string;
  examples: Example[];
}

export interface Lesson {
  week: number;
  hook: string;
  points: LessonPoint[];
  drills: Example[];
  tip: string;
}

export interface WeekInfo {
  week: number;
  title: string;
  searchQuery: string;
}

export interface VocabWord {
  en: string;
  ko: string;
  example: string;
  exampleKo: string;
}

export interface VocabWeek {
  week: number;
  words: VocabWord[];
}

export type Register = "친구끼리" | "어디서나" | "문자";

export interface SlangItem extends VocabWord {
  register: Register;
}

export interface SlangCategory {
  category: string;
  items: SlangItem[];
}

export type TaskTarget =
  | "clip"
  | "vocab"
  | "review"
  | "sheet"
  | "dictation"
  | "speaking"
  | "friend"
  | "scene"
  | "writing"
  | "voice"
  | "none";

export interface DailyTask {
  label: string;
  minutes: number;
  target: TaskTarget;
}

export interface Stage {
  id: 1 | 2 | 3 | 4;
  name: string;
  weeks: readonly [number, number];
  color: string;
  goal: string;
}

export interface Friend {
  id: string;
  name: string;
  from: string;
  flag: string;
  job: string;
  minStage: number;
  intro: string;
  color: string;
  persona: string;
  context: string;
}

export interface Scene {
  id: string;
  title: string;
  description: string;
  role: string;
  minStage: number;
  missions: string[];
}

export interface WritingTask {
  title: string;
  minStage: number;
}

// ---------- Worksheets ----------

export interface ChoiceQuestion {
  kind: "choice";
  prompt: string;
  options: string[];
  answerIndex: number;
  explanation: string;
  /** Text to read aloud for this question. */
  audio?: string;
  /** Hide the audio button until the question is answered. */
  audioAfterAnswer?: boolean;
  /** Listening question: the audio is the question itself. */
  listening?: boolean;
}

export interface OrderQuestion {
  kind: "order";
  prompt: string;
  tokens: string[];
  answer: string;
  explanation: string;
}

export type Question = ChoiceQuestion | OrderQuestion;

// ---------- Persisted state ----------

/** Spaced-repetition record: box 0-5 and the next due date (YYYY-MM-DD). */
export interface SrsRecord {
  b: number;
  d: string;
}

export interface Progress {
  startDate: string | null;
  /** Week the course started at, chosen by the level check (absent = not measured yet). */
  startWeek?: number;
  /** YYYY-MM-DD → checked flags for that day's tasks. */
  daily: Record<string, boolean[]>;
  known: Record<string, 1>;
  /** Best scores keyed by worksheet id (w12, s2, t3, d5, p5). */
  scores: Record<string, number>;
  clips: Record<string, boolean>;
  srs: Record<string, SrsRecord>;
  /** YYYY-MM-DD → how much of each activity was done that day (drives the daily quest). */
  activity: Record<string, Record<string, number>>;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface FriendThread {
  msgs: ChatMessage[];
  memo: string;
  /** User messages since the memo was last refreshed. */
  since: number;
}

export interface SavedWord {
  en: string;
  ko: string;
  ex: string;
  exko: string;
  /** Topic or source label. */
  t: string;
}

export interface WritingRecord {
  d: string;
  task: string;
  src: string;
  out: string;
}

export interface EvaluationRecord {
  d: string;
  key: string;
  score: number;
}

export interface Profile {
  name: string;
  about: string;
}

export interface Personal {
  friends: Record<string, FriendThread>;
  extra: SavedWord[];
  writes: WritingRecord[];
  evals: EvaluationRecord[];
  rate: number;
  voice: string;
  voiceMode: boolean;
  autoListen: boolean;
  profile: Profile;
}
