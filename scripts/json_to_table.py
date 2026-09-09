"""Render a JSON list/object as a readable local HTML table."""

import argparse
import html
import json
from pathlib import Path


def flatten(value: object) -> str:
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False, indent=2)
    return "" if value is None else str(value)


def render(data: object, title: str) -> str:
    rows = data if isinstance(data, list) else data.get("items", data.get("results", [])) if isinstance(data, dict) else []
    if not isinstance(rows, list):
        rows = [data]
    columns = []
    for row in rows:
        if isinstance(row, dict):
            for key in row:
                if key not in columns:
                    columns.append(key)
    header = "".join(f"<th>{html.escape(str(column))}</th>" for column in columns)
    body = []
    for row in rows:
        body.append("<tr>" + "".join(
            f"<td><pre>{html.escape(flatten(row.get(column) if isinstance(row, dict) else None))}</pre></td>"
            for column in columns
        ) + "</tr>")
    return f"""<!doctype html>
<html lang="en"><meta charset="utf-8"><title>{html.escape(title)}</title>
<style>body{{font:14px Segoe UI, sans-serif;background:#eef3f8;color:#102030;padding:24px}}h1{{color:#0a2540}}.wrap{{overflow:auto;background:white;border:1px solid #cfdcea;border-radius:8px}}table{{border-collapse:collapse;width:100%;min-width:900px}}th,td{{padding:9px 11px;border-bottom:1px solid #dbe5ee;text-align:left;vertical-align:top}}th{{position:sticky;top:0;background:#0a2540;color:white}}tr:nth-child(even){{background:#f5f8fb}}pre{{font:12px Consolas,monospace;white-space:pre-wrap;max-width:420px;margin:0}}</style>
<h1>{html.escape(title)}</h1><p>{len(rows)} row(s)</p><div class="wrap"><table><thead><tr>{header}</tr></thead><tbody>{''.join(body)}</tbody></table></div>
</html>"""


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("json_file", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    output = args.output or args.json_file.with_suffix(".html")
    data = json.loads(args.json_file.read_text(encoding="utf-8"))
    output.write_text(render(data, args.json_file.stem), encoding="utf-8")
    print(f"saved -> {output}")


if __name__ == "__main__":
    main()
