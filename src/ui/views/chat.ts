/**
 * AI conversation tab: persistent AI friends, mission-based role-play scenes and
 * writing correction. Voice mode turns any conversation into a hands-free loop:
 * the partner's reply is read aloud, then the microphone opens again.
 */
import { complete, completeJson } from "../../ai/client";
import { errorMessage } from "../../ai/errors";
import { parseReply } from "../../ai/parse";
import {
  evaluationPrompt,
  friendOpener,
  friendSystem,
  hintPrompt,
  memoPrompt,
  sceneSystem,
  writingPrompt,
  type LearnerContext,
} from "../../ai/prompts";
import { today } from "../../core/date";
import { isRecord } from "../../core/storage";
import { FRIENDS, SCENES, WRITING_TASKS } from "../../data/curriculum";
import { isAvailable, isListening, listen, stopListening } from "../../speech/recognition";
import { speak } from "../../speech/tts";
import type { ChatMessage, Example, Friend, FriendThread, Scene } from "../../types";
import type { ActionHandler, App } from "../app";
import { avatar, errorText, header, segmented, speakButton } from "../components";
import { html, raw, type SafeHtml } from "../html";
import type { ChatMode, Evaluation } from "../state";

/** Messages kept per friend and sent per request (the memo carries older context). */
const THREAD_LIMIT = 60;
const CONTEXT_TURNS = 20;
const SCENE_CONTEXT_TURNS = 16;
/** Refresh a friend's memory notes after this many new learner messages. */
const MEMO_EVERY = 8;
/** Keyboard dictation: send after the text stops changing for this long. */
const AUTO_SEND_MS = 2000;

const learner = (app: App): LearnerContext => ({
  week: app.week,
  profile: app.store.personal.profile,
});

function currentFriend(app: App): Friend {
  return FRIENDS.find((f) => f.id === app.ui.friendId) ?? FRIENDS[0]!;
}

function currentScene(app: App): Scene {
  return SCENES.find((s) => s.id === app.ui.sceneId) ?? SCENES[0]!;
}

function thread(app: App, friendId: string): FriendThread {
  return (app.store.personal.friends[friendId] ??= { msgs: [], memo: "", since: 0 });
}

/** The conversation currently on screen. */
function activeLog(app: App): ChatMessage[] {
  return app.ui.chatMode === "friend"
    ? thread(app, currentFriend(app).id).msgs
    : (app.ui.sceneLogs[currentScene(app).id] ??= []);
}

// ---------- Views ----------

function messageView(m: ChatMessage): SafeHtml {
  if (m.role === "user")
    return html`<div class="msg me"><span class="main">${m.content}</span></div>`;
  const r = parseReply(m.content);
  return html`<div class="msg ai">
    <span class="main">${r.main}</span>
    ${r.translation ? html`<span class="tr">${r.translation}</span>` : ""}
    ${r.correction ? html`<span class="fix"><b>교정</b> ${r.correction}</span>` : ""}
    <span class="row"
      >${speakButton(r.main, "🔊 듣기")}<button
        class="speak"
        data-action="saveSentence"
        data-en="${r.main}"
        data-ko="${r.translation}"
      >
        ⭐ 저장
      </button></span
    >
  </div>`;
}

function voiceBar(app: App): SafeHtml {
  const { voiceMode, autoListen } = app.store.personal;
  const mic = isAvailable();
  const listening = isListening();
  return html`<div class="vbar ${voiceMode ? "on" : ""}">
    <button class="vtog" data-action="toggleVoiceMode" aria-pressed="${voiceMode}">
      <span class="sw"><i></i></span><b>음성 대화 모드</b>
    </button>
    ${
      voiceMode
        ? html`<span class="small"
              >${listening ? html`<b>듣는 중… 영어로 말하세요</b>` : "AI 대답을 소리로 읽어 주고, 말이 끝나면 자동으로 보내요."}</span
            >
            <div class="row">
              ${mic ? html`<button class="btn primary mic ${listening ? "rec" : ""}" data-action="toggleMic">🎤 ${listening ? "그만 듣기" : "눌러서 말하기"}</button>` : ""}
              <button class="btn sm" data-action="replayLast">🔁 다시 듣기</button>
              <button class="btn sm" data-action="toggleAutoListen" aria-pressed="${autoListen}">
                ${autoListen ? "✅" : "⬜"} 대답 후 자동으로 듣기
              </button>
            </div>
            <span class="small muted"
              >${mic ? "마이크가 안 되면 " : ""}입력창을 누르고 <b>키보드의 🎤 버튼</b>으로
              말하세요. 키보드를 <b>영어</b>로 바꿔야 영어로 받아 적어요. 말을 멈추고 2초 뒤 자동
              전송돼요.</span
            >`
        : ""
    }
  </div>`;
}

