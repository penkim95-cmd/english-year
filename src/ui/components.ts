/** Small presentational helpers shared by several views. */
import { TOTAL_WEEKS, stageOf } from "../data/curriculum";
import { cardStatus } from "../domain/srs";
import type { Friend, SrsRecord } from "../types";
import { html, raw, type SafeHtml } from "./html";

export function header(week: number): SafeHtml {
  const stage = stageOf(week);
  const pct = Math.round((week / TOTAL_WEEKS) * 100);
  return html`<div class="top">
      <div>
        <div class="day">Week ${week} / ${TOTAL_WEEKS}</div>
        <h1>나의 영어 1년</h1>
      </div>
      <span class="chip st" style="background:${stage.color}">${stage.id}단계 · ${stage.name}</span>
    </div>
    <div
      class="bar"
      role="progressbar"
      aria-label="1년 진행률"
      aria-valuenow="${pct}"
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <i style="width:${pct}%"></i>
    </div>`;
}

export function weekNav(week: number, action: string): SafeHtml {
  return html`<div class="wnav">
    <button
      class="btn sm"
      data-action="${action}"
      data-week="${week - 1}"
      ${week <= 1 ? raw("disabled") : ""}
    >
      ← 이전 주
    </button>
    <b>W${week}</b>
    <button
      class="btn sm"
      data-action="${action}"
      data-week="${week + 1}"
      ${week >= TOTAL_WEEKS ? raw("disabled") : ""}
    >
      다음 주 →
    </button>
  </div>`;
}

export interface SegmentOption {
  id: string;
  label: string;
}

/** Segmented control. Each button carries data-action and data-value. */
export function segmented(options: SegmentOption[], current: string, action: string): SafeHtml {
  return html`<div class="seg">
    ${options.map(
      (o) =>
        html`<button
          class="${o.id === current ? "on" : ""}"
          data-action="${action}"
          data-value="${o.id}"
        >
          ${o.label}
        </button>`,
    )}
  </div>`;
}

const STATUS_CHIP = {
  new: html`<span class="chip">새 단어</span>`,
  relearn: html`<span class="chip warn">다시 보기</span>`,
  mastered: html`<span class="chip ok">외움</span>`,
};

export function statusChip(record: SrsRecord | undefined): SafeHtml {
  const status = cardStatus(record);
  return status === "learning"
    ? html`<span class="chip">익히는 중 ${record!.b}/3</span>`
    : STATUS_CHIP[status];
}

export function avatar(friend: Pick<Friend, "name" | "color">, size: number): SafeHtml {
  return html`<span
    class="av"
    style="background:${friend.color};width:${size}px;height:${size}px;font-size:${Math.round(size * 0.42)}px"
    >${friend.name[0]}</span
  >`;
}

export function speakButton(text: string, label = "🔊"): SafeHtml {
  return html`<button class="speak" data-action="speak" data-text="${text}">${label}</button>`;
}

export function errorText(message: string): SafeHtml {
  return message ? html`<p class="small error">${message}</p>` : html``;
}
