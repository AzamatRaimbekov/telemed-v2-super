def test_fiscal_status_enum():
    from app.models.fiscal import FiscalStatus
    assert FiscalStatus.PENDING == "pending"
    assert FiscalStatus.SUCCESS == "success"
    assert FiscalStatus.FAILED == "failed"

def test_fiscal_receipt_model_exists():
    from app.models.fiscal import FiscalReceipt
    assert FiscalReceipt.__tablename__ == "fiscal_receipts"