export function chatBox(app: App, log: ChatMessage[]): SafeHtml {
  const ui = app.ui;
  const voiceMode = app.store.personal.voiceMode;
  return html`${voiceBar(app)}
    <div class="chat" id="chat" aria-live="polite">
      ${
        log.length
          ? log.map(messageView)
          : html`<div class="note">
              예시: <span class="en">Hi! Nice to meet you.</span> 또는 "안녕, 만나서 반가워를 영어로
              하고 싶어"
            </div>`
      }
      ${ui.busy ? html`<div class="msg ai"><span class="tr" id="live">입력 중…</span></div>` : ""}
    </div>
    ${
      ui.hints
        ? html`<div class="hints">
            ${ui.hints.map(
              (h) =>
                html`<button class="hint" data-action="useHint" data-text="${h.en}">
                  <span class="en">${h.en}</span><br /><span class="small muted">${h.ko}</span>
                </button>`,
            )}
          </div>`
        : ""
    }
    ${errorText(ui.chatError)}
    <div class="composer">
      <label class="sr-only" for="chat-input">메시지</label>
      <textarea
        id="chat-input"
        rows="${voiceMode ? 2 : 1}"
        placeholder="${voiceMode ? "여기를 누르고 키보드 🎤로 말하세요" : "영어로 써 보세요 (한국어도 OK)"}"
      >
${ui.draft}</textarea>
      <button class="btn primary" data-action="sendMessage" ${ui.busy ? raw("disabled") : ""}>
        보내기
      </button>
    </div>
    <div class="row">
      <button
        class="btn sm"
        data-action="suggestReplies"
        ${ui.busy || ui.hinting ? raw("disabled") : ""}
      >
        ${ui.hinting ? "찾는 중…" : "뭐라고 말하지? (예시 답변)"}
      </button>
    </div>`;
}

function feedbackView(app: App, key: string): SafeHtml {
  const f = app.ui.feedback[key];
  if (!f) return html``;
  if (f.status === "loading") return html`<div class="note">대화를 평가하는 중…</div>`;
  if (f.status === "error") return errorText(f.message);
  const r = f.result;
  return html`<div class="fbk">
    <div class="row between">
      <b>대화 평가</b><span class="chip ${r.score >= 70 ? "ok" : "warn"}">${r.score}점</span>
    </div>
    ${r.missions.length ? html`<div class="small">${r.missions.map((m) => html`${m.done ? "✅" : "⬜"} ${m.goal}<br />`)}</div>` : ""}
    ${r.good ? html`<p class="small"><b>잘한 점</b> ${r.good}</p>` : ""}
    ${
      r.fixes.length
        ? html`<div class="small">
            <b>고치면 좋은 문장</b>${r.fixes.map(
              (x) =>
                html`<div class="fx">
                  <span class="no">${x.orig}</span> → <span class="en">${x.better}</span><br />
                  <span class="muted">${x.why}</span> ${speakButton(x.better)}
                  <button
                    class="speak"
                    data-action="saveSentence"
                    data-en="${x.better}"
                    data-ko="${x.why}"
                  >
                    ⭐ 저장
                  </button>
                </div>`,
            )}
          </div>`
        : ""
    }
    ${r.next ? html`<p class="small"><b>다음엔</b> ${r.next}</p>` : ""}
  </div>`;
}

