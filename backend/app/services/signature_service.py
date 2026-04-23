import hashlib
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document_signature import DocumentSignature, SignatureStatus
from app.models.user import User


class SignatureService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def sign_document(
        self,
        document_id: uuid.UUID | None,
        document_type: str,
        document_title: str,
        pin_code: str,
        signer: User,
        clinic_id: uuid.UUID,
        ip_address: str | None = None,
    ) -> DocumentSignature:
        """Create a digital signature for a document."""
        # Build signature hash from document details + signer + timestamp
        now = datetime.now(timezone.utc)
        hash_input = f"{document_id}:{document_type}:{signer.id}:{now.isoformat()}:{pin_code}"
        signature_hash = hashlib.sha256(hash_input.encode()).hexdigest()

        sig = DocumentSignature(
            document_id=document_id,
            document_type=document_type,
            document_title=document_title,
            signer_id=signer.id,
            signer_name=signer.full_name or f"{signer.last_name} {signer.first_name}",
            signer_role=signer.role.value if signer.role else "unknown",
            signature_hash=signature_hash,
            pin_code_verified=True,
            status=SignatureStatus.SIGNED,
            signed_at=now,
            ip_address=ip_address,
            clinic_id=clinic_id,
        )
        self.db.add(sig)
        await self.db.commit()
        await self.db.refresh(sig)
        return sig

    async def list_signatures(
        self,
        clinic_id: uuid.UUID,
        signer_id: uuid.UUID | None = None,
        document_type: str | None = None,
        status: str | None = None,
        limit: int = 50,
    ) -> list[DocumentSignature]:
        query = select(DocumentSignature).where(
            DocumentSignature.clinic_id == clinic_id,
            DocumentSignature.is_deleted == False,
        )
        if signer_id:
            query = query.where(DocumentSignature.signer_id == signer_id)
        if document_type:
            query = query.where(DocumentSignature.document_type == document_type)
        if status:
            query = query.where(DocumentSignature.status == status)
        query = query.order_by(DocumentSignature.created_at.desc()).limit(limit)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_signature(self, signature_id: uuid.UUID) -> DocumentSignature | None:
        result = await self.db.execute(
            select(DocumentSignature).where(DocumentSignature.id == signature_id)
        )
        return result.scalar_one_or_none()

    async def verify_signature(self, signature_hash: str) -> DocumentSignature | None:
        result = await self.db.execute(
            select(DocumentSignature).where(
                DocumentSignature.signature_hash == signature_hash,
                DocumentSignature.status == SignatureStatus.SIGNED,
            )
        )
        return result.scalar_one_or_none()
