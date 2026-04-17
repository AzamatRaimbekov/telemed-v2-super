export type VoiceLanguage = "ru" | "ky" | "en";

export type VoiceStatus = "idle" | "listening" | "processing" | "error";

export type VoiceResponseType = "answer" | "action_confirm" | "navigate" | "error";

export interface VoiceAction {
  id: string;
  type: string;
  description: string;
  params: Record<string, unknown>;
}

export interface VoiceProcessResponse {
  type: VoiceResponseType;
  text: string;
  action?: VoiceAction;
  route?: string;
  fallback?: boolean;
}

export interface VoiceSettings {
  voice_enabled: boolean;
  wake_word_enabled: boolean;
  tts_enabled: boolean;
  language: VoiceLanguage;
  tts_speed: number;
  hint_size: "sm" | "md" | "lg";
}

export interface VoiceContextValue {
  status: VoiceStatus;
  transcript: string;
  aiResponse: string | null;
  pendingAction: VoiceAction | null;
  settings: VoiceSettings;
  startListening: () => void;
  stopListening: () => void;
  confirmAction: (confirmed: boolean) => void;
  updateSettings: (settings: Partial<VoiceSettings>) => void;
}
