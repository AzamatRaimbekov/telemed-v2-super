from __future__ import annotations
import uuid
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Query
from sqlalchemy import select, desc, func
from app.api.deps import CurrentUser, DBSession, require_role
from app.models.user import UserRole
from app.core.config import settings


router = APIRouter(prefix="/patients", tags=["AI Assistant"])


@router.get("/{patient_id}/ai/summary")
async def get_patient_ai_summary(
    patient_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    """Generate AI-powered patient summary and recommendations."""
    from app.models.patient import Patient
    from app.models.vital_signs import VitalSign
    from app.models.diagnosis import Diagnosis
    from app.models.medication import Prescription
    from app.models.laboratory import LabOrder, LabResult
    from app.models.procedure import ProcedureOrder
    from app.models.stroke import StrokeAssessment

    clinic_id = current_user.clinic_id

    # --- Collect patient data ---
    # Patient info
    p_q = select(Patient).where(Patient.id == patient_id, Patient.clinic_id == clinic_id)
    p_result = await session.execute(p_q)
    patient = p_result.scalar_one_or_none()
    if not patient:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("Patient", str(patient_id))

    # Latest vitals
    v_q = select(VitalSign).where(
        VitalSign.patient_id == patient_id, VitalSign.clinic_id == clinic_id, VitalSign.is_deleted == False
    ).order_by(desc(VitalSign.recorded_at)).limit(5)
    v_result = await session.execute(v_q)
    vitals = list(v_result.scalars().all())

    # Active diagnoses
    d_q = select(Diagnosis).where(
        Diagnosis.patient_id == patient_id, Diagnosis.clinic_id == clinic_id,
        Diagnosis.is_deleted == False, Diagnosis.status.in_(["active", "chronic"])
    )
    d_result = await session.execute(d_q)
    diagnoses = list(d_result.scalars().all())

    # Active prescriptions with items
    rx_q = select(Prescription).where(
        Prescription.patient_id == patient_id, Prescription.clinic_id == clinic_id,
        Prescription.is_deleted == False, Prescription.status == "ACTIVE"
    )
    rx_result = await session.execute(rx_q)
    prescriptions = list(rx_result.scalars().all())

    # Latest lab results
    lab_q = (
        select(LabResult)
        .join(LabOrder, LabResult.lab_order_id == LabOrder.id)
        .where(LabOrder.patient_id == patient_id, LabOrder.clinic_id == clinic_id, LabResult.is_deleted == False)
        .order_by(desc(LabResult.resulted_at))
        .limit(15)
    )
    lab_result = await session.execute(lab_q)
    labs = list(lab_result.scalars().all())

    # Stroke assessments
    sa_q = select(StrokeAssessment).where(
        StrokeAssessment.patient_id == patient_id, StrokeAssessment.clinic_id == clinic_id,
        StrokeAssessment.is_deleted == False
    ).order_by(desc(StrokeAssessment.assessed_at)).limit(10)
    sa_result = await session.execute(sa_q)
    assessments = list(sa_result.scalars().all())

    # Pending procedures
    proc_q = select(ProcedureOrder).where(
        ProcedureOrder.patient_id == patient_id, ProcedureOrder.clinic_id == clinic_id,
        ProcedureOrder.is_deleted == False, ProcedureOrder.status.in_(["ORDERED", "SCHEDULED", "IN_PROGRESS"])
    )
    proc_result = await session.execute(proc_q)
    pending_procedures = list(proc_result.scalars().all())

    # --- Generate analysis ---
    patient_data = _collect_patient_context(patient, vitals, diagnoses, prescriptions, labs, assessments, pending_procedures)

    if settings.OPENAI_API_KEY:
        analysis = await _ai_analysis(patient_data, settings.OPENAI_API_KEY)
    else:
        analysis = _rule_based_analysis(patient, vitals, diagnoses, prescriptions, labs, assessments, pending_procedures)

    return analysis


def _collect_patient_context(patient, vitals, diagnoses, prescriptions, labs, assessments, procedures) -> str:
    """Build a text context for AI analysis."""
    lines = []
    lines.append(f"Пациент: {patient.last_name} {patient.first_name}, {patient.date_of_birth}, пол: {patient.gender.value if patient.gender else '?'}")
    if patient.chronic_conditions:
        lines.append(f"Хронические заболевания: {', '.join(patient.chronic_conditions)}")
    if patient.allergies:
        lines.append(f"Аллергии: {', '.join(patient.allergies)}")
    lines.append(f"Группа крови: {patient.blood_type or '?'}")

    if vitals:
        v = vitals[0]
        parts = []
        if v.systolic_bp: parts.append(f"АД {v.systolic_bp}/{v.diastolic_bp}")
        if v.pulse: parts.append(f"Пульс {v.pulse}")
        if v.spo2: parts.append(f"SpO2 {v.spo2}%")
        if v.temperature: parts.append(f"t {v.temperature}°C")
        if v.blood_glucose: parts.append(f"Глюкоза {v.blood_glucose}")
        lines.append(f"Последние показатели: {', '.join(parts)}")

    if diagnoses:
        lines.append("Диагнозы:")
        for d in diagnoses:
            lines.append(f"  - {d.icd_code} {d.title} [{d.status.value}]")

    if prescriptions:
        lines.append("Текущие препараты:")
        for rx in prescriptions:
            for item in (rx.items or []):
                if not item.is_deleted and item.drug:
                    lines.append(f"  - {item.drug.name} {item.dosage or ''} {item.frequency or ''} ({item.route.value if item.route else ''})")

    if labs:
        lines.append("Последние анализы:")
        for l in labs[:8]:
            abn = " [ПАТОЛОГИЯ]" if l.is_abnormal else ""
            lines.append(f"  - {l.value or ''} = {l.numeric_value or '?'} {l.unit or ''} (норма: {l.reference_range or '?'}){abn}")

    if assessments:
        lines.append("Шкалы:")
        for a in assessments[:6]:
            lines.append(f"  - {a.assessment_type.value}: {a.score}/{a.max_score} ({a.assessed_at})")

    if procedures:
        lines.append("Незавершённые процедуры:")
        for p in procedures:
            name = p.procedure.name if p.procedure else "?"
            lines.append(f"  - {name} [{p.status.value}]")

    return "\n".join(lines)


async def _ai_analysis(context: str, api_key: str) -> dict:
    """Send to OpenAI for analysis."""
    import httpx

    prompt = f"""Вы — клинический ИИ-ассистент для врача. Проанализируйте данные пациента и предоставьте:

1. SUMMARY (краткая сводка состояния пациента, 3-5 предложений)
2. RECOMMENDATIONS (список конкретных рекомендаций по лечению/обследованию)
3. RISKS (потенциальные риски и предупреждения)
4. TRENDS (динамика: улучшение/ухудшение показателей)

Данные пациента:
{context}

Ответьте на русском языке в формате JSON:
{{"summary": "...", "recommendations": ["...", "..."], "risks": ["...", "..."], "trends": ["...", "..."]}}"""

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={
                    "model": "gpt-4o-mini",
                    "messages": [{"role": "user", "content": prompt}],
                    "response_format": {"type": "json_object"},
                    "temperature": 0.3,
                },
            )
        if response.status_code == 200:
            import json
            content = response.json()["choices"][0]["message"]["content"]
            result = json.loads(content)
            result["source"] = "ai"
            result["model"] = "gpt-4o-mini"
            return result
    except Exception:
        pass

    # Fallback to rule-based
    return _rule_based_analysis_from_context(context)


