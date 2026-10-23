/**
 * Worksheets tab: weekly sheets, stage review sheets, stage tests, AI-generated
 * sheets, dictation and speaking (shadowing) practice.
 */
import { completeJson } from "../../ai/client";
import { errorMessage } from "../../ai/errors";
import { worksheetPrompt } from "../../ai/prompts";
import { STAGES, TOTAL_WEEKS, weekInfo } from "../../data/curriculum";
import { compare, sentencesFor, SENTENCES_PER_WEEK } from "../../domain/dictation";
import {
  STAGE_TEST_PASS,
  isAnswered,
  isCorrect,
  scoreSheet,
  stageSheet,
  stageTest,
  weekSheet,
  type Answer,
} from "../../domain/worksheets";
import { isAvailable, isListening, listen } from "../../speech/recognition";
import type { ChoiceQuestion, Question } from "../../types";
import { numberData, type ActionHandler, type App } from "../app";
import { errorText, header, segmented, speakButton, weekNav } from "../components";
import { html, raw, type SafeHtml } from "../html";
import type { SheetMode } from "../state";

const MODES: { id: SheetMode; label: string }[] = [
  { id: "week", label: "주차별" },
  { id: "stage", label: "단계 종합" },
  { id: "test", label: "단계 테스트" },
  { id: "dictation", label: "받아쓰기" },
  { id: "speaking", label: "따라 말하기" },
];

interface ActiveSheet {
  key: string;
  title: string;
  questions: Question[];
}

function activeSheet(app: App): ActiveSheet {
  const ui = app.ui;
  const week = ui.sheetWeek ?? app.week;
  const stageId = ui.sheetStage ?? app.stage.id;
  switch (ui.sheetMode) {
    case "test":
      return {
        key: `t${stageId}`,
        title: `${stageId}단계 테스트 · 20문항 · ${STAGE_TEST_PASS}개 이상이면 통과`,
        questions: stageTest(stageId),
      };
    case "stage":
      return {
        key: `s${stageId}`,
        title: `${stageId}단계 종합 학습지`,
        questions: stageSheet(stageId),
      };
    case "ai":
      if (ui.aiSheet) {
        return {
          key: "ai",
          title: `AI가 만든 ${ui.aiSheet.topic} 학습지`,
          questions: ui.aiSheet.questions,
        };
      }
      return {
        key: `w${week}`,
        title: `${week}주차 · ${weekInfo(week).title}`,
        questions: weekSheet(week),
      };
    default:
      return {
        key: `w${week}`,
        title: `${week}주차 · ${weekInfo(week).title}`,
        questions: weekSheet(week),
      };
  }
}

function modeTabs(app: App): SafeHtml {
  const modes = app.ui.aiSheet ? [...MODES, { id: "ai" as const, label: "AI 학습지" }] : MODES;
  return segmented(modes, app.ui.sheetMode, "sheetMode");
}

function questionView(
  q: Question,
  index: number,
  key: string,
  answer: Answer | undefined,
): SafeHtml {
  if (q.kind === "order") {
    const picked = Array.isArray(answer) ? answer : [];
    const full = isAnswered(q, answer);
    const ok = isCorrect(q, answer);
    return html`<div class="q">
      <span class="qt">${index + 1}. ${q.prompt}</span>
      <div class="tokens">
        ${
          picked.length
            ? picked.map((j) => html`<span class="tok">${q.tokens[j]}</span>`)
            : html`<span class="small muted">아래 단어를 순서대로 누르세요</span>`
        }
      </div>
      <div class="opts">
        ${q.tokens.map((t, j) =>
          picked.includes(j)
            ? ""
            : html`<button
                class="opt"
                data-action="pickToken"
                data-key="${key}"
                data-q="${index}"
                data-token="${j}"
              >
                ${t}
              </button>`,
        )}
      </div>
      ${
        full
          ? html`<span class="exp ${ok ? "good" : "bad"}"
              ><b>${ok ? "정답!" : "아쉬워요."}</b> ${q.answer} ${q.explanation}
              ${speakButton(q.answer, "🔊 듣기")}</span
            >`
          : picked.length
            ? html`<button
                class="btn sm"
                data-action="clearTokens"
                data-key="${key}"
                data-q="${index}"
              >
                다시 놓기
              </button>`
            : ""
      }
    </div>`;
  }
  return choiceView(q, index, key, answer);
}

