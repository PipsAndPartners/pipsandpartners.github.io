"""Create Outlook drafts from drafts.jsonl by driving ms-365-mcp-server over MCP.

This spawns the same server the .mcp.json config uses, so it shares the encrypted
token cache under %APPDATA%\\ms-365-mcp-server\\. Log in once with

    npx -y @softeria/ms-365-mcp-server --org-mode --login

then this creates the drafts non-interactively -- no browser, no Claude session
needed. Drafts only: the server is scoped to Mail.ReadWrite (no Mail.Send), so it
structurally cannot send.

    python -m outreach.push_mcp --input outreach/drafts.jsonl --dry-run
    python -m outreach.push_mcp --input outreach/drafts.jsonl
"""

import argparse
import asyncio
import json
import shutil
import sys
from pathlib import Path

SERVER_ARGS = [
    "-y", "@softeria/ms-365-mcp-server",
    "--org-mode", "--preset", "mail",
    "--allowed-scopes", "User.Read Mail.ReadWrite",
]
DRAFT_TOOL = "create-draft-email"


def _draft_args(rec: dict) -> dict:
    """Wrap a drafts.jsonl record as create-draft-email arguments. The tool's
    `body` param is the Graph message resource (subject, body, *Recipients);
    contentType is the lowercase Graph enum 'text' / 'html'."""
    message: dict = {
        "subject": rec.get("subject", ""),
        "body": {"contentType": "text", "content": rec.get("body", "")},
        "toRecipients": [{"emailAddress": {"address": rec["to"]}}] if rec.get("to") else [],
    }
    if rec.get("bcc"):
        message["bccRecipients"] = [{"emailAddress": {"address": rec["bcc"]}}]
    if rec.get("cc"):
        cc = rec["cc"] if isinstance(rec["cc"], list) else [rec["cc"]]
        message["ccRecipients"] = [{"emailAddress": {"address": x}} for x in cc if x]
    return {"body": message, "confirm": True}


def _load(input_path: Path) -> list[dict]:
    return [
        json.loads(line)
        for line in input_path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]


async def run(input_path: Path, dry_run: bool) -> None:
    from mcp import ClientSession, StdioServerParameters
    from mcp.client.stdio import stdio_client

    records = _load(input_path)
    npx = shutil.which("npx") or "npx"
    params = StdioServerParameters(command=npx, args=SERVER_ARGS)

    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            tools = {t.name: t for t in (await session.list_tools()).tools}
            print(f"server up · {len(tools)} tools · {DRAFT_TOOL}: "
                  f"{'FOUND' if DRAFT_TOOL in tools else 'MISSING'}")
            if DRAFT_TOOL not in tools:
                print("mail/draft tools seen:",
                      [n for n in tools if "mail" in n or "draft" in n])
                return

            if dry_run:
                tool = tools[DRAFT_TOOL]
                schema = getattr(tool, "inputSchema", None) or getattr(tool, "input_schema", None) or {}
                print(f"{DRAFT_TOOL} input keys:",
                      list(schema.get("properties", {}).keys()))
                for r in records:
                    print(f"[dry] {r.get('to')} | {r.get('subject')}")
                print(f"[dry-run] {len(records)} drafts prepared (no create call)")
                return

            created = 0
            for r in records:
                result = await session.call_tool(DRAFT_TOOL, _draft_args(r))
                text = result.content[0].text if result.content else ""
                if result.isError:
                    print(f"ERR {r.get('to')} -> {text[:160]}")
                else:
                    created += 1
                    print(f"OK  {r.get('to')} -> draft created")
            print(f"created {created}/{len(records)} drafts")


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser(description="Push drafts.jsonl to Outlook Drafts via ms-365-mcp-server")
    ap.add_argument("--input", type=Path, default=Path("outreach/drafts.jsonl"))
    ap.add_argument("--dry-run", action="store_true", help="list tool schema + payloads, no create")
    args = ap.parse_args()
    asyncio.run(run(args.input, args.dry_run))


if __name__ == "__main__":
    main()
