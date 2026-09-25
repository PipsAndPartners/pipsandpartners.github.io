"""Apify credentials and client construction.

Tokens are read from a central key file so they live next to your other keys,
not in the repo. Resolution order:

1. env APIFY_KEY_FILE, if set -> that file
2. else the default key store: ~/Desktop/Key/Key/.apify_tokens.env
3. plus whatever is already in the environment / project .env

The key file (or env) provides APIFY_TOKENS as a comma/space/newline separated
list. A single APIFY_TOKEN still works as a fallback. Placeholder values that
start with "test_place" are ignored.
"""

import itertools
import os
import re
import threading
from pathlib import Path

from apify_client import ApifyClient
from dotenv import load_dotenv

load_dotenv()  # project .env (may hold APIFY_KEY_FILE or a single APIFY_TOKEN)

_DEFAULT_KEY_FILE = Path.home() / "Desktop" / "Key" / "Key" / ".apify_tokens.env"
KEY_FILE = Path(os.environ.get("APIFY_KEY_FILE", _DEFAULT_KEY_FILE))
if KEY_FILE.exists():
    load_dotenv(KEY_FILE, override=True)  # central key store wins over placeholders


def get_tokens() -> list[str]:
    """Return the ordered, de-duplicated list of usable Apify tokens."""
    raw = os.environ.get("APIFY_TOKENS") or os.environ.get("APIFY_TOKEN") or ""
    seen: set[str] = set()
    tokens: list[str] = []
    for tok in re.split(r"[,\s]+", raw):
        tok = tok.strip()
        if not tok or tok.startswith("test_place") or tok in seen:
            continue
        seen.add(tok)
        tokens.append(tok)
    if not tokens:
        raise RuntimeError(
            f"No Apify tokens found. Put APIFY_TOKENS in {KEY_FILE} "
            "(or set APIFY_TOKEN / APIFY_KEY_FILE in the environment)."
        )
    return tokens


def get_client(token: str | None = None) -> ApifyClient:
    """A client for one token. With no arg, uses the first token in the pool.
    The web console still passes the logged-in user's own token explicitly.
    """
    token = token or get_tokens()[0]
    return ApifyClient(token)


class TokenPool:
    """Rotate over all tokens to spread load / credit across the 4 accounts.

    - next_token() / client(): round-robin, thread-safe (for parallel jobs).
    - clients(): one client per token (e.g. to fan work out across all 4 at once).
    - run_with_failover(fn): call fn(client) trying each token until one succeeds
      (use it to survive a token that hit its quota or rate limit).
    """

    def __init__(self, tokens: list[str] | None = None) -> None:
        self.tokens = tokens or get_tokens()
        self._cycle = itertools.cycle(self.tokens)
        self._lock = threading.Lock()

    def next_token(self) -> str:
        with self._lock:
            return next(self._cycle)

    def client(self) -> ApifyClient:
        return ApifyClient(self.next_token())

    def clients(self) -> list[ApifyClient]:
        return [ApifyClient(t) for t in self.tokens]

    def run_with_failover(self, fn):
        """Try fn(client) against each token in turn; return the first success."""
        last: Exception | None = None
        for token in self.tokens:
            try:
                return fn(ApifyClient(token))
            except Exception as exc:  # noqa: BLE001 - try the next token
                last = exc
        raise last if last else RuntimeError("No tokens to try")
