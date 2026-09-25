"""Delegated Microsoft Graph auth via MSAL device-code flow.

Device code needs no client secret: on first run it prints a URL + code for the
user to sign in, then caches the refresh token (encrypted at rest) so later runs
are silent. Scope is Mail.ReadWrite only -- enough to create drafts, and
deliberately NOT Mail.Send, so this tool can never send on its own.

Requires two env vars (an Entra/Azure app registration):
    MS_CLIENT_ID  -- the app registration's Application (client) ID
    MS_TENANT_ID  -- the tenant GUID or domain (e.g. tmgm.com); default
                     "organizations" (any work/school account)

The app registration must be a public client with "Allow public client flows"
enabled and the delegated Mail.ReadWrite permission. Whether admin consent is
required shows up at sign-in time: if the tenant blocks user consent, the
consent screen will say an administrator must approve it.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

GRAPH_SCOPES = ["Mail.ReadWrite"]
_CACHE_PATH = Path(__file__).resolve().parent / ".msal_cache.enc"


def _load_cache():
    import msal

    cache = msal.SerializableTokenCache()
    if _CACHE_PATH.exists():
        try:
            from web.crypto_utils import decrypt_token
            cache.deserialize(decrypt_token(_CACHE_PATH.read_text(encoding="utf-8")))
        except Exception as exc:  # noqa: BLE001 - a bad cache just means re-login
            print(f"token cache load skipped: {exc}")
    return cache


def _save_cache(cache) -> None:
    if not cache.has_state_changed:
        return
    try:
        from web.crypto_utils import encrypt_token
        _CACHE_PATH.write_text(encrypt_token(cache.serialize()), encoding="utf-8")
    except Exception as exc:  # noqa: BLE001 - caching is best-effort
        print(f"token cache save skipped: {exc}")


def get_token(scopes: list[str] | None = None) -> str:
    """Return a Graph access token, prompting device-code login only if needed."""
    import msal

    scopes = scopes or GRAPH_SCOPES
    client_id = os.getenv("MS_CLIENT_ID")
    tenant = os.getenv("MS_TENANT_ID", "organizations")
    if not client_id:
        raise RuntimeError(
            "Missing MS_CLIENT_ID -- register an app in Entra (public client, "
            "delegated Mail.ReadWrite) and put its client id in .env."
        )

    cache = _load_cache()
    app = msal.PublicClientApplication(
        client_id,
        authority=f"https://login.microsoftonline.com/{tenant}",
        token_cache=cache,
    )

    result = None
    accounts = app.get_accounts()
    if accounts:
        result = app.acquire_token_silent(scopes, account=accounts[0])

    if not result:
        flow = app.initiate_device_flow(scopes=scopes)
        if "user_code" not in flow:
            raise RuntimeError(f"Failed to start device flow: {flow}")
        print(flow["message"])  # "To sign in, use a web browser to open ... and enter code ..."
        result = app.acquire_token_by_device_flow(flow)

    _save_cache(cache)

    if "access_token" not in result:
        raise RuntimeError(
            f"Auth failed: {result.get('error')}: {result.get('error_description')}"
        )
    return result["access_token"]


if __name__ == "__main__":  # `python -m outreach.graph_auth` = a quick auth test
    import json
    import urllib.request

    token = get_token()
    req = urllib.request.Request(
        "https://graph.microsoft.com/v1.0/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        me = json.load(resp)
    print(f"signed in as {me.get('userPrincipalName') or me.get('mail')}")
