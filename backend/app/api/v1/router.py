from fastapi import APIRouter
from app.api.v1.routes import auth, clinics, health, users, portal, patients

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(clinics.router)
api_router.include_router(portal.router)
api_router.include_router(patients.router)
