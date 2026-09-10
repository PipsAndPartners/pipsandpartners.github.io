"""Render a list of flat dict rows as an in-memory .xlsx workbook."""

from io import BytesIO

from openpyxl import Workbook


def build(rows: list[dict], headers: list[tuple[str, str]], title: str = "Sheet1") -> BytesIO:
    """headers: list of (dict_key, column_label) pairs, in output column order."""
    wb = Workbook()
    ws = wb.active
    ws.title = title[:31]
    ws.append([label for _, label in headers])
    for row in rows:
        ws.append([row.get(key, "") for key, _ in headers])
    for column_cells in ws.columns:
        length = max((len(str(cell.value)) for cell in column_cells if cell.value is not None), default=10)
        ws.column_dimensions[column_cells[0].column_letter].width = min(length + 2, 50)
    buffer = BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer
