Subject: Admin consent request — "MS 365 MCP Server" (delegated Mail.ReadWrite, drafts only)

Hi IT team,

I'm setting up a small tool to help me prepare partnership-outreach emails as
**drafts in my own Outlook** (I review and send each one manually). When I signed
in, Entra created an admin consent request because our tenant requires admin
approval for this app. Could you please approve it?

Where to approve:
Entra admin center → Identity → Applications → Enterprise applications →
Admin consent requests → "MS 365 MCP Server" → Review and approve.

Request details:
- App: MS 365 MCP Server
- Requested by: precy.vuong@tmgm.com
- Submitted: 18 Sep 2026 (expires 18 Oct 2026)

What it can and cannot do (please note the minimal scope):
- Permissions requested: Microsoft Graph **delegated** `User.Read` and
  `Mail.ReadWrite` only.
- **Delegated** = it acts only as me, on my own mailbox — not tenant-wide, no
  access to anyone else's mail.
- **No `Mail.Send`** — it literally cannot send email. It only creates drafts in
  my Drafts folder, which I send by hand.
- No calendar, files, Teams, or other data.

Background: the app is the open-source "ms-365-mcp-server" (publisher: Softeria),
a Microsoft Graph client I run locally. If you'd rather I use an in-house app
registration you control instead of the third-party one, I'm happy to switch —
just let me know and I'll register one scoped to `Mail.ReadWrite` only.

Happy to jump on a quick call if that's easier. Thanks very much!

Best,
Precy
