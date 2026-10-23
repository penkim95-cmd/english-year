/**
 * Today's study on the home screen. All seven steps run in place — lesson,
 * flashcards, quiz, dictation, speaking, AI conversation, review — one at a
 * time: the current step is open, finished steps fold up, later steps wait.
 * The first visit starts with a 12-question level check that sets the week.
 */
import { STORAGE_KEYS, readString, writeString } from "../../core/storage";
import { today } from "../../core/date";
import { defaultFriendFor, lessonOf, stageOf, vocabOf, weekInfo } from "../../data/curriculum";
import { compare, sentencesFor, type Comparison } from "../../domain/dictation";
import { dueKeys, vocabKey } from "../../domain/dictionary";
import { PLACEMENT, countCorrect, placementWeek } from "../../domain/placement";
import { skipKind, type Quest, type QuestStep } from "../../domain/quest";
import { prioritize, review } from "../../domain/srs";
import { weekSheet } from "../../domain/worksheets";
import { isAvailable, isListening, listen } from "../../speech/recognition";
import { numberData, type ActionHandler, type App } from "../app";
import { avatar, speakButton, statusChip } from "../components";
import { html, raw, type SafeHtml } from "../html";
import { chatBox } from "./chat";
import { comparisonView, questionView } from "./sheet";

/** Per-session state of the inline activities (not persisted). */
export interface TodaySession {
  week: number;
  lessonPage: number;
  revealed: number[];
  deck: { id: string; keys: string[]; flipped: boolean };
  dictation: { index: number; input: string; result: (Comparison & { input: string }) | null };
  speaking: { index: number; result: (Comparison & { heard: string }) | null };
}

export function newSession(week: number): TodaySession {
  return {
    week,
    lessonPage: 0,
    revealed: [],
    deck: { id: "", keys: [], flipped: false },
    dictation: { index: 0, input: "", result: null },
    speaking: { index: 0, result: null },
  };
}

function session(app: App): TodaySession {
  if (app.ui.today?.week !== app.week) app.ui.today = newSession(app.week);
  return app.ui.today;
}

const spoken = (en: string) => en.replace(/~/g, "something").split("·")[0]!.trim();

// ---------- Level check ----------

function placementCard(app: App): SafeHtml {
  const st = (app.ui.placement ??= { index: 0, answers: [] });
  if (st.index >= PLACEMENT.length) {
    const correct = countCorrect(st.answers);
    const week = placementWeek(correct);
    const stage = stageOf(week);
    return html`<section class="card today">
      <h2>실력 측정 결과</h2>
      <p class="lead-title">${PLACEMENT.length}문제 중 ${correct}개 맞혔어요</p>
      <div class="note">
        <b>${stage.id}단계 · ${stage.name}</b>의 <b>${week}주차 "${weekInfo(week).title}"</b>부터
        시작해요. 이미 아는 앞부분은 건너뛰고, 맞히지 못한 수준부터 배워요.
      </div>
      <button class="btn primary" data-action="placementStart" data-week="${week}">
        이 수준으로 시작하기
      </button>
      <button class="btn sm" data-action="placementRetry">다시 측정하기</button>
    </section>`;
  }
  const q = PLACEMENT[st.index]!;
  return html`<section class="card today">
    <div class="row between">
      <h2>실력 측정</h2>
      <span class="chip">${st.index + 1} / ${PLACEMENT.length}</span>
    </div>
    <p class="small muted">
      12문제로 시작 수준을 정해요. 모르면 아무거나 고르지 말고 "모르겠어요"를 누르세요.
    </p>
    <div class="qmeter">
      <i style="width:${Math.round((100 * st.index) / PLACEMENT.length)}%"></i>
    </div>
    <div class="q">
      <span class="qt">${q.prompt}</span>
      <div class="opts col">
        ${q.options.map(
          (o, j) =>
            html`<button class="opt" data-action="placementAnswer" data-option="${j}">
              ${o}
            </button>`,
        )}
      </div>
      <button class="btn sm" data-action="placementAnswer" data-option="-1">모르겠어요</button>
    </div>
    ${
      app.store.progress.startWeek === undefined
        ? html`<button class="linkish small" data-action="placementSkip">
            측정 없이 1주차부터 하기
          </button>`
        : html`<button class="linkish small" data-action="placementCancel">취소</button>`
    }
  </section>`;
}

// ---------- Step activities ----------

