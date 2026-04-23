from app.services.wristband_service import generate_wristband_uid

def test_uid_format():
    uid = generate_wristband_uid()
    assert uid.startswith("MC-")
    assert len(uid) == 9
    assert uid[3:].isalnum()
    assert uid[3:].isupper() or uid[3:].isdigit()

def test_uid_uniqueness():
    uids = [generate_wristband_uid() for _ in range(200)]
    assert len(set(uids)) >= 190  # 95% unique

def test_uid_uppercase():
    for _ in range(50):
        uid = generate_wristband_uid()
        assert uid == uid.upper()
