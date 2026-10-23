/** Renders the real app shell in jsdom and drives it through clicks. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { STORAGE_KEYS } from "../src/core/storage";
import { App, type ActionHandler } from "../src/ui/app";
import { chatActions, chatView } from "../src/ui/views/chat";
import { homeActions, homeView } from "../src/ui/views/home";
import { planActions, planView } from "../src/ui/views/plan";
import { sheetActions, sheetView } from "../src/ui/views/sheet";
import { vocabActions, vocabView } from "../src/ui/views/vocab";

vi.stubGlobal("__APP_VERSION__", "test");
vi.stubGlobal("scrollTo", () => {});

function createApp() {
  document.body.innerHTML = '<main id="app"></main><div id="tabs"></div>';
  const actions: Record<string, ActionHandler> = {
    ...homeActions,
    ...planActions,
    ...sheetActions,
    ...vocabActions,
    ...chatActions,
  };
  const openClip = vi.fn();
  const app = new App({
    root: document.getElementById("app")!,
    tabs: document.getElementById("tabs")!,
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
    expect(text()).toContain("오늘 할 일");
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

  it("starts the course and checks off a daily task", () => {
    const { app } = createApp();
    click('[data-action="startCourse"]');
    expect(app.store.progress.startDate).not.toBeNull();
    click('[data-action="toggleTask"][data-index="0"]');
    expect(text()).toContain("1 / 5 완료");
  });

  it("routes 하기 → buttons to the right screen", () => {
    const { app, openClip } = createApp();
    click('[data-action="go"][data-to="clip"]');
    expect(openClip).toHaveBeenCalledWith(app, 1);
    click('[data-action="go"][data-to="vocab"]');
    expect(app.ui.tab).toBe("vocab");
    expect(app.ui.vocabMode).toBe("week");
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
