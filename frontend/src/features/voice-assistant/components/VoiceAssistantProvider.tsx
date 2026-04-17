import { createContext, useContext, useState, useCallback, useEffect, useMemo } from "react";
import { useLocation } from "@tanstack/react-router";
import { useVoiceRecognition } from "../hooks/useVoiceRecognition";
import { useWakeWord } from "../hooks/useWakeWord";
import { useIntentRouter } from "../hooks/useIntentRouter";
import { useAIAssistant } from "../hooks/useAIAssistant";
import { useTextToSpeech } from "../hooks/useTextToSpeech";
import { getHintsForPage } from "../intents/hints";
import { DEFAULT_VOICE_SETTINGS } from "../constants";
import { getVoiceSettings, updateVoiceSettings } from "../api";
import { FloatingMic } from "./FloatingMic";
import { SpeechBubble } from "./SpeechBubble";
import { HintChips } from "./HintChips";
import { ConfirmationDialog } from "./ConfirmationDialog";
import type { VoiceContextValue, VoiceSettings, VoiceStatus } from "../types";

const VoiceContext = createContext<VoiceContextValue | null>(null);

export function useVoiceAssistant(): VoiceContextValue {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error("useVoiceAssistant must be used within VoiceAssistantProvider");
  return ctx;
}

export function VoiceAssistantProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<VoiceSettings>(() => {
    const saved = localStorage.getItem("voice_settings");
    return saved ? JSON.parse(saved) : DEFAULT_VOICE_SETTINGS;
  });
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [transcript, setTranscript] = useState("");
  const [showBubble, setShowBubble] = useState(false);

  const location = useLocation();
  const currentPage = location.pathname;

  useEffect(() => {
    getVoiceSettings()
      .then((s) => {
        setSettings(s);
        localStorage.setItem("voice_settings", JSON.stringify(s));
      })
      .catch(() => {});
  }, []);

  const handleUpdateSettings = useCallback(async (partial: Partial<VoiceSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      localStorage.setItem("voice_settings", JSON.stringify(next));
      updateVoiceSettings(next).catch(() => {});
      return next;
    });
  }, []);

  const { processIntent } = useIntentRouter({
    language: settings.language,
    onShowHelp: () => {},
  });

  const ai = useAIAssistant({
    language: settings.language,
    currentPage,
  });

  const tts = useTextToSpeech({
    enabled: settings.tts_enabled,
    language: settings.language,
    speed: settings.tts_speed,
  });

  const handleVoiceResult = useCallback(
    async (text: string) => {
      setTranscript(text);
      setShowBubble(true);

      const intentResult = processIntent(text);
      if (intentResult.matched) {
        setStatus("idle");
        return;
      }

      setStatus("processing");
      await ai.ask(text);
      setStatus("idle");
    },
    [processIntent, ai],
  );

  useEffect(() => {
    if (ai.response && settings.tts_enabled) {
      tts.speak(ai.response);
    }
  }, [ai.response, settings.tts_enabled, tts]);

  const recognition = useVoiceRecognition({
    language: settings.language,
    onResult: handleVoiceResult,
    onError: (error) => {
      setStatus("error");
      setTranscript(error);
      setShowBubble(true);
      setTimeout(() => setStatus("idle"), 3000);
    },
  });

  const startListening = useCallback(() => {
    tts.stop();
    setStatus("listening");
    setTranscript("");
    ai.clearResponse();
    recognition.start();
  }, [recognition, ai, tts]);

  const stopListening = useCallback(() => {
    recognition.stop();
    setStatus("idle");
  }, [recognition]);

  useWakeWord({
    enabled: settings.voice_enabled && settings.wake_word_enabled,
    language: settings.language,
    onWakeWord: startListening,
  });

  const handleMicClick = useCallback(() => {
    if (status === "listening") {
      stopListening();
    } else if (status === "idle") {
      startListening();
    }
  }, [status, startListening, stopListening]);

  const handleHintClick = useCallback(
    (hint: string) => {
      handleVoiceResult(hint);
    },
    [handleVoiceResult],
  );

  const handleConfirm = useCallback(
    (confirmed: boolean) => {
      ai.confirm(confirmed);
    },
    [ai],
  );

  const hints = useMemo(
    () => getHintsForPage(currentPage, settings.language),
    [currentPage, settings.language],
  );

  const contextValue = useMemo<VoiceContextValue>(
    () => ({
      status,
      transcript,
      aiResponse: ai.response,
      pendingAction: ai.pendingAction,
      settings,
      startListening,
      stopListening,
      confirmAction: handleConfirm,
      updateSettings: handleUpdateSettings,
    }),
    [status, transcript, ai.response, ai.pendingAction, settings, startListening, stopListening, handleConfirm, handleUpdateSettings],
  );

  return (
    <VoiceContext.Provider value={contextValue}>
      {children}

      {settings.voice_enabled && (
        <>
          <HintChips
            hints={hints}
            visible={status === "listening"}
            size={settings.hint_size}
            onHintClick={handleHintClick}
          />
          <SpeechBubble
            transcript={transcript}
            response={ai.response}
            visible={showBubble}
            onClose={() => {
              setShowBubble(false);
              ai.clearResponse();
            }}
          />
          <FloatingMic status={status} onClick={handleMicClick} />
          <ConfirmationDialog action={ai.pendingAction} onConfirm={handleConfirm} />
        </>
      )}
    </VoiceContext.Provider>
  );
}