function friendView(app: App): SafeHtml {
  const stageId = app.stage.id;
  const friend = currentFriend(app);
  const t = thread(app, friend.id);
  return html`<section class="card">
      <div class="flist">
        ${FRIENDS.map((f) => {
          const last = app.store.personal.friends[f.id]?.msgs.at(-1);
          return html`<button
            class="fr ${f.id === friend.id ? "on" : ""}"
            data-action="selectFriend"
            data-friend="${f.id}"
          >
            ${avatar(f, 40)}
            <span class="ft"
              ><b>${f.name} ${f.flag}</b
              ><small>${f.from} · ${f.job}</small
              >${last ? html`<small class="lm">${parseReply(last.content).main.slice(0, 60)}</small>` : ""}</span
            >
            ${f.minStage > stageId ? html`<span class="chip">${f.minStage}단계~</span>` : ""}
          </button>`;
        })}
      </div>
    </section>
    <section class="card">
      <div class="row">
        ${avatar(friend, 44)}
        <div>
          <h3>${friend.name} ${friend.flag}</h3>
          <span class="small muted">${friend.intro}</span>
        </div>
      </div>
      ${t.msgs.length ? "" : html`<button class="btn primary" data-action="startFriendChat" ${app.ui.busy ? raw("disabled") : ""}>${friend.name}에게 먼저 인사 받기</button>`}
      ${chatBox(app, t.msgs)}
      <div class="row">
        ${t.msgs.length > 2 ? html`<button class="btn sm" data-action="evaluateChat" ${app.ui.busy ? raw("disabled") : ""}>오늘 대화 평가 받기</button>` : ""}
        ${t.msgs.length ? html`<button class="btn sm" data-action="clearFriendChat">${app.ui.clearConfirm === friend.id ? "한 번 더 누르면 지워져요" : "대화 지우기"}</button>` : ""}
      </div>
      ${feedbackView(app, `f:${friend.id}`)}
    </section>`;
}

function sceneView(app: App): SafeHtml {
  const stageId = app.stage.id;
  const scene = currentScene(app);
  const log = activeLog(app);
  return html`<section class="card">
      <div class="scen">
        ${SCENES.map(
          (s) =>
            html`<button
              class="${s.id === scene.id ? "on" : ""}"
              data-action="selectScene"
              data-scene="${s.id}"
            >
              <b>${s.title}</b
              ><span
                >${s.description}${s.minStage > stageId ? ` · ${s.minStage}단계 추천` : ""}</span
              >
            </button>`,
        )}
      </div>
    </section>
    <section class="card">
      <div class="row between">
        <h3>${scene.title}</h3>
        ${log.length ? html`<button class="btn sm" data-action="resetScene">새 대화</button>` : ""}
      </div>
      <div class="mission">
        <b>🎯 미션</b>${scene.missions.map((g) => html`<span>· ${g}</span>`)}
      </div>
      ${chatBox(app, log)}
      <div class="row">
        <button class="btn sm" data-action="evaluateChat" ${app.ui.busy ? raw("disabled") : ""}>
          대화 마치고 평가 받기
        </button>
      </div>
      ${feedbackView(app, `s:${scene.id}`)}
    </section>`;
}

function writingTaskIndex(app: App): number {
  const fallback = WRITING_TASKS.findIndex((t) => t.minStage === app.stage.id);
  return app.ui.writingTask ?? Math.max(0, fallback);
}

function writingView(app: App): SafeHtml {
  const ui = app.ui;
  const index = writingTaskIndex(app);
  const task = WRITING_TASKS[index]!;
  const history = app.store.personal.writes.slice().reverse().slice(0, 5);
  return html`<section class="card">
      <h3>무엇을 쓸까요?</h3>
      ${segmented(
        WRITING_TASKS.map((t, i) => ({ id: String(i), label: t.title })),
        String(index),
        "selectWritingTask",
      )}
      <label class="sr-only" for="writing-input">영작</label>
      <textarea
        id="writing-input"
        class="field"
        rows="5"
        placeholder="${task.title}을(를) 영어로 써 보세요. 모르는 부분은 한국어로 써도 돼요."
      >
${ui.writingDraft}</textarea>
      <button
        class="btn primary"
        data-action="correctWriting"
        ${ui.writingBusy ? raw("disabled") : ""}
      >
        ${ui.writingBusy ? "고치는 중…" : "첨삭 받기"}
      </button>
      ${ui.writingOut ? html`<div class="wout" id="writing-output">${ui.writingOut}</div>` : ""}
      ${errorText(ui.writingError)}
    </section>
    ${
      history.length
        ? html`<section class="card">
            <h3>지난 첨삭</h3>
            ${history.map(
              (w) =>
                html`<details class="wh">
                  <summary>${w.d} · ${w.task}</summary>
                  <p class="small muted">${w.src}</p>
                  <div class="wout">${w.out}</div>
                </details>`,
            )}
          </section>`
        : ""
    }`;
}

