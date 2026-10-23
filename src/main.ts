/** Entry point: wires the views, actions and platform services together. */
import "./styles/app.css";
import { stopListening } from "./speech/recognition";
import { onVoicesChanged } from "./speech/tts";
import { App, type ActionHandler } from "./ui/app";
import { ClipPlayer } from "./ui/clip";
import { bindInputs } from "./ui/inputs";
import { chatActions, chatView } from "./ui/views/chat";
import { homeActions, homeView } from "./ui/views/home";
import { planActions, planView } from "./ui/views/plan";
import { sheetActions, sheetView } from "./ui/views/sheet";
import { vocabActions, vocabView } from "./ui/views/vocab";

const byId = (id: string) => document.getElementById(id)!;

const clip = new ClipPlayer(byId("clip"));

/** Actions any screen can use. */
const commonActions: Record<string, ActionHandler> = {
  speak(app, el) {
    app.say(el.dataset.text ?? "");
  },
  openClip(app, el) {
    clip.open(app, Number(el.dataset.week) || app.week);
  },
};

const actions: Record<string, ActionHandler> = {
  ...commonActions,
  ...homeActions,
  ...planActions,
  ...sheetActions,
  ...vocabActions,
  ...chatActions,
};

const app = new App({
  root: byId("app"),
  tabs: byId("tabs"),
  views: { home: homeView, plan: planView, sheet: sheetView, vocab: vocabView, chat: chatView },
  actions,
  openClip: (a, week) => clip.open(a, week),
});

bindInputs(app, byId("app"), actions);

// Voices load asynchronously on iOS; refresh the voice picker when they arrive.
onVoicesChanged(() => {
  const typing = document.activeElement?.matches("input, textarea, select") ?? false;
  if (app.ui.tab === "home" && !typing) app.render();
});

// Save pending writes and release the microphone when the app goes to the background.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    app.store.flush();
    stopListening();
  }
});
window.addEventListener("pagehide", () => app.store.flush());

app.renderNow();

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js")
      .then((registration) => registration.update())
      .catch(() => {
        /* offline support is optional */
      });
  });
  // A new version took over: reload once, unless the learner is typing.
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    const typing = document.activeElement?.matches("input, textarea") ?? false;
    if (reloaded || typing) return;
    reloaded = true;
    app.store.flush();
    location.reload();
  });
}