function choiceView(
  q: ChoiceQuestion,
  index: number,
  key: string,
  answer: Answer | undefined,
): SafeHtml {
  const answered = typeof answer === "number";
  const showAudio = q.audio && (q.listening || !q.audioAfterAnswer || answered);
  return html`<div class="q">
    <span class="qt"
      >${index + 1}. ${q.prompt}
      ${showAudio ? speakButton(q.audio!, q.listening ? "🔊 듣기" : "🔊 발음") : ""}</span
    >
    <div class="opts">
      ${q.options.map((o, j) => {
        const state = !answered ? "" : j === q.answerIndex ? "right" : j === answer ? "wrong" : "";
        return html`<button
          class="opt ${state}"
          data-action="pickOption"
          data-key="${key}"
          data-q="${index}"
          data-option="${j}"
          ${answered ? raw("disabled") : ""}
        >
          ${o}
        </button>`;
      })}
    </div>
    ${
      answered
        ? html`<span class="exp"
            ><b class="${answer === q.answerIndex ? "good" : "bad"}"
              >${answer === q.answerIndex ? "정답!" : "오답"}</b
            >
            ${q.explanation}</span
          >`
        : ""
    }
  </div>`;
}

function worksheetView(app: App): SafeHtml {
  const ui = app.ui;
  const sheet = activeSheet(app);
  const answers = ui.answers[sheet.key] ?? {};
  const best = app.store.progress.scores[sheet.key];
  const score = scoreSheet(sheet.questions, answers);
  const week = ui.sheetWeek ?? app.week;
  const stageId = ui.sheetStage ?? app.stage.id;
  return html`<section class="card">
      <h2>학습지</h2>
      ${modeTabs(app)} ${ui.sheetMode === "week" ? weekNav(week, "sheetWeek") : ""}
      ${
        ui.sheetMode === "stage" || ui.sheetMode === "test"
          ? segmented(
              STAGES.map((s) => ({ id: String(s.id), label: `${s.id}단계` })),
              String(stageId),
              "sheetStage",
            )
          : ""
      }
      <p class="small muted">
        ${sheet.title} · 보기를 누르면 바로
        채점돼요${best !== undefined ? ` · 최고 점수 ${best}/${sheet.questions.length}` : ""}
      </p>
      ${sheet.questions.map((q, i) => questionView(q, i, sheet.key, answers[i]))}
      <div class="row">
        <span class="chip"
          >점수 ${score.correct} /
          ${score.total}${score.answered < score.total ? " (푸는 중)" : ""}</span
        >
        <button class="btn sm" data-action="resetSheet" data-key="${sheet.key}">다시 풀기</button>
      </div>
    </section>
    <section class="card">
      <h3>AI로 새 학습지 만들기</h3>
      <p class="small muted">
        현재 주차 주제(${weekInfo(app.week).title})로 새 문제 8개를 만들어요. 본인 Claude API
        사용량이 조금 쓰여요.
      </p>
      <div class="row">
        <button
          class="btn primary"
          data-action="generateSheet"
          ${ui.generating ? raw("disabled") : ""}
        >
          ${ui.generating ? "만드는 중…" : "새 학습지 만들기"}
        </button>
      </div>
      ${errorText(ui.generateError)}
    </section>`;
}

