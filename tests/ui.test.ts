/** Renders the real app shell in jsdom and drives it through clicks. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { STORAGE_KEYS } from "../src/core/storage";
import { App, type ActionHandler } from "../src/ui/app";
import { chatActions, chatView } from "../src/ui/views/chat";
import { homeActions, homeView } from "../src/ui/views/home";
import { planActions, planView } from "../src/ui/views/plan";
import { questActions, questBar } from "../src/ui/views/quest";
import { todayActions } from "../src/ui/views/today";
import { PLACEMENT } from "../src/domain/placement";
import { sheetActions, sheetView } from "../src/ui/views/sheet";
import { vocabActions, vocabView } from "../src/ui/views/vocab";

vi.stubGlobal("__APP_VERSION__", "test");
vi.stubGlobal("scrollTo", () => {});
// jsdom does not lay out pages.
Element.prototype.scrollIntoView = () => {};

function createApp() {
  document.body.innerHTML = '<main id="app"></main><div id="quest"></div><div id="tabs"></div>';
  const actions: Record<string, ActionHandler> = {
    ...homeActions,
    ...questActions,
    ...todayActions,
    ...planActions,
    ...sheetActions,
    ...vocabActions,
    ...chatActions,
  };
  const openClip = vi.fn();
  const app = new App({
    root: document.getElementById("app")!,
    tabs: document.getElementById("tabs")!,
    questBar: { el: document.getElementById("quest")!, view: questBar },
    views: { home: homeView, plan: planView, sheet: sheetView, vocab: vocabView, chat: chatView },
    actions,
    openClip,
  });
  app.render = () => app.renderNow();
  app.renderNow();
  return { app, openClip };
}

const click = (selector: string) => {
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) throw new Error(`missing ${selector}`);
  el.click();
};
const text = () => document.getElementById("app")!.textContent ?? "";

beforeEach(() => localStorage.clear());

describe("app shell", () => {
  it("opens on the home tab and switches tabs from the tab bar", () => {
    createApp();
    expect(text()).toContain("실력 측정");
    click('[data-tab="plan"]');
    expect(text()).toContain("1단계");
    click('[data-tab="sheet"]');
    expect(text()).toContain("학습지");
    click('[data-tab="vocab"]');
    expect(text()).toContain("단어장");
    click('[data-tab="chat"]');
    expect(text()).toContain("AI 대화");
    expect(localStorage.getItem(STORAGE_KEYS.lastTab)).toBe("chat");
  });

  it("measures the level first and starts one stage up for a basic learner", () => {
    const { app } = createApp();
    PLACEMENT.forEach((q, i) =>
      click(`[data-action="placementAnswer"][data-option="${i < 5 ? q.answerIndex : -1}"]`),
    );
    expect(text()).toContain("12문제 중 5개 맞혔어요");
    click('[data-action="placementStart"]');
    expect(app.week).toBe(9);
    expect(app.stage.id).toBe(2);
    expect(text()).toContain("오늘의 공부");
  });

  it("runs today's steps in place on the home screen", () => {
    localStorage.setItem(STORAGE_KEYS.progress, JSON.stringify({ startWeek: 1 }));
    const { app } = createApp();
    const steps = () => [...document.querySelectorAll(".qstep")].map((e) => e.classList[1]);
    expect(steps()).toEqual(["current", "locked", "locked", "locked", "locked", "locked", "done"]);

    // 1. Lesson: page through and finish, without leaving the home tab.
    while (document.querySelector('[data-action="todayLessonPage"][data-step="1"]')) {
      click('[data-action="todayLessonPage"][data-step="1"]');
    }
    click('[data-action="todayLessonDone"]');
    expect(steps().slice(0, 2)).toEqual(["done", "current"]);
    expect(text()).toContain("1단계 완료");

    // 2. Flashcards right inside the step.
    for (let i = 0; i < 15; i++) click('[data-action="todayAnswer"][data-known="1"]');
    expect(steps()[2]).toBe("current");
    expect(document.querySelector('#app [data-action="pickOption"]')).not.toBeNull();
    expect(app.ui.tab).toBe("home");
  });

  it("shows where today's study stands on other tabs and leads back", () => {
    localStorage.setItem(STORAGE_KEYS.progress, JSON.stringify({ startWeek: 1 }));
    const { app } = createApp();
    click('[data-tab="vocab"]');
    expect(document.getElementById("quest")!.textContent).toContain("오늘의 공부 1/7");
    click('[data-action="questGo"]');
    expect(app.ui.tab).toBe("home");
  });

  it("answers a worksheet question and records the score", () => {
    const { app } = createApp();
    click('[data-tab="sheet"]');
    click('[data-action="pickOption"][data-q="0"]');
    expect(document.querySelector(".exp")).not.toBeNull();
    expect(app.ui.answers).not.toEqual({});
  });

  it("flips and grades a flashcard", () => {
    const { app } = createApp();
    click('[data-tab="vocab"]');
    click('[data-action="flipCard"]');
    expect(app.ui.flipped).toBe(true);
    click('[data-action="answerCard"][data-known="1"]');
    expect(Object.keys(app.store.progress.srs)).toHaveLength(1);
  });

  it("escapes learner-provided text", () => {
    localStorage.setItem(
      STORAGE_KEYS.personal,
      JSON.stringify({ profile: { name: '<img src=x onerror="window.hacked=1">', about: "" } }),
    );
    createApp();
    expect(document.querySelector("#app img")).toBeNull();
    const input = document.getElementById("profile-name") as HTMLInputElement;
    expect(input.value).toContain("<img");
  });

  it("asks for an API key before any AI request", async () => {
    const { app } = createApp();
    click('[data-tab="chat"]');
    (document.getElementById("chat-input") as HTMLTextAreaElement).value = "Hello!";
    click('[data-action="sendMessage"]');
    await vi.waitFor(() => expect(app.ui.busy).toBe(false));
    expect(text()).toContain("API 키");
  });
});
