def test_isolation_type_enum():
    from app.models.infection_control import IsolationType
    assert IsolationType.CONTACT == "contact"
    assert IsolationType.DROPLET == "droplet"
    assert IsolationType.AIRBORNE == "airborne"

def test_infection_status():
    from app.models.infection_control import InfectionStatus
    assert InfectionStatus.SUSPECTED == "suspected"
    assert InfectionStatus.CONFIRMED == "confirmed"
    assert InfectionStatus.RESOLVED == "resolved"
