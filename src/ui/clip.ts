/**
 * Lesson clip player: a full-screen, story-style slide show that narrates each
 * week's lesson with the device voice (cover → 3 points → speaking drill → tip).
 *
 * Narration is a queue of steps. Every navigation bumps `token`, which silently
 * cancels any queue still running, so slides never talk over each other.
 */
import { LESSONS, TOTAL_WEEKS, lessonOf, stageOf, weekInfo } from "../data/curriculum";
import { say, speak, stopSpeaking } from "../speech/tts";
import type { LessonPoint } from "../types";
import type { App } from "./app";
import { html, mount, raw, type SafeHtml } from "./html";

type Slide =
  | { type: "cover" }
  | { type: "point"; point: LessonPoint; n: number }
  | { type: "drill" }
  | { type: "end" };

type Step =
  | { kind: "say"; text: string; lang: "en-US" | "ko-KR" }
  | { kind: "pause"; ms: number }
  | { kind: "do"; run: () => void };

/** Turns display text ("go → went · 과거") into something worth reading aloud. */
export function spokenText(text: string): string {
  return text
    .split("·")[0]!
    .replace(/→/g, ", ")
    .replace(/\s\/\s/g, ", ")
    .replace(/~/g, "")
    .trim();
}

function slidesFor(week: number): Slide[] {
  const lesson = lessonOf(week);
  return [
    { type: "cover" },
    ...lesson.points.map((point, i): Slide => ({ type: "point", point, n: i + 1 })),
    { type: "drill" },
    { type: "end" },
  ];
}

export class ClipPlayer {
  private week = 1;
  private slides: Slide[] = [];
  private index = 0;
  private playing = false;
  private muted = false;
  private revealed = new Set<number>();
  private highlight = -1;
  private token = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private cancelSay: (() => void) | undefined;
  private app: App | undefined;

  constructor(private readonly el: HTMLElement) {
    el.addEventListener("click", (e) => this.onClick(e));
    document.addEventListener("keydown", (e) => {
      if (!this.isOpen) return;
      if (e.key === "Escape") this.close();
      else if (e.key === "ArrowRight") this.move(1);
      else if (e.key === "ArrowLeft") this.move(-1);
    });
  }

  get isOpen(): boolean {
    return !this.el.hidden;
  }

  open(app: App, week: number): void {
    this.stop();
    this.app = app;
    this.week = Math.min(TOTAL_WEEKS, Math.max(1, week));
    this.slides = slidesFor(this.week);
    Object.assign(this, { index: 0, playing: true, muted: false, highlight: -1 });
    this.revealed = new Set();
    this.el.hidden = false;
    document.body.classList.add("noscroll");
    this.render();
    this.narrate();
  }

  close(): void {
    this.stop();
    this.el.hidden = true;
    this.el.replaceChildren();
    document.body.classList.remove("noscroll");
    this.app?.render();
  }

  private stop(): void {
    stopSpeaking();
    clearTimeout(this.timer);
    this.cancelSay?.();
    this.token++;
  }

  private move(delta: number): void {
    const next = this.index + delta;
    if (next < 0 || next >= this.slides.length) return;
    this.stop();
    this.index = next;
    this.highlight = -1;
    this.render();
    if (this.playing) this.narrate();
  }

  private pause(): void {
    this.playing = false;
    this.stop();
    this.render();
  }

  // ---------- Rendering ----------

  private slideView(): SafeHtml {
    const week = this.week;
    const lesson = lessonOf(week);
    const stage = stageOf(week);
    const slide = this.slides[this.index]!;
    switch (slide.type) {
      case "cover":
        return html`<span class="tag">${stage.id}단계 · ${stage.name}</span>
          <h2>${weekInfo(week).title}</h2>
          <p class="lead">${lesson.hook}</p>
          <p class="small faint">화면 오른쪽을 누르면 다음, 왼쪽은 이전이에요.</p>`;
      case "point":
        return html`<span class="tag">포인트 ${slide.n} / ${lesson.points.length}</span>
          <h2>${slide.point.title}</h2>
          <p class="lead">${slide.point.explanation}</p>
          <div class="exs">
            ${slide.point.examples.map(
              (ex, j) =>
                html`<button
                  class="ex ${this.highlight === j ? "on" : ""}"
                  data-clip="say"
                  data-text="${spokenText(ex.en)}"
                >
                  <span class="tx"
                    ><span class="e">${ex.en}</span><span class="k">${ex.ko}</span></span
                  ><span class="sp">🔊</span>
                </button>`,
            )}
          </div>`;
      case "drill":
        return html`<span class="tag">따라 말하기</span>
          <h2>영어로 말해 보세요</h2>
          <p class="lead">한국어를 보고 먼저 소리 내 말한 다음, 눌러서 정답을 확인하세요.</p>
          <div class="exs">
            ${lesson.drills.map((d, j) => {
              const shown = this.revealed.has(j);
              return html`<button
                class="ex ${this.highlight === j ? "on" : ""}"
                data-clip="reveal"
                data-index="${j}"
              >
                <span class="tx"
                  ><span class="k strong">${d.ko}</span
                  >${shown ? html`<span class="e">${d.en}</span>` : html`<span class="hid">눌러서 정답 보기</span>`}</span
                >
                <span class="sp">${shown ? "🔊" : "👀"}</span>
              </button>`;
            })}
          </div>`;
      case "end": {
        const done = this.app?.store.progress.clips[week];
        return html`<span class="tag">오늘의 팁</span>
          <h2>${week}주차 클립 끝!</h2>
          <p class="lead">${lesson.tip}</p>
          <button class="donebtn" data-clip="done">
            ${done ? "✓ 완료한 클립 · 닫기" : "다 봤어요 (완료 표시)"}
          </button>
          ${week < TOTAL_WEEKS ? html`<button class="ex center" data-clip="nextWeek">다음 주 클립 미리 보기 →</button>` : ""}`;
      }
    }
  }