def _rule_based_analysis_from_context(context: str) -> dict:
    return {
        "summary": "ИИ-анализ недоступен. Используется базовый анализ данных.",
        "recommendations": [],
        "risks": [],
        "trends": [],
        "source": "fallback",
    }


def _rule_based_analysis(patient, vitals, diagnoses, prescriptions, labs, assessments, procedures) -> dict:
    """Generate rule-based clinical insights without external AI."""
    summary_parts = []
    recommendations = []
    risks = []
    trends = []
    abnormal_labs = []

    # Patient basic info
    age = None
    if patient.date_of_birth:
        from datetime import date
        today = date.today()
        birth = patient.date_of_birth if isinstance(patient.date_of_birth, date) else date.fromisoformat(str(patient.date_of_birth))
        age = today.year - birth.year - ((today.month, today.day) < (birth.month, birth.day))

    gender_text = "мужчина" if str(patient.gender) == "MALE" else "женщина" if str(patient.gender) == "FEMALE" else ""
    summary_parts.append(f"Пациент {patient.last_name} {patient.first_name}, {age} лет, {gender_text}." if age else f"Пациент {patient.last_name} {patient.first_name}.")

    # Diagnoses summary
    active_diag = [d for d in diagnoses if str(d.status) in ("active", "DiagnosisStatus.ACTIVE")]
    chronic_diag = [d for d in diagnoses if str(d.status) in ("chronic", "DiagnosisStatus.CHRONIC")]
    if active_diag:
        codes = ", ".join(d.icd_code for d in active_diag[:3])
        summary_parts.append(f"Активные диагнозы: {codes}.")
    if chronic_diag:
        codes = ", ".join(d.icd_code for d in chronic_diag[:3])
        summary_parts.append(f"Хронические заболевания: {codes}.")

    # Vitals analysis
    if vitals:
        v = vitals[0]
        if v.systolic_bp and v.systolic_bp > 140:
            risks.append(f"Повышенное АД: {v.systolic_bp}/{v.diastolic_bp} мм рт.ст. Рассмотреть коррекцию гипотензивной терапии.")
        if v.systolic_bp and v.systolic_bp < 100:
            risks.append(f"Гипотония: АД {v.systolic_bp}/{v.diastolic_bp}. Контроль гемодинамики.")
        if v.pulse and v.pulse > 100:
            risks.append(f"Тахикардия: пульс {v.pulse} уд/мин.")
        if v.spo2 and v.spo2 < 95:
            risks.append(f"Снижение SpO₂: {v.spo2}%. Рассмотреть кислородотерапию.")
        if v.blood_glucose and float(v.blood_glucose) > 7.0:
            risks.append(f"Повышенная глюкоза: {v.blood_glucose} ммоль/л. Контроль гликемии.")
        if v.temperature and float(v.temperature) > 37.5:
            risks.append(f"Субфебрилитет: {v.temperature}°C. Исключить инфекцию.")

        # Vitals trend
        if len(vitals) >= 3:
            bp_trend = [v.systolic_bp for v in vitals if v.systolic_bp]
            if len(bp_trend) >= 3:
                if bp_trend[0] < bp_trend[-1]:
                    trends.append("АД: положительная динамика (снижение)")
                elif bp_trend[0] > bp_trend[-1]:
                    trends.append("АД: отрицательная динамика (повышение)")

    # Lab analysis
    abnormal_labs = [l for l in labs if l.is_abnormal]
    if abnormal_labs:
        risks.append(f"Обнаружено {len(abnormal_labs)} отклонений в анализах. Требуется внимание.")
        for l in abnormal_labs[:3]:
            val_str = f"{l.numeric_value} {l.unit or ''}" if l.numeric_value else str(l.value or "")
            risks.append(f"  • {val_str} (норма: {l.reference_range or '?'})")

    # Medication analysis
    med_count = sum(len([i for i in (rx.items or []) if not i.is_deleted]) for rx in prescriptions)
    if med_count > 5:
        risks.append(f"Полипрагмазия: {med_count} препаратов. Рассмотреть необходимость каждого назначения.")

    # Check for common drug-condition conflicts
    med_names = []
    for rx in prescriptions:
        for item in (rx.items or []):
            if not item.is_deleted and item.drug:
                med_names.append(item.drug.name.lower())

    # Allergies check
    if patient.allergies:
        allergies_list = patient.allergies if isinstance(patient.allergies, list) else list(patient.allergies)
        for allergy in allergies_list:
            for med in med_names:
                if allergy.lower() in med:
                    risks.append(f"АЛЛЕРГИЯ: препарат '{med}' может содержать аллерген '{allergy}'!")

    # Assessment trends
    if assessments:
        by_type = {}
        for a in assessments:
            key = a.assessment_type.value
            if key not in by_type:
                by_type[key] = []
            by_type[key].append(a)

        for atype, items in by_type.items():
            if len(items) >= 2:
                latest = float(items[0].score) if items[0].score else 0
                earliest = float(items[-1].score) if items[-1].score else 0
                if atype in ("NIHSS", "MRS", "BECK_DEPRESSION"):
                    if latest < earliest:
                        trends.append(f"{atype}: улучшение ({earliest} → {latest})")
                    elif latest > earliest:
                        trends.append(f"{atype}: ухудшение ({earliest} → {latest})")
                elif atype in ("BARTHEL", "MMSE"):
                    if latest > earliest:
                        trends.append(f"{atype}: улучшение ({earliest} → {latest})")
                    elif latest < earliest:
                        trends.append(f"{atype}: ухудшение ({earliest} → {latest})")

    # Recommendations
    if not vitals:
        recommendations.append("Нет данных о витальных показателях. Рекомендуется измерение АД, пульса, SpO₂.")
    if not labs:
        recommendations.append("Нет лабораторных данных. Рекомендуется базовый анализ крови.")
    pending_procs = [p for p in procedures if p.status.value in ("ORDERED", "SCHEDULED")]
    if pending_procs:
        recommendations.append(f"Запланировано {len(pending_procs)} процедур. Проверить сроки выполнения.")
    if any(d.icd_code.startswith("I63") for d in diagnoses):
        recommendations.append("Пациент перенёс инсульт. Контроль липидного профиля, антиагрегантная терапия, реабилитация.")
    if any(d.icd_code.startswith("E11") for d in diagnoses):
        recommendations.append("СД 2 типа: контроль HbA1c каждые 3 месяца, осмотр стоп, нефропротекция.")
    if any(d.icd_code.startswith("I10") for d in diagnoses):
        recommendations.append("Гипертензия: целевое АД < 130/80 мм рт.ст., контроль каждый визит.")
    if age and age > 60 and not any("статин" in m or "аторвастатин" in m for m in med_names):
        recommendations.append("Пациент > 60 лет с сердечно-сосудистым риском — рассмотреть назначение статинов.")

    # Build summary
    summary = " ".join(summary_parts)
    if not risks:
        summary += " Критических отклонений не выявлено."
    else:
        summary += f" Выявлено {len(risks)} потенциальных рисков."

    return {
        "summary": summary,
        "recommendations": recommendations,
        "risks": risks,
        "trends": trends,
        "source": "rules",
        "medications_count": med_count,
        "diagnoses_count": len(diagnoses),
        "abnormal_labs_count": len(abnormal_labs),
    }


