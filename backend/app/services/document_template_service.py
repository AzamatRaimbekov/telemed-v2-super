import uuid

from jinja2 import Template
from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document_template import DocumentTemplate, TemplateCategory
from app.models.patient import Patient
from app.models.medical import Visit
from app.models.user import User


class DocumentTemplateService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_all(self, clinic_id: uuid.UUID):
        result = await self.db.execute(
            select(DocumentTemplate)
            .where(DocumentTemplate.clinic_id == clinic_id, DocumentTemplate.is_deleted == False)
            .order_by(DocumentTemplate.name)
        )
        return result.scalars().all()

    async def get_by_id(self, template_id: uuid.UUID):
        result = await self.db.execute(
            select(DocumentTemplate)
            .where(DocumentTemplate.id == template_id, DocumentTemplate.is_deleted == False)
        )
        return result.scalar_one_or_none()

    async def render(self, template_id: uuid.UUID, context: dict) -> str:
        """Render template with patient/doctor/visit data."""
        tmpl = await self.get_by_id(template_id)
        if not tmpl:
            return ""
        jinja_tmpl = Template(tmpl.body_template)
        return jinja_tmpl.render(**context)

    async def render_with_ids(
        self,
        template_id: uuid.UUID,
        patient_id: uuid.UUID | None = None,
        visit_id: uuid.UUID | None = None,
        doctor_id: uuid.UUID | None = None,
        extra: dict | None = None,
    ) -> str:
        """Resolve entities from DB, build context, and render."""
        context: dict = {}

        if patient_id:
            result = await self.db.execute(select(Patient).where(Patient.id == patient_id))
            patient = result.scalar_one_or_none()
            if patient:
                context["patient"] = {
                    "first_name": patient.first_name,
                    "last_name": patient.last_name,
                    "middle_name": patient.middle_name or "",
                    "full_name": f"{patient.last_name} {patient.first_name} {patient.middle_name or ''}".strip(),
                    "date_of_birth": patient.date_of_birth.strftime("%d.%m.%Y") if patient.date_of_birth else "",
                    "gender": patient.gender.value if patient.gender else "",
                    "phone": patient.phone or "",
                    "address": patient.address or "",
                    "insurance_number": patient.insurance_number or "",
                    "insurance_provider": patient.insurance_provider or "",
                    "passport_number": patient.passport_number or "",
                    "inn": patient.inn or "",
                }

        if visit_id:
            result = await self.db.execute(select(Visit).where(Visit.id == visit_id))
            visit = result.scalar_one_or_none()
            if visit:
                context["visit"] = {
                    "type": visit.visit_type.value if visit.visit_type else "",
                    "status": visit.status.value if visit.status else "",
                    "chief_complaint": visit.chief_complaint or "",
                    "diagnosis_text": visit.diagnosis_text or "",
                    "examination_notes": visit.examination_notes or "",
                    "date": visit.started_at.strftime("%d.%m.%Y") if visit.started_at else "",
                    "started_at": visit.started_at.strftime("%d.%m.%Y %H:%M") if visit.started_at else "",
                    "ended_at": visit.ended_at.strftime("%d.%m.%Y %H:%M") if visit.ended_at else "",
                }

        if doctor_id:
            result = await self.db.execute(select(User).where(User.id == doctor_id))
            doctor = result.scalar_one_or_none()
            if doctor:
                context["doctor"] = {
                    "full_name": f"{doctor.last_name} {doctor.first_name} {doctor.middle_name or ''}".strip(),
                    "first_name": doctor.first_name,
                    "last_name": doctor.last_name,
                    "middle_name": doctor.middle_name or "",
                    "specialization": doctor.specialization or "",
                    "email": doctor.email or "",
                }

        if extra:
            context.update(extra)

        from datetime import date
        context["today"] = date.today().strftime("%d.%m.%Y")

        return await self.render(template_id, context)

    async def create(
        self,
        clinic_id: uuid.UUID,
        name: str,
        category: str,
        body_template: str,
        description: str | None = None,
        created_by_id: uuid.UUID | None = None,
        is_system_default: bool = False,
    ) -> DocumentTemplate:
        tmpl = DocumentTemplate(
            clinic_id=clinic_id,
            name=name,
            category=category,
            body_template=body_template,
            description=description,
            created_by_id=created_by_id,
            is_system_default=is_system_default,
        )
        self.db.add(tmpl)
        await self.db.commit()
        await self.db.refresh(tmpl)
        return tmpl

    async def update_template(
        self,
        template_id: uuid.UUID,
        clinic_id: uuid.UUID,
        data: dict,
    ) -> DocumentTemplate | None:
        tmpl = await self.get_by_id(template_id)
        if not tmpl or tmpl.clinic_id != clinic_id:
            return None
        for key, value in data.items():
            if hasattr(tmpl, key) and value is not None:
                setattr(tmpl, key, value)
        await self.db.commit()
        await self.db.refresh(tmpl)
        return tmpl

    async def delete_template(self, template_id: uuid.UUID, clinic_id: uuid.UUID) -> bool:
        tmpl = await self.get_by_id(template_id)
        if not tmpl or tmpl.clinic_id != clinic_id:
            return False
        tmpl.is_deleted = True
        await self.db.commit()
        return True
