from fastapi import APIRouter
from fastapi.responses import HTMLResponse
from app.api.deps import CurrentUser, DBSession
from sqlalchemy import select
from app.models.patient import Patient
from app.models.clinic import Clinic
import uuid
from datetime import date

router = APIRouter(prefix="/print", tags=["Print Documents"])


@router.get("/prescription/{patient_id}", response_class=HTMLResponse)
async def print_prescription(
    patient_id: str,
    session: DBSession,
    current_user: CurrentUser,
    medications: str = "",
):
    patient = (await session.execute(select(Patient).where(Patient.id == uuid.UUID(patient_id)))).scalar_one_or_none()
    clinic = (await session.execute(select(Clinic).where(Clinic.id == current_user.clinic_id))).scalar_one_or_none()

    patient_name = f"{patient.last_name} {patient.first_name}" if patient else "—"
    doctor_name = f"{current_user.last_name} {current_user.first_name}"
    clinic_name = clinic.name if clinic else "MedCore Клиника"
    today = date.today().strftime("%d.%m.%Y")

    meds_list = "".join(
        f"<tr><td style='padding:8px;border:1px solid #ddd;'>{i+1}</td><td style='padding:8px;border:1px solid #ddd;'>{m.strip()}</td></tr>"
        for i, m in enumerate(medications.split(",")) if m.strip()
    ) if medications else "<tr><td colspan='2' style='padding:8px;color:#999;'>Нет назначений</td></tr>"

    html = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Рецепт</title>
