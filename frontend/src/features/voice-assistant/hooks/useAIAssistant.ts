import { useState, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { processVoice, confirmVoiceAction } from "../api";
import type { VoiceAction, VoiceLanguage, VoiceProcessResponse } from "../types";

interface UseAIAssistantOptions {
  language: VoiceLanguage;
  currentPage: string;
}

export function useAIAssistant({ language, currentPage }: UseAIAssistantOptions) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<VoiceAction | null>(null);
  const [isFallback, setIsFallback] = useState(false);
  const navigate = useNavigate();

  const ask = useCallback(
    async (text: string) => {
      setIsProcessing(true);
      setResponse(null);
      setPendingAction(null);

      try {
        const result: VoiceProcessResponse = await processVoice(text, language, currentPage);

        if (result.fallback) {
          setIsFallback(true);
          setResponse("AI-ассистент временно недоступен. Навигация голосом доступна.");
          return;
        }

        setIsFallback(false);

        switch (result.type) {
          case "answer":
            setResponse(result.text);
            break;
          case "navigate":
            if (result.route) navigate({ to: result.route });
            break;
          case "action_confirm":
            setResponse(result.text);
            if (result.action) setPendingAction(result.action);
            break;
          case "error":
            setResponse(result.text || "Произошла ошибка");
            break;
        }
      } catch {
        setResponse("Не удалось связаться с сервером");
        setIsFallback(true);
      } finally {
        setIsProcessing(false);
      }
    },
    [language, currentPage, navigate],
  );

  const confirm = useCallback(
    async (confirmed: boolean) => {
      if (!pendingAction) return;
      try {
        const result = await confirmVoiceAction(pendingAction.id, confirmed);
        setResponse(result.message);
      } catch {
        setResponse("Ошибка выполнения действия");
      } finally {
        setPendingAction(null);
      }
    },
    [pendingAction],
  );

  const clearResponse = useCallback(() => {
    setResponse(null);
    setPendingAction(null);
  }, []);

  return { isProcessing, response, pendingAction, isFallback, ask, confirm, clearResponse };
}