function lessonActivity(app: App): SafeHtml {
  const s = session(app);
  const lesson = lessonOf(app.week);
  const pages = lesson.points.length + 2;
  const page = Math.min(s.lessonPage, pages - 1);
  const nav = html`<div class="row between">
    <button
      class="btn sm"
      data-action="todayLessonPage"
      data-step="-1"
      ${page === 0 ? raw("disabled") : ""}
    >
      ← 이전
    </button>
    <span class="small muted">${page + 1} / ${pages}</span>
    ${
      page < pages - 1
        ? html`<button class="btn sm primary" data-action="todayLessonPage" data-step="1">
            다음 →
          </button>`
        : html`<button class="btn sm primary" data-action="todayLessonDone">레슨 끝 ✓</button>`
    }
  </div>`;
  let body: SafeHtml;
  if (page < lesson.points.length) {
    const point = lesson.points[page]!;
    body = html`${page === 0 ? html`<p class="small">${lesson.hook}</p>` : ""}
      <b class="qtitle">${page + 1}. ${point.title}</b>
      <p>${point.explanation}</p>
      <div class="exlist">
        ${point.examples.map(
          (ex) =>
            html`<div class="exrow">
              ${speakButton(spoken(ex.en))}
              <span
                ><span class="en">${ex.en}</span><br /><span class="small muted"
                  >${ex.ko}</span
                ></span
              >
            </div>`,
        )}
      </div>
      <p class="small muted">🔊를 누르고 들은 대로 소리 내 따라 읽으세요.</p>`;
  } else if (page === lesson.points.length) {
    body = html`<b class="qtitle">영어로 말해 보세요</b>
      <p class="small">한국어를 보고 먼저 소리 내 말한 다음 눌러서 정답을 확인하세요.</p>
      <div class="exlist">
        ${lesson.drills.map((d, j) =>
          s.revealed.includes(j)
            ? html`<div class="exrow">
                ${speakButton(d.en)}
                <span
                  ><span class="small muted">${d.ko}</span><br /><span class="en"
                    >${d.en}</span
                  ></span
                >
              </div>`
            : html`<button class="exrow hidden" data-action="todayReveal" data-index="${j}">
                <span>👀</span
                ><span><b>${d.ko}</b><br /><span class="small muted">눌러서 정답 보기</span></span>
              </button>`,
        )}
      </div>`;
  } else {
    body = html`<b class="qtitle">오늘의 팁</b>
      <p>${lesson.tip}</p>`;
  }
  return html`<button class="btn sm" data-action="openClip" data-week="${app.week}">
      ▶ 소리로 듣는 클립으로 보기
    </button>
    ${body}${nav}`;
}

function deckActivity(app: App, kind: "vocab" | "review"): SafeHtml {
  const s = session(app);
  const day = today();
  const id = kind === "vocab" ? `v${app.week}` : `r${day}`;
  if (s.deck.id !== id) {
    const keys =
      kind === "vocab"
        ? vocabOf(app.week).words.map((w) => vocabKey(w.en))
        : dueKeys(app.store.dictionary, app.store.progress.srs, day);
    s.deck = { id, keys: prioritize(keys, app.store.progress.srs), flipped: false };
  }
  const key = s.deck.keys[0];
  const card = key ? app.store.dictionary.get(key) : undefined;
  if (!card) {
    return html`<p class="small">
        이 묶음을 다 넘겼어요. 처음부터 한 번 더 보면 기억에 오래 남아요.
      </p>
      <button class="btn sm" data-action="todayDeckRestart">처음부터 다시</button>`;
  }
  return html`<button class="flash" data-action="todayFlip" aria-label="카드 뒤집기">
      <span class="row center"
        >${statusChip(app.store.progress.srs[card.key])}<span class="small muted"
          >남은 카드 ${s.deck.keys.length}</span
        ></span
      >
      <span class="w">${card.en}</span>
      ${
        s.deck.flipped
          ? html`<span class="k">${card.ko}</span><span class="exen">${card.example}</span
              ><span class="small muted">${card.exampleKo}</span>`
          : html`<span class="small muted">눌러서 뜻과 예문 보기</span>`
      }
    </button>
    <div class="row center">
      ${speakButton(spoken(card.en), "🔊 단어")}${speakButton(card.example, "🔊 예문")}
    </div>
    <div class="row center">
      <button class="btn" data-action="todayAnswer" data-kind="${kind}" data-known="0">
        몰라요
      </button>
      <button class="btn primary" data-action="todayAnswer" data-kind="${kind}" data-known="1">
        알아요
      </button>
    </div>`;
}

