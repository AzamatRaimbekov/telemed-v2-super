from app.services.ai_summarizer import _empty_summary

def test_empty_summary():
    result = _empty_summary("Test transcript text")
    assert result["raw_transcript"] == "Test transcript text"
    assert result["chief_complaint"] is None
    assert result["diagnosis"] is None
