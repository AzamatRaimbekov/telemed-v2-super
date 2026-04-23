from __future__ import annotations

import uuid

from fastapi import APIRouter, Query, Request

from app.api.deps import CurrentUser, DBSession
from app.schemas.signature import SignDocumentRequest, SignatureOut, SignatureVerifyOut
from app.services.signature_service import SignatureService

router = APIRouter(prefix="/signatures", tags=["signatures"])


@router.post("/sign", response_model=SignatureOut, status_code=201)
async def sign_document(
    data: SignDocumentRequest,
    request: Request,
    session: DBSession,
    current_user: CurrentUser,
):
    """Sign a document with PIN verification."""
    service = SignatureService(session)
    ip = request.client.host if request.client else None
    sig = await service.sign_document(
        document_id=data.document_id,
        document_type=data.document_type,
        document_title=data.document_title,
        pin_code=data.pin_code,
        signer=current_user,
        clinic_id=current_user.clinic_id,
        ip_address=ip,
    )
    return sig


@router.get("/", response_model=list[SignatureOut])
async def list_signatures(
    session: DBSession,
    current_user: CurrentUser,
    signer_id: uuid.UUID | None = Query(None),
    document_type: str | None = Query(None),
    status: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
):
    """List document signatures for the current clinic."""
    service = SignatureService(session)
    return await service.list_signatures(
        clinic_id=current_user.clinic_id,
        signer_id=signer_id,
        document_type=document_type,
        status=status,
        limit=limit,
    )


@router.get("/{signature_id}", response_model=SignatureOut)
async def get_signature(
    signature_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    """Get a single signature by ID."""
    service = SignatureService(session)
    sig = await service.get_signature(signature_id)
    if not sig:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("DocumentSignature")
    return sig


@router.get("/verify/{signature_hash}", response_model=SignatureVerifyOut)
async def verify_signature(
    signature_hash: str,
    session: DBSession,
):
    """Verify a signature by its hash (public endpoint, no auth required)."""
    service = SignatureService(session)
    sig = await service.verify_signature(signature_hash)
    if sig:
        return SignatureVerifyOut(
            valid=True,
            signature=SignatureOut.model_validate(sig),
            message="Подпись действительна",
        )
    return SignatureVerifyOut(
        valid=False,
        signature=None,
        message="Подпись не найдена или недействительна",
    )
