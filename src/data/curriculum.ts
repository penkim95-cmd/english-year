/**
 * Curriculum structure: stages, AI partners, role-play scenes and writing tasks.
 * Week-level content (lessons, vocabulary, slang) lives in the JSON files next to this one.
 */
import type { Friend, Scene, Stage, WritingTask } from "../types";
import lessonsJson from "./lessons.json";
import slangJson from "./slang.json";
import stageSheetsJson from "./stage-sheets.json";
import vocabJson from "./vocab.json";
import weeksJson from "./weeks.json";
import type { Lesson, Question, SlangCategory, VocabWeek, WeekInfo } from "../types";

export const TOTAL_WEEKS = 52;

export const LESSONS = lessonsJson as Lesson[];
export const WEEKS = weeksJson as WeekInfo[];
export const VOCAB = vocabJson as VocabWeek[];
export const SLANG = slangJson as SlangCategory[];
export const STAGE_SHEETS = stageSheetsJson as Record<string, Question[]>;

export const STAGES: readonly Stage[] = [
  {
    id: 1,
    name: "기초 다지기",
    weeks: [1, 8],
    color: "var(--s1)",
    goal: "철자를 보고 소리 내기, 기초 단어 500개, 주어+동사 문장",
  },
  {
    id: 2,
    name: "입 트기",
    weeks: [9, 24],
    color: "var(--s2)",
    goal: "회화 패턴 100개, 쉐도잉 습관, AI와 매일 대화",
  },
  {
    id: 3,
    name: "실전 대화",
    weeks: [25, 40],
    color: "var(--s3)",
    goal: "여행 상황 대화, 처음 만난 사람과 스몰토크, 친구 사귀기",
  },
  {
    id: 4,
    name: "비즈니스 입문",
    weeks: [41, 52],
    color: "var(--s4)",
    goal: "마케팅·컨설팅 기본 용어, 이메일, 회의, 짧은 발표",
  },
];

export const FRIENDS: readonly Friend[] = [
  {
    id: "jake",
    name: "Jake",
    from: "미국 오스틴",
    flag: "🇺🇸",
    job: "바리스타·기타리스트, 29",
    minStage: 1,
    intro: "느긋하고 친절해요. 커피·음악·여행 이야기를 좋아해요. 첫 친구로 딱 좋아요.",
    color: "#F5A524",
    persona:
      "Jake, 29, a barista and part-time guitarist in Austin, Texas. Laid-back and funny. Loves live music, BBQ, coffee and road trips. Has never been to Korea but loves Korean BBQ.",
    context: "you just met them at your coffee shop while they were traveling",
  },
  {
    id: "emma",
    name: "Emma",
    from: "호주 멜버른",
    flag: "🇦🇺",
    job: "간호사·한국어 공부 중, 31",
    minStage: 2,
    intro: "한국어를 배우는 언어교환 친구예요. K드라마 팬이고 내년에 서울 여행을 준비해요.",
    color: "#14A391",
    persona:
      "Emma, 31, a nurse in Melbourne, Australia. She is learning Korean, loves K-dramas, coffee and travel, and is planning a trip to Seoul next year. Sometimes she asks how to say simple things in Korean.",
    context: "you just matched with them on a language exchange app",
  },
  {
    id: "carlos",
    name: "Carlos",
    from: "스페인 바르셀로나",
    flag: "🇪🇸",
    job: "투어 가이드, 30",
    minStage: 3,
    intro:
      "여행자와 어울리기 좋아하는 가이드예요. 여행 꿀팁·음식·축구 이야기, 같이 놀자는 약속도 잡아요.",
    color: "#4C80EA",
    persona:
      "Carlos, 30, a tour guide in Barcelona. English is his second language but he speaks it well. Loves football, tapas and meeting travelers. Gives travel tips and likes to invite people to hang out.",
    context: "you just met them at a hostel bar in Barcelona",
  },
  {
    id: "sophie",
    name: "Sophie",
    from: "영국 런던",
    flag: "🇬🇧",
    job: "뷰티 브랜드 마케팅 매니저, 36",
    minStage: 4,
    intro: "같은 마케터로 네트워킹하는 동료예요. 캠페인·SNS 트렌드·직장 이야기를 나눠요.",
    color: "#8565DA",
    persona:
      "Sophie, 36, a marketing manager at a beauty brand in London. Professional but warm. Talks about campaigns, social media trends, KPIs and work life. She is networking with a fellow marketer.",
    context: "you just connected with them on LinkedIn after a marketing webinar",
  },
  {
    id: "daniel",
    name: "Daniel",
    from: "미국 뉴욕",
    flag: "🇺🇸",
    job: "스킨케어 스타트업 대표(고객), 45",
    minStage: 4,
    intro: "마케팅 컨설팅을 의뢰하려는 고객이에요. 전략·예산·결과를 직접적으로 물어봐요.",
    color: "#D9534F",
    persona:
      "Daniel Reed, 45, CEO of a small skincare startup in New York. A potential client who wants marketing consulting to grow in the US and enter Korea. Busy, direct and polite. Asks practical questions about strategy, budget, timeline and results.",
    context: "you emailed them to set up a first video call about a consulting project",
  },
];

