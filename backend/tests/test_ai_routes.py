import pytest
from unittest.mock import patch, AsyncMock, MagicMock


def test_suggest_diagnoses_schema():
    """Verify the DiagnosisSuggestRequest schema accepts valid data."""
    from app.schemas.ai import DiagnosisSuggestRequest
    import uuid
    req = DiagnosisSuggestRequest(
        patient_id=uuid.uuid4(),
        symptoms="головная боль, температура",
        age=35,
        sex="M",
    )
    assert req.symptoms == "головная боль, температура"


def test_exam_generate_schema():
    from app.schemas.ai import ExamGenerateRequest
    import uuid
    req = ExamGenerateRequest(
        patient_id=uuid.uuid4(),
        complaints="боль в горле",
    )
    assert req.complaints == "боль в горле"


def test_conclusion_schema():
    from app.schemas.ai import ConclusionGenerateRequest
    import uuid
    req = ConclusionGenerateRequest(
        patient_id=uuid.uuid4(),
        diagnoses=["J06.9 ОРВИ"],
        exam_notes="Температура 37.5",
    )
    assert len(req.diagnoses) == 1
