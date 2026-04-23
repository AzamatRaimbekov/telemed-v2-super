def test_queue_status_enum():
    from app.models.queue import QueueStatus
    assert QueueStatus.WAITING == "waiting"
    assert QueueStatus.CALLED == "called"
    assert QueueStatus.IN_PROGRESS == "in_progress"
    assert QueueStatus.COMPLETED == "completed"

def test_queue_entry_model():
    from app.models.queue import QueueEntry
    assert QueueEntry.__tablename__ == "queue_entries"