function quizActivity(app: App): SafeHtml {
  const key = `w${app.week}`;
  const answers = (app.ui.answers[key] ??= {});
  return html`<div class="qlist">
    ${weekSheet(app.week).map((q, i) => questionView(q, i, key, answers[i]))}
  </div>`;
}

function dictationActivity(app: App): SafeHtml {
  const s = session(app).dictation;
  const set = sentencesFor(app.week);
  const item = set[s.index % set.length]!;
  return html`<div class="q">
    <span class="qt">${(s.index % set.length) + 1}번 문장</span>
    <div class="row">
      <button class="btn primary" data-action="todayDictPlay">🔊 듣기</button>
      <button class="btn" data-action="todayDictPlay" data-slow="1">🐢 천천히</button>
    </div>
    <label class="sr-only" for="today-dict">들린 문장</label>
    <input
      id="today-dict"
      class="field"
      autocomplete="off"
      autocapitalize="off"
      spellcheck="false"
      placeholder="들린 영어를 쓰세요"
      value="${s.input}"
      ${s.result ? raw("disabled") : ""}
    />
    ${
      s.result
        ? html`${comparisonView(s.result)}
            <span class="exp"
              ><b class="${s.result.exact ? "good" : "bad"}"
                >${s.result.exact ? "정답!" : `${s.result.accuracy}% 맞음`}</b
              >
              ${item.en} <span class="muted">${item.ko}</span></span
            >
            <button class="btn primary" data-action="todayDictNext">다음 문장 →</button>`
        : html`<button class="btn primary" data-action="todayDictCheck">확인</button>`
    }
  </div>`;
}

function speakingActivity(app: App, step: QuestStep): SafeHtml {
  const s = session(app).speaking;
  const set = sentencesFor(app.week);
  const item = set[s.index % set.length]!;
  const mic = isAvailable();
  return html`<div class="q">
    <span class="qt">${(s.index % set.length) + 1}번 문장</span>
    <p><span class="en big">${item.en}</span><br /><span class="small muted">${item.ko}</span></p>
    <div class="row">
      ${speakButton(item.en, "🔊 듣기")}
      ${
        mic
          ? html`<button
              class="btn primary mic ${isListening() ? "rec" : ""}"
              data-action="todaySpeak"
            >
              🎤 ${isListening() ? "듣는 중…" : "따라 말하기"}
            </button>`
          : html`<button class="btn primary" data-action="todaySpokeAloud">
              소리 내서 읽었어요
            </button>`
      }
    </div>
    ${
      s.result
        ? html`${comparisonView(s.result)}
            <span class="exp"
              ><b class="${s.result.accuracy >= 80 ? "good" : "bad"}">${s.result.accuracy}%</b> 들린
              말: "${s.result.heard}"
              ${s.result.accuracy >= 80 ? "좋아요!" : "빨간 단어를 또박또박 다시 말해 보세요."}</span
            >
            <button class="btn sm" data-action="todaySpeakNext">다음 문장 →</button>`
        : ""
    }
    ${mic ? "" : html`<span class="small muted">이 화면에서는 마이크를 쓸 수 없어요. 듣고 소리 내 읽은 뒤 버튼을 누르세요.</span>`}
    ${step.progress === 0 ? html`<button class="linkish small" data-action="todaySkip" data-index="${step.index}">오늘은 건너뛰기</button>` : ""}
  </div>`;
}

function chatActivity(app: App, step: QuestStep): SafeHtml {
  const friend = defaultFriendFor(app.stage.id);
  if (!readString(STORAGE_KEYS.apiKey).trim()) {
    return html`<div class="note">
        AI 친구와 대화하려면 Claude API 키가 필요해요. console.anthropic.com에서 만든 키를 넣어
        주세요(이 폰에만 저장돼요).
      </div>
      <div class="composer">
        <label class="sr-only" for="today-key">Claude API 키</label>
        <input
          id="today-key"
          class="field"
          type="password"
          autocomplete="off"
          placeholder="sk-ant-로 시작하는 키"
        />
        <button class="btn primary" data-action="todaySaveKey">저장</button>
      </div>
      <button class="linkish small" data-action="todaySkip" data-index="${step.index}">
        키가 없어서 오늘은 건너뛰기
      </button>`;
  }
  // The conversation step always talks to this stage's friend.
  app.ui.chatMode = "friend";
  app.ui.friendId = friend.id;
  const current = friend;
  const thread = app.store.personal.friends[current.id];
  const msgs = thread?.msgs ?? [];
  return html`<div class="row">
      ${avatar(current, 36)}<span
        ><b>${current.name} ${current.flag}</b><br /><span class="small muted"
          >${current.intro}</span
        ></span
      >
    </div>
    ${
      msgs.length
        ? ""
        : html`<button
            class="btn primary"
            data-action="startFriendChat"
            ${app.ui.busy ? raw("disabled") : ""}
          >
            ${current.name}에게 먼저 인사 받기
          </button>`
    }
    ${chatBox(app, msgs.slice(-12))}`;
}

