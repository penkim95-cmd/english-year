/** Flashcards: weekly words, due reviews, slang decks and the learner's own words. */
import { completeJson } from "../../ai/client";
import { errorMessage } from "../../ai/errors";
import { flashcardPrompt, wordListPrompt } from "../../ai/prompts";
import { today } from "../../core/date";
import { seededRng, shuffle } from "../../core/random";
import { SLANG, TOTAL_WEEKS, WORD_TOPICS, vocabOf, weekInfo } from "../../data/curriculum";
import {
  MAX_SAVED_WORDS,
  dueKeys,
  learnedCount,
  savedKey,
  slangKey,
  vocabKey,
} from "../../domain/dictionary";
import { prioritize, review } from "../../domain/srs";
import { flashLabel, numberData, type ActionHandler, type App } from "../app";
import { errorText, header, segmented, speakButton, statusChip, weekNav } from "../components";
import { html, raw, type SafeHtml } from "../html";
import type { VocabMode } from "../state";

/** Card keys of the current deck, in display order. */
function deckKeys(app: App): string[] {
  const ui = app.ui;
  const { progress, personal, dictionary } = app.store;
  switch (ui.vocabMode) {
    case "week":
      return vocabOf(ui.vocabWeek ?? app.week).words.map((w) => vocabKey(w.en));
    case "slang":
      return (SLANG[ui.slangCategory] ?? SLANG[0]!).items.map((s) => slangKey(s.en));
    case "mine":
      return personal.extra.map((w) => savedKey(w.en));
    case "review":
      return dueKeys(dictionary, progress.srs, today());
  }
}

/** The study queue is rebuilt only when the deck changes, so answers can reorder it. */
function queue(app: App): string[] {
  const ui = app.ui;
  const id = `${ui.vocabMode}:${ui.vocabMode === "week" ? (ui.vocabWeek ?? app.week) : ui.vocabMode === "slang" ? ui.slangCategory : ""}`;
  if (ui.queueId !== id) {
    const keys = deckKeys(app);
    ui.queue =
      ui.vocabMode === "review"
        ? shuffle(keys, seededRng(Date.now() % 100_000))
        : prioritize(keys, app.store.progress.srs);
    ui.queueId = id;
    ui.flipped = false;
  }
  return ui.queue;
}

const spoken = (en: string) => en.replace(/~/g, "something");

function cardView(app: App, keys: string[]): SafeHtml {
  const ui = app.ui;
  if (!keys.length) {
    const review = ui.vocabMode === "review";
    return html`<div class="flash">
      <span class="w">${review ? "오늘 복습 끝!" : "이 묶음 끝!"}</span>
      <span class="small muted"
        >${
          review
            ? "복습할 단어가 없어요. 새 단어를 외우면 정해진 날에 다시 나와요."
            : "다 봤어요. '몰라요' 누른 단어는 오늘 복습에 다시 나와요."
        }</span
      >
      ${review ? "" : html`<button class="btn primary" data-action="restartDeck">처음부터 다시</button>`}
    </div>`;
  }
  const card = app.store.dictionary.get(keys[0]!)!;
  return html`<button class="flash" data-action="flipCard" aria-label="카드 뒤집기">
      <span class="row center"
        >${statusChip(app.store.progress.srs[card.key])}<span class="small muted"
          >남은 카드 ${keys.length}</span
        >${card.tag ? html`<span class="chip">${card.tag}</span>` : ""}</span
      >
      <span class="w">${card.en}</span>
      ${
        ui.flipped
          ? html`<span class="k">${card.ko}</span><span class="exen">${card.example}</span
              ><span class="small muted">${card.exampleKo}</span>`
          : html`<span class="small muted">눌러서 뜻과 예문 보기</span>`
      }
    </button>
    <div class="row center">
      ${speakButton(spoken(card.en), "🔊 단어")}${speakButton(card.example, "🔊 예문")}
    </div>
    <div class="row center">
      <button class="btn" data-action="answerCard" data-known="0">몰라요</button>
      <button class="btn primary" data-action="answerCard" data-known="1">알아요</button>
    </div>`;
}

