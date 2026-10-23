/**
 * Today's quest: the stage's daily tasks as an ordered list of steps.
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
  | `manual${number}`;

export type Activity = Partial<Record<string, number>>;

interface StepRule {
  goal: number;
  unit: string;
  /** Where to go and what exactly to do. */
  how: string;
}

export const STEP_RULES: Record<TaskTarget, StepRule> = {
  clip: {
    goal: 1,
    unit: "편",
    how: "이번 주 레슨 클립을 끝까지 보고 마지막 장의 '다 봤어요'를 누르세요.",
  },
  vocab: {
    goal: 15,
    unit: "장",
    how: "단어장 → 주차별 단어에서 카드를 '알아요/몰라요'로 넘기세요.",
  },
  review: {
    goal: 10,
    unit: "장",
    how: "단어장 → 복습에서 오늘 다시 볼 카드를 넘기세요. 복습할 카드가 없으면 바로 통과예요.",
  },
  sheet: { goal: 8, unit: "문제", how: "학습지 → 주차별에서 이번 주 8문제를 모두 푸세요." },
  dictation: { goal: 10, unit: "문장", how: "학습지 → 받아쓰기에서 듣고 쓴 뒤 '확인'을 누르세요." },
  speaking: { goal: 10, unit: "번", how: "학습지 → 따라 말하기에서 듣고 🎤로 따라 말하세요." },
  friend: {
    goal: 6,
    unit: "번",
    how: "AI 대화 → AI 친구에게 메시지를 보내세요. 한국어로 써도 돼요.",
  },
  scene: { goal: 6, unit: "번", how: "AI 대화 → 상황 연습에서 미션을 보며 대화하세요." },
  writing: {
    goal: 1,
    unit: "번",
    how: "AI 대화 → 쓰기 첨삭에서 글을 쓰고 '첨삭 받기'를 누르세요.",
  },
  voice: { goal: 5, unit: "번", how: "AI 대화 → 음성 대화 모드를 켜고 말로 대화하세요." },
  none: { goal: 1, unit: "번", how: "앱 밖에서 하는 공부예요. 하고 나서 '했어요'를 눌러 주세요." },
};

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
    if (task.target === "review" && !done && dueCount === 0) {
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
