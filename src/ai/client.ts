/**
 * Claude API client. Calls go straight from the device to api.anthropic.com
 * with the learner's own key (see docs/adr/0002-client-side-claude-api.md).
 * The SDK is loaded lazily so the app opens instantly and works offline.
 */
import type Anthropic from "@anthropic-ai/sdk";
import { STORAGE_KEYS, readString } from "../core/storage";
import type { ChatMessage } from "../types";
import { AiError, toAiError } from "./errors";
import { parseJsonLoose } from "./parse";

export const MODELS = {
  "claude-opus-5": {
    label: "Claude Opus 5 · 최고 품질 (기본)",
    cost: "하루 30분 대화 기준 월 약 3~5만 원",
  },
  "claude-sonnet-5": {
    label: "Claude Sonnet 5 · 균형",
    cost: "하루 30분 대화 기준 월 약 1.5~2만 원",
  },
  "claude-haiku-4-5": {
    label: "Claude Haiku 4.5 · 가장 저렴·빠름",
    cost: "하루 30분 대화 기준 월 약 1만 원 이하",
  },
} as const;

export type ModelId = keyof typeof MODELS;
export const DEFAULT_MODEL: ModelId = "claude-opus-5";

export function currentModel(): ModelId {
  const saved = readString(STORAGE_KEYS.model, DEFAULT_MODEL);
  return saved in MODELS ? (saved as ModelId) : DEFAULT_MODEL;
}

/** quick: short conversational turns. default: corrections, evaluations, generated content. */
export type Tier = "quick" | "default";

export interface CompleteOptions {
  tier?: Tier;
  /** Called with the whole text so far each time more arrives. */
  onText?: (text: string) => void;
  signal?: AbortSignal;
}

let sdk: typeof Anthropic | undefined;
let client: Anthropic | undefined;
let clientKey = "";

async function getClient(): Promise<Anthropic> {
  const key = readString(STORAGE_KEYS.apiKey).trim();
  if (!key) throw new AiError("no_key");
  sdk ??= (await import("@anthropic-ai/sdk")).default;
  if (!client || clientKey !== key) {
    // Personal app: the key belongs to the learner and never leaves the device except to Anthropic.
    client = new sdk({ apiKey: key, dangerouslyAllowBrowser: true, maxRetries: 2 });
    clientKey = key;
  }
  return client;
}

/** Sends a prompt (or a conversation) and resolves with the full reply text. */
export async function complete(
  input: string | ChatMessage[],
  options: CompleteOptions = {},
): Promise<string> {
  const api = await getClient();
  const model = currentModel();
  const quick = options.tier === "quick";
  const messages = typeof input === "string" ? [{ role: "user" as const, content: input }] : input;
  const params = {
    model,
    max_tokens: quick ? 2048 : 8000,
    messages,
    // Haiku 4.5 does not take an effort setting.
    ...(model === "claude-haiku-4-5"
      ? {}
      : { output_config: { effort: quick ? "low" : "medium" } }),
  };

  let text = "";
  try {
    const stream = openStream(api, model, params);
    options.signal?.addEventListener("abort", () => stream.abort());
    stream.on("text", (delta) => {
      text += delta;
      options.onText?.(text);
    });
    const message = await stream.finalMessage();
    if (message.stop_reason === "refusal") throw new AiError("refused");
    const full =
      message.content.map((block) => (block.type === "text" ? (block.text ?? "") : "")).join("") ||
      text;
    if (!full.trim()) throw new AiError("empty");
    return full;
  } catch (err) {
    throw toAiError(err, text);
  }
}

/** The part of the SDK's two stream types (stable and beta) this module uses. */
interface TextStream {
  on(event: "text", listener: (delta: string) => void): unknown;
  abort(): void;
  finalMessage(): Promise<{
    stop_reason: string | null;
    content: readonly { type: string; text?: string }[];
  }>;
}

function openStream(api: Anthropic, model: ModelId, params: object): TextStream {
  if (model === "claude-opus-5") {
    // If a safety classifier declines, the server retries on the recommended model.
    return api.beta.messages.stream({
      ...params,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    } as Parameters<typeof api.beta.messages.stream>[0]);
  }
  return api.messages.stream(params as Parameters<typeof api.messages.stream>[0]);
}

/** Asks for JSON and parses it tolerantly (bare JSON, a fenced block, or the outermost value). */
export async function completeJson<T>(prompt: string, options: CompleteOptions = {}): Promise<T> {
  const text = await complete(
    `${prompt}\n\nReply with only the JSON value, no other text.`,
    options,
  );
  const value = parseJsonLoose(text);
  if (value === undefined)
    throw new AiError("invalid_json", "Model reply was not valid JSON", text);
  return value as T;
}

export async function testConnection(): Promise<string> {
  const text = await complete("Reply with exactly: OK", { tier: "quick" });
  return text.trim().slice(0, 40);
}
