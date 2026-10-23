/**
 * Thin wrapper around localStorage that never throws (private mode, quota,
 * disabled storage all degrade to "nothing saved").
 */

export const STORAGE_KEYS = {
  progress: "eng-year-v1",
  personal: "eng-year-v1-aux",
  lastTab: "eng-year-v1-tab",
  apiKey: "eng-year-apikey",
  model: "eng-year-model",
} as const;

export function readString(key: string, fallback = ""): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function writeString(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: keep running in memory */
  }
}

export function readJson(key: string): unknown {
  const raw = readString(key, "");
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

export function writeJson(key: string, value: unknown): void {
  writeString(key, JSON.stringify(value));
}

const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/**
 * Deep-copies untrusted JSON into plain data: drops prototype-polluting keys,
 * functions and unknown types, and bounds depth, array length and string length.
 */
export function sanitizeJson(value: unknown, depth = 0): unknown {
  if (depth > 8) return undefined;
  if (Array.isArray(value)) return value.slice(0, 5000).map((v) => sanitizeJson(v, depth + 1));
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
      if (FORBIDDEN_KEYS.has(key)) continue;
      out[key] = sanitizeJson((value as Record<string, unknown>)[key], depth + 1);
    }
    return out;
  }
  if (typeof value === "string") return value.slice(0, 5000);
  if (typeof value === "number" || typeof value === "boolean") return value;
  return undefined;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
