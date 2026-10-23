/** Screen state that is not persisted (current tab, open panels, drafts, in-flight requests). */
import type { Comparison } from "../domain/dictation";
import type { Answer } from "../domain/worksheets";
import type { ChatMessage, Example, Question } from "../types";

export type Tab = "home" | "plan" | "sheet" | "vocab" | "chat";
export type SheetMode = "week" | "stage" | "test" | "dictation" | "speaking" | "ai";
export type VocabMode = "week" | "review" | "slang" | "mine";
export type ChatMode = "friend" | "scene" | "writing";

export interface Evaluation {
  score: number;
  missions: { goal: string; done: boolean }[];
  good: string;
  fixes: { orig: string; better: string; why: string }[];
  next: string;
}

export type FeedbackState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "done"; result: Evaluation };

export interface UiState {
  tab: Tab;
  planWeek: number | null;

  sheetMode: SheetMode;
  sheetWeek: number | null;
  sheetStage: number | null;
  answers: Record<string, Record<number, Answer>>;
  aiSheet: { topic: string; questions: Question[] } | null;
  generating: boolean;
  generateError: string;
  dictation: {
    week: number;
    index: number;
    results: boolean[];
    input: string;
    checked: boolean;
    hint: boolean;
  } | null;
  speaking: {
    week: number;
    index: number;
    best: Record<number, number>;
    result: (Comparison & { heard: string }) | null;
  } | null;

  vocabMode: VocabMode;
  vocabWeek: number | null;
  slangCategory: number;
  queue: string[];
  queueId: string;
  flipped: boolean;
  wordTopic: number;
  wordBusy: boolean;
  wordError: string;

  chatMode: ChatMode;
  friendId: string | null;
  sceneId: string;
  sceneLogs: Record<string, ChatMessage[]>;
  draft: string;
  busy: boolean;
  hints: Example[] | null;
  hinting: boolean;
  chatError: string;
  feedback: Record<string, FeedbackState>;
  clearConfirm: string | null;

  writingTask: number | null;
  writingDraft: string;
  writingBusy: boolean;
  writingOut: string;
  writingError: string;

  profileMessage: string;
  testing: boolean;
  testMessage: string;
  backupMessage: string;
}

export function initialUi(tab: Tab): UiState {
  return {
    tab,
    planWeek: null,
    sheetMode: "week",
    sheetWeek: null,
    sheetStage: null,
    answers: {},
    aiSheet: null,
    generating: false,
    generateError: "",
    dictation: null,
    speaking: null,
    vocabMode: "week",
    vocabWeek: null,
    slangCategory: 0,
    queue: [],
    queueId: "",
    flipped: false,
    wordTopic: 0,
    wordBusy: false,
    wordError: "",
    chatMode: "friend",
    friendId: null,
    sceneId: "intro",
    sceneLogs: {},
    draft: "",
    busy: false,
    hints: null,
    hinting: false,
    chatError: "",
    feedback: {},
    clearConfirm: null,
    writingTask: null,
    writingDraft: "",
    writingBusy: false,
    writingOut: "",
    writingError: "",
    profileMessage: "",
    testing: false,
    testMessage: "",
    backupMessage: "",
  };
}

export const TABS: readonly { id: Tab; label: string; icon: string }[] = [
  {
    id: "home",
    label: "오늘",
    icon: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  },
  {
    id: "plan",
    label: "1년 플랜",
    icon: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  },
  { id: "sheet", label: "학습지", icon: '<path d="M6 3h9l4 4v14H6z"/><path d="M9 12h7M9 16h5"/>' },
  {
    id: "vocab",
    label: "단어장",
    icon: '<rect x="4" y="4" width="13" height="16" rx="3"/><path d="M8 4v16"/><path d="M20 7v13"/>',
  },
  { id: "chat", label: "AI 대화", icon: '<path d="M4 5h16v11H9l-5 4z"/>' },
];

export function isTab(value: string): value is Tab {
  return TABS.some((t) => t.id === value);
}
