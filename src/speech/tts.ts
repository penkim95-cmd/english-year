/** Text-to-speech with the device's built-in voices (no network, no cost). */

const PREFERRED_VOICES = [
  /natural/i,
  /premium/i,
  /enhanced/i,
  /google us english/i,
  /samantha/i,
  /aria/i,
  /jenny/i,
  /ava/i,
];

export const RATES = [
  { value: 0.7, label: "느리게" },
  { value: 0.85, label: "보통" },
  { value: 1, label: "원어민 속도" },
] as const;

export interface VoiceSettings {
  rate: number;
  voice: string;
}

const synth = (): SpeechSynthesis | undefined =>
  typeof speechSynthesis === "undefined" ? undefined : speechSynthesis;

export function englishVoices(): SpeechSynthesisVoice[] {
  try {
    return (
      synth()
        ?.getVoices()
        .filter((v) => /^en[-_]/i.test(v.lang)) ?? []
    );
  } catch {
    return [];
  }
}

export function pickVoice(preferred: string): SpeechSynthesisVoice | undefined {
  const voices = englishVoices();
  if (!voices.length) return undefined;
  const chosen = preferred && voices.find((v) => v.name === preferred);
  if (chosen) return chosen;
  for (const pattern of PREFERRED_VOICES) {
    const us = voices.find((v) => pattern.test(v.name) && /en[-_]US/i.test(v.lang));
    const any = voices.find((v) => pattern.test(v.name));
    if (us ?? any) return us ?? any;
  }
  return voices.find((v) => /en[-_]US/i.test(v.lang)) ?? voices[0];
}

export function stopSpeaking(): void {
  try {
    synth()?.cancel();
  } catch {
    /* nothing to stop */
  }
}

function utterance(text: string, lang: "en-US" | "ko-KR", settings: VoiceSettings, rate?: number) {
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  if (lang === "en-US") {
    const v = pickVoice(settings.voice);
    if (v) u.voice = v;
    u.rate = rate ?? settings.rate;
  } else {
    u.rate = 1.05;
  }
  return u;
}

/** Speaks English, interrupting anything already playing. `onEnd` always fires once. */
export function speak(
  text: string,
  settings: VoiceSettings,
  options: { rate?: number; onEnd?: () => void } = {},
): void {
  let done = false;
  const finish = () => {
    if (!done) {
      done = true;
      options.onEnd?.();
    }
  };
  try {
    stopSpeaking();
    const u = utterance(text, "en-US", settings, options.rate);
    u.onend = finish;
    u.onerror = finish;
    const s = synth();
    if (s) s.speak(u);
    else finish();
  } catch {
    finish();
  }
}

/**
 * Queues one utterance without interrupting (used by the lesson player).
 * A timer guarantees `onEnd` even when the platform never fires `end`.
 */
export function say(
  text: string,
  lang: "en-US" | "ko-KR",
  settings: VoiceSettings,
  muted: boolean,
  onEnd: () => void,
): () => void {
  let done = false;
  const estimate = lang === "ko-KR" ? text.length * 190 : text.length * 95;
  const timer = setTimeout(finish, (muted ? estimate * 0.7 : estimate * 1.6) + 1500);
  function finish() {
    if (done) return;
    done = true;
    clearTimeout(timer);
    onEnd();
  }
  if (!muted) {
    try {
      const u = utterance(text, lang, settings);
      u.onend = finish;
      u.onerror = finish;
      synth()?.speak(u);
    } catch {
      /* the timer still advances */
    }
  }
  return () => {
    done = true;
    clearTimeout(timer);
  };
}

export function onVoicesChanged(listener: () => void): void {
  const s = synth();
  if (s) s.onvoiceschanged = listener;
}
