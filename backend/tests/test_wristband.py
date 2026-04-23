from app.services.wristband_service import generate_wristband_uid

def test_wristband_uid_format():
    uid = generate_wristband_uid()
    assert uid.startswith("MC-")
    assert len(uid) == 9  # MC- + 6 chars
    assert uid[3:].isalnum()

def test_wristband_uid_unique():
    uids = set(generate_wristband_uid() for _ in range(100))
    assert len(uids) >= 95  # at least 95% unique in 100 tries