function activity(app: App, step: QuestStep): SafeHtml {
  switch (step.target) {
    case "clip":
      return lessonActivity(app);
    case "vocab":
      return deckActivity(app, "vocab");
    case "review":
      return deckActivity(app, "review");
    case "sheet":
      return quizActivity(app);
    case "dictation":
      return dictationActivity(app);
    case "speaking":
      return speakingActivity(app, step);
    case "friend":
      return chatActivity(app, step);
    default:
      return html``;
  }
}

// ---------- Today card ----------

function stepRow(app: App, step: QuestStep, quest: Quest): SafeHtml {
  const n = step.index + 1;
  if (step.state === "done") {
    return html`<div class="qstep done">
      <span class="qn" aria-hidden="true">✓</span>
      <span class="qt"
        ><b>${n}단계</b> ${step.label}${step.note ? html`<small>${step.note}</small>` : ""}</span
      >
    </div>`;
  }
  if (step.state === "locked") {
    return html`<div class="qstep locked">
      <span class="qn" aria-hidden="true">${n}</span>
      <span class="qt">${step.label}<small>약 ${step.minutes}분</small></span>
    </div>`;
  }
  return html`<div class="qstep current" id="today-current" aria-current="step">
    <span class="qlabel"
      >STEP ${n} / ${quest.steps.length} · 지금 할 일 · 약 ${step.minutes}분</span
    >
    <b class="qtitle">${step.label}</b>
    <p class="small muted">${step.how}</p>
    ${
      step.goal > 1
        ? html`<div class="row between small">
              <span>진행</span><b>${step.progress} / ${step.goal}${step.unit}</b>
            </div>
            <div class="qmeter">
              <i style="width:${Math.round((100 * step.progress) / step.goal)}%"></i>
            </div>`
        : ""
    }
    <div class="qwork">${activity(app, step)}</div>
  </div>`;
}

export function todayCard(app: App): SafeHtml {
  if (app.store.progress.startWeek === undefined || app.ui.placement) return placementCard(app);
  session(app);
  const quest = app.quest;
  const total = quest.steps.reduce((m, st) => m + st.minutes, 0);
  const info = weekInfo(app.week);
  const toast = app.ui.questToast;
  const justDone = toast ? quest.steps[toast.stepIndex] : undefined;
  return html`<section class="card today quest">
    <div class="row between">
      <h2>오늘의 공부</h2>
      <span class="chip ${quest.complete ? "ok" : ""}"
        >완료 ${quest.doneCount} / ${quest.steps.length}</span
      >
    </div>
    <p class="small muted">
      ${app.week}주차 · ${info.title} · 모두 약 ${total}분. 위에서부터 순서대로, 이 화면에서 다 할
      수 있어요.
    </p>
    <div class="qsegs" aria-hidden="true">
      ${quest.steps.map((st) => html`<i class="${st.state}"></i>`)}
    </div>
    ${
      quest.complete
        ? html`<div class="qdone">
            <b>🎉 오늘 공부 끝!</b
            ><span class="small"
              >내일 이 화면을 열면 새 공부가 준비돼 있어요. 더 하고 싶으면 아래 탭에서 자유롭게
              연습하세요.</span
            >
          </div>`
        : justDone
          ? html`<div class="qjust">✓ ${justDone.index + 1}단계 완료! 다음 단계가 열렸어요.</div>`
          : ""
    }
    <div class="qsteps">${quest.steps.map((st) => stepRow(app, st, quest))}</div>
  </section>`;
}

// ---------- Actions ----------

/** Runs an update and, if it finished a step, scrolls the next one into view. */
function advance(app: App, update: () => void): void {
  const before = app.quest.current?.index ?? -1;
  update();
  const after = app.quest.current?.index ?? -1;
  app.renderNow();
  if (after !== before && after >= 0) {
    document
      .getElementById("today-current")
      ?.scrollIntoView({ block: "start", behavior: "smooth" });
  }
}

