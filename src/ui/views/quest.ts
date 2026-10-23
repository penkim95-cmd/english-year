/**
 * Strip above the tab bar that keeps today's study in sight on the other tabs.
 * The study itself runs on the home screen (see today.ts).
 */
import type { ActionHandler, App } from "../app";
import { html, type SafeHtml } from "../html";

/** Strip above the tab bar on the other tabs: where today's study stands, one tap back to it. */
export function questBar(app: App): SafeHtml {
  if (app.ui.tab === "home") return html``;
  const quest = app.quest;
  const step = quest.current;
  if (!step) return html``;
  return html`<div class="qbar">
    <span class="qbt"
      ><b>오늘의 공부 ${quest.doneCount}/${quest.steps.length} · ${step.index + 1}단계</b>
      <small
        >${step.label}${step.goal > 1 ? ` · ${step.progress} / ${step.goal}${step.unit}` : ""}</small
      ></span
    >
    <button class="btn sm primary" data-action="questGo">이어서 하기</button>
  </div>`;
}

export const questActions: Record<string, ActionHandler> = {
  questGo(app) {
    app.setTab("home");
    document.getElementById("today-current")?.scrollIntoView({ block: "start" });
  },
};
