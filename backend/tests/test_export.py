from app.services.export_service import ExcelExporter

def test_excel_export():
    headers = ["Name", "Age", "City"]
    rows = [["Alice", 30, "Bishkek"], ["Bob", 25, "Osh"]]
    buffer = ExcelExporter.create_report("Test Report", headers, rows)
    data = buffer.read()
    assert len(data) > 0
    # XLSX magic bytes
    assert data[:2] == b'PK'