function myWordTools(app: App): SafeHtml {
  const ui = app.ui;
  return html`<div class="q">
    <label class="qt" for="add-word">릴스·영화에서 들은 단어나 문장 추가</label>
    <div class="composer">
      <input
        id="add-word"
        class="field"
        placeholder="예: no cap, I'm down, rain check"
        autocomplete="off"
      />
      <button class="btn primary" data-action="addWord" ${ui.wordBusy ? raw("disabled") : ""}>
        추가
      </button>
    </div>
    <span class="qt">AI로 새 단어 15개 받기</span>
    ${segmented(
      WORD_TOPICS.map((t, i) => ({ id: String(i), label: t })),
      String(ui.wordTopic),
      "wordTopic",
    )}
    <button class="btn" data-action="generateWords" ${ui.wordBusy ? raw("disabled") : ""}>
      ${ui.wordBusy ? "만드는 중…" : "단어 15개 만들기"}
    </button>
    ${errorText(ui.wordError)}
    <span class="small muted"
      >뜻·예문은 AI가 만들어요. 추가한 단어도 복습 주기에 들어가요. (최대
      ${MAX_SAVED_WORDS.toLocaleString()}개)</span
    >
  </div>`;
}

export function vocabView(app: App): SafeHtml {
  const ui = app.ui;
  const { progress, personal, dictionary } = app.store;
  const due = dueKeys(dictionary, progress.srs, today()).length;
  const week = ui.vocabWeek ?? app.week;
  const keys = queue(app);
  const listKeys = ui.vocabMode === "mine" ? deckKeys(app).reverse() : deckKeys(app);
  const listTitle =
    ui.vocabMode === "week"
      ? `${week}주차 단어`
      : ui.vocabMode === "slang"
        ? SLANG[ui.slangCategory]!.category
        : ui.vocabMode === "mine"
          ? "내 단어"
          : "복습할 단어";
  return html`${header(app.week)}
    <section class="card">
      <div class="row between">
        <h2>단어장</h2>
        <span class="chip">외운 단어 ${learnedCount(dictionary, progress.srs)}</span>
      </div>
      ${segmented(
        [
          { id: "week", label: "주차별 단어" },
          { id: "review", label: `복습${due ? ` ${due}` : ""}` },
          { id: "slang", label: "실생활 슬랭" },
          {
            id: "mine",
            label: `내 단어${personal.extra.length ? ` ${personal.extra.length}` : ""}`,
          },
        ],
        ui.vocabMode,
        "vocabMode",
      )}
      ${ui.vocabMode === "mine" ? myWordTools(app) : ""}
      ${ui.vocabMode === "week" ? weekNav(week, "vocabWeek") : ""}
      ${
        ui.vocabMode === "slang"
          ? segmented(
              SLANG.map((c, i) => ({ id: String(i), label: c.category })),
              String(ui.slangCategory),
              "slangCategory",
            )
          : ""
      }
      ${cardView(app, keys)}
      <p class="small muted">
        '알아요'를 누르면 1일 → 3일 → 7일 → 14일 → 30일 뒤에 다시 나와요. 3번 연속 맞히면 '외움'.
        '몰라요'는 3장 뒤에 다시 나와요.
      </p>
    </section>
    <section class="card">
      <h3>${listTitle} (${listKeys.length})</h3>
      <div class="wordlist">
        ${
          listKeys.length
            ? listKeys.map((k) => {
                const c = dictionary.get(k)!;
                return html`<div class="wl">
                  ${speakButton(spoken(c.en))}
                  <span class="e">${c.en}</span><span class="ko">${c.ko}</span>
                  ${progress.srs[k] ? statusChip(progress.srs[k]) : ""}
                  ${k.startsWith("x:") ? html`<button class="speak" data-action="removeWord" data-en="${c.en}" aria-label="삭제">✕</button>` : ""}
                </div>`;
              })
            : html`<p class="small muted">없어요.</p>`
        }
      </div>
    </section>`;
}

