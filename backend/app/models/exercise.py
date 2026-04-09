import enum
import uuid
from datetime import datetime
from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, JSON, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TenantMixin

class ExerciseCategory(str, enum.Enum):
    UPPER_LIMB = "UPPER_LIMB"
    LOWER_LIMB = "LOWER_LIMB"
    BALANCE = "BALANCE"
    GAIT = "GAIT"
    COGNITIVE = "COGNITIVE"

class ExerciseDifficulty(str, enum.Enum):
    EASY = "EASY"
    MEDIUM = "MEDIUM"
    HARD = "HARD"

class Exercise(TenantMixin, Base):
    __tablename__ = "exercises"
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    category: Mapped[ExerciseCategory] = mapped_column(Enum(ExerciseCategory), nullable=False)
    difficulty: Mapped[ExerciseDifficulty] = mapped_column(Enum(ExerciseDifficulty), default=ExerciseDifficulty.EASY)
    target_joints: Mapped[dict | None] = mapped_column(JSON)
    angle_thresholds: Mapped[dict | None] = mapped_column(JSON)
    demo_video_url: Mapped[str | None] = mapped_column(String(500))
    instructions: Mapped[str | None] = mapped_column(Text)
    default_sets: Mapped[int | None] = mapped_column(Integer)
    default_reps: Mapped[int | None] = mapped_column(Integer)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

class ExerciseSession(TenantMixin, Base):
    __tablename__ = "exercise_sessions"
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    exercise_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("exercises.id"), nullable=False)
    treatment_plan_item_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("treatment_plan_items.id"), nullable=True)
    duration_seconds: Mapped[int | None] = mapped_column(Integer)
    reps_completed: Mapped[int | None] = mapped_column(Integer)
    sets_completed: Mapped[int | None] = mapped_column(Integer)
    accuracy_score: Mapped[float | None] = mapped_column(Numeric(5, 2))
    feedback: Mapped[dict | None] = mapped_column(JSON)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    patient = relationship("Patient", foreign_keys=[patient_id], lazy="selectin")
    exercise = relationship("Exercise", foreign_keys=[exercise_id], lazy="selectin")
    reps = relationship("ExerciseRep", back_populates="session", lazy="selectin")

class ExerciseRep(TenantMixin, Base):
    __tablename__ = "exercise_reps"
    session_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("exercise_sessions.id"), nullable=False)
    rep_number: Mapped[int] = mapped_column(Integer, nullable=False)
    max_angle: Mapped[float | None] = mapped_column(Numeric(6, 2))
    min_angle: Mapped[float | None] = mapped_column(Numeric(6, 2))
    duration_ms: Mapped[int | None] = mapped_column(Integer)
    form_score: Mapped[float | None] = mapped_column(Numeric(5, 2))
    feedback: Mapped[dict | None] = mapped_column(JSON)
    session = relationship("ExerciseSession", back_populates="reps")
