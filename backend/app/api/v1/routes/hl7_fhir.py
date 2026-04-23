from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from sqlalchemy import select

from app.api.deps import CurrentUser, DBSession
from app.models.patient import Patient
from app.models.laboratory import LabResult
from app.services.hl7_service import HL7Message, FHIRConverter

router = APIRouter(prefix="/integrations", tags=["HL7 / FHIR Integration"])


# ---------- schemas ----------

class FHIRObservation(BaseModel):
    resourceType: str = "Observation"
    id: str | None = None
    status: str = "final"
    code: dict = {}
    subject: dict | None = None
    valueQuantity: dict | None = None
    referenceRange: list[dict] | None = None
    issued: str | None = None


class HL7StatusResponse(BaseModel):
    status: str
    protocol_version: str
    supported_messages: list[str]
    last_received: str | None = None


# ---------- HL7 endpoints ----------

@router.post("/hl7/receive", response_class=PlainTextResponse)
async def receive_hl7_message(
    request: Request,
    session: DBSession,
    current_user: CurrentUser,
):
    """Receive HL7 ORU message from lab analyzer (raw text body)."""
    raw_body = (await request.body()).decode("utf-8", errors="replace")
    if not raw_body.strip():
        raise HTTPException(400, "Пустое HL7-сообщение")

    parsed = HL7Message.parse_oru(raw_body)

    # Extract message control ID for ACK
    segments = raw_body.strip().split("\r")
    message_id = "UNKNOWN"
    for seg in segments:
        fields = seg.split("|")
        if fields[0] == "MSH" and len(fields) > 9:
            message_id = fields[9]
            break

    # Store parsed results if patient found
    patient_hl7_id = parsed.get("patient", {}).get("id", "")
    if patient_hl7_id and parsed.get("results"):
        patient = (await session.execute(
            select(Patient).where(Patient.id == uuid.UUID(patient_hl7_id))
        )).scalar_one_or_none() if patient_hl7_id else None

        if patient:
            for res in parsed["results"]:
                lab_result = LabResult(
                    clinic_id=current_user.clinic_id,
                    patient_id=patient.id,
                    test_name=res.get("test_code", ""),
                    result_value=res.get("value", ""),
                    unit=res.get("unit", ""),
                    reference_range=res.get("reference_range", ""),
                    status="completed",
                )
                session.add(lab_result)
            await session.flush()

    ack = HL7Message.create_ack(message_id)
    return PlainTextResponse(content=ack, media_type="text/plain")


@router.get("/hl7/status")
async def hl7_status(current_user: CurrentUser):
    """HL7/FHIR connection status."""
    return {
        "status": "active",
        "protocol_version": "HL7 v2.5 / FHIR R4",
        "supported_messages": ["ORU^R01", "ACK"],
        "fhir_resources": ["Observation", "Patient"],
        "last_received": None,
    }


# ---------- FHIR endpoints ----------

@router.post("/fhir/Observation")
async def receive_fhir_observation(
    obs: FHIRObservation,
    session: DBSession,
    current_user: CurrentUser,
):
    """Receive FHIR Observation resource (lab result)."""
    if obs.resourceType != "Observation":
        raise HTTPException(400, f"Ожидался resourceType=Observation, получен {obs.resourceType}")

    lab_data = FHIRConverter.observation_to_lab_result(obs.model_dump())

    # Try to find patient from subject reference
    patient_id = None
    if obs.subject and obs.subject.get("reference"):
        ref = obs.subject["reference"]
        # Format: "Patient/<uuid>"
        if ref.startswith("Patient/"):
            try:
                patient_id = uuid.UUID(ref.split("/")[1])
            except (ValueError, IndexError):
                pass

    if patient_id:
        patient = (await session.execute(
            select(Patient).where(Patient.id == patient_id)
        )).scalar_one_or_none()
        if not patient:
            raise HTTPException(404, "Пациент не найден")

        lab_result = LabResult(
            clinic_id=current_user.clinic_id,
            patient_id=patient_id,
            test_name=lab_data.get("test_name") or lab_data.get("test_code", ""),
            result_value=str(lab_data.get("value", "")),
            unit=lab_data.get("unit", ""),
            reference_range=lab_data.get("reference_range", ""),
            status="completed",
        )
        session.add(lab_result)
        await session.flush()

        return {
            "status": "created",
            "lab_result_id": str(lab_result.id),
            "patient_id": str(patient_id),
        }

    return {"status": "received", "data": lab_data, "note": "Пациент не привязан — результат не сохранён"}


@router.get("/fhir/Patient/{patient_id}")
async def get_fhir_patient(
    patient_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    """Get patient as FHIR Patient resource."""
    patient = (await session.execute(
        select(Patient).where(Patient.id == patient_id, Patient.is_deleted == False)
    )).scalar_one_or_none()
    if not patient:
        raise HTTPException(404, "Пациент не найден")

    patient_data = {
        "id": str(patient.id),
        "last_name": patient.last_name,
        "first_name": patient.first_name,
        "date_of_birth": patient.date_of_birth.isoformat() if patient.date_of_birth else None,
        "gender": patient.gender if hasattr(patient, "gender") else "unknown",
        "phone": patient.phone if hasattr(patient, "phone") else None,
    }

    return FHIRConverter.patient_to_fhir(patient_data)
