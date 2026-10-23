/**
 * Level check: 12 questions of rising difficulty, each tied to the week that
 * teaches it. The course starts at the first level the learner has not shown
 * yet — answering n questions right starts at the week of question n+1.
 */
import { TOTAL_WEEKS } from "../data/curriculum";

export interface PlacementQuestion {
  prompt: string;
  options: string[];
  answerIndex: number;
  /** Week of the course that teaches this. */
  week: number;
}

export const PLACEMENT: readonly PlacementQuestion[] = [
  { week: 1, prompt: '"cat"의 뜻은?', options: ["고양이", "모자", "자동차"], answerIndex: 0 },
  { week: 4, prompt: "I ___ a student.", options: ["is", "am", "are"], answerIndex: 1 },
  {
    week: 5,
    prompt: '"그녀는 커피를 좋아해요."',
    options: ["She like coffee.", "She liking coffee.", "She likes coffee."],
    answerIndex: 2,
  },
  { week: 6, prompt: "___ you have a car?", options: ["Do", "Are", "Does"], answerIndex: 0 },
  {
    week: 8,
    prompt: '"어제 친구를 만났어요."',
    options: [
      "I meet my friend yesterday.",
      "I met my friend yesterday.",
      "I meeting my friend yesterday.",
    ],
    answerIndex: 1,
  },
  {
    week: 9,
    prompt: '카페에서 "아이스 라떼 주세요."',
    options: ["I'd like an iced latte, please.", "I like iced latte.", "Give me iced latte now."],
    answerIndex: 0,
  },
  { week: 10, prompt: "___ you help me, please?", options: ["Did", "Could", "Am"], answerIndex: 1 },
  {
    week: 13,
    prompt: "How about ___ a movie tonight?",
    options: ["watch", "watched", "watching"],
    answerIndex: 2,
  },
  {
    week: 15,
    prompt: "I'm going to ___ Japan next month.",
    options: ["visit", "visiting", "visited"],
    answerIndex: 0,
  },
  {
    week: 18,
    prompt: "Have you ever ___ sushi?",
    options: ["try", "tried", "trying"],
    answerIndex: 1,
  },
  {
    week: 25,
    prompt: '입국심사 "What\'s the purpose of your visit?"에 알맞은 대답은?',
    options: ["I'm a purpose.", "Yes, I visit.", "I'm here on vacation."],
    answerIndex: 2,
  },
  {
    week: 31,
    prompt: '"So, what do you do?"의 뜻은?',
    options: ["무슨 일 하세요?", "지금 뭐 해요?", "뭘 할까요?"],
    answerIndex: 0,
  },
];

/** Week to start at when every question is right (business English). */
export const TOP_START_WEEK = 41;

/** Start week from the number of correct answers. */
export function placementWeek(correct: number): number {
  const next = PLACEMENT[correct];
  return Math.min(TOTAL_WEEKS, next ? next.week : TOP_START_WEEK);
}

export function countCorrect(answers: readonly number[]): number {
  return answers.filter((a, i) => PLACEMENT[i]?.answerIndex === a).length;
}