function dictationView(app: App, week: number): SafeHtml {
  const set = sentencesFor(week);
  if (app.ui.dictation?.week !== week) {
    app.ui.dictation = { week, index: 0, results: [], input: "", checked: false, hint: false };
  }
  const st = app.ui.dictation;
  const best = app.store.progress.scores[`d${week}`];
  let body: SafeHtml;
  if (st.index >= set.length) {
    const correct = st.results.filter(Boolean).length;
    body = html`<div class="flash">
      <span class="w">${correct} / ${set.length} 정답</span>
      <span class="small muted"
        >${correct >= 8 ? "귀가 트이고 있어요!" : "틀린 문장은 '천천히'로 다시 들어 보세요."}</span
      >
      <button class="btn primary" data-action="dictationRestart">다시 하기</button>
    </div>`;
  } else {
    const item = set[st.index]!;
    const result = st.checked ? compare(item.en, st.input) : null;
    body = html`<div class="q">
      <span class="qt">${st.index + 1} / ${set.length} · 듣고 그대로 써 보세요</span>
      <div class="row">
        <button class="btn primary" data-action="dictationPlay">🔊 듣기</button>
        <button class="btn" data-action="dictationPlay" data-slow="1">🐢 천천히</button>
        <button class="btn sm" data-action="dictationHint">${st.hint ? item.ko : "뜻 힌트"}</button>
      </div>
      <label class="sr-only" for="dictation-input">들린 문장</label>
      <input
        id="dictation-input"
        class="field"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        placeholder="들린 영어를 쓰세요"
        value="${st.input}"
        ${st.checked ? raw("disabled") : ""}
      />
      ${
        result
          ? html`${comparisonView(result)}
              <span class="exp"
                ><b class="${result.exact ? "good" : "bad"}"
                  >${result.exact ? "완벽해요!" : "초록은 맞힌 단어, 빨강은 놓친 단어예요."}</b
                >
                ${item.ko}</span
              >
              <button class="btn primary" data-action="dictationNext">
                ${st.index + 1 < set.length ? "다음 문장 →" : "결과 보기"}
              </button>`
          : html`<button class="btn primary" data-action="dictationCheck">확인</button>`
      }
    </div>`;
  }
  return html`<section class="card">
    <h2>학습지</h2>
    ${modeTabs(app)}${weekNav(week, "sheetWeek")}
    <p class="small muted">
      ${week}주차 문장 ${SENTENCES_PER_WEEK}개를 듣고 받아써요. 대소문자·문장부호는 채점하지
      않아요.${best !== undefined ? ` · 최고 ${best}/${SENTENCES_PER_WEEK}` : ""}
    </p>
    ${body}
  </section>`;
}

function comparisonView(c: { words: string[]; hit: Set<number> }): SafeHtml {
  return html`<div class="dres">
    ${c.words.map((w, i) => html`<span class="${c.hit.has(i) ? "ok" : "no"}">${w}</span> `)}
  </div>`;
}

function speakingView(app: App, week: number): SafeHtml {
  const set = sentencesFor(week);
  if (app.ui.speaking?.week !== week) app.ui.speaking = { week, index: 0, best: {}, result: null };
  const st = app.ui.speaking;
  const item = set[st.index] ?? set[0]!;
  const tries = Object.values(st.best);
  const mean = tries.length ? Math.round(tries.reduce((a, b) => a + b, 0) / tries.length) : null;
  const weekBest = app.store.progress.scores[`p${week}`];
  const mic = isAvailable();
  const res = st.result;
  return html`<section class="card">
    <h2>학습지</h2>
    ${modeTabs(app)}${weekNav(week, "sheetWeek")}
    <p class="small muted">
      문장을 듣고 똑같이 말하면 음성 인식으로 몇 % 맞았는지
      채점해요.${weekBest !== undefined ? ` · 이번 주 최고 평균 ${weekBest}%` : ""}
    </p>
    <div class="q">
      <span class="qt">${st.index + 1} / ${set.length}</span>
      <span class="en big">${item.en}</span><span class="small muted">${item.ko}</span>
      <div class="row">
        <button class="btn" data-action="speakingPlay">🔊 듣기</button>
        <button class="btn" data-action="speakingPlay" data-slow="1">🐢 천천히</button>
        ${
          mic
            ? html`<button
                class="btn primary mic ${isListening() ? "rec" : ""}"
                data-action="speakingRecord"
              >
                🎤 ${isListening() ? "듣는 중…" : "따라 말하기"}
              </button>`
            : ""
        }
      </div>
      ${mic ? "" : html`<span class="small muted">이 브라우저에서는 마이크를 쓸 수 없어요. 소리 내서 따라 읽어 보세요.</span>`}
      ${
        res
          ? html`${comparisonView(res)}
              <span class="exp"
                ><b class="${res.accuracy >= 80 ? "good" : "bad"}">${res.accuracy}%</b> 들린 말:
                "${res.heard}"
                ${res.accuracy >= 80 ? "좋아요!" : "빨간 단어를 또박또박 다시 말해 보세요."}</span
              >`
          : ""
      }
      <div class="row">
        <button
          class="btn sm"
          data-action="speakingMove"
          data-step="-1"
          ${st.index <= 0 ? raw("disabled") : ""}
        >
          ← 이전
        </button>
        <button
          class="btn sm"
          data-action="speakingMove"
          data-step="1"
          ${st.index >= set.length - 1 ? raw("disabled") : ""}
        >
          다음 →
        </button>
        <button class="btn sm" data-action="saveSentence" data-en="${item.en}" data-ko="${item.ko}">
          ⭐ 어려운 문장 저장
        </button>
      </div>
    </div>
    ${mean !== null ? html`<p class="small">이번 연습 평균 <b>${mean}%</b> (${tries.length}문장)</p>` : ""}
  </section>`;
}