export const SCENES: readonly Scene[] = [
  {
    id: "intro",
    title: "자기소개",
    description: "처음 만난 외국인 친구",
    role: "a friendly traveler you just met at a hostel",
    minStage: 1,
    missions: ["이름과 출신 말하기", "하는 일이나 취미 말하기", "상대에게 질문 1개 하기"],
  },
  {
    id: "cafe",
    title: "카페 주문",
    description: "바리스타와 대화",
    role: "a barista at a coffee shop",
    minStage: 1,
    missions: ["음료 주문하기", "사이즈나 옵션 말하기", "계산 방법 말하기"],
  },
  {
    id: "airport",
    title: "공항·입국심사",
    description: "입국심사관",
    role: "an immigration officer at the airport",
    minStage: 2,
    missions: ["방문 목적 말하기", "머무는 기간·숙소 말하기", "질문에 끝까지 대답하기"],
  },
  {
    id: "hotel",
    title: "호텔 체크인",
    description: "호텔 직원",
    role: "a hotel front desk staff member",
    minStage: 2,
    missions: [
      "예약자 이름으로 체크인하기",
      "요청 1개 하기(수건·와이파이 등)",
      "체크아웃 시간 묻기",
    ],
  },
  {
    id: "friend",
    title: "친구 사귀기",
    description: "바에서 만난 현지인",
    role: "a local person you meet at a bar who is curious about Korea",
    minStage: 2,
    missions: ["자기소개 하기", "공통 관심사 찾기", "연락처 묻거나 약속 잡기"],
  },
  {
    id: "directions",
    title: "길 묻기",
    description: "길 가던 현지인",
    role: "a local person on the street",
    minStage: 2,
    missions: ["목적지 가는 길 묻기", "거리나 걸리는 시간 묻기", "못 알아들은 부분 다시 묻기"],
  },
  {
    id: "meeting",
    title: "비즈니스 미팅",
    description: "해외 고객과 첫 미팅",
    role: "a potential client from a foreign company in a first meeting",
    minStage: 3,
    missions: ["회사와 역할 소개하기", "고객 상황 질문 2개 하기", "다음 단계 제안하기"],
  },
  {
    id: "marketing",
    title: "마케팅 회의",
    description: "캠페인 아이디어 논의",
    role: "a marketing manager discussing a new social media campaign",
    minStage: 3,
    missions: [
      "캠페인 아이디어 1개 제안하기",
      "근거(데이터·고객) 말하기",
      "상대 의견에 동의나 반대 표현하기",
    ],
  },
];

export const WRITING_TASKS: readonly WritingTask[] = [
  { title: "나를 소개하는 3문장", minStage: 1 },
  { title: "어제 한 일 3문장", minStage: 1 },
  { title: "이번 주말 계획 3문장", minStage: 2 },
  { title: "좋아하는 영화나 음식 소개 3문장", minStage: 2 },
  { title: "외국인 친구에게 보내는 안부 메시지", minStage: 2 },
  { title: "호텔에 늦은 체크인을 요청하는 짧은 이메일", minStage: 3 },
  { title: "여행에서 있었던 일 이야기 5문장", minStage: 3 },
  { title: "고객에게 미팅 일정을 제안하는 이메일", minStage: 4 },
  { title: "지난달 마케팅 결과를 보고하는 3문장", minStage: 4 },
  { title: "고객에게 전략을 추천하는 짧은 메시지", minStage: 4 },
  { title: "자유 주제", minStage: 1 },
];

export const WORD_TOPICS = [
  "이번 주 주제",
  "일상 대화",
  "여행",
  "친구 사귀기",
  "직장 생활",
  "마케팅",
  "컨설팅",
  "프레젠테이션",
] as const;

export function stageOf(week: number): Stage {
  return STAGES.find((s) => week >= s.weeks[0] && week <= s.weeks[1]) ?? STAGES[0]!;
}

export function lessonOf(week: number): Lesson {
  return LESSONS[week - 1]!;
}

export function weekInfo(week: number): WeekInfo {
  return WEEKS[week - 1]!;
}

export function vocabOf(week: number): VocabWeek {
  return VOCAB[week - 1]!;
}

/** The most advanced partner unlocked at the given stage. */
export function defaultFriendFor(stageId: number): Friend {
  return [...FRIENDS].reverse().find((f) => f.minStage <= stageId) ?? FRIENDS[0]!;
}
