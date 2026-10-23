/**
 * Test doubles for the parts of the platform the app cannot control:
 * device speech (synthesis and recognition) and the Claude API.
 */
import { test as base, expect, type Page, type Route } from "@playwright/test";

declare global {
  interface Window {
    __spoken: string[];
    __nextTranscript: string;
    __recognitionStarts: number;
  }
}

/** Replaces Web Speech with recorders: utterances finish after 20 ms, recognition "hears" __nextTranscript. */
function installSpeechMocks(): void {
  window.__spoken = [];
  window.__nextTranscript = "I like coffee";
  window.__recognitionStarts = 0;
  class Utterance {
    text: string;
    lang = "";
    rate = 1;
    voice: unknown = null;
    onend: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(text: string) {
      this.text = text;
    }
  }
  const synth = {
    speak(u: Utterance) {
      window.__spoken.push(u.text);
      setTimeout(() => u.onend?.(), 20);
    },
    cancel() {},
    getVoices: () => [
      { name: "Samantha", lang: "en-US" },
      { name: "Daniel", lang: "en-GB" },
    ],
    onvoiceschanged: null,
  };
  class Recognition {
    onresult: ((e: unknown) => void) | null = null;
    onend: (() => void) | null = null;
    onerror: ((e: unknown) => void) | null = null;
    start() {
      window.__recognitionStarts++;
      setTimeout(() => {
        this.onresult?.({ results: [[{ transcript: window.__nextTranscript }]] });
        this.onend?.();
      }, 150);
    }
    stop() {
      setTimeout(() => this.onend?.(), 0);
    }
  }
  Object.assign(window, {
    SpeechSynthesisUtterance: Utterance,
    SpeechRecognition: Recognition,
    webkitSpeechRecognition: Recognition,
  });
  Object.defineProperty(window, "speechSynthesis", { value: synth, configurable: true });
}

export const MOCK_REPLY =
  "Hey! Nice to meet you. What do you like to do?\n해석: 안녕! 반가워. 뭐 하는 거 좋아해?\n교정: I like coffee. (잘했어요)";

/** Canned answers keyed by what each prompt asks for. */
function replyFor(prompt: string): string {
  if (prompt.includes("Reply with exactly: OK")) return "OK";
  if (prompt.includes("Evaluate the learner")) {
    return JSON.stringify({
      score: 82,
      missions: [{ goal: "인사하기", done: true }],
      good: "인사를 잘했어요.",
      fixes: [
        { orig: "I like coffee", better: "I'd like a coffee, please.", why: "주문할 땐 I'd like" },
      ],
      next: "다음엔 질문도 해 보세요.",
    });
  }
  if (prompt.includes("Suggest 3 very simple things")) {
    return '[{"en":"Nice to meet you!","ko":"만나서 반가워요!"},{"en":"How are you?","ko":"잘 지내요?"},{"en":"I am from Korea.","ko":"한국에서 왔어요."}]';
  }
  if (prompt.includes("Explain it as one flashcard")) {
    return '```json\n{"en":"no cap","ko":"진짜로","ex":"No cap, it was great.","exko":"진짜로 좋았어."}\n```';
  }
  if (prompt.includes("Create 15 useful English")) {
    return JSON.stringify(
      Array.from({ length: 15 }, (_, i) => ({
        en: `mock phrase ${i}`,
        ko: `뜻${i}`,
        ex: `This is mock phrase ${i}.`,
        exko: `예문${i}`,
      })),
    );
  }
  if (prompt.includes("Make an English worksheet")) {
    return JSON.stringify(
      Array.from({ length: 8 }, (_, i) => ({
        q: `Q${i} I ___ a student.`,
        o: ["am", "is", "are"],
        a: 0,
        e: "am",
      })),
    );
  }
  if (prompt.includes("Update your private memory notes")) return "- likes coffee";
  if (prompt.includes("Correct it for them")) {
    return "고친 글:\nI went to the cafe yesterday.\n\n고친 이유:\n- go → went (과거)\n\n한 줄 칭찬:\n잘했어요!";
  }
  return MOCK_REPLY;
}

