import { useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { navigationIntents } from "../intents/navigation";
import { createActionIntents } from "../intents/actions";
import { fuzzyMatch } from "../utils/levenshtein";
import { usePortalAuthStore } from "@/stores/portal-auth-store";
import type { VoiceLanguage } from "../types";

interface UseIntentRouterOptions {
  language: VoiceLanguage;
  onShowHelp: () => void;
}

interface IntentResult {
  matched: boolean;
  type?: "navigate" | "action";
  route?: string;
}

export function useIntentRouter({ language, onShowHelp }: UseIntentRouterOptions) {
  const navigate = useNavigate();
  const logout = usePortalAuthStore((s) => s.logout);

  const processIntent = useCallback(
    (text: string): IntentResult => {
      const normalized = text.toLowerCase().trim();

      for (const intent of Object.values(navigationIntents)) {
        const patterns = intent.patterns[language] || intent.patterns.ru;
        if (fuzzyMatch(normalized, patterns, 2)) {
          navigate({ to: intent.route });
          return { matched: true, type: "navigate", route: intent.route };
        }
      }

      const actionIntents = createActionIntents({
        goBack: () => window.history.back(),
        refresh: () => window.location.reload(),
        logout: () => logout(),
        showHelp: onShowHelp,
      });

      for (const action of actionIntents) {
        const patterns = action.patterns[language] || action.patterns.ru;
        if (fuzzyMatch(normalized, patterns, 2)) {
          action.execute();
          return { matched: true, type: "action" };
        }
      }

      return { matched: false };
    },
    [language, navigate, logout, onShowHelp],
  );

  return { processIntent };
}
