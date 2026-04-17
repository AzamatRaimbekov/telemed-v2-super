import type { VoiceSettings } from "./types";

export const WAKE_WORDS: Record<string, string[]> = {
  ru: ["медкор", "эй медкор", "привет медкор"],
  ky: ["медкор", "эй медкор"],
  en: ["medcore", "hey medcore"],
};

export const SILENCE_TIMEOUT_MS = 10_000;
export const CONFIDENCE_THRESHOLD = 0.6;
export const MIC_BUTTON_SIZE = 56;

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  voice_enabled: true,
  wake_word_enabled: false,
  tts_enabled: false,
  language: "ru",
  tts_speed: 1.0,
  hint_size: "md",
};

export const SPEECH_LANG_MAP: Record<string, string> = {
  ru: "ru-RU",
  ky: "ky-KG",
  en: "en-US",
};
