import { useRef, useCallback } from "react";

interface UseTextToSpeechOptions {
  enabled: boolean;
  language: string;
  speed: number;
}

export function useTextToSpeech({ enabled, language, speed }: UseTextToSpeechOptions) {
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const speak = useCallback(
    (text: string) => {
      if (!enabled || !text || !window.speechSynthesis) return;

      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language === "ky" ? "ky-KG" : language === "en" ? "en-US" : "ru-RU";
      utterance.rate = speed;
      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [enabled, language, speed],
  );

  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
  }, []);

  const isSpeaking = useCallback(() => {
    return window.speechSynthesis.speaking;
  }, []);

  return { speak, stop, isSpeaking };
}