export const todayActions: Record<string, ActionHandler> = {
  placementAnswer(app, el) {
    const st = (app.ui.placement ??= { index: 0, answers: [] });
    st.answers[st.index] = Number(el.dataset.option);
    st.index++;
    app.render();
  },
  placementStart(app, el) {
    const progress = app.store.progress;
    progress.startWeek = numberData(el, "week");
    progress.startDate = today();
    app.store.saveProgress();
    app.ui.placement = null;
    app.ui.today = newSession(app.week);
    app.renderNow();
    window.scrollTo(0, 0);
  },
  placementRetry(app) {
    app.ui.placement = { index: 0, answers: [] };
    app.render();
  },
  placementSkip(app) {
    app.store.progress.startWeek = 1;
    app.store.ensureStarted();
    app.store.saveProgress();
    app.ui.placement = null;
    app.render();
  },
  placementCancel(app) {
    app.ui.placement = null;
    app.render();
  },
  placementOpen(app) {
    app.ui.placement = { index: 0, answers: [] };
    app.setTab("home");
  },
  todayLessonPage(app, el) {
    const s = session(app);
    s.lessonPage = Math.max(0, s.lessonPage + numberData(el, "step"));
    app.renderNow();
    document.getElementById("today-current")?.scrollIntoView({ block: "start" });
  },
  todayReveal(app, el) {
    const j = numberData(el, "index");
    const s = session(app);
    if (!s.revealed.includes(j)) s.revealed.push(j);
    const drill = lessonOf(app.week).drills[j];
    if (drill) app.say(drill.en);
    app.render();
  },
  todayLessonDone(app) {
    advance(app, () => app.track("clip"));
  },
  todayFlip(app) {
    const s = session(app);
    s.deck.flipped = !s.deck.flipped;
    app.render();
  },
  todayAnswer(app, el) {
    const s = session(app);
    const key = s.deck.keys.shift();
    if (!key) return;
    const known = el.dataset.known === "1";
    const { progress, dictionary } = app.store;
    progress.srs[key] = review(progress.srs[key], known);
    if (known) progress.known[dictionary.get(key)!.en] = 1;
    else s.deck.keys.splice(Math.min(3, s.deck.keys.length), 0, key);
    s.deck.flipped = false;
    app.store.saveProgress();
    advance(app, () => app.track(el.dataset.kind === "review" ? "review" : "vocab"));
  },
  todayDeckRestart(app) {
    session(app).deck.id = "";
    app.render();
  },
  todayDictPlay(app, el) {
    const set = sentencesFor(app.week);
    const item = set[session(app).dictation.index % set.length]!;
    app.say(item.en, el.dataset.slow ? 0.6 : undefined);
  },
  todayDictCheck(app) {
    const s = session(app).dictation;
    const input = (document.getElementById("today-dict") as HTMLInputElement | null)?.value ?? "";
    if (!input.trim()) return;
    const set = sentencesFor(app.week);
    s.input = input;
    s.result = { ...compare(set[s.index % set.length]!.en, input), input };
    advance(app, () => app.track("dictation"));
  },
  todayDictNext(app) {
    const s = session(app).dictation;
    Object.assign(s, { index: s.index + 1, input: "", result: null });
    app.renderNow();
    const set = sentencesFor(app.week);
    app.say(set[s.index % set.length]!.en);
    document.getElementById("today-dict")?.focus();
  },
  todaySpeak(app) {
    const s = session(app).speaking;
    if (isListening()) return;
    const set = sentencesFor(app.week);
    const target = set[s.index % set.length]!.en;
    listen({
      onStateChange: () => app.render(),
      onDone: (heard) => {
        if (!heard.trim()) return;
        s.result = { ...compare(target, heard), heard };
        advance(app, () => app.track("speaking"));
      },
    });
  },
  todaySpokeAloud(app) {
    const s = session(app).speaking;
    s.index++;
    advance(app, () => app.track("speaking"));
  },
  todaySpeakNext(app) {
    const s = session(app).speaking;
    Object.assign(s, { index: s.index + 1, result: null });
    app.render();
  },
  todaySaveKey(app) {
    const key =
      (document.getElementById("today-key") as HTMLInputElement | null)?.value.trim() ?? "";
    if (!key) return;
    writeString(STORAGE_KEYS.apiKey, key);
    app.render();
  },
  todaySkip(app, el) {
    advance(app, () => app.track(skipKind(numberData(el, "index"))));
  },
};
