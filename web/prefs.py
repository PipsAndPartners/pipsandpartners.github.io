"""Remembers the last actor/platform/input a person used in the web console."""

import json
import threading
from pathlib import Path

PREFS_PATH = Path(__file__).resolve().parent / "last_run.json"
_LOCK = threading.Lock()


def load() -> dict:
    with _LOCK:
        if not PREFS_PATH.exists():
            return {}
        return json.loads(PREFS_PATH.read_text(encoding="utf-8"))


def save_last_run(platform: str, actor_id: str, run_input: dict) -> None:
    with _LOCK:
        data = {}
        if PREFS_PATH.exists():
            data = json.loads(PREFS_PATH.read_text(encoding="utf-8"))
        data["last_platform"] = platform
        data.setdefault("runs", {})[platform] = {"actor_id": actor_id, "run_input": run_input}
        PREFS_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