const MODE_NOTES: Record<ChatMode, string> = {
  friend:
    "실제 사람 대신 대화하는 AI 친구들이에요. '음성 대화 모드'를 켜면 말로 대화할 수 있어요. 각자 사는 곳·직업·성격이 있고, 나눈 대화를 기억해요. 막히면 한국어로 써도 돼요.",
  scene: "공항·호텔·식당처럼 정해진 상황을 미션과 함께 연습해요. AI가 상대 역할을 해요.",
  writing: "영어로 쓰면 AI가 고쳐 주고 이유를 설명해 줘요.",
};

export function chatView(app: App): SafeHtml {
  const mode = app.ui.chatMode;
  const body =
    mode === "scene" ? sceneView(app) : mode === "writing" ? writingView(app) : friendView(app);
  return html`${header(app.week)}
    <section class="card">
      <h2>AI 대화</h2>
      ${segmented(
        [
          { id: "friend", label: "AI 친구" },
          { id: "scene", label: "상황 연습" },
          { id: "writing", label: "쓰기 첨삭" },
        ],
        mode,
        "chatMode",
      )}
      <p class="small muted">${MODE_NOTES[mode]}</p>
    </section>
    ${body}`;
}

// ---------- Conversation logic ----------

function showLive(text: string): void {
  const el = document.getElementById("live");
  if (el) el.textContent = parseReply(text).main;
}

/** Reads the reply aloud in voice mode, then reopens the microphone if enabled. */
function speakReply(app: App, reply: string): void {
  if (!app.store.personal.voiceMode) return;
  speak(parseReply(reply).main, app.voice, {
    onEnd: () => {
      const { voiceMode, autoListen } = app.store.personal;
      if (voiceMode && autoListen && app.ui.tab === "chat" && !isListening() && !app.ui.busy) {
        setTimeout(() => startListening(app, true), 350);
      }
    },
  });
}

function startListening(app: App, automatic = false): void {
  if (!app.store.personal.voiceMode && automatic) return;
  listen({
    automatic,
    onStateChange: () => app.render(),
    onText: (text) => {
      app.ui.draft = text;
      const box = document.getElementById("chat-input") as HTMLTextAreaElement | null;
      if (box) box.value = text;
    },
    onDone: (text) => {
      if (text.trim() && !app.ui.busy) void sendMessage(app, text);
    },
  });
}

async function refreshMemo(app: App, friend: Friend): Promise<void> {
  const t = thread(app, friend.id);
  try {
    const notes = await complete(memoPrompt(friend, app.store.personal.profile, t.memo, t.msgs), {
      tier: "quick",
    });
    t.memo = notes.trim().slice(0, 1200);
    t.since = 0;
    app.store.savePersonal();
  } catch {
    /* memory refresh is best-effort */
  }
}

async function talkToFriend(app: App, text: string | null): Promise<void> {
  const friend = currentFriend(app);
  const t = thread(app, friend.id);
  if (text !== null) {
    t.msgs.push({ role: "user", content: text });
    t.since++;
  }
  const turns: ChatMessage[] = [
    { role: "user", content: friendSystem(friend, learner(app), t.memo) },
    ...t.msgs.slice(-CONTEXT_TURNS),
  ];
  if (text === null)
    turns.push({ role: "user", content: friendOpener(app.store.personal.profile) });
  const reply = await complete(turns, { tier: "quick", onText: showLive });
  t.msgs.push({ role: "assistant", content: reply });
  if (t.msgs.length > THREAD_LIMIT) t.msgs = t.msgs.slice(-THREAD_LIMIT);
  app.store.savePersonal();
  speakReply(app, reply);
  if (t.since >= MEMO_EVERY) void refreshMemo(app, friend);
}

