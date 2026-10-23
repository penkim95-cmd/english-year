/**
 * Speech recognition (Web Speech API; on iPhone this uses Apple's recognizer).
 * Only one recognizer runs at a time and its state lives here, so leaving a
 * screen can always stop it (see docs/adr/0005-single-speech-session.md).
 */
import { stopSpeaking } from "./tts";

interface RecognitionResultLike {
  readonly [index: number]: { transcript: string };
}
interface RecognitionEventLike {
  results: ArrayLike<RecognitionResultLike>;
}
interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: RecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
type RecognitionCtor = new () => RecognitionLike;

function ctor(): RecognitionCtor | undefined {
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

const PERMISSION_ERRORS = new Set(["not-allowed", "service-not-allowed", "audio-capture"]);

let active: RecognitionLike | null = null;
let listening = false;
let blocked = false;

export const isListening = () => listening;
/** False when the browser has no recognizer or the microphone was refused. */
export const isAvailable = () => !blocked && ctor() !== undefined;

export function stopListening(): void {
  try {
    active?.stop();
  } catch {
    /* already stopped */
  }
  active = null;
  listening = false;
}

export interface ListenOptions {
  /** Interim and final transcripts as they arrive. */
  onText?: (text: string) => void;
  /** Final transcript ("" when nothing was heard). */
  onDone: (text: string) => void;
  /** Called whenever listening starts or stops, to refresh the UI. */
  onStateChange?: () => void;
  /**
   * Automatic restarts (after the partner finishes speaking) may be rejected
   * without a user gesture; those failures must not disable the microphone.
   */
  automatic?: boolean;
}

export function listen(options: ListenOptions): void {
  const Recognition = ctor();
  if (!Recognition || blocked) {
    blocked = true;
    options.onStateChange?.();
    return;
  }
  stopListening();
  stopSpeaking();
  let transcript = "";
  let recognizer: RecognitionLike;
  try {
    recognizer = new Recognition();
    recognizer.lang = "en-US";
    recognizer.interimResults = true;
    recognizer.continuous = false;
  } catch {
    blocked = true;
    options.onStateChange?.();
    return;
  }
  recognizer.onresult = (e) => {
    transcript = Array.from(e.results, (r) => r[0]?.transcript ?? "").join("");
    options.onText?.(transcript);
  };
  recognizer.onerror = (e) => {
    if (!options.automatic && PERMISSION_ERRORS.has(e.error)) blocked = true;
  };
  recognizer.onend = () => {
    if (active === recognizer) {
      active = null;
      listening = false;
    }
    options.onStateChange?.();
    options.onDone(transcript);
  };
  try {
    active = recognizer;
    recognizer.start();
    listening = true;
  } catch {
    if (!options.automatic) blocked = true;
    active = null;
    listening = false;
  }
  options.onStateChange?.();
}