/** Server-sent events in the shape of the Messages streaming API. */
function sse(text: string): string {
  const event = (name: string, data: object) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
  const deltas = (text.match(/[\s\S]{1,25}/g) ?? [""]).map((chunk) =>
    event("content_block_delta", {
      type: "content_block_delta",
      index: 0,
      delta: { type: "text_delta", text: chunk },
    }),
  );
  return [
    event("message_start", {
      type: "message_start",
      message: {
        id: "msg_test",
        type: "message",
        role: "assistant",
        model: "claude-opus-5",
        content: [],
        stop_reason: null,
        stop_sequence: null,
        usage: { input_tokens: 1, output_tokens: 1 },
      },
    }),
    event("content_block_start", {
      type: "content_block_start",
      index: 0,
      content_block: { type: "text", text: "" },
    }),
    ...deltas,
    event("content_block_stop", { type: "content_block_stop", index: 0 }),
    event("message_delta", {
      type: "message_delta",
      delta: { stop_reason: "end_turn", stop_sequence: null },
      usage: { output_tokens: 1 },
    }),
    event("message_stop", { type: "message_stop" }),
  ].join("");
}

export interface ApiCall {
  model: string;
  prompt: string;
  turns: number;
  headers: Record<string, string>;
}

async function fulfill(route: Route, calls: ApiCall[]): Promise<void> {
  const request = route.request();
  const cors = {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "*",
    "access-control-allow-methods": "POST, OPTIONS",
  };
  if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
  const body = JSON.parse(request.postData() ?? "{}") as {
    model: string;
    messages: { content: unknown }[];
  };
  const prompt = body.messages
    .map((m) => (typeof m.content === "string" ? m.content : JSON.stringify(m.content)))
    .join("\n");
  calls.push({
    model: body.model,
    prompt,
    turns: body.messages.length,
    headers: await request.allHeaders(),
  });
  return route.fulfill({
    status: 200,
    headers: { ...cors, "content-type": "text/event-stream" },
    body: sse(replyFor(prompt)),
  });
}

export const TEST_KEY = "sk-ant-test-key";

interface Fixtures {
  /** Every request the app sent to the Claude API. */
  apiCalls: ApiCall[];
  /** Hostnames of requests that left the device, other than Google Fonts. */
  externalHosts: string[];
  /** Uncaught errors and console errors. */
  pageErrors: string[];
  /** Same page with an API key already saved. */
  withKey: Page;
  /** Same page with the level check already done (course starts at week 1). */
  measured: Page;
}

export const test = base.extend<Fixtures>({
  apiCalls: async ({}, use) => use([]),
  externalHosts: async ({}, use) => use([]),
  pageErrors: async ({}, use) => use([]),
  page: async ({ page, apiCalls, externalHosts, pageErrors }, use) => {
    await page.addInitScript(installSpeechMocks);
    await page.route("https://api.anthropic.com/**", (route) => fulfill(route, apiCalls));
    page.on("request", (r) => {
      const host = new URL(r.url()).hostname;
      if (host !== "localhost" && !/^fonts\.(googleapis|gstatic)\.com$/.test(host))
        externalHosts.push(host);
    });
    page.on("pageerror", (e) => pageErrors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") pageErrors.push(m.text());
    });
    await use(page);
    expect(pageErrors, "no runtime errors").toEqual([]);
  },
  measured: async ({ page }, use) => {
    await page.addInitScript(() => {
      if (!localStorage.getItem("eng-year-v1"))
        localStorage.setItem("eng-year-v1", JSON.stringify({ startWeek: 1 }));
    });
    await use(page);
  },
  withKey: async ({ page }, use) => {
    await page.addInitScript((key) => {
      if (!localStorage.getItem("eng-year-apikey")) localStorage.setItem("eng-year-apikey", key);
    }, TEST_KEY);
    await use(page);
  },
});

export { expect };

/** Text the learner was last read aloud. */
export const lastSpoken = (page: Page) => page.evaluate(() => window.__spoken.at(-1) ?? "");
