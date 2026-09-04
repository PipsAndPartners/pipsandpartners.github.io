"""Web console: pick/type an Apify actor ID and JSON input, run it, watch it live."""

import functools
import json
import os
import sys
import threading
import uuid
from pathlib import Path

from flask import Flask, abort, flash, g, jsonify, redirect, render_template, request, send_file, session, url_for
from psycopg.rows import dict_row
from werkzeug.security import check_password_hash, generate_password_hash

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from apify_config import get_client
from db.connection import get_conn
from db.loader import load_platform_results
from platforms import PLATFORMS
from runner import run_actor_live
from storage import save_items
from web import prefs
from web.crypto_utils import decrypt_token, encrypt_token

app = Flask(__name__)
try:
    app.secret_key = os.environ["SECRET_KEY"]
except KeyError:
    raise RuntimeError("Missing SECRET_KEY environment variable (set it in .env)") from None

JOBS: dict[str, dict] = {}
JOBS_LOCK = threading.Lock()


def _get_user(**where: str | int) -> dict | None:
    column, value = next(iter(where.items()))
    conn = get_conn()
    try:
        conn.row_factory = dict_row
        with conn.cursor() as cur:
            cur.execute(f"SELECT * FROM app_users WHERE {column} = %s", (value,))
            return cur.fetchone()
    finally:
        conn.close()


@app.before_request
def _require_login():
    """Every route needs a logged-in user, except the login page and static assets."""
    if request.endpoint in ("login", "login_submit", "static") or request.endpoint is None:
        return None

    user_id = session.get("user_id")
    if not user_id or not (user := _get_user(user_id=user_id)):
        return redirect(url_for("login"))

    g.user = user
    return None


def admin_required(view):
    @functools.wraps(view)
    def wrapped(*args, **kwargs):
        if not g.user["is_admin"]:
            abort(403)
        return view(*args, **kwargs)

    return wrapped


@app.get("/login")
def login():
    if session.get("user_id"):
        return redirect(url_for("index"))
    return render_template("login.html")


@app.post("/login")
def login_submit():
    username = (request.form.get("username") or "").strip()
    password = request.form.get("password") or ""
    user = _get_user(username=username)
    if not user or not check_password_hash(user["password_hash"], password):
        flash("Invalid username or password.")
        return redirect(url_for("login"))

    session.clear()
    session["user_id"] = user["user_id"]
    return redirect(url_for("index"))


@app.post("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


def _run_job(job_id: str, actor_id: str, run_input: dict, label: str, platform: str, apify_token: str) -> None:
    def on_progress(status: str, item_count: int) -> None:
        with JOBS_LOCK:
            JOBS[job_id]["status"] = status
            JOBS[job_id]["item_count"] = item_count

    try:
        client = get_client(apify_token)
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
def index():
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

    apify_token = decrypt_token(g.user["apify_token_encrypted"])
    thread = threading.Thread(target=_run_job, args=(job_id, actor_id, run_input, label, platform, apify_token), daemon=True)
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


@app.get("/admin")
@admin_required
def admin_users():
    conn = get_conn()
    try:
        conn.row_factory = dict_row
        with conn.cursor() as cur:
            cur.execute("SELECT user_id, username, is_admin, created_at FROM app_users ORDER BY created_at")
            users = cur.fetchall()
    finally:
        conn.close()
    return render_template("admin.html", users=users)


@app.post("/admin/users")
@admin_required
def admin_add_user():
    username = (request.form.get("username") or "").strip()
    password = request.form.get("password") or ""
    apify_token = (request.form.get("apify_token") or "").strip()
    is_admin = request.form.get("is_admin") == "on"

    if not username or not password or not apify_token:
        flash("Username, password, and Apify token are all required.")
        return redirect(url_for("admin_users"))

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO app_users (username, password_hash, apify_token_encrypted, is_admin)
                VALUES (%s, %s, %s, %s)
                """,
                (username, generate_password_hash(password), encrypt_token(apify_token), is_admin),
            )
        conn.commit()
    except Exception as exc:  # noqa: BLE001 - most likely a duplicate username
        flash(f"Could not add user: {exc}")
    finally:
        conn.close()
    return redirect(url_for("admin_users"))


@app.post("/admin/users/<int:user_id>/delete")
@admin_required
def admin_delete_user(user_id: int):
    if user_id == g.user["user_id"]:
        flash("Cannot delete your own account.")
        return redirect(url_for("admin_users"))

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT count(*) FROM app_users WHERE is_admin")
            admin_count = cur.fetchone()[0]
            cur.execute("SELECT is_admin FROM app_users WHERE user_id = %s", (user_id,))
            row = cur.fetchone()
            if row and row[0] and admin_count <= 1:
                flash("Cannot delete the last admin.")
                return redirect(url_for("admin_users"))

            cur.execute("DELETE FROM app_users WHERE user_id = %s", (user_id,))
        conn.commit()
    finally:
        conn.close()
    return redirect(url_for("admin_users"))


if __name__ == "__main__":
    debug = os.environ.get("FLASK_DEBUG", "0") == "1"
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=debug)
