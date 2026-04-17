import { useRef, useEffect, useCallback } from "react";
import { WAKE_WORDS, SPEECH_LANG_MAP } from "../constants";
import { fuzzyMatch } from "../utils/levenshtein";
import type { VoiceLanguage } from "../types";

interface UseWakeWordOptions {
  enabled: boolean;
  language: VoiceLanguage;
  onWakeWord: () => void;
}

export function useWakeWord({ enabled, language, onWakeWord }: UseWakeWordOptions) {
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isActiveRef = useRef(false);

  const stopWakeWord = useCallback(() => {
    if (recognitionRef.current) {
      isActiveRef.current = false;
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      stopWakeWord();
      return;
    }

    const isSupported = typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
    if (!isSupported) return;

    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;

    const startListening = () => {
      if (isActiveRef.current) return;

      const recognition = new SpeechRecognitionCtor();
      recognition.lang = SPEECH_LANG_MAP[language] || "ru-RU";
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript.toLowerCase().trim();
          const words = WAKE_WORDS[language] || WAKE_WORDS.ru;
          if (fuzzyMatch(transcript, words, 2)) {
            stopWakeWord();
            onWakeWord();
            return;
          }
        }
      };

      recognition.onerror = () => {
        isActiveRef.current = false;
      };

      recognition.onend = () => {
        isActiveRef.current = false;
        if (enabled) {
          setTimeout(startListening, 500);
        }
      };

      recognitionRef.current = recognition;
      isActiveRef.current = true;
      recognition.start();
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        startListening();
      } else {
        stopWakeWord();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    if (document.visibilityState === "visible") {
      startListening();
    }

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      stopWakeWord();
    };
  }, [enabled, language, onWakeWord, stopWakeWord]);

  return { stop: stopWakeWord };
}
