import { STAGES, WEEKS } from "../../data/curriculum";
import { STAGE_TEST_PASS, STAGE_TEST_SIZE } from "../../domain/worksheets";
import { numberData, type ActionHandler, type App } from "../app";
import { header } from "../components";
import { html, type SafeHtml } from "../html";
import { weekCard } from "./home";

export function planView(app: App): SafeHtml {
  const current = app.week;
  const selected = app.ui.planWeek ?? current;
  const { clips, scores } = app.store.progress;
  return html`${header(current)}
    <div class="track">
      ${STAGES.map((s) => {
        const on = selected >= s.weeks[0] && selected <= s.weeks[1];
        return html`<button
          class="${on ? "on" : ""}"
          style="${on ? `background:${s.color}` : ""}"
          data-action="selectWeek"
          data-week="${s.weeks[0]}"
        >
          <b>${s.id}단계</b><span>${s.weeks[0]}~${s.weeks[1]}주</span>
        </button>`;
      })}
    </div>
    ${weekCard(app, selected)}
    ${STAGES.map((s) => {
      const test = scores[`t${s.id}`];
      return html`<section class="card">
        <div class="stagehead">
          <div class="row">
            <span class="dot" style="background:${s.color}"></span>
            <h2>${s.id}단계 · ${s.name}</h2>
            ${test !== undefined ? html`<span class="chip ${test >= STAGE_TEST_PASS ? "ok" : "warn"}">테스트 ${test}/${STAGE_TEST_SIZE}</span>` : ""}
          </div>
          <p class="small muted">
            ${s.weeks[0]}~${s.weeks[1]}주차 (약
            ${Math.round((s.weeks[1] - s.weeks[0] + 1) / 4.3)}개월) · ${s.goal}
          </p>
        </div>
        <div class="weeks">
          ${WEEKS.slice(s.weeks[0] - 1, s.weeks[1]).map((w) => {
            const best = scores[`w${w.week}`];
            return html`<button
              class="wk ${w.week === current ? "cur" : ""}"
              data-action="selectWeek"
              data-week="${w.week}"
            >
              <span class="n">W${w.week}</span><span class="t">${w.title}</span>
              ${clips[w.week] ? html`<span class="ck">✓ 클립</span>` : ""}
              ${best !== undefined ? html`<span class="ck">${best}/8</span>` : ""}
              ${w.week === current ? html`<span class="chip">이번 주</span>` : ""}
            </button>`;
          })}
        </div>
      </section>`;
    })}`;
}

export const planActions: Record<string, ActionHandler> = {
  selectWeek(app, el) {
    app.ui.planWeek = numberData(el, "week");
    app.renderNow();
    window.scrollTo(0, 0);
  },
};
