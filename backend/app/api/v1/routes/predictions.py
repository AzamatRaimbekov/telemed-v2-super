from fastapi import APIRouter, Query
from app.api.deps import CurrentUser, DBSession, require_role
from app.models.user import UserRole
from app.services.predictive_service import PredictiveService

router = APIRouter(prefix="/predictions", tags=["Predictions"])


@router.get("/beds")
async def predict_beds(
    session: DBSession,
    current_user: CurrentUser,
    days: int = Query(default=7, le=30),
):
    svc = PredictiveService(session)
    return await svc.forecast_bed_occupancy(current_user.clinic_id, days)


@router.get("/admissions")
async def predict_admissions(
    session: DBSession,
    current_user: CurrentUser,
    days: int = Query(default=7, le=30),
):
    svc = PredictiveService(session)
    return await svc.forecast_admissions(current_user.clinic_id, days)


@router.get("/medications")
async def predict_medications(
    session: DBSession,
    current_user: CurrentUser,
    days: int = Query(default=30, le=90),
):
    svc = PredictiveService(session)
    return await svc.forecast_medication(current_user.clinic_id, days)


@router.get("/dashboard")
async def predictions_dashboard(
    session: DBSession,
    current_user: CurrentUser,
):
    """All predictions in one call for the dashboard."""
    svc = PredictiveService(session)
    return {
        "beds": await svc.forecast_bed_occupancy(current_user.clinic_id, 7),
        "admissions": await svc.forecast_admissions(current_user.clinic_id, 7),
        "medications": await svc.forecast_medication(current_user.clinic_id, 30),
    }