async function talkInScene(app: App, text: string): Promise<void> {
  const scene = currentScene(app);
  const log = activeLog(app);
  log.push({ role: "user", content: text });
  const turns: ChatMessage[] = [
    { role: "user", content: sceneSystem(scene, learner(app)) },
    ...log.slice(-SCENE_CONTEXT_TURNS),
  ];
  const reply = await complete(turns, { tier: "quick", onText: showLive });
  log.push({ role: "assistant", content: reply });
  speakReply(app, reply);
}

async function sendMessage(app: App, text: string | null): Promise<void> {
  const ui = app.ui;
  if (ui.busy) return;
  const message = text?.trim() ?? null;
  if (text !== null && !message) return;
  Object.assign(ui, { draft: "", hints: null, chatError: "", busy: true });
  app.renderNow();
  try {
    if (ui.chatMode === "friend") await talkToFriend(app, message);
    else await talkInScene(app, message!);
    // Only the learner's own messages count toward the daily quest.
    if (message !== null) {
      app.track(ui.chatMode === "friend" ? "friend" : "scene");
      if (app.store.personal.voiceMode) app.track("voice");
    }
  } catch (err) {
    ui.chatError = errorMessage(err);
  }
  ui.busy = false;
  app.renderNow();
}

function toEvaluation(value: unknown): Evaluation | null {
  if (!isRecord(value)) return null;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  return {
    score: Math.max(0, Math.min(100, Number(value.score) || 0)),
    missions: Array.isArray(value.missions)
      ? value.missions.filter(isRecord).map((m) => ({ goal: str(m.goal), done: m.done === true }))
      : [],
    good: str(value.good),
    fixes: Array.isArray(value.fixes)
      ? value.fixes
          .filter(isRecord)
          .slice(0, 4)
          .map((f) => ({ orig: str(f.orig), better: str(f.better), why: str(f.why) }))
      : [],
    next: str(value.next),
  };
}

// ---------- Actions ----------

let autoSendTimer: ReturnType<typeof setTimeout> | undefined;

/** Keyboard dictation support: called on every input event of the chat box. */
export function onChatInput(app: App, value: string): void {
  app.ui.draft = value;
  if (!app.store.personal.voiceMode) return;
  clearTimeout(autoSendTimer);
  if (!value.trim()) return;
  autoSendTimer = setTimeout(() => {
    const box = document.getElementById("chat-input") as HTMLTextAreaElement | null;
    if (box?.value === value && !app.ui.busy && app.store.personal.voiceMode)
      void sendMessage(app, value);
  }, AUTO_SEND_MS);
}

export function sendFromInput(app: App): void {
  const box = document.getElementById("chat-input") as HTMLTextAreaElement | null;
  void sendMessage(app, box?.value ?? "");
}

