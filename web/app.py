"""Web console: pick/type an Apify actor ID and JSON input, run it, watch it live."""

import json
import os
import secrets
import sys
import threading
import uuid
from pathlib import Path

from flask import Flask, jsonify, render_template, request, send_file

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from apify_config import get_client
from db.connection import get_conn
from db.loader import load_platform_results
from platforms import PLATFORMS
from runner import run_actor_live
from storage import save_items
from web import prefs

app = Flask(__name__)

JOBS: dict[str, dict] = {}
JOBS_LOCK = threading.Lock()


@app.before_request
def _require_auth():
    """Gate the whole app behind HTTP Basic Auth if WEB_USERNAME/WEB_PASSWORD are set.

    Unset locally by default (convenient for local dev); REQUIRED once this is
    deployed publicly, since any visitor could otherwise run actors on your
    Apify account and spend your credits.
    """
    username = os.environ.get("WEB_USERNAME")
    password = os.environ.get("WEB_PASSWORD")
    if not username or not password:
        return None

    auth = request.authorization
    valid = auth and secrets.compare_digest(auth.username, username) and secrets.compare_digest(auth.password, password)
    if not valid:
        return (
            "Authentication required",
            401,
            {"WWW-Authenticate": 'Basic realm="Apify Scraper Console"'},
        )
    return None


def _run_job(job_id: str, actor_id: str, run_input: dict, label: str, platform: str) -> None:
    def on_progress(status: str, item_count: int) -> None:
        with JOBS_LOCK:
            JOBS[job_id]["status"] = status
            JOBS[job_id]["item_count"] = item_count

    try:
        client = get_client()
        items = run_actor_live(client, label, actor_id, run_input, poll_seconds=3.0, on_progress=on_progress)
        out_path = save_items(label, items)

        db_status = None
        if platform in PLATFORMS and hasattr(PLATFORMS[platform], "to_entity"):
            try:
                conn = get_conn()
                try:
                    loaded = load_platform_results(conn, platform, items)
                finally:
                    conn.close()
                db_status = f"loaded {loaded} into Postgres"
            except Exception as exc:  # noqa: BLE001 - DB is optional, JSON file already saved above
                db_status = f"Postgres load skipped: {exc}"

        with JOBS_LOCK:
            JOBS[job_id].update(
                status="SUCCEEDED",
                items=items,
                item_count=len(items),
                output_path=str(out_path),
                db_status=db_status,
            )
    except Exception as exc:  # noqa: BLE001 - surfaced to the UI, not swallowed
        with JOBS_LOCK:
            JOBS[job_id].update(status="FAILED", error=str(exc))


@app.get("/")
def discovery_desk():
    """Main page: the local-first IB discovery / lead-review desk."""
    return render_template("side_quest.html")


@app.get("/apify")
def apify_console():
    presets = {name: {"actor_id": mod.ACTOR_ID, "default_input": mod.DEFAULT_INPUT} for name, mod in PLATFORMS.items()}

    saved = prefs.load()
    last_platform = saved.get("last_platform", "")
    last_runs = saved.get("runs", {})

    # A platform you've actually run before shows what you used last, not the code default.
    for name, remembered in last_runs.items():
        if name in presets:
            presets[name] = {"actor_id": remembered["actor_id"], "default_input": remembered["run_input"]}

    if last_platform in presets:
        initial_actor_id = presets[last_platform]["actor_id"]
        initial_run_input = presets[last_platform]["default_input"]
    elif last_platform == "custom" and "custom" in last_runs:
        initial_actor_id = last_runs["custom"]["actor_id"]
        initial_run_input = last_runs["custom"]["run_input"]
    else:
        initial_actor_id = ""
        initial_run_input = {}

    return render_template(
        "index.html",
        presets=presets,
        selected_platform=last_platform,
        initial_actor_id=initial_actor_id,
        initial_run_input_json=json.dumps(initial_run_input, ensure_ascii=False, indent=2) if initial_run_input else "",
    )


@app.post("/api/run")
def start_run():
    data = request.get_json(force=True, silent=True) or {}
    actor_id = (data.get("actor_id") or "").strip()
    run_input = data.get("run_input")
    platform = (data.get("platform") or "custom").strip() or "custom"

    if not actor_id:
        return jsonify(error="actor_id is required"), 400
    if run_input is None:
        run_input = {}
    if not isinstance(run_input, dict):
        return jsonify(error="run_input must be a JSON object"), 400

    prefs.save_last_run(platform, actor_id, run_input)

    job_id = uuid.uuid4().hex[:12]
    label = actor_id.replace("/", "_").replace(" ", "_")
    with JOBS_LOCK:
        JOBS[job_id] = {"status": "STARTING", "item_count": 0, "actor_id": actor_id, "label": label, "platform": platform}

    thread = threading.Thread(target=_run_job, args=(job_id, actor_id, run_input, label, platform), daemon=True)
    thread.start()
    return jsonify(job_id=job_id)


@app.get("/api/status/<job_id>")
def job_status(job_id: str):
    with JOBS_LOCK:
        job = JOBS.get(job_id)
    if not job:
        return jsonify(error="unknown job_id"), 404
    return jsonify(
        status=job["status"],
        item_count=job.get("item_count", 0),
        error=job.get("error"),
        db_status=job.get("db_status"),
    )


@app.get("/api/result/<job_id>")
def job_result(job_id: str):
    with JOBS_LOCK:
        job = JOBS.get(job_id)
    if not job or job.get("status") != "SUCCEEDED":
        return jsonify(error="result not ready"), 409

    items = job["items"]
    module = PLATFORMS.get(job.get("platform"))
    entities = None
    if module and hasattr(module, "to_entity"):
        entities = []
        for item in items:
            try:
                entities.append(module.to_entity(item))
            except Exception:  # noqa: BLE001 - a bad row shouldn't blank the whole preview
                continue

    return jsonify(items=items, entities=entities)


@app.get("/api/download/<job_id>")
def job_download(job_id: str):
    with JOBS_LOCK:
        job = JOBS.get(job_id)
    if not job or "output_path" not in job:
        return jsonify(error="file not ready"), 409
    return send_file(job["output_path"], as_attachment=True)


if __name__ == "__main__":
    debug = os.environ.get("FLASK_DEBUG", "1") == "1"
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=debug)