export const vocabActions: Record<string, ActionHandler> = {
  vocabMode(app, el) {
    app.ui.vocabMode = el.dataset.value as VocabMode;
    app.ui.queueId = "";
    app.render();
  },
  vocabWeek(app, el) {
    app.ui.vocabWeek = Math.min(TOTAL_WEEKS, Math.max(1, numberData(el, "week")));
    app.render();
  },
  slangCategory(app, el) {
    app.ui.slangCategory = Number(el.dataset.value);
    app.render();
  },
  wordTopic(app, el) {
    app.ui.wordTopic = Number(el.dataset.value);
    app.render();
  },
  flipCard(app) {
    app.ui.flipped = !app.ui.flipped;
    app.render();
  },
  answerCard(app, el) {
    const known = el.dataset.known === "1";
    const ui = app.ui;
    const key = ui.queue.shift();
    if (key) {
      const { progress, dictionary } = app.store;
      progress.srs[key] = review(progress.srs[key], known);
      if (known) progress.known[dictionary.get(key)!.en] = 1;
      // A missed card comes back three cards later in this session.
      else ui.queue.splice(Math.min(3, ui.queue.length), 0, key);
      app.store.saveProgress();
    }
    ui.flipped = false;
    app.render();
  },
  restartDeck(app) {
    app.ui.queueId = "";
    app.render();
  },
  removeWord(app, el) {
    app.store.removeSavedWord(el.dataset.en!);
    app.ui.queueId = "";
    app.render();
  },
  saveSentence(app, el) {
    const en = (el.dataset.en ?? "").trim().slice(0, 300);
    if (!en) return;
    const ko = (el.dataset.ko ?? "").slice(0, 200);
    const added = app.store.addSavedWords(
      [{ en, ko: ko || "저장한 문장", ex: en, exko: ko }],
      "저장한 문장",
    );
    app.ui.queueId = "";
    flashLabel(el, added ? "✓ 저장됨" : "이미 있어요");
  },
  async addWord(app) {
    const input = document.getElementById("add-word") as HTMLInputElement | null;
    const heard = input?.value.trim() ?? "";
    if (!heard) return;
    const ui = app.ui;
    ui.wordBusy = true;
    ui.wordError = "";
    app.render();
    try {
      const card = await completeJson<unknown>(flashcardPrompt(heard), { tier: "quick" });
      const added = app.store.addSavedWords([card], "직접 추가");
      ui.wordError = added ? "" : "이미 단어장에 있는 표현이에요.";
      ui.queueId = "";
    } catch (err) {
      ui.wordError = errorMessage(err);
    }
    ui.wordBusy = false;
    app.render();
  },
  async generateWords(app) {
    const ui = app.ui;
    const topic = ui.wordTopic === 0 ? weekInfo(app.week).title : WORD_TOPICS[ui.wordTopic]!;
    const known = [
      ...app.store.personal.extra.map((w) => w.en),
      ...vocabOf(app.week).words.map((w) => w.en),
    ];
    ui.wordBusy = true;
    ui.wordError = "";
    app.render();
    try {
      const list = await completeJson<unknown[]>(
        wordListPrompt({ week: app.week, profile: app.store.personal.profile }, topic, known),
      );
      const added = app.store.addSavedWords(Array.isArray(list) ? list : [], topic);
      ui.wordError = added ? "" : "새 단어를 만들지 못했어요. 다시 눌러 주세요.";
      ui.vocabMode = "mine";
      ui.queueId = "";
    } catch (err) {
      ui.wordError = errorMessage(err);
    }
    ui.wordBusy = false;
    app.render();
  },
};
