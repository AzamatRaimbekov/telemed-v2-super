from __future__ import annotations
from fastapi import Request
from fastapi.responses import JSONResponse

class APIError(Exception):
    def __init__(self, status_code: int = 500, error_code: str = "INTERNAL_ERROR", message: str = "An internal error occurred", details: dict | None = None) -> None:
        self.status_code = status_code
        self.error_code = error_code
        self.message = message
        self.details = details or {}

class NotFoundError(APIError):
    def __init__(self, resource: str = "Resource", resource_id: str = "") -> None:
        super().__init__(status_code=404, error_code=f"{resource.upper()}_NOT_FOUND", message=f"{resource} not found" + (f": {resource_id}" if resource_id else ""))

class ValidationError(APIError):
    def __init__(self, message: str = "Validation failed", details: dict | None = None) -> None:
        super().__init__(status_code=422, error_code="VALIDATION_ERROR", message=message, details=details)

class AuthenticationError(APIError):
    def __init__(self, message: str = "Authentication failed") -> None:
        super().__init__(status_code=401, error_code="AUTHENTICATION_ERROR", message=message)

class ForbiddenError(APIError):
    def __init__(self, message: str = "Access denied") -> None:
        super().__init__(status_code=403, error_code="FORBIDDEN", message=message)

class ConflictError(APIError):
    def __init__(self, message: str = "Resource already exists") -> None:
        super().__init__(status_code=409, error_code="CONFLICT", message=message)

class RateLimitError(APIError):
    def __init__(self) -> None:
        super().__init__(status_code=429, error_code="RATE_LIMITED", message="Too many requests")

async def api_error_handler(request: Request, exc: APIError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"error": {"code": exc.error_code, "message": exc.message, "details": exc.details}})
