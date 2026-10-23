/**
 * Application shell: owns the store and screen state, renders the active tab,
 * and routes clicks through a single delegated handler.
 *
 * Interactive elements declare `data-action="name"` plus any `data-*` arguments;
 * each feature module registers its actions in `ACTIONS` (see ui/actions.ts).
 */
import { today } from "../core/date";
import { STORAGE_KEYS, readString, writeString } from "../core/storage";
import { defaultFriendFor, stageOf } from "../data/curriculum";
import { currentWeek } from "../domain/progress";
import { isListening, stopListening } from "../speech/recognition";
import { speak, type VoiceSettings } from "../speech/tts";
import { Store } from "../state/store";
import { html, mount, raw, type SafeHtml } from "./html";
import { TABS, initialUi, isTab, type Tab, type UiState } from "./state";

export type ActionHandler = (app: App, el: HTMLElement, event: Event) => void;
export type View = (app: App) => SafeHtml;

/** Where "하기 →" buttons and links can send the learner. */
export type Destination =
  | "clip"
  | "vocab"
  | "review"
  | "slang"
  | "sheet"
  | "dictation"
  | "speaking"
  | "friend"
  | "scene"
  | "writing"
  | "voice";

export interface AppConfig {
  root: HTMLElement;
  tabs: HTMLElement;
  views: Record<Tab, View>;
  actions: Record<string, ActionHandler>;
  openClip: (app: App, week: number) => void;
}

export class App {
  readonly store = new Store();
  ui: UiState;
  private frame = 0;

  constructor(private readonly config: AppConfig) {
    const saved = readString(STORAGE_KEYS.lastTab, "home");
    this.ui = initialUi(isTab(saved) ? saved : "home");
    config.root.addEventListener("click", (e) => this.dispatch(e));
    config.tabs.addEventListener("click", (e) => this.dispatch(e));
  }

  get week(): number {
    return currentWeek(this.store.progress.startDate, today());
  }

  get stage() {
    return stageOf(this.week);
  }

  get voice(): VoiceSettings {
    return { rate: this.store.personal.rate, voice: this.store.personal.voice };
  }

  say(text: string, rate?: number): void {
    speak(text, this.voice, rate === undefined ? {} : { rate });
  }

  /** Re-renders on the next animation frame (several updates collapse into one paint). */
  render(): void {
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => this.renderNow());
  }

  renderNow(): void {
    cancelAnimationFrame(this.frame);
    mount(this.config.root, this.config.views[this.ui.tab](this));
    mount(this.config.tabs, this.tabBar());
    const chat = this.config.root.querySelector<HTMLElement>("#chat");
    if (chat) chat.scrollTop = chat.scrollHeight;
  }

  setTab(tab: Tab): void {
    if (isListening()) stopListening();
    this.ui.tab = tab;
    writeString(STORAGE_KEYS.lastTab, tab);
    this.renderNow();
    window.scrollTo(0, 0);
  }

  go(destination: Destination, week?: number): void {
    if (isListening()) stopListening();
    const ui = this.ui;
    const w = week ?? this.week;
    switch (destination) {
      case "clip":
        this.config.openClip(this, w);
        return;
      case "vocab":
        Object.assign(ui, { vocabMode: "week", vocabWeek: w, queueId: "" });
        return this.setTab("vocab");
      case "review":
        Object.assign(ui, { vocabMode: "review", queueId: "" });
        return this.setTab("vocab");
      case "slang":
        Object.assign(ui, { vocabMode: "slang", queueId: "" });
        return this.setTab("vocab");
      case "sheet":
        Object.assign(ui, { sheetMode: "week", sheetWeek: w });
        return this.setTab("sheet");
      case "dictation":
        Object.assign(ui, { sheetMode: "dictation", sheetWeek: w });
        return this.setTab("sheet");
      case "speaking":
        Object.assign(ui, { sheetMode: "speaking", sheetWeek: w });
        return this.setTab("sheet");
      case "scene":
        ui.chatMode = "scene";
        return this.setTab("chat");
      case "writing":
        ui.chatMode = "writing";
        return this.setTab("chat");
      case "voice":
        this.store.personal.voiceMode = true;
        this.store.savePersonal();
        this.openFriend();
        return;
      case "friend":
        this.openFriend();
        return;
    }
  }

  openFriend(friendId?: string): void {
    this.ui.chatMode = "friend";
    this.ui.friendId = friendId ?? this.ui.friendId ?? defaultFriendFor(this.stage.id).id;
    this.setTab("chat");
  }

  private tabBar(): SafeHtml {
    return html`<nav>
      ${TABS.map(
        (t) =>
          html`<button
            class="${this.ui.tab === t.id ? "on" : ""}"
            data-action="tab"
            data-tab="${t.id}"
            aria-label="${t.label}"
            aria-current="${this.ui.tab === t.id ? "page" : "false"}"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linejoin="round"
              stroke-linecap="round"
              aria-hidden="true"
            >
              ${raw(t.icon)}</svg
            >${t.label}
          </button>`,
      )}
    </nav>`;
  }

  private dispatch(event: Event): void {
    const el = (event.target as Element | null)?.closest<HTMLElement>("[data-action]");
    if (!el || el.hasAttribute("disabled")) return;
    const name = el.dataset.action!;
    if (name === "tab") {
      const tab = el.dataset.tab ?? "";
      if (isTab(tab)) this.setTab(tab);
      return;
    }
    const handler = this.config.actions[name];
    if (handler) handler(this, el, event);
  }
}

/** Briefly replaces a button's label (e.g. "✓ 저장됨"). */
export function flashLabel(el: HTMLElement, message: string): void {
  const original = el.textContent;
  el.textContent = message;
  setTimeout(() => {
    if (el.isConnected) el.textContent = original;
  }, 2500);
}

export function numberData(el: HTMLElement, key: string): number {
  return Number(el.dataset[key]);
}
