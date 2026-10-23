/**
 * Prompt builders. Every prompt is assembled from the learner's own profile
 * (stored on the device) and the curriculum; no personal data is hard-coded.
 */
import { stageOf, weekInfo } from "../data/curriculum";
import type { ChatMessage, Friend, Profile, Scene } from "../types";
import { parseReply } from "./parse";

export interface LearnerContext {
  week: number;
  profile: Profile;
}

export function learnerName(profile: Profile): string {
  return profile.name.trim().slice(0, 30) || "the learner";
}

export function learnerLine({ week, profile }: LearnerContext): string {
  const stage = stageOf(week);
  const about = profile.about.trim().slice(0, 300);
  return (
    `The learner is ${learnerName(profile)}, a Korean adult${about ? ` (${about})` : ""}. ` +
    `They started from near-zero English (could barely read spelling) and are now at stage ` +
    `${stage.id}/4 ("${stage.name}") of a one-year plan, week ${week}: "${weekInfo(week).title}".`
  );
}

export function levelLine(week: number): string {
  switch (stageOf(week).id) {
    case 1:
      return "Use only very common, simple words and short sentences.";
    case 2:
      return "Use simple everyday words and short sentences.";
    case 3:
      return "Use natural everyday English, avoid rare words.";
    default:
      return "Use natural English; business terms are fine but keep sentences clear.";
  }
}

const REPLY_FORMAT = `After your English message, on a new line write "해석:" with a natural Korean translation of your message.
If their last message had grammar mistakes, unnatural wording, or was in Korean, add a new line "교정:" with the natural English they could say, plus a very short Korean explanation. Skip 교정 if it was fine.
No markdown, no emojis, no lists.`;

export function friendSystem(friend: Friend, ctx: LearnerContext, memo: string): string {
  const name = learnerName(ctx.profile);
  return `You are ${friend.persona}
You are texting with ${name}. ${learnerLine(ctx)}
Context: ${friend.context}.${memo ? `\nWhat you remember about ${name} and your past chats:\n${memo}` : ""}
Act like a real person with your own life: share small details about your day and opinions, react naturally, ask one question back. Text like a friend: 1-3 short sentences. ${levelLine(ctx.week)}
If they sincerely ask whether you are an AI, say honestly that you are an AI practice partner, then keep chatting in character.
${REPLY_FORMAT}`;
}

export function friendOpener(profile: Profile): string {
  return `(Start the chat: send ${learnerName(profile)} your first friendly message.)`;
}

export function sceneSystem(scene: Scene, ctx: LearnerContext): string {
  const beginner = stageOf(ctx.week).id <= 2 ? " only (beginner level)" : "";
  return `You are a warm, patient English conversation partner. ${learnerLine(ctx)}
Role-play: you are ${scene.role}. Stay in this role.
Rules:
- Reply in very simple, natural spoken English: at most 2 short sentences, then 1 easy question to keep the conversation going. Use common words${beginner}.
${REPLY_FORMAT}`;
}

export function memoPrompt(
  friend: Friend,
  profile: Profile,
  oldMemo: string,
  msgs: ChatMessage[],
): string {
  const name = learnerName(profile);
  const convo = msgs
    .slice(-24)
    .map((m) => `${m.role === "user" ? name : friend.name}: ${parseReply(m.content).main}`)
    .join("\n");
  return `You are ${friend.name}. Update your private memory notes about ${name} and your friendship.
Old notes:
${oldMemo || "(none)"}

Recent chat:
${convo}

Write at most 8 short lines in English: facts about ${name} (job, likes, plans), things you promised or planned together, topics you already talked about. Only the notes, no other text.`;
}

export function hintPrompt(situation: string, partnerRole: string, msgs: ChatMessage[]): string {
  const log = msgs
    .slice(-6)
    .map((m) => `${m.role === "user" ? "Learner" : "Partner"}: ${parseReply(m.content).main}`)
    .join("\n");
  return `A Korean beginner is practicing English in this situation: ${situation} (partner is ${partnerRole}).
Conversation so far:
${log || "(not started yet)"}

Suggest 3 very simple things the learner could say next. Reply with only a JSON array like [{"en":"Hi! Nice to meet you.","ko":"안녕하세요! 만나서 반가워요."}].`;
}

export function evaluationPrompt(
  ctx: LearnerContext,
  partner: string,
  goals: readonly string[],
  msgs: ChatMessage[],
): string {
  const convo = msgs
    .slice(-30)
    .map((m) =>
      m.role === "user" ? `Learner: ${m.content}` : `Partner: ${parseReply(m.content).main}`,
    )
    .join("\n")
    .slice(0, 8000);
  return `${learnerLine(ctx)}
They just practiced English with ${partner}.
${goals.length ? `Mission goals (Korean): ${JSON.stringify(goals)}\n` : ""}Conversation:
${convo}

Evaluate the learner kindly for their level. Reply with only JSON: {"score":0-100,"missions":[{"goal":"<goal text as given>","done":true}],"good":"한국어로 잘한 점 1문장","fixes":[{"orig":"learner sentence","better":"natural English","why":"짧은 한국어 이유"}],"next":"한국어로 다음 연습 제안 1문장"}. Use at most 4 fixes, only real mistakes. If there are no goals, use an empty missions array.`;
}

export function writingPrompt(ctx: LearnerContext, task: string, text: string): string {
  return `${learnerLine(ctx)}
They wrote this for the task "${task}" (parts may be in Korean):
"""${text.slice(0, 3000)}"""

Correct it for them. Reply in this exact plain-text format, no markdown symbols:
고친 글:
(the corrected, natural English version)

고친 이유:
- (each change: original → fixed, short reason in Korean)

더 자연스러운 표현:
- (1-2 alternative natural sentences with Korean meaning)

한 줄 칭찬:
(one encouraging line in Korean)`;
}

export function flashcardPrompt(heard: string): string {
  return `A Korean English learner heard this in a reel or movie: "${heard.slice(0, 200)}". Explain it as one flashcard. Reply with only JSON: {"en":"the word or phrase (fix spelling if needed)","ko":"short Korean meaning, max 15 chars","ex":"a short natural example sentence using it","exko":"Korean translation of the example"}`;
}

export function wordListPrompt(ctx: LearnerContext, topic: string, known: string[]): string {
  return `${learnerLine(ctx)}
Create 15 useful English words or short phrases for the topic "${topic}" that native speakers really use. ${levelLine(ctx.week)} Avoid these the learner already has: ${known.slice(-400).join(", ")}.
Reply with only a JSON array of 15 objects: [{"en":"word","ko":"짧은 뜻(15자 이내)","ex":"short natural example sentence","exko":"예문 해석"}]`;
}

export function worksheetPrompt(week: number): string {
  const stage = stageOf(week);
  return `Make an English worksheet for a Korean adult near-beginner. Stage ${stage.id} (${stage.name}), this week's topic: "${weekInfo(week).title}".
Write 8 multiple-choice questions that practice this topic. Questions and explanations in Korean where helpful; answer options in English (or Korean meaning when asking a word's meaning). Exactly 3 options each, one correct.
Reply with only a JSON array: [{"q":"I ___ a student.","o":["am","is","are"],"a":0,"e":"I 다음에는 am."}] where a is the index of the correct option.`;
}
