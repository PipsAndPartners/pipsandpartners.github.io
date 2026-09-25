# Outreach drafting (via ms-365-mcp-server)

Turn a curated shortlist + outreach markdown into **Outlook draft** emails.
Drafts only — nothing is ever sent.

The Microsoft 365 side is handled by [ms-365-mcp-server](https://github.com/softeria/ms-365-mcp-server)
(an MCP server that wraps Microsoft Graph), instead of hand-rolled Graph code.
It handles device-code login, token refresh, and the Graph calls; this repo just
prepares the data.

## Interim: local .eml drafts (no auth, no consent)

While the Graph/MCP admin consent is pending, `eml.py` writes `.eml` files
locally. Each has an `X-Unsent: 1` header, so **double-clicking it opens in
Outlook as an editable draft** (To / Bcc / Subject / HTML body + company footer
prefilled) — review and send by hand. No sign-in, no admin approval.

Straight from an Excel sheet — this is the everyday command:

```bash
python -m outreach.createmail "C:\path\to\mailnow.xlsx"        # first row only (test)
python -m outreach.createmail "C:\path\to\mailnow.xlsx" --all  # every row
```

The sheet needs an `email` column plus a body column named `nội dung email` **or**
`Content for mail`, and it may also carry a `Subject for mail` column — exactly
the shape `discovery.shortlist` now exports (see the IB-shortlist section in the
main README). `Subject for mail`/`source_url` are optional. When there's no
subject column, `createmail` derives the subject from the body greeting; either
way it BCCs j.tran@tmgm.com by
default. It adds **no footer** — Outlook appends your own signature when the
.eml opens, so a footer here would duplicate it; the WhatsApp/Telegram/LinkedIn
lines stay in the body. Pass `--footer` to instead use `outreach/footer.html`
and strip those lines (for when Outlook has no signature set). Or from a prepared
drafts.jsonl:

```bash
python -m outreach.eml --input outreach/drafts.jsonl --from precy.vuong@tmgm.com
```

**Every row CreateMail writes an .eml for counts as contacted.** It marks the
entity in Postgres (`entities.contacted_at` / `contacted_batch` / `follow_up_at` =
+7 days / `follow_up_note`, from `db/12_outreach_status.sql`) and ticks
`already contact` = Yes in the input sheet, adding `website` / `already contact` /
`follow up` / `follow up note` columns if missing (never overwriting a cell you
edited). `discovery.shortlist` then skips contacted entities (`--include-contacted`
to keep them). Pass `--no-mark` for a throwaway test. If the DB is down or the
sheet is open in Excel, the .eml files are still written and it prints the
catch-up command:

```bash
python -m scripts.backfill_contacted --dry-run   # replay outreach/eml/* + Sent Items export
python -m outreach.contacted results/ib_master.xlsx --tracker results/outreach_tracker.xlsx
```

`outreach.contacted <sheet...>` fills those four columns in any sheet from the DB;
`--tracker` writes a follow-up worklist (everyone contacted, soonest follow-up first).

Files land in `outreach/eml/<label>/` (label defaults to today's date), one
dedicated subfolder per run — pass `--label my-campaign` to name it. For a big
batch you can also drag the whole folder into Outlook's Drafts folder to import
them all at once.

The footer is `outreach/footer.html` — edit that one file (it holds the TMGM
signature, address and Compliance disclaimer) and it applies to every message.
The personal WhatsApp/Telegram/LinkedIn block is stripped from the body by
`build.py` (footer carries contacts); pass `--keep-contacts` to build if you
want it back.

## Flow (Graph path, once consent lands)

```
curated CSV + outreach MD  --build.py-->  drafts.jsonl  --ms-365-mcp-server-->  Outlook Drafts
```

- `build.py` — turns a shortlist CSV + outreach markdown into `drafts.jsonl`
  (one JSON per line: `{to, cc, bcc, subject, body, source_url}`), keeping only
  rows whose contact column has an email. No network — testable anywhere.
- **ms-365-mcp-server** — its `create-draft-message` tool creates each draft in
  Outlook. Body is plain text; Graph preserves the line breaks (the mangling we
  hit before was the browser editor, not the API).

## 1. One-time: login + check consent

The server ships with a built-in Softeria app, so you can log in without
registering your own Azure app:

```bash
npx -y @softeria/ms-365-mcp-server --org-mode --login
```

It prints a URL + code — open it, sign in as `precy.vuong@tmgm.com`, approve.
**This is where consent shows up:** if the tenant blocks user consent, the
screen says an admin must approve — only then do you involve IT. Token is cached
encrypted under `%APPDATA%\ms-365-mcp-server\`.

Drafts-only is enforced by scope: the MCP config requests `Mail.ReadWrite` and
**not** `Mail.Send`, so this setup structurally cannot send.

## 2. MCP config (already in repo)

`../.mcp.json` (repo root) registers the server for Claude Code in this project:

```json
{ "mcpServers": { "ms365": { "command": "npx",
  "args": ["-y","@softeria/ms-365-mcp-server","--org-mode","--preset","mail",
           "--allowed-scopes","User.Read Mail.ReadWrite"] } } }
```

Restart Claude Code in this repo so the `ms365` tools load.

## 3. Build the drafts data

```bash
python -m outreach.build \
  --csv results/2026-09/2026-09-18/shortlists/batch1_curated.csv \
  --md  results/2026-09/2026-09-18/emails/batch1_emails.md \
  --bcc j.tran@tmgm.com \
  --out outreach/drafts.jsonl
```

`outreach/drafts.jsonl` is already built for the 6 test rows (both batches).

## 4. Create the drafts

`push_mcp.py` spawns the same server (sharing the token cache) and creates one
draft per line by calling the `create-draft-email` tool — no Claude session or
MCP-in-Claude needed:

```bash
python -m outreach.push_mcp --input outreach/drafts.jsonl --dry-run   # verify, no create
python -m outreach.push_mcp --input outreach/drafts.jsonl             # create the drafts
```

The tool's `body` argument is the Graph message resource (subject, body,
`toRecipients`, `bccRecipients`; `contentType` is `text`). Review the drafts in
Outlook, then send by hand.

Alternatively, in a Claude Code session where the `ms365` tools are loaded (from
`../.mcp.json`), just ask Claude to create a draft per line via
`create-draft-email`.

## Legacy (optional, superseded)

`push.py` + `graph_auth.py` were the earlier direct-to-Graph approach (MSAL
device-code in Python). They still work if you register your own Azure app and
set `MS_CLIENT_ID`/`MS_TENANT_ID`, but the MCP server above is the supported
path now. `render.py` (text→HTML) is kept for when you want an HTML body instead
of plain text.
