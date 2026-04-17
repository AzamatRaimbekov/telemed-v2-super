from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


class VoiceLanguage(str, Enum):
    RU = "ru"
    KY = "ky"
    EN = "en"


class VoiceResponseType(str, Enum):
    ANSWER = "answer"
    ACTION_CONFIRM = "action_confirm"
    NAVIGATE = "navigate"
    ERROR = "error"


class VoiceProcessRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=500)
    language: VoiceLanguage = VoiceLanguage.RU
    page: str = Field(..., description="Current portal page route")


class VoiceAction(BaseModel):
    id: str
    type: str  # book_appointment, cancel_appointment, pay_bill, send_message
    description: str
    params: dict


class VoiceProcessResponse(BaseModel):
    type: VoiceResponseType
    text: str
    action: Optional[VoiceAction] = None
    route: Optional[str] = None
    fallback: bool = False


class VoiceConfirmRequest(BaseModel):
    action_id: str
    confirmed: bool


class VoiceConfirmResponse(BaseModel):
    success: bool
    message: str


class WhisperRequest(BaseModel):
    pass  # Audio comes as FormData


class WhisperResponse(BaseModel):
    text: str
    language: str


class VoiceHintsResponse(BaseModel):
    hints: list[str]


class VoiceSettings(BaseModel):
    voice_enabled: bool = False
    wake_word_enabled: bool = False
    tts_enabled: bool = False
    language: VoiceLanguage = VoiceLanguage.RU
    tts_speed: float = Field(default=1.0, ge=0.5, le=2.0)
    hint_size: str = Field(default="md", pattern="^(sm|md|lg)$")
