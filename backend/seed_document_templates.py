"""Seed default medical document templates for Kyrgyz clinics."""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.models.document_template import DocumentTemplate, TemplateCategory

DATABASE_URL = os.getenv("DATABASE_URL", "")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

TEMPLATES = [
    {
        "name": "Рецепт",
        "category": TemplateCategory.PRESCRIPTION,
        "description": "Стандартный рецепт для назначения лекарственных препаратов",
        "body_template": """<div style="font-family: 'Times New Roman', serif; max-width: 700px; margin: 0 auto; padding: 30px; border: 2px solid #333;">
  <div style="text-align: center; border-bottom: 1px solid #999; padding-bottom: 15px; margin-bottom: 20px;">
    <h2 style="margin: 0;">РЕЦЕПТ</h2>
    <p style="margin: 5px 0; color: #666;">Кыргызская Республика</p>
  </div>

  <p><strong>Дата:</strong> {{ today }}</p>
  <p><strong>Пациент:</strong> {{ patient.full_name }}</p>
  <p><strong>Дата рождения:</strong> {{ patient.date_of_birth }}</p>
  <p><strong>Адрес:</strong> {{ patient.address }}</p>

  <hr style="border: none; border-top: 1px dashed #999; margin: 20px 0;">

  <h3>Rp:</h3>
  <div style="min-height: 150px; padding: 10px; border: 1px solid #eee; margin-bottom: 20px;">
    {{ extra.medications if extra and extra.medications else '<em>Назначения врача</em>' }}
  </div>

  <div style="margin-top: 30px;">
    <p><strong>Лечащий врач:</strong> {{ doctor.full_name }}</p>
    <p><strong>Специализация:</strong> {{ doctor.specialization }}</p>
    <p style="margin-top: 30px;">Подпись: ____________________</p>
    <p>М.П.</p>
  </div>
</div>""",
    },
    {
        "name": "Выписка из стационара",
        "category": TemplateCategory.DISCHARGE,
        "description": "Выписной эпикриз пациента из стационара",
        "body_template": """<div style="font-family: 'Times New Roman', serif; max-width: 700px; margin: 0 auto; padding: 30px;">
  <div style="text-align: center; margin-bottom: 25px;">
    <h2 style="margin: 0;">ВЫПИСНОЙ ЭПИКРИЗ</h2>
    <p style="color: #666;">Кыргызская Республика</p>
  </div>

  <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
    <tr>
      <td style="padding: 5px; width: 200px;"><strong>Пациент:</strong></td>
      <td style="padding: 5px;">{{ patient.full_name }}</td>
    </tr>
    <tr>
      <td style="padding: 5px;"><strong>Дата рождения:</strong></td>
      <td style="padding: 5px;">{{ patient.date_of_birth }}</td>
    </tr>
    <tr>
      <td style="padding: 5px;"><strong>Паспорт:</strong></td>
      <td style="padding: 5px;">{{ patient.passport_number }}</td>
    </tr>
    <tr>
      <td style="padding: 5px;"><strong>Полис:</strong></td>
      <td style="padding: 5px;">{{ patient.insurance_number }}</td>
    </tr>
  </table>

  <h3>Диагноз</h3>
  <p>{{ visit.diagnosis_text if visit else '' }}</p>

  <h3>Жалобы при поступлении</h3>
  <p>{{ visit.chief_complaint if visit else '' }}</p>

  <h3>Проведённое лечение</h3>
  <p>{{ visit.examination_notes if visit else '' }}</p>

  <h3>Дата поступления</h3>
  <p>{{ visit.started_at if visit else '' }}</p>

  <h3>Дата выписки</h3>
  <p>{{ visit.ended_at if visit else today }}</p>

  <h3>Рекомендации</h3>
  <div style="min-height: 100px; padding: 10px; border: 1px solid #eee;">
    {{ extra.recommendations if extra and extra.recommendations else '' }}
  </div>

  <div style="margin-top: 40px;">
    <p><strong>Лечащий врач:</strong> {{ doctor.full_name }}</p>
    <p>Подпись: ____________________</p>
    <p style="margin-top: 10px;"><strong>Дата:</strong> {{ today }}</p>
  </div>
</div>""",
    },
    {
        "name": "Направление",
        "category": TemplateCategory.REFERRAL,
        "description": "Направление пациента к специалисту или в другое отделение",
        "body_template": """<div style="font-family: 'Times New Roman', serif; max-width: 700px; margin: 0 auto; padding: 30px; border: 1px solid #999;">
  <div style="text-align: center; margin-bottom: 25px;">
    <h2 style="margin: 0;">НАПРАВЛЕНИЕ</h2>
    <p style="color: #666;">Кыргызская Республика</p>
  </div>

  <p><strong>Дата:</strong> {{ today }}</p>

  <p><strong>От врача:</strong> {{ doctor.full_name }} ({{ doctor.specialization }})</p>

  <p style="margin-top: 15px;"><strong>Направляется пациент:</strong></p>
  <p>ФИО: {{ patient.full_name }}</p>
  <p>Дата рождения: {{ patient.date_of_birth }}</p>
  <p>Полис: {{ patient.insurance_number }}</p>

  <p style="margin-top: 15px;"><strong>Направлен в:</strong>
    {{ extra.target_department if extra and extra.target_department else '____________________' }}
  </p>

  <p><strong>К специалисту:</strong>
    {{ extra.target_doctor if extra and extra.target_doctor else '____________________' }}
  </p>

  <h3>Причина направления</h3>
  <p>{{ extra.reason if extra and extra.reason else visit.diagnosis_text if visit else '' }}</p>

  <h3>Предварительный диагноз</h3>
  <p>{{ visit.diagnosis_text if visit else '' }}</p>

  <div style="margin-top: 40px;">
    <p>Подпись направившего врача: ____________________</p>
    <p>М.П.</p>
  </div>
</div>""",
    },
    {
        "name": "Справка о лечении",
        "category": TemplateCategory.CERTIFICATE,
        "description": "Справка о прохождении лечения в медицинском учреждении",
        "body_template": """<div style="font-family: 'Times New Roman', serif; max-width: 700px; margin: 0 auto; padding: 30px; border: 2px solid #333;">
  <div style="text-align: center; margin-bottom: 25px;">
    <h2 style="margin: 0;">СПРАВКА</h2>
    <p style="color: #666;">Кыргызская Республика</p>
  </div>

  <p style="text-align: center; margin: 20px 0;">
    Дана {{ patient.full_name }}, {{ patient.date_of_birth }} г.р.,
  </p>

  <p style="text-align: justify; line-height: 1.8;">
    в том, что он(а) находился(ась) на лечении в нашем медицинском учреждении
    с <strong>{{ extra.date_from if extra and extra.date_from else visit.started_at if visit else '___________' }}</strong>
    по <strong>{{ extra.date_to if extra and extra.date_to else visit.ended_at if visit else '___________' }}</strong>.
  </p>

  <p style="text-align: justify; line-height: 1.8;">
    Диагноз: {{ visit.diagnosis_text if visit else '____________________' }}
  </p>

  <p style="margin-top: 10px;">
    Справка выдана для предоставления по месту требования.
  </p>

  <div style="margin-top: 40px;">
    <p><strong>Лечащий врач:</strong> {{ doctor.full_name }}</p>
    <p>Подпись: ____________________</p>
    <p style="margin-top: 10px;"><strong>Дата выдачи:</strong> {{ today }}</p>
    <p>М.П.</p>
  </div>
</div>""",
    },
]


async def main():
    if not DATABASE_URL:
        print("DATABASE_URL not set")
        return

    engine = create_async_engine(DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # Get first clinic
        result = await session.execute(text("SELECT id FROM clinics LIMIT 1"))
        row = result.fetchone()
        if not row:
            print("No clinic found, skipping template seed")
            return
        clinic_id = row[0]

        for tmpl_data in TEMPLATES:
            # Check if already exists
            result = await session.execute(
                select(DocumentTemplate).where(
                    DocumentTemplate.clinic_id == clinic_id,
                    DocumentTemplate.name == tmpl_data["name"],
                    DocumentTemplate.is_deleted == False,
                )
            )
            existing = result.scalar_one_or_none()
            if existing:
                print(f"  [skip] {tmpl_data['name']} already exists")
                continue

            tmpl = DocumentTemplate(
                clinic_id=clinic_id,
                name=tmpl_data["name"],
                category=tmpl_data["category"],
                body_template=tmpl_data["body_template"],
                description=tmpl_data["description"],
                is_system_default=True,
            )
            session.add(tmpl)
            print(f"  [seed] {tmpl_data['name']}")

        await session.commit()
        print("Document templates seeded successfully!")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
