/**
 * Today's study: a fixed sequence of seven steps done on the home screen,
 * with this week's content (input → memory → output → review).
 *
 * Each step has a measurable goal counted from what the learner actually did
 * today (cards answered, questions solved, messages sent...). Steps unlock in
 * order: the first unfinished step is the current one, later unfinished steps
 * stay locked. Work done ahead of time still counts, so a later step can
 * already be complete when it unlocks.
 */
import type { DailyTask, TaskTarget } from "../types";

/** What the app counts per day. "manual<n>" marks a step the learner confirmed by hand. */
export type ActivityKind =
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
  | `manual${number}`
  | `skip${number}`;

export type Activity = Partial<Record<string, number>>;

interface StepRule {
  goal: number;
  unit: string;
  /** Where to go and what exactly to do. */
  how: string;
}

export const STEP_RULES: Record<TaskTarget, StepRule> = {
  clip: { goal: 1, unit: "번", how: "이번 주 핵심 표현 3개를 배우고 예문을 소리 내 따라 읽어요." },
  vocab: { goal: 15, unit: "장", how: "카드를 눌러 뜻을 보고 '알아요/몰라요'로 넘겨요." },
  review: { goal: 10, unit: "장", how: "다시 볼 때가 된 카드를 넘겨요. 없으면 바로 통과예요." },
  sheet: { goal: 8, unit: "문제", how: "이번 주 표현으로 8문제를 풀어요." },
  dictation: {
    goal: 10,
    unit: "문장",
    how: "🔊로 듣고 들린 영어를 써요. 틀린 단어는 빨갛게 보여요.",
  },
  speaking: { goal: 10, unit: "문장", how: "🔊로 듣고 🎤를 눌러 똑같이 따라 말해요." },
  friend: {
    goal: 8,
    unit: "번",
    how: "AI 친구에게 영어로 메시지를 보내요. 막히면 '뭐라고 말하지?'를 누르세요.",
  },
  scene: { goal: 6, unit: "번", how: "AI 대화 → 상황 연습에서 미션을 보며 대화하세요." },
  writing: {
    goal: 1,
    unit: "번",
    how: "AI 대화 → 쓰기 첨삭에서 글을 쓰고 '첨삭 받기'를 누르세요.",
  },
  voice: { goal: 5, unit: "번", how: "AI 대화 → 음성 대화 모드를 켜고 말로 대화하세요." },
  none: { goal: 1, unit: "번", how: "하고 나서 '했어요'를 눌러 주세요." },
};

/** The same seven steps every day; the content comes from the current week. */
export const TODAY_PLAN: readonly DailyTask[] = [
  { label: "레슨: 이번 주 핵심 표현 배우기", minutes: 10, target: "clip" },
  { label: "단어 15개 외우기", minutes: 15, target: "vocab" },
  { label: "문제 8개 풀기", minutes: 10, target: "sheet" },
  { label: "듣고 받아쓰기 10문장", minutes: 10, target: "dictation" },
  { label: "따라 말하기 10문장", minutes: 10, target: "speaking" },
  { label: "AI 친구와 영어로 대화 8번", minutes: 15, target: "friend" },
  { label: "복습 카드 정리", minutes: 5, target: "review" },
];

export type StepState = "done" | "current" | "locked";

export interface QuestStep {
  /** 0-based position in today's list. */
  index: number;
  label: string;
  minutes: number;
  target: TaskTarget;
  how: string;
  unit: string;
  goal: number;
  /** Counted progress, capped at the goal. */
  progress: number;
  done: boolean;
  state: StepState;
  /** Set when a step passes without work (e.g. nothing to review today). */
  note?: string;
}

export interface Quest {
  steps: QuestStep[];
  doneCount: number;
  complete: boolean;
  current: QuestStep | null;
}

export const manualKind = (index: number): ActivityKind => `manual${index}`;
/** Marks a step the learner chose to skip today (e.g. no microphone or no API key). */
export const skipKind = (index: number): ActivityKind => `skip${index}`;

/** Counter that measures a step. */
export function kindFor(task: DailyTask, index: number): ActivityKind {
  return task.target === "none" ? manualKind(index) : task.target;
}

export function buildQuest(
  tasks: readonly DailyTask[],
  activity: Activity,
  { dueCount }: { dueCount: number },
): Quest {
  const steps = tasks.map((task, index): QuestStep => {
    const rule = STEP_RULES[task.target];
    const count = activity[kindFor(task, index)] ?? 0;
    let done = count >= rule.goal;
    let note: string | undefined;
    if (!done && (activity[skipKind(index)] ?? 0) > 0) {
      done = true;
      note = "오늘은 건너뛰었어요.";
    } else if (task.target === "review" && !done && dueCount === 0) {
      done = true;
      note = count ? "오늘 복습 끝!" : "오늘은 복습할 카드가 없어요.";
    }
    const step: QuestStep = {
      index,
      label: task.label,
      minutes: task.minutes,
      target: task.target,
      how: rule.how,
      unit: rule.unit,
      goal: rule.goal,
      progress: Math.min(count, rule.goal),
      done,
      state: "locked",
      ...(note ? { note } : {}),
    };
    return step;
  });
  const current = steps.find((s) => !s.done) ?? null;
  for (const step of steps)
    step.state = step.done ? "done" : step === current ? "current" : "locked";
  const doneCount = steps.filter((s) => s.done).length;
  return { steps, doneCount, complete: doneCount === steps.length, current };
}

/** Steps finished by the latest activity: done now, not done before. */
export function newlyDone(before: Quest, after: Quest): QuestStep[] {
  return after.steps.filter((s, i) => s.done && !before.steps[i]?.done);
}
