import uuid
import enum
from datetime import date
from sqlalchemy import String, Float, Date, JSON, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, BaseMixin, TenantMixin


class PredictionType(str, enum.Enum):
    BED_OCCUPANCY = "bed_occupancy"
    MEDICATION_CONSUMPTION = "medication_consumption"
    PATIENT_ADMISSIONS = "patient_admissions"


class Prediction(TenantMixin, Base):
    __tablename__ = "predictions"

    prediction_type: Mapped[str] = mapped_column(SAEnum(PredictionType), nullable=False)
    target_date: Mapped[date] = mapped_column(Date, nullable=False)
    predicted_value: Mapped[float] = mapped_column(Float, nullable=False)
    confidence_low: Mapped[float | None] = mapped_column(Float, nullable=True)
    confidence_high: Mapped[float | None] = mapped_column(Float, nullable=True)
    actual_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    model_version: Mapped[str | None] = mapped_column(String(50), nullable=True)