export const chatActions: Record<string, ActionHandler> = {
  chatMode(app, el) {
    Object.assign(app.ui, { chatMode: el.dataset.value as ChatMode, hints: null, chatError: "" });
    app.render();
  },
  selectFriend(app, el) {
    Object.assign(app.ui, { friendId: el.dataset.friend!, hints: null, chatError: "" });
    app.render();
  },
  selectScene(app, el) {
    Object.assign(app.ui, { sceneId: el.dataset.scene!, hints: null, chatError: "" });
    app.render();
  },
  startFriendChat(app) {
    void sendMessage(app, null);
  },
  sendMessage(app) {
    sendFromInput(app);
  },
  useHint(app, el) {
    app.ui.draft = el.dataset.text ?? "";
    app.ui.hints = null;
    app.renderNow();
    document.getElementById("chat-input")?.focus();
  },
  async suggestReplies(app) {
    const ui = app.ui;
    const isFriend = ui.chatMode === "friend";
    const friend = currentFriend(app);
    const scene = currentScene(app);
    ui.hinting = true;
    app.render();
    try {
      const list = await completeJson<unknown[]>(
        hintPrompt(
          isFriend ? "texting with a friend" : scene.title,
          isFriend ? friend.persona : scene.role,
          activeLog(app),
        ),
        { tier: "quick" },
      );
      ui.hints = (Array.isArray(list) ? list : [])
        .filter(isRecord)
        .filter((x) => typeof x.en === "string")
        .slice(0, 3)
        .map((x): Example => ({ en: String(x.en), ko: typeof x.ko === "string" ? x.ko : "" }));
    } catch (err) {
      ui.chatError = errorMessage(err);
    }
    ui.hinting = false;
    app.render();
  },
  resetScene(app) {
    app.ui.sceneLogs[currentScene(app).id] = [];
    Object.assign(app.ui, { hints: null, chatError: "" });
    app.render();
  },
  clearFriendChat(app) {
    const friend = currentFriend(app);
    if (app.ui.clearConfirm !== friend.id) {
      app.ui.clearConfirm = friend.id;
      app.render();
      return;
    }
    app.store.personal.friends[friend.id] = { msgs: [], memo: "", since: 0 };
    app.ui.clearConfirm = null;
    app.store.savePersonal();
    app.render();
  },
  async evaluateChat(app) {
    const ui = app.ui;
    const isFriend = ui.chatMode === "friend";
    const friend = currentFriend(app);
    const scene = currentScene(app);
    const key = isFriend ? `f:${friend.id}` : `s:${scene.id}`;
    const log = activeLog(app);
    if (log.filter((m) => m.role === "user").length < 2) {
      ui.feedback[key] = { status: "error", message: "두 마디 이상 대화한 뒤에 평가할 수 있어요." };
      app.render();
      return;
    }
    ui.feedback[key] = { status: "loading" };
    app.render();
    try {
      const result = toEvaluation(
        await completeJson<unknown>(
          evaluationPrompt(
            learner(app),
            isFriend ? friend.name : scene.role,
            isFriend ? [] : scene.missions,
            log,
          ),
        ),
      );
      if (!result) throw new Error("invalid evaluation");
      ui.feedback[key] = { status: "done", result };
      const evals = app.store.personal.evals;
      evals.push({ d: today(), key, score: result.score });
      app.store.personal.evals = evals.slice(-100);
      app.store.savePersonal();
    } catch (err) {
      ui.feedback[key] = {
        status: "error",
        message:
          err instanceof Error && err.name !== "AiError"
            ? "평가를 만들지 못했어요. 다시 눌러 주세요."
            : errorMessage(err),
      };
    }
    app.render();
  },
  toggleVoiceMode(app) {
    const personal = app.store.personal;
    personal.voiceMode = !personal.voiceMode;
    if (!personal.voiceMode) stopListening();
    app.store.savePersonal();
    app.render();
  },
  toggleAutoListen(app) {
    app.store.personal.autoListen = !app.store.personal.autoListen;
    app.store.savePersonal();
    app.render();
  },
  toggleMic(app) {
    if (isListening()) {
      stopListening();
      app.render();
    } else startListening(app);
  },
  replayLast(app) {
    const last = activeLog(app)
      .slice()
      .reverse()
      .find((m) => m.role === "assistant");
    if (last) app.say(parseReply(last.content).main);
  },
  selectWritingTask(app, el) {
    app.ui.writingTask = Number(el.dataset.value);
    app.render();
  },
  async correctWriting(app) {
    const ui = app.ui;
    const input = document.getElementById("writing-input") as HTMLTextAreaElement | null;
    const text = input?.value ?? "";
    if (!text.trim()) return;
    const task = WRITING_TASKS[writingTaskIndex(app)]!.title;
    Object.assign(ui, { writingDraft: text, writingBusy: true, writingError: "", writingOut: "" });
    app.renderNow();
    try {
      const out = await complete(writingPrompt(learner(app), task, text), {
        onText: (partial) => {
          const el = document.getElementById("writing-output");
          if (el) el.textContent = partial;
          else ui.writingOut = partial;
        },
      });
      ui.writingOut = out;
      const writes = app.store.personal.writes;
      writes.push({ d: today(), task, src: text.slice(0, 1500), out: out.slice(0, 3000) });
      app.store.personal.writes = writes.slice(-20);
      app.store.savePersonal();
      app.track("writing");
    } catch (err) {
      ui.writingError = errorMessage(err);
    }
    ui.writingBusy = false;
    app.render();
  },
};
