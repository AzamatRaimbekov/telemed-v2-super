from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.api.deps import CurrentUser, DBSession
from app.services.document_template_service import DocumentTemplateService

router = APIRouter(prefix="/document-templates", tags=["document-templates"])


# ── Schemas ──────────────────────────────────────────────────────────────────


class TemplateCreate(BaseModel):
    name: str
    category: str = "other"
    body_template: str
    description: str | None = None


class TemplateUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    body_template: str | None = None
    description: str | None = None


class RenderRequest(BaseModel):
    patient_id: uuid.UUID | None = None
    visit_id: uuid.UUID | None = None
    doctor_id: uuid.UUID | None = None
    extra: dict | None = None


# ── Endpoints ────────────────────────────────────────────────────────────────


@router.get("/")
async def list_templates(
    session: DBSession,
    current_user: CurrentUser,
):
    service = DocumentTemplateService(session)
    templates = await service.get_all(current_user.clinic_id)
    return {"items": [_serialize(t) for t in templates]}


@router.post("/", status_code=201)
async def create_template(
    data: TemplateCreate,
    session: DBSession,
    current_user: CurrentUser,
):
    service = DocumentTemplateService(session)
    tmpl = await service.create(
        clinic_id=current_user.clinic_id,
        name=data.name,
        category=data.category,
        body_template=data.body_template,
        description=data.description,
        created_by_id=current_user.id,
    )
    return _serialize(tmpl)


@router.get("/{template_id}")
async def get_template(
    template_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    service = DocumentTemplateService(session)
    tmpl = await service.get_by_id(template_id)
    if not tmpl or tmpl.clinic_id != current_user.clinic_id:
        raise HTTPException(status_code=404, detail="Template not found")
    return _serialize(tmpl)


@router.put("/{template_id}")
async def update_template(
    template_id: uuid.UUID,
    data: TemplateUpdate,
    session: DBSession,
    current_user: CurrentUser,
):
    service = DocumentTemplateService(session)
    tmpl = await service.update_template(
        template_id=template_id,
        clinic_id=current_user.clinic_id,
        data=data.model_dump(exclude_unset=True),
    )
    if not tmpl:
        raise HTTPException(status_code=404, detail="Template not found")
    return _serialize(tmpl)


@router.delete("/{template_id}", status_code=204)
async def delete_template(
    template_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    service = DocumentTemplateService(session)
    ok = await service.delete_template(template_id, current_user.clinic_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Template not found")


@router.post("/{template_id}/render")
async def render_template(
    template_id: uuid.UUID,
    data: RenderRequest,
    session: DBSession,
    current_user: CurrentUser,
):
    service = DocumentTemplateService(session)
    tmpl = await service.get_by_id(template_id)
    if not tmpl or tmpl.clinic_id != current_user.clinic_id:
        raise HTTPException(status_code=404, detail="Template not found")

    html = await service.render_with_ids(
        template_id=template_id,
        patient_id=data.patient_id,
        visit_id=data.visit_id,
        doctor_id=data.doctor_id,
        extra=data.extra,
    )
    return {"html": html, "template_name": tmpl.name}


# ── Helpers ──────────────────────────────────────────────────────────────────


def _serialize(t) -> dict:
    return {
        "id": str(t.id),
        "name": t.name,
        "category": t.category,
        "body_template": t.body_template,
        "description": t.description,
        "is_system_default": t.is_system_default,
        "created_by_id": str(t.created_by_id) if t.created_by_id else None,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
    }
