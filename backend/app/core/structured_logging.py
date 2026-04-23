"""Structured logging configuration for production monitoring."""
import structlog
import logging
import sys


def setup_logging(log_level: str = "INFO", json_format: bool = True):
    """Configure structured logging for the application."""

    processors = [
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
    ]

    if json_format:
        processors.append(structlog.processors.JSONRenderer())
    else:
        processors.append(structlog.dev.ConsoleRenderer())

    structlog.configure(
        processors=processors,
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    # Configure standard logging
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=getattr(logging, log_level.upper(), logging.INFO),
    )


def get_logger(name: str):
    """Get a structured logger instance."""
    return structlog.get_logger(name)


# Request logging helper
class RequestLogger:
    """Log API requests with structured data."""

    def __init__(self):
        self.logger = get_logger("api.request")

    async def log_request(self, method: str, path: str, status: int,
                          duration_ms: float, user_id: str | None = None,
                          clinic_id: str | None = None):
        self.logger.info(
            "api_request",
            method=method,
            path=path,
            status=status,
            duration_ms=round(duration_ms, 2),
            user_id=user_id,
            clinic_id=clinic_id,
        )

    async def log_error(self, method: str, path: str, error: str,
                        user_id: str | None = None):
        self.logger.error(
            "api_error",
            method=method,
            path=path,
            error=error,
            user_id=user_id,
        )

request_logger = RequestLogger()
