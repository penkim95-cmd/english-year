/**
 * Form events that are not clicks: typing, Enter-to-submit, selects and file
 * pickers. Like clicks, they are delegated from the app root.
 */
import { STORAGE_KEYS, writeString } from "../core/storage";
import type { App, ActionHandler } from "./app";
import { onChatInput, sendFromInput } from "./views/chat";

/** Element id → action run when Enter is pressed inside it. */
const ENTER_ACTIONS: Record<string, string> = {
  "dictation-input": "dictationCheck",
  "add-word": "addWord",
  "api-key": "saveKey",
};

export function bindInputs(
  app: App,
  root: HTMLElement,
  actions: Record<string, ActionHandler>,
): void {
  root.addEventListener("input", (e) => {
    const el = e.target as HTMLInputElement | HTMLTextAreaElement;
    if (el.id === "chat-input") onChatInput(app, el.value);
    else if (el.id === "writing-input") app.ui.writingDraft = el.value;
    else if (el.id === "dictation-input" && app.ui.dictation) app.ui.dictation.input = el.value;
  });

  root.addEventListener("keydown", (e) => {
    const el = e.target as HTMLElement;
    if (e.key !== "Enter" || e.isComposing || e.shiftKey) return;
    if (el.id === "chat-input") {
      e.preventDefault();
      sendFromInput(app);
      return;
    }
    const action = ENTER_ACTIONS[el.id];
    if (action && actions[action]) {
      e.preventDefault();
      actions[action](app, el, e);
    }
  });

  root.addEventListener("change", (e) => {
    const el = e.target as HTMLInputElement | HTMLSelectElement;
    switch (el.id) {
      case "model-select":
        writeString(STORAGE_KEYS.model, el.value);
        app.ui.testMessage = "";
        app.render();
        return;
      case "voice-select":
        app.store.personal.voice = el.value;
        app.store.savePersonal();
        app.say("Hi! This is my English voice.");
        return;
      case "restore-file": {
        const file = (el as HTMLInputElement).files?.[0];
        if (!file) return;
        file
          .text()
          .then((text) => {
            app.store.importBackup(text);
            app.ui.backupMessage = "복원했어요.";
          })
          .catch(() => {
            app.ui.backupMessage = "올바른 백업 파일이 아니에요.";
          })
          .finally(() => {
            (el as HTMLInputElement).value = "";
            app.ui.queueId = "";
            app.render();
          });
        return;
      }
    }
  });
}