@router.post("/{patient_id}/ai/chat")
async def chat_with_ai(
    patient_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
    message: str = Query(...),
):
    """Chat with AI about the patient."""
    from app.models.patient import Patient
    from app.models.vital_signs import VitalSign
    from app.models.diagnosis import Diagnosis
    from app.models.medication import Prescription
    from app.models.laboratory import LabOrder, LabResult
    from app.models.procedure import ProcedureOrder
    from app.models.stroke import StrokeAssessment

    clinic_id = current_user.clinic_id

    p_q = select(Patient).where(Patient.id == patient_id, Patient.clinic_id == clinic_id)
    p_result = await session.execute(p_q)
    patient = p_result.scalar_one_or_none()
    if not patient:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("Patient", str(patient_id))

    v_q = select(VitalSign).where(
        VitalSign.patient_id == patient_id,
        VitalSign.clinic_id == clinic_id,
        VitalSign.is_deleted == False,
    ).order_by(desc(VitalSign.recorded_at)).limit(5)
    vitals = list((await session.execute(v_q)).scalars().all())

    d_q = select(Diagnosis).where(
        Diagnosis.patient_id == patient_id,
        Diagnosis.clinic_id == clinic_id,
        Diagnosis.is_deleted == False,
    )
    diagnoses = list((await session.execute(d_q)).scalars().all())

    rx_q = select(Prescription).where(
        Prescription.patient_id == patient_id,
        Prescription.clinic_id == clinic_id,
        Prescription.is_deleted == False,
        Prescription.status == "ACTIVE",
    )
    prescriptions = list((await session.execute(rx_q)).scalars().all())

    lab_q = (
        select(LabResult)
        .join(LabOrder, LabResult.lab_order_id == LabOrder.id)
        .where(
            LabOrder.patient_id == patient_id,
            LabOrder.clinic_id == clinic_id,
            LabResult.is_deleted == False,
        )
        .order_by(desc(LabResult.resulted_at))
        .limit(15)
    )
    labs = list((await session.execute(lab_q)).scalars().all())

    sa_q = select(StrokeAssessment).where(
        StrokeAssessment.patient_id == patient_id,
        StrokeAssessment.clinic_id == clinic_id,
        StrokeAssessment.is_deleted == False,
    ).order_by(desc(StrokeAssessment.assessed_at)).limit(10)
    assessments = list((await session.execute(sa_q)).scalars().all())

    proc_q = select(ProcedureOrder).where(
        ProcedureOrder.patient_id == patient_id,
        ProcedureOrder.clinic_id == clinic_id,
        ProcedureOrder.is_deleted == False,
    )
    procedures = list((await session.execute(proc_q)).scalars().all())

    context = _collect_patient_context(patient, vitals, diagnoses, prescriptions, labs, assessments, procedures)

    if settings.OPENAI_API_KEY:
        return await _ai_chat(context, message, settings.OPENAI_API_KEY)
    else:
        return _rule_based_chat(message, patient, vitals, diagnoses, prescriptions, labs, assessments, procedures)