export function sheetView(app: App): SafeHtml {
  const week = app.ui.sheetWeek ?? app.week;
  const body =
    app.ui.sheetMode === "dictation"
      ? dictationView(app, week)
      : app.ui.sheetMode === "speaking"
        ? speakingView(app, week)
        : worksheetView(app);
  return html`${header(app.week)}${body}`;
}

/** Records the best score once every question of a built-in sheet is answered. */
function recordScore(app: App, key: string): void {
  if (key === "ai") return;
  const sheet = activeSheet(app);
  if (sheet.key !== key) return;
  const score = scoreSheet(sheet.questions, app.ui.answers[key] ?? {});
  if (key === `w${app.week}`) app.track("sheet", score.answered, "max");
  if (score.answered < score.total) return;
  const best = app.store.progress.scores[key];
  if (best === undefined || score.correct > best) {
    app.store.progress.scores[key] = score.correct;
    app.store.saveProgress();
  }
}

function sheetAnswers(app: App, key: string): Record<number, Answer> {
  return (app.ui.answers[key] ??= {});
}

interface GeneratedQuestion {
  q?: unknown;
  o?: unknown;
  a?: unknown;
  e?: unknown;
}

export const sheetActions: Record<string, ActionHandler> = {
  sheetMode(app, el) {
    app.ui.sheetMode = el.dataset.value as SheetMode;
    app.render();
  },
  sheetWeek(app, el) {
    app.ui.sheetWeek = Math.min(TOTAL_WEEKS, Math.max(1, numberData(el, "week")));
    app.render();
  },
  sheetStage(app, el) {
    app.ui.sheetStage = Number(el.dataset.value);
    app.render();
  },
  pickOption(app, el) {
    const key = el.dataset.key!;
    sheetAnswers(app, key)[numberData(el, "q")] = numberData(el, "option");
    recordScore(app, key);
    app.render();
  },
  pickToken(app, el) {
    const key = el.dataset.key!;
    const answers = sheetAnswers(app, key);
    const q = numberData(el, "q");
    const current = Array.isArray(answers[q]) ? (answers[q] as number[]) : [];
    answers[q] = [...current, numberData(el, "token")];
    recordScore(app, key);
    app.render();
  },
  clearTokens(app, el) {
    Reflect.deleteProperty(sheetAnswers(app, el.dataset.key!), numberData(el, "q"));
    app.render();
  },
  resetSheet(app, el) {
    app.ui.answers[el.dataset.key!] = {};
    app.render();
  },
  async generateSheet(app) {
    const ui = app.ui;
    ui.generating = true;
    ui.generateError = "";
    app.render();
    try {
      const generated = await completeJson<GeneratedQuestion[]>(worksheetPrompt(app.week));
      const questions: Question[] = (Array.isArray(generated) ? generated : [])
        .filter(
          (x) =>
            typeof x.q === "string" &&
            Array.isArray(x.o) &&
            x.o.length >= 2 &&
            Number.isInteger(x.a) &&
            (x.a as number) >= 0 &&
            (x.a as number) < x.o.length,
        )
        .slice(0, 8)
        .map((x) => ({
          kind: "choice" as const,
          prompt: String(x.q),
          options: (x.o as unknown[]).map(String),
          answerIndex: x.a as number,
          explanation: typeof x.e === "string" ? x.e : "",
        }));
      if (questions.length < 3) throw new Error("too few questions");
      ui.aiSheet = { topic: weekInfo(app.week).title, questions };
      ui.answers.ai = {};
      ui.sheetMode = "ai";
    } catch (err) {
      ui.generateError =
        err instanceof Error && err.name !== "AiError"
          ? "문제를 제대로 만들지 못했어요. 다시 눌러 주세요."
          : errorMessage(err);
    }
    ui.generating = false;
    app.render();
  },

  // ----- dictation -----
  dictationPlay(app, el) {
    const st = app.ui.dictation;
    const item = st && sentencesFor(st.week)[st.index];
    if (item) app.say(item.en, el.dataset.slow ? 0.6 : undefined);
  },
  dictationHint(app) {
    if (app.ui.dictation) app.ui.dictation.hint = true;
    app.render();
  },
  dictationCheck(app) {
    const st = app.ui.dictation;
    if (!st) return;
    st.input = (document.getElementById("dictation-input") as HTMLInputElement | null)?.value ?? "";
    if (!st.input.trim()) return;
    st.checked = true;
    st.results[st.index] = compare(sentencesFor(st.week)[st.index]!.en, st.input).exact;
    app.track("dictation");
    app.render();
  },
  dictationNext(app) {
    const st = app.ui.dictation;
    if (!st) return;
    const set = sentencesFor(st.week);
    Object.assign(st, { index: st.index + 1, input: "", checked: false, hint: false });
    if (st.index >= set.length) {
      const correct = st.results.filter(Boolean).length;
      const key = `d${st.week}`;
      const best = app.store.progress.scores[key];
      if (best === undefined || correct > best) {
        app.store.progress.scores[key] = correct;
        app.store.saveProgress();
      }
    } else {
      app.say(set[st.index]!.en);
    }
    app.render();
  },
  dictationRestart(app) {
    const st = app.ui.dictation;
    if (st)
      app.ui.dictation = {
        week: st.week,
        index: 0,
        results: [],
        input: "",
        checked: false,
        hint: false,
      };
    app.render();
  },

  // ----- speaking -----
  speakingPlay(app, el) {
    const st = app.ui.speaking;
    const item = st && sentencesFor(st.week)[st.index];
    if (item) app.say(item.en, el.dataset.slow ? 0.6 : undefined);
  },
  speakingMove(app, el) {
    const st = app.ui.speaking;
    if (!st) return;
    const last = sentencesFor(st.week).length - 1;
    st.index = Math.min(last, Math.max(0, st.index + numberData(el, "step")));
    st.result = null;
    app.render();
  },
  speakingRecord(app) {
    const st = app.ui.speaking;
    if (!st || isListening()) return;
    const target = sentencesFor(st.week)[st.index]!.en;
    listen({
      onStateChange: () => app.render(),
      onDone: (heard) => {
        if (!heard.trim()) return;
        const result = compare(target, heard);
        st.result = { ...result, heard };
        app.track("speaking");
        st.best[st.index] = Math.max(st.best[st.index] ?? 0, result.accuracy);
        const tries = Object.values(st.best);
        const mean = Math.round(tries.reduce((a, b) => a + b, 0) / tries.length);
        const key = `p${st.week}`;
        const best = app.store.progress.scores[key];
        if (tries.length >= 3 && (best === undefined || mean > best)) {
          app.store.progress.scores[key] = mean;
          app.store.saveProgress();
        }
        app.render();
      },
    });
  },
};
