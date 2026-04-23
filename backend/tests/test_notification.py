def test_notification_channel_enum():
    from app.models.notification_log import NotificationChannel
    assert NotificationChannel.SMS == "SMS"
    assert NotificationChannel.WHATSAPP == "WHATSAPP"
    assert NotificationChannel.TELEGRAM == "TELEGRAM"
    assert NotificationChannel.EMAIL == "EMAIL"

def test_notification_status_enum():
    from app.models.notification_log import NotificationStatus
    assert NotificationStatus.PENDING == "PENDING"
    assert NotificationStatus.SENT == "SENT"
    assert NotificationStatus.FAILED == "FAILED"