<style>
  @page {{ size: A5; margin: 15mm; }}
  body {{ font-family: 'Times New Roman', serif; font-size: 12pt; color: #333; }}
  .header {{ text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 15px; }}
  .header h1 {{ font-size: 16pt; margin: 0; }}
  .header p {{ font-size: 10pt; color: #666; margin: 2px 0; }}
  .field {{ margin: 8px 0; }}
  .field label {{ font-weight: bold; }}
  table {{ width: 100%; border-collapse: collapse; margin: 15px 0; }}
  .signature {{ margin-top: 40px; display: flex; justify-content: space-between; }}
  .signature div {{ text-align: center; }}
  .signature .line {{ border-top: 1px solid #333; width: 150px; margin-top: 30px; padding-top: 5px; font-size: 10pt; }}
  @media print {{ button {{ display: none; }} }}
</style></head><body>
<button onclick="window.print()" style="position:fixed;top:10px;right:10px;padding:8px 16px;background:#7E78D2;color:white;border:none;border-radius:8px;cursor:pointer;">Печать</button>
<div class="header">
  <h1>{clinic_name}</h1>
  <p>Рецепт</p>
</div>
<div class="field"><label>Пациент:</label> {patient_name}</div>
<div class="field"><label>Дата:</label> {today}</div>
<div class="field"><label>Врач:</label> {doctor_name}</div>
<h3>Назначения:</h3>
<table><thead><tr><th style="padding:8px;border:1px solid #ddd;background:#f5f5f5;">№</th><th style="padding:8px;border:1px solid #ddd;background:#f5f5f5;">Препарат</th></tr></thead><tbody>{meds_list}</tbody></table>
<div class="signature">
  <div><div class="line">Подпись врача</div></div>
  <div><div class="line">Печать клиники</div></div>
</div>
</body></html>"""
    return HTMLResponse(content=html)


@router.get("/discharge/{patient_id}", response_class=HTMLResponse)
async def print_discharge(
    patient_id: str,
    session: DBSession,
    current_user: CurrentUser,
    diagnosis: str = "",
    treatment: str = "",
    recommendations: str = "",
):
    patient = (await session.execute(select(Patient).where(Patient.id == uuid.UUID(patient_id)))).scalar_one_or_none()
    clinic = (await session.execute(select(Clinic).where(Clinic.id == current_user.clinic_id))).scalar_one_or_none()

    patient_name = f"{patient.last_name} {patient.first_name}" if patient else "—"
    doctor_name = f"{current_user.last_name} {current_user.first_name}"
    clinic_name = clinic.name if clinic else "MedCore Клиника"
    today = date.today().strftime("%d.%m.%Y")

    html = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Выписка</title>
<style>
  @page {{ size: A4; margin: 20mm; }}
  body {{ font-family: 'Times New Roman', serif; font-size: 12pt; color: #333; line-height: 1.6; }}
  .header {{ text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }}
  .header h1 {{ font-size: 18pt; margin: 0; }}
  .section {{ margin: 15px 0; }}
  .section h3 {{ font-size: 13pt; color: #555; margin-bottom: 5px; }}
  .signature {{ margin-top: 50px; display: flex; justify-content: space-between; }}
  .signature .line {{ border-top: 1px solid #333; width: 180px; margin-top: 30px; padding-top: 5px; font-size: 10pt; text-align: center; }}
  @media print {{ button {{ display: none; }} }}
</style></head><body>
<button onclick="window.print()" style="position:fixed;top:10px;right:10px;padding:8px 16px;background:#7E78D2;color:white;border:none;border-radius:8px;cursor:pointer;">Печать</button>
<div class="header">
  <h1>{clinic_name}</h1>
  <p>Выписной эпикриз</p>
</div>
<div class="section"><h3>Пациент</h3><p>{patient_name}</p></div>
<div class="section"><h3>Дата выписки</h3><p>{today}</p></div>
<div class="section"><h3>Диагноз</h3><p>{diagnosis or '—'}</p></div>
<div class="section"><h3>Проведённое лечение</h3><p>{treatment or '—'}</p></div>
<div class="section"><h3>Рекомендации</h3><p>{recommendations or '—'}</p></div>
<div class="section"><h3>Лечащий врач</h3><p>{doctor_name}</p></div>
<div class="signature">
  <div><div class="line">Подпись врача</div></div>
  <div><div class="line">Печать клиники</div></div>
</div>
</body></html>"""
    return HTMLResponse(content=html)


@router.get("/referral/{patient_id}", response_class=HTMLResponse)
async def print_referral(
    patient_id: str,
    session: DBSession,
    current_user: CurrentUser,
    to_department: str = "",
    reason: str = "",
):
    patient = (await session.execute(select(Patient).where(Patient.id == uuid.UUID(patient_id)))).scalar_one_or_none()
    clinic = (await session.execute(select(Clinic).where(Clinic.id == current_user.clinic_id))).scalar_one_or_none()

    patient_name = f"{patient.last_name} {patient.first_name}" if patient else "—"
    doctor_name = f"{current_user.last_name} {current_user.first_name}"
    clinic_name = clinic.name if clinic else "MedCore Клиника"
    today = date.today().strftime("%d.%m.%Y")

    html = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Направление</title>
<style>
  @page {{ size: A5; margin: 15mm; }}
  body {{ font-family: 'Times New Roman', serif; font-size: 12pt; color: #333; }}
  .header {{ text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 15px; }}
  .field {{ margin: 10px 0; }}
  .field label {{ font-weight: bold; }}
  .signature {{ margin-top: 40px; }}
  .signature .line {{ border-top: 1px solid #333; width: 150px; margin-top: 30px; padding-top: 5px; font-size: 10pt; }}
  @media print {{ button {{ display: none; }} }}
</style></head><body>
<button onclick="window.print()" style="position:fixed;top:10px;right:10px;padding:8px 16px;background:#7E78D2;color:white;border:none;border-radius:8px;cursor:pointer;">Печать</button>
<div class="header"><h1>{clinic_name}</h1><p>Направление</p></div>
<div class="field"><label>Пациент:</label> {patient_name}</div>
<div class="field"><label>Дата:</label> {today}</div>
<div class="field"><label>Направляющий врач:</label> {doctor_name}</div>
<div class="field"><label>Направлен в:</label> {to_department or '—'}</div>
<div class="field"><label>Причина направления:</label> {reason or '—'}</div>
<div class="signature"><div class="line">Подпись врача</div></div>
</body></html>"""
    return HTMLResponse(content=html)
