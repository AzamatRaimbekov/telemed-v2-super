import { useState, useRef, useCallback, useEffect } from "react";
import { SPEECH_LANG_MAP, SILENCE_TIMEOUT_MS, CONFIDENCE_THRESHOLD } from "../constants";
import { whisperSTT } from "../api";
import type { VoiceLanguage } from "../types";

interface UseVoiceRecognitionOptions {
  language: VoiceLanguage;
  onResult: (text: string) => void;
  onError?: (error: string) => void;
}

export function useVoiceRecognition({ language, onResult, onError }: UseVoiceRecognitionOptions) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const isSupported = typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const startFallbackRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        if (blob.size > 0) {
          try {
            const result = await whisperSTT(blob);
            if (result.text) onResult(result.text);
          } catch {
            onError?.("Не удалось распознать речь");
          }
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
    } catch {
      onError?.("Нет доступа к микрофону");
    }
  }, [onResult, onError]);

  const stop = useCallback(() => {
    clearSilenceTimer();
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    setIsListening(false);
  }, [clearSilenceTimer]);

  const start = useCallback(() => {
    if (!isSupported) {
      startFallbackRecording();
      setIsListening(true);
      silenceTimerRef.current = setTimeout(stop, SILENCE_TIMEOUT_MS);
      return;
    }

    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = SPEECH_LANG_MAP[language] || "ru-RU";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const result = event.results[event.resultIndex];
      if (result[0].confidence >= CONFIDENCE_THRESHOLD) {
        onResult(result[0].transcript.trim());
      }
      stop();
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "no-speech") {
        stop();
        return;
      }
      if (event.error === "not-allowed") {
        onError?.("Разрешите доступ к микрофону в настройках браузера");
      } else {
        startFallbackRecording();
      }
      stop();
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);

    silenceTimerRef.current = setTimeout(stop, SILENCE_TIMEOUT_MS);
  }, [isSupported, language, onResult, onError, stop, startFallbackRecording]);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return { isListening, isSupported, start, stop };
}