async def _ai_chat(context: str, question: str, api_key: str) -> dict:
    """Send chat message to OpenAI with patient context."""
    import httpx

    system_prompt = f"""Вы — клинический ИИ-ассистент для врача. У вас есть полные данные пациента.
Отвечайте на русском языке. Будьте конкретны и практичны.
Используйте форматирование: **жирный** для важного, • для списков.

Данные пациента:
{context}"""

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={
                    "model": "gpt-4o-mini",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": question},
                    ],
                    "temperature": 0.3,
                    "max_tokens": 1000,
                },
            )
        if response.status_code == 200:
            content = response.json()["choices"][0]["message"]["content"]
            return {"response": content, "source": "ai"}
    except Exception:
        pass

    return {"response": "Извините, ИИ-сервис временно недоступен. Попробуйте позже.", "source": "error"}


def _rule_based_chat(message: str, patient, vitals, diagnoses, prescriptions, labs, assessments, procedures) -> dict:
    """Generate rule-based response based on keywords in the question."""
    msg = message.lower()

    # Vitals
    if any(w in msg for w in ["витальн", "показател", "давлен", "пульс", "температур", "сатурац"]):
        if not vitals:
            return {"response": "У пациента пока нет записей витальных показателей.", "source": "rules"}
        v = vitals[0]
        parts = []
        if v.systolic_bp:
            parts.append(f"• **АД:** {v.systolic_bp}/{v.diastolic_bp} мм рт.ст.")
        if v.pulse:
            parts.append(f"• **Пульс:** {v.pulse} уд/мин")
        if v.spo2:
            parts.append(f"• **SpO₂:** {v.spo2}%")
        if v.temperature:
            parts.append(f"• **Температура:** {v.temperature}°C")
        if v.blood_glucose:
            parts.append(f"• **Глюкоза:** {v.blood_glucose} ммоль/л")
        if v.respiratory_rate:
            parts.append(f"• **ЧДД:** {v.respiratory_rate}/мин")
        if v.weight:
            parts.append(f"• **Вес:** {v.weight} кг")
        date_str = v.recorded_at.strftime("%d.%m.%Y %H:%M") if v.recorded_at else "?"
        response = f"**Последние витальные показатели** (записано {date_str}):\n\n" + "\n".join(parts)
        warnings = []
        if v.systolic_bp and v.systolic_bp > 140:
            warnings.append("⚠️ Повышенное АД — контроль гипотензивной терапии")
        if v.pulse and v.pulse > 100:
            warnings.append("⚠️ Тахикардия")
        if v.spo2 and v.spo2 < 95:
            warnings.append("⚠️ Снижение сатурации — рассмотреть О₂ терапию")
        if v.blood_glucose and float(v.blood_glucose) > 7:
            warnings.append("⚠️ Гипергликемия")
        if warnings:
            response += "\n\n**Обратите внимание:**\n" + "\n".join(warnings)
        return {"response": response, "source": "rules"}

    # Labs
    if any(w in msg for w in ["анализ", "лаборатор", "результат", "кровь"]):
        if not labs:
            return {"response": "У пациента пока нет результатов анализов.", "source": "rules"}
        lines = ["**Последние результаты анализов:**\n"]
        for lab in labs[:10]:
            abn = " ⚠️" if lab.is_abnormal else " ✓"
            lines.append(
                f"• {lab.value or '?'}: **{lab.numeric_value or '?'}** {lab.unit or ''} "
                f"(норма: {lab.reference_range or '?'}){abn}"
            )
        abnormal = [l for l in labs if l.is_abnormal]
        if abnormal:
            lines.append(f"\n**Отклонения:** {len(abnormal)} из {len(labs)} показателей вне нормы.")
        return {"response": "\n".join(lines), "source": "rules"}

    # Diagnoses
    if any(w in msg for w in ["диагноз", "мкб", "заболеван"]):
        if not diagnoses:
            return {"response": "У пациента пока нет установленных диагнозов.", "source": "rules"}
        lines = ["**Диагнозы пациента:**\n"]
        for d in diagnoses:
            raw_status = d.status.value if hasattr(d.status, "value") else str(d.status)
            status_label = {
                "active": "Активный",
                "chronic": "Хронический",
                "resolved": "Излечен",
                "suspected": "Подозрение",
            }.get(raw_status, raw_status)
            lines.append(f"• **{d.icd_code}** — {d.title} [{status_label}]")
            if d.description:
                lines.append(f"  {d.description[:100]}")
        return {"response": "\n".join(lines), "source": "rules"}

    # Medications
    if any(w in msg for w in ["препарат", "лекарств", "лечени", "терапи", "назначен", "рецепт"]):
        if not prescriptions:
            return {"response": "У пациента нет активных назначений.", "source": "rules"}
        lines = ["**Текущие назначения:**\n"]
        for rx in prescriptions:
            for item in (rx.items or []):
                if not item.is_deleted and item.drug:
                    raw_route = item.route.value if hasattr(item.route, "value") else str(item.route)
                    route_label = {
                        "ORAL": "перорально",
                        "IV": "в/в",
                        "IM": "в/м",
                        "TOPICAL": "наружно",
                    }.get(raw_route, raw_route)
                    lines.append(
                        f"• **{item.drug.name}** {item.dosage or ''} — "
                        f"{item.frequency or ''} ({route_label})"
                    )
                    if item.duration_days:
                        lines.append(f"  Курс: {item.duration_days} дней")
        return {"response": "\n".join(lines), "source": "rules"}

    # Scales / Assessments
    if any(w in msg for w in ["шкал", "nihss", "barthel", "оценк", "когнит", "реабилит"]):
        if not assessments:
            return {"response": "У пациента нет оценок по клиническим шкалам.", "source": "rules"}
        lines = ["**Клинические шкалы:**\n"]
        by_type: dict = {}
        for a in assessments:
            key = a.assessment_type.value
            if key not in by_type:
                by_type[key] = a
        for atype, a in by_type.items():
            date_str = a.assessed_at.strftime("%d.%m.%Y") if a.assessed_at else "?"
            lines.append(f"• **{atype}:** {a.score}/{a.max_score} (от {date_str})")
            if a.interpretation:
                lines.append(f"  {a.interpretation[:80]}")
        return {"response": "\n".join(lines), "source": "rules"}

    # Daily note generation
    if any(w in msg for w in ["дневник", "запис", "сгенерир"]):
        lines = ["**Шаблон дневниковой записи:**\n"]
        lines.append(f"Дата: {datetime.now().strftime('%d.%m.%Y')}\n")
        if vitals:
            v = vitals[0]
            parts = []
            if v.systolic_bp:
                parts.append(f"АД {v.systolic_bp}/{v.diastolic_bp}")
            if v.pulse:
                parts.append(f"пульс {v.pulse}")
            if v.spo2:
                parts.append(f"SpO₂ {v.spo2}%")
            if v.temperature:
                parts.append(f"t {v.temperature}°C")
            lines.append(f"**Витальные:** {', '.join(parts)}\n")
        active_diag = [
            d for d in diagnoses
            if str(d.status.value if hasattr(d.status, "value") else d.status) in ("active", "chronic")
        ]
        if active_diag:
            codes = ", ".join(d.icd_code for d in active_diag[:3])
            lines.append(f"**Диагнозы:** {codes}\n")
        if prescriptions:
            meds = []
            for rx in prescriptions:
                for item in (rx.items or []):
                    if not item.is_deleted and item.drug:
                        meds.append(f"{item.drug.name} {item.dosage or ''}")
            if meds:
                lines.append(f"**Терапия:** {', '.join(meds[:5])}\n")
        lines.append("**Жалобы:** [заполните]\n")
        lines.append("**Динамика:** [заполните]\n")
        lines.append("**План:** [заполните]")
        return {"response": "\n".join(lines), "source": "rules"}

    # Risks
    if any(w in msg for w in ["риск", "опасно", "предупрежд", "внимани"]):
        analysis = _rule_based_analysis(patient, vitals, diagnoses, prescriptions, labs, assessments, procedures)
        if not analysis["risks"]:
            return {"response": "На данный момент критических рисков не обнаружено.", "source": "rules"}
        lines = ["**Выявленные риски:**\n"]
        for r in analysis["risks"]:
            lines.append(f"• {r}")
        return {"response": "\n".join(lines), "source": "rules"}

    # Recommendations
    if any(w in msg for w in ["рекоменд", "совет", "предлож"]):
        analysis = _rule_based_analysis(patient, vitals, diagnoses, prescriptions, labs, assessments, procedures)
        if not analysis["recommendations"]:
            return {
                "response": "Нет специфических рекомендаций. Заполните больше данных о пациенте.",
                "source": "rules",
            }
        lines = ["**Рекомендации:**\n"]
        for i, r in enumerate(analysis["recommendations"], 1):
            lines.append(f"{i}. {r}")
        return {"response": "\n".join(lines), "source": "rules"}

    # Procedures
    if any(w in msg for w in ["процедур", "обследован", "исследован"]):
        if not procedures:
            return {"response": "У пациента нет назначенных процедур.", "source": "rules"}
        lines = ["**Процедуры:**\n"]
        for p in procedures:
            name = p.procedure.name if p.procedure else "?"
            raw_status = p.status.value if hasattr(p.status, "value") else str(p.status)
            status_label = {
                "ORDERED": "Назначена",
                "SCHEDULED": "Запланирована",
                "IN_PROGRESS": "Выполняется",
                "COMPLETED": "Выполнена",
                "CANCELLED": "Отменена",
            }.get(raw_status, raw_status)
            lines.append(f"• **{name}** — {status_label}")
        return {"response": "\n".join(lines), "source": "rules"}

    # Default — general summary
    analysis = _rule_based_analysis(patient, vitals, diagnoses, prescriptions, labs, assessments, procedures)
    response = f"**О пациенте:**\n{analysis['summary']}\n"
    if analysis["recommendations"]:
        response += "\n**Рекомендации:**\n"
        for r in analysis["recommendations"][:3]:
            response += f"• {r}\n"
    if analysis["risks"]:
        response += "\n**Риски:**\n"
        for r in analysis["risks"][:3]:
            response += f"• {r}\n"
    response += "\nЗадайте более конкретный вопрос, и я дам детальный ответ."
    return {"response": response, "source": "rules"}
