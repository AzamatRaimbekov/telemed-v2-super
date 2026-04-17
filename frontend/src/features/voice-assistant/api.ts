import portalClient from "@/lib/portal-api-client";
import type { VoiceProcessResponse, VoiceSettings } from "./types";

export async function processVoice(
  text: string,
  language: string,
  page: string,
): Promise<VoiceProcessResponse> {
  const { data } = await portalClient.post<VoiceProcessResponse>("/portal/voice/process", {
    text,
    language,
    page,
  });
  return data;
}

export async function confirmVoiceAction(
  actionId: string,
  confirmed: boolean,
): Promise<{ success: boolean; message: string }> {
  const { data } = await portalClient.post("/portal/voice/confirm-action", {
    action_id: actionId,
    confirmed,
  });
  return data;
}

export async function whisperSTT(audioBlob: Blob): Promise<{ text: string; language: string }> {
  const formData = new FormData();
  formData.append("audio", audioBlob, "recording.webm");
  const { data } = await portalClient.post("/portal/voice/whisper", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function getVoiceHints(page: string, lang: string): Promise<string[]> {
  const { data } = await portalClient.get<{ hints: string[] }>(`/portal/voice/hints/${page}`, {
    params: { lang },
  });
  return data.hints;
}

export async function getVoiceSettings(): Promise<VoiceSettings> {
  const { data } = await portalClient.get<VoiceSettings>("/portal/voice/settings");
  return data;
}

export async function updateVoiceSettings(settings: VoiceSettings): Promise<VoiceSettings> {
  const { data } = await portalClient.put<VoiceSettings>("/portal/voice/settings", settings);
  return data;
}
