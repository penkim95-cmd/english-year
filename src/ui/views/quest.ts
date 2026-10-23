/**
 * Daily quest UI: the step list on the home screen and the strip above the
 * tab bar that shows the current step (or "step done → next") everywhere else.
 */
import { manualKind, type Quest, type QuestStep } from "../../domain/quest";
import type { TaskTarget } from "../../types";
import { numberData, type ActionHandler, type App, type Destination } from "../app";
import { html, type SafeHtml } from "../html";
import type { Tab } from "../state";

const DESTINATION: Partial<Record<TaskTarget, Destination>> = {
  clip: "clip",
  vocab: "vocab",
  review: "review",
  sheet: "sheet",
  dictation: "dictation",
  speaking: "speaking",
  friend: "friend",
  scene: "scene",
  writing: "writing",
  voice: "voice",
};

/** Tab where each kind of step is done (the bar stays compact there). */
const TAB_OF: Partial<Record<TaskTarget, Tab>> = {
  vocab: "vocab",
  review: "vocab",
  sheet: "sheet",
  dictation: "sheet",
  speaking: "sheet",
  friend: "chat",
  scene: "chat",
  writing: "chat",
  voice: "chat",
};

const pct = (s: QuestStep) => Math.round((100 * s.progress) / s.goal);

function meter(step: QuestStep): SafeHtml {
  return html`<div
    class="qmeter"
    role="progressbar"
    aria-valuenow="${step.progress}"
    aria-valuemin="0"
    aria-valuemax="${step.goal}"
  >
    <i style="width:${pct(step)}%"></i>
  </div>`;
}

function stepAction(step: QuestStep): SafeHtml {
  if (step.target === "none") {
    return html`<button class="btn primary" data-action="questManual" data-index="${step.index}">
      했어요 ✓
    </button>`;
  }
  return html`<button class="btn primary" data-action="questGo" data-index="${step.index}">
    ${step.progress ? "이어서 하기 →" : "시작하기 →"}
  </button>`;
}

function stepView(step: QuestStep, total: number): SafeHtml {
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
      <span class="qn" aria-hidden="true">🔒</span>
      <span class="qt"
        ><b>${n}단계</b> ${step.label}<small>${n - 1}단계를 끝내면 열려요</small></span
      >
    </div>`;
  }
  return html`<div class="qstep current" aria-current="step">
    <span class="qlabel">STEP ${n} / ${total} · 지금 할 일 · 약 ${step.minutes}분</span>
    <b class="qtitle">${step.label}</b>
    <p class="small">${step.how}</p>
    ${
      step.goal > 1
        ? html`${meter(step)}<span class="small muted"
              >${step.progress} / ${step.goal}${step.unit} · 채우면 자동으로 다음 단계가
              열려요</span
            >`
        : ""
    }
    ${stepAction(step)}
  </div>`;
}

function summary(quest: Quest): SafeHtml {
  return html`<div class="qsegs" aria-hidden="true">
    ${quest.steps.map((s) => html`<i class="${s.state}"></i>`)}
  </div>`;
}

/** Home screen card. */
export function questCard(app: App): SafeHtml {
  const quest = app.quest;
  const started = !!app.store.progress.startDate;
  return html`<section class="card quest">
    <div class="row between">
      <h2>오늘의 퀘스트</h2>
      <span class="chip ${quest.complete ? "ok" : ""}"
        >완료 ${quest.doneCount} / ${quest.steps.length}</span
      >
    </div>
    ${summary(quest)}
    ${
      started
        ? ""
        : html`<div class="note">
            시작일을 정하면 주차가 날짜에 맞춰 넘어가요.
            <button class="btn sm primary" data-action="startCourse">오늘부터 시작</button>
          </div>`
    }
    ${
      quest.complete
        ? html`<div class="qdone">
            <b>🎉 오늘 퀘스트 완료!</b
            ><span class="small"
              >오늘치는 여기까지예요. 더 하고 싶으면 아래 탭에서 자유롭게 공부하세요.</span
            >
          </div>`
        : ""
    }
    <div class="qsteps">${quest.steps.map((s) => stepView(s, quest.steps.length))}</div>
    <p class="small muted">
      위에서부터 순서대로 하면 돼요. 한 단계를 채우면 다음 단계가 열리고, 어느 화면에 있든 아래
      퀘스트 바에서 지금 할 일을 볼 수 있어요.
    </p>
  </section>`;
}

/** Strip above the tab bar. Empty on the home screen (the card is there). */
export function questBar(app: App): SafeHtml {
  const quest = app.quest;
  const toast = app.ui.questToast;
  if (toast) {
    const finished = quest.steps[toast.stepIndex];
    const next = quest.current;
    return html`<div class="qbar toast" role="status">
      <span class="qbt"
        ><b>✓ ${(finished?.index ?? 0) + 1}단계 완료!</b>
        <small
          >${next ? `다음: ${next.index + 1}단계 · ${next.label}` : "오늘 퀘스트를 모두 끝냈어요 🎉"}</small
        ></span
      >
      ${next ? html`<button class="btn sm primary" data-action="questNext">다음 단계로 →</button>` : ""}
      <button class="x" data-action="questDismiss" aria-label="닫기">×</button>
    </div>`;
  }
  const step = quest.current;
  if (app.ui.tab === "home" || !step) return html``;
  const here = TAB_OF[step.target] === app.ui.tab;
  return html`<div class="qbar">
    <span class="qbt"
      ><b>퀘스트 ${step.index + 1}/${quest.steps.length} · ${step.label}</b>
      <small
        >${step.goal > 1 ? `${step.progress} / ${step.goal}${step.unit}` : step.how}</small
      ></span
    >
    ${step.goal > 1 ? html`<span class="qring" style="--p:${pct(step)}">${pct(step)}%</span>` : ""}
    ${here ? "" : html`<button class="btn sm" data-action="questGo" data-index="${step.index}">이동</button>`}
    <button class="btn sm" data-action="tab" data-tab="home" aria-label="퀘스트 전체 보기">
      목록
    </button>
  </div>`;
}

function goToStep(app: App, index: number): void {
  const step = app.quest.steps[index];
  const destination = step && DESTINATION[step.target];
  app.ui.questToast = null;
  if (destination) app.go(destination);
  else app.setTab("home");
}

export const questActions: Record<string, ActionHandler> = {
  questGo(app, el) {
    goToStep(app, numberData(el, "index"));
  },
  questNext(app) {
    const next = app.quest.current;
    if (next) goToStep(app, next.index);
  },
  questManual(app, el) {
    app.track(manualKind(numberData(el, "index")));
    app.render();
  },
  questDismiss(app) {
    app.ui.questToast = null;
    app.render();
  },
};
