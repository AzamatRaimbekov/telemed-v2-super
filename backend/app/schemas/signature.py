from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class SignDocumentRequest(BaseModel):
    document_id: uuid.UUID | None = None
    document_type: str = Field(..., max_length=50)
    document_title: str = Field(..., max_length=300)
    pin_code: str = Field(..., min_length=4, max_length=6)


class SignatureOut(BaseModel):
    id: uuid.UUID
    document_id: uuid.UUID | None = None
    document_type: str
    document_title: str
    signer_id: uuid.UUID
    signer_name: str
    signer_role: str
    signature_hash: str | None = None
    pin_code_verified: bool
    status: str
    signed_at: datetime | None = None
    ip_address: str | None = None
    notes: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SignatureVerifyOut(BaseModel):
    valid: bool
    signature: SignatureOut | None = None
    message: str
