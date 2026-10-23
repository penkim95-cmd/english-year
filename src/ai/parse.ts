import { sanitizeJson } from "../core/storage";

/** Parsed conversation turn: English line, Korean translation and optional correction. */
export interface Reply {
  main: string;
  translation: string;
  correction: string;
}

const TRANSLATION = /^\s*해석\s*[:：]\s*/;
const CORRECTION = /^\s*교정\s*[:：]\s*/;

/** Splits a partner reply written in the "English / 해석: / 교정:" format the prompts ask for. */
export function parseReply(text: string): Reply {
  const main: string[] = [];
  const translation: string[] = [];
  const correction: string[] = [];
  let current = main;
  for (const line of text.split("\n")) {
    if (TRANSLATION.test(line)) {
      current = translation;
      current.push(line.replace(TRANSLATION, ""));
    } else if (CORRECTION.test(line)) {
      current = correction;
      current.push(line.replace(CORRECTION, ""));
    } else if (line.trim()) {
      current.push(line);
    }
  }
  return {
    main: main.join("\n"),
    translation: translation.join(" "),
    correction: correction.join("\n"),
  };
}

/**
 * Extracts one JSON value from model output: the whole text, a ```json fence,
 * or the span from the first { / [ to the last } / ]. Returns undefined if none parses.
 * The result is passed through sanitizeJson because it comes from outside the app.
 */
export function parseJsonLoose(text: string): unknown {
  const attempts: string[] = [text.trim()];
  const fence = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  if (fence?.[1]) attempts.push(fence[1]);
  const starts = [text.indexOf("{"), text.indexOf("[")].filter((i) => i >= 0);
  const end = Math.max(text.lastIndexOf("}"), text.lastIndexOf("]"));
  if (starts.length && end > Math.min(...starts))
    attempts.push(text.slice(Math.min(...starts), end + 1));
  for (const candidate of attempts) {
    try {
      return sanitizeJson(JSON.parse(candidate));
    } catch {
      /* try the next shape */
    }
  }
  return undefined;
}
