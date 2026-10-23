/**
 * Worksheet generation. Weekly sheets are built from that week's lesson and
 * vocabulary with a fixed seed, so every learner sees the same 8 questions:
 *   3 × meaning, 2 × Korean → English, 1 × listening, 2 × word order.
 */
import { seededRng, shuffle, type Rng } from "../core/random";
import { STAGE_SHEETS, STAGES, lessonOf, vocabOf } from "../data/curriculum";
import type { ChoiceQuestion, OrderQuestion, Question, VocabWord } from "../types";

export const WEEK_SHEET_SIZE = 8;
export const STAGE_TEST_SIZE = 20;
export const STAGE_TEST_PASS = 16;

/** Patterns that mark phonics examples ("cat / bed", "A → apple", "I'd like ~"). */
const NOT_A_SENTENCE = /→|\s\/\s|~/;

const wordCount = (s: string) => s.split(" ").length;

function choice<T>(
  target: T,
  pool: readonly T[],
  label: (x: T) => string,
  rng: Rng,
): { options: string[]; answerIndex: number } {
  const others = shuffle(
    pool.filter((x) => x !== target && label(x) !== label(target)),
    rng,
  ).slice(0, 2);
  const ordered = shuffle([target, ...others], rng);
  return { options: ordered.map(label), answerIndex: ordered.indexOf(target) };
}

function orderQuestion(ko: string, en: string, rng: Rng): OrderQuestion {
  const words = en.split(" ");
  let tokens = shuffle(words, rng);
  for (let k = 0; k < 5 && tokens.join(" ") === en; k++) tokens = shuffle(words, rng);
  return { kind: "order", prompt: `순서대로 눌러 "${ko}"`, tokens, answer: en, explanation: "" };
}

const cache = new Map<string, Question[]>();

function memo(key: string, build: () => Question[]): Question[] {
  let hit = cache.get(key);
  if (!hit) {
    hit = build();
    cache.set(key, hit);
  }
  return hit;
}

export function weekSheet(week: number): Question[] {
  return memo(`w${week}`, () => {
    const rng = seededRng(week * 7919 + 13);
    const words: VocabWord[] = shuffle(vocabOf(week).words, rng);
    const lesson = lessonOf(week);
    const qs: Question[] = [];

    for (let i = 0; i < 3; i++) {
      const t = words[i]!;
      const c = choice(t, words, (x) => x.ko, rng);
      qs.push({
        kind: "choice",
        prompt: `"${t.en}"의 뜻은?`,
        ...c,
        explanation: `${t.en} = ${t.ko} · 예: ${t.example}`,
        audio: t.en,
      });
    }

    const examples = shuffle(
      lesson.points
        .flatMap((p) => p.examples)
        .filter((x) => !NOT_A_SENTENCE.test(x.en) && wordCount(x.en) >= 2),
      rng,
    );
    for (let i = 0; i < 2; i++) {
      if (examples.length >= 3) {
        const t = examples[i]!;
        const c = choice(t, examples, (x) => x.en, rng);
        qs.push({
          kind: "choice",
          prompt: `"${t.ko.split("·")[0]!.trim()}"를 영어로?`,
          ...c,
          explanation: `정답: ${t.en}`,
          audio: t.en,
          audioAfterAnswer: true,
        });
      } else {
        const t = words[3 + i]!;
        const c = choice(t, words, (x) => x.en, rng);
        qs.push({
          kind: "choice",
          prompt: `"${t.ko}"를 영어로?`,
          ...c,
          explanation: `예: ${t.example} (${t.exampleKo})`,
          audio: t.en,
          audioAfterAnswer: true,
        });
      }
    }

    {
      const t = words[5]!;
      const c = choice(t, words, (x) => x.exampleKo, rng);
      qs.push({
        kind: "choice",
        prompt: "🔊 듣고 알맞은 뜻 고르기",
        ...c,
        explanation: `${t.example} = ${t.exampleKo}`,
        audio: t.example,
        listening: true,
      });
    }

    const drills = shuffle(
      lesson.drills.filter((d) => wordCount(d.en) >= 3 && wordCount(d.en) <= 9),
      rng,
    );
    const fallback = words
      .slice(6)
      .filter((x) => wordCount(x.example) >= 3 && wordCount(x.example) <= 9);
    for (let i = 0; i < 2; i++) {
      const d = drills[i] ?? { ko: fallback[i]!.exampleKo, en: fallback[i]!.example };
      qs.push(orderQuestion(d.ko, d.en, rng));
    }
    return qs;
  });
}

export function stageSheet(stageId: number): Question[] {
  return STAGE_SHEETS[String(stageId)] ?? [];
}

/** 16 multiple-choice + 4 word-order questions drawn from the stage's weekly sheets. */
export function stageTest(stageId: number): Question[] {
  return memo(`t${stageId}`, () => {
    const stage = STAGES[stageId - 1]!;
    const rng = seededRng(stageId * 104729);
    const pool: Question[] = [];
    for (let w = stage.weeks[0]; w <= stage.weeks[1]; w++) pool.push(...weekSheet(w));
    const mc = shuffle(
      pool.filter((q): q is ChoiceQuestion => q.kind === "choice"),
      rng,
    ).slice(0, 16);
    const order = shuffle(
      pool.filter((q): q is OrderQuestion => q.kind === "order"),
      rng,
    ).slice(0, 4);
    return shuffle<Question>([...mc, ...order], rng);
  });
}

/** Answer for a choice question is the picked index; for word order, the picked token indexes. */
export type Answer = number | number[];

export function isAnswered(q: Question, a: Answer | undefined): boolean {
  if (a === undefined) return false;
  return q.kind === "choice"
    ? typeof a === "number"
    : Array.isArray(a) && a.length === q.tokens.length;
}

export function isCorrect(q: Question, a: Answer | undefined): boolean {
  if (!isAnswered(q, a)) return false;
  if (q.kind === "choice") return a === q.answerIndex;
  return (a as number[]).map((i) => q.tokens[i]).join(" ") === q.answer;
}

export function scoreSheet(
  questions: readonly Question[],
  answers: Record<number, Answer>,
): { correct: number; answered: number; total: number } {
  let correct = 0;
  let answered = 0;
  questions.forEach((q, i) => {
    if (!isAnswered(q, answers[i])) return;
    answered++;
    if (isCorrect(q, answers[i])) correct++;
  });
  return { correct, answered, total: questions.length };
}