  private render(): void {
    const n = this.slides.length;
    mount(
      this.el,
      html`<div
        class="stage"
        style="--st:${stageOf(this.week).color}"
        role="dialog"
        aria-modal="true"
        aria-label="${this.week}주차 레슨 클립"
      >
        <div class="segs">
          ${this.slides.map(
            (_, k) =>
              html`<i class="${k < this.index ? "done" : k === this.index ? "cur" : ""}"></i>`,
          )}
        </div>
        <div class="bar2">
          <span>Week ${this.week} · ${this.index + 1} / ${n}</span
          ><button class="x" data-clip="close" aria-label="닫기">×</button>
        </div>
        <div class="body" data-clip="tap">${this.slideView()}</div>
        <div class="ctrl">
          <button data-clip="prev" aria-label="이전" ${this.index === 0 ? raw("disabled") : ""}>
            ←
          </button>
          <button class="big" data-clip="play" aria-label="${this.playing ? "일시정지" : "재생"}">
            ${this.playing ? "❚❚" : "▶"}
          </button>
          <button data-clip="next" aria-label="다음" ${this.index === n - 1 ? raw("disabled") : ""}>
            →
          </button>
          <button data-clip="mute" aria-label="소리" aria-pressed="${this.muted}">
            ${this.muted ? "🔇" : "🔊"}
          </button>
        </div>
      </div>`,
    );
  }

  // ---------- Narration ----------

  private stepsFor(slide: Slide): Step[] {
    const week = this.week;
    const lesson = lessonOf(week);
    const ko = (text: string): Step => ({ kind: "say", text, lang: "ko-KR" });
    const en = (text: string): Step => ({ kind: "say", text, lang: "en-US" });
    const mark = (j: number): Step => ({
      kind: "do",
      run: () => {
        this.highlight = j;
        this.render();
      },
    });
    switch (slide.type) {
      case "cover":
        return [ko(`${week}주차. ${spokenText(weekInfo(week).title)}. ${lesson.hook}`)];
      case "point":
        return [
          ko(`${slide.point.title}. ${slide.point.explanation}`),
          ...slide.point.examples.flatMap((ex, j): Step[] => [
            mark(j),
            en(spokenText(ex.en)),
            ko(spokenText(ex.ko)),
            { kind: "pause", ms: 400 },
          ]),
        ];
      case "drill":
        return [
          ko("한국어를 보고 영어로 말해 보세요."),
          ...lesson.drills.flatMap((d, j): Step[] => [
            mark(j),
            ko(d.ko),
            { kind: "pause", ms: 3000 },
            {
              kind: "do",
              run: () => {
                this.revealed.add(j);
                this.render();
              },
            },
            en(d.en),
            { kind: "pause", ms: 600 },
          ]),
        ];
      case "end":
        return [ko(lesson.tip)];
    }
  }

  private narrate(): void {
    const steps = this.stepsFor(this.slides[this.index]!);
    const token = ++this.token;
    const voice = this.app!.voice;
    let k = 0;
    const next = (): void => {
      if (token !== this.token || !this.playing) return;
      const step = steps[k++];
      if (!step) {
        this.highlight = -1;
        this.render();
        if (this.index < this.slides.length - 1) {
          this.timer = setTimeout(() => {
            if (token === this.token && this.playing) this.move(1);
          }, 1200);
        } else {
          this.playing = false;
          this.render();
        }
        return;
      }
      if (step.kind === "do") {
        step.run();
        next();
      } else if (step.kind === "pause") {
        this.timer = setTimeout(next, step.ms);
      } else {
        this.cancelSay = say(step.text, step.lang, voice, this.muted, next);
      }
    };
    next();
  }

  // ---------- Input ----------

  private onClick(event: MouseEvent): void {
    const el = (event.target as Element | null)?.closest<HTMLElement>("[data-clip]");
    if (!el || el.hasAttribute("disabled") || !this.app) return;
    const voice = this.app.voice;
    switch (el.dataset.clip) {
      case "say":
        event.stopPropagation();
        this.pause();
        speak(el.dataset.text ?? "", voice);
        return;
      case "reveal": {
        event.stopPropagation();
        const j = Number(el.dataset.index);
        this.revealed.add(j);
        this.pause();
        const drill = LESSONS[this.week - 1]?.drills[j];
        if (drill) speak(drill.en, voice);
        return;
      }
      case "close":
        return this.close();
      case "prev":
        return this.move(-1);
      case "next":
        return this.move(1);
      case "play":
        if (this.playing) return this.pause();
        this.playing = true;
        this.render();
        return this.narrate();
      case "mute":
        this.muted = !this.muted;
        this.stop();
        this.render();
        if (this.playing) this.narrate();
        return;
      case "done":
        this.app.store.progress.clips[this.week] = true;
        this.app.store.saveProgress();
        return this.close();
      case "nextWeek":
        return this.open(this.app, this.week + 1);
      case "tap": {
        const r = el.getBoundingClientRect();
        this.move(event.clientX - r.left < r.width * 0.3 ? -1 : 1);
        return;
      }
    }
  }
}
