"""Web console: pick/type an Apify actor ID and JSON input, run it, watch it live."""

import functools
import asyncio
import json
import os
import re
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
from web.json_to_table import render as render_json_table
from discovery.keyword_campaign import search_telegram_entities
from discovery.telegram.client import Settings, build_client
from discovery.youtube_data_api import FINANCE_SIGNAL, discover as discover_youtube
from discovery.x_api import discover as discover_x
from discovery.common.contacts import extract_contacts
from web.xlsx_export import build as build_xlsx

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
    presets = {
        name: {"actor_id": mod.ACTOR_ID, "default_input": mod.DEFAULT_INPUT}
        for name, mod in PLATFORMS.items()
        if hasattr(mod, "ACTOR_ID") and hasattr(mod, "DEFAULT_INPUT")
    }

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
        location_options=LOCATION_OPTIONS,
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
        source=job.get("source"),
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

    return jsonify(items=items, entities=entities, contacts=job.get("contacts"))


@app.get("/api/discovery/<job_id>/export.xlsx")
def discovery_export_xlsx(job_id: str):
    with JOBS_LOCK:
        job = JOBS.get(job_id)
    if not job or not job.get("contacts"):
        return jsonify(error="no contacts to export"), 409
    headers = [
        ("name", "Channel"), ("youtube", "YouTube"), ("facebook", "Facebook"),
        ("email", "Email"), ("zalo", "Zalo"), ("phone", "Phone"),
        ("tiktok", "TikTok"), ("instagram", "Instagram"), ("telegram", "Telegram"), ("x", "X"),
    ]
    buffer = build_xlsx(job["contacts"], headers, title="YouTube contacts")
    return send_file(
        buffer,
        as_attachment=True,
        download_name=f"youtube_contacts_{job_id}.xlsx",
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


@app.get("/api/download/<job_id>")
def job_download(job_id: str):
    with JOBS_LOCK:
        job = JOBS.get(job_id)
    if not job or "output_path" not in job:
        return jsonify(error="file not ready"), 409
    return send_file(job["output_path"], as_attachment=True)


@app.get("/api/table/<job_id>")
def job_table(job_id: str):
    with JOBS_LOCK:
        job = JOBS.get(job_id)
    if not job or "table_path" not in job:
        return jsonify(error="table not ready"), 409
    return send_file(job["table_path"])


# YouTube "Location" dropdown: big markets + countries with a dense forex-IB scene.
# Japan is intentionally left out. Values are ISO 3166-1 alpha-2 (lowercase) so they can be
# matched exactly against a channel's declared country (see _location_match).
LOCATION_OPTIONS = [
    ("all", "All countries"),
    ("vn", "Vietnam"),
    ("au", "Australia"),
    ("us", "United States"),
    ("gb", "United Kingdom"),
    ("ca", "Canada"),
    ("de", "Germany"),
    ("fr", "France"),
    ("es", "Spain"),
    ("tr", "Turkey"),
    ("ae", "United Arab Emirates"),
    ("in", "India"),
    ("pk", "Pakistan"),
    ("bd", "Bangladesh"),
    ("id", "Indonesia"),
    ("my", "Malaysia"),
    ("ph", "Philippines"),
    ("th", "Thailand"),
    ("sg", "Singapore"),
    ("cn", "China"),
    ("kr", "South Korea"),
    ("ng", "Nigeria"),
    ("za", "South Africa"),
    ("ke", "Kenya"),
    ("eg", "Egypt"),
    ("br", "Brazil"),
    ("mx", "Mexico"),
]

# Fuzzy fallback terms per country code, matched against a channel's title + description
# when it has no declared country. No bare 2-letter codes here (they match common words).
LOCATION_ALIASES = {
    "vn": ("vietnam", "viet nam", "việt nam", "người việt", "hà nội", "hanoi", "ho chi minh", "sài gòn", "saigon"),
    "au": ("australia", "australian", "úc", "sydney", "melbourne", "brisbane", "perth", "adelaide"),
    "us": ("usa", "u.s.a", "united states", "america", "american", "mỹ", "new york", "los angeles", "california", "texas", "florida"),
    "gb": ("uk", "united kingdom", "britain", "british", "england", "scotland", "wales", "london", "manchester", "anh quốc"),
    "ca": ("canada", "canadian", "toronto", "vancouver", "montreal", "calgary", "ontario"),
    "de": ("germany", "german", "deutschland", "berlin", "munich", "münchen", "hamburg", "frankfurt"),
    "fr": ("france", "french", "français", "paris", "lyon", "marseille"),
    "es": ("spain", "spanish", "españa", "madrid", "barcelona", "valencia", "sevilla"),
    "tr": ("turkey", "türkiye", "turkish", "istanbul", "ankara", "izmir"),
    "ae": ("uae", "united arab emirates", "emirates", "dubai", "abu dhabi", "sharjah"),
    "in": ("india", "indian", "bharat", "mumbai", "delhi", "bengaluru", "bangalore", "hyderabad", "chennai", "kolkata"),
    "pk": ("pakistan", "pakistani", "karachi", "lahore", "islamabad", "rawalpindi"),
    "bd": ("bangladesh", "bangladeshi", "dhaka", "chittagong", "chattogram"),
    "id": ("indonesia", "indonesian", "bahasa indonesia", "jakarta", "surabaya", "bandung", "medan"),
    "my": ("malaysia", "malaysian", "kuala lumpur", "penang", "johor bahru", "selangor"),
    "ph": ("philippines", "filipino", "pinoy", "manila", "cebu", "davao", "quezon city"),
    "th": ("thailand", "thai", "bangkok", "chiang mai", "phuket"),
    "sg": ("singapore", "singaporean"),
    "cn": ("china", "chinese", "mainland china", "beijing", "shanghai", "shenzhen", "guangzhou"),
    "kr": ("korea", "south korea", "korean", "seoul", "busan", "incheon"),
    "ng": ("nigeria", "nigerian", "naija", "lagos", "abuja", "port harcourt", "ibadan"),
    "za": ("south africa", "south african", "johannesburg", "cape town", "durban", "pretoria"),
    "ke": ("kenya", "kenyan", "nairobi", "mombasa", "kisumu"),
    "eg": ("egypt", "egyptian", "cairo", "alexandria", "giza"),
    "br": ("brazil", "brasil", "brazilian", "são paulo", "sao paulo", "rio de janeiro", "belo horizonte"),
    "mx": ("mexico", "méxico", "mexican", "mexicano", "ciudad de méxico", "guadalajara", "monterrey"),
}
LOCATION_ALIASES["uk"] = LOCATION_ALIASES["gb"]  # keep the free-text Telegram/X box working


def _location_match(text: str, location: str, *, country_code: str = "") -> bool:
    location = location.strip().casefold()
    if not location or location in {"all", "any", "tất cả"}:
        return True
    if country_code.strip().casefold() == location:  # channel's own declared country
        return True
    terms = LOCATION_ALIASES.get(location, (location,))
    text = text.casefold()
    return any(re.search(r"(?<!\w)" + re.escape(term) + r"(?!\w)", text) for term in terms)


def _run_discovery_job(job_id: str, source: str, keyword: str, follower: int, follower_max: int | None, location: str, max_results: int) -> None:
    contacts = None
    try:
        if source == "youtube":
            result = discover_youtube([keyword], max_results=50)
            items = [
                item for item in result["items"]
                if int(item.get("statistics", {}).get("subscriberCount", 0)) >= follower
                and (follower_max is None or int(item.get("statistics", {}).get("subscriberCount", 0)) <= follower_max)
                and _location_match(
                    " ".join((
                        item.get("snippet", {}).get("title", ""),
                        item.get("snippet", {}).get("description", ""),
                    )),
                    location,
                    country_code=item.get("snippet", {}).get("country", "")
                    or item.get("brandingSettings", {}).get("channel", {}).get("country", ""),
                )
                and any(
                    signal in (item.get("snippet", {}).get("title", "") + " " + item.get("snippet", {}).get("description", "")).casefold()
                    for signal in (*FINANCE_SIGNAL, keyword.casefold())
                )
            ][:max_results]
            result["items"] = items
            result["filter"] = {"keyword": keyword, "follower_min": follower, "follower_max": follower_max, "location": location, "max_results": max_results}
            contacts = []
            for item in items:
                channel_id = item.get("id")
                snippet = item.get("snippet", {})
                contacts.append({
                    "name": snippet.get("title", ""),
                    **extract_contacts(snippet.get("description")),
                    "youtube": f"https://www.youtube.com/channel/{channel_id}" if channel_id else "",
                })
            result["contacts"] = contacts
            output = Path(__file__).resolve().parent.parent / "results" / "youtube_ui_discovery.json"
            output.parent.mkdir(parents=True, exist_ok=True)
            output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
            table_output = output.with_suffix(".html")
            table_output.write_text(render_json_table(result, f"YouTube discovery: {keyword}"), encoding="utf-8")
            db_status = None
            try:
                conn = get_conn()
                try:
                    loaded = load_platform_results(conn, "youtube", items)
                finally:
                    conn.close()
                db_status = f"loaded {loaded} into Postgres"
            except Exception as exc:
                db_status = f"Postgres load skipped: {exc}"
        elif source == "x":
            result = discover_x([keyword], max_results=50)
            items = [
                item for item in result["items"]
                if int(item.get("public_metrics", {}).get("followers_count", 0)) >= follower
                and (follower_max is None or int(item.get("public_metrics", {}).get("followers_count", 0)) <= follower_max)
                and _location_match(
                    " ".join((item.get("description") or "", item.get("location") or "")),
                    location,
                )
                and any(
                    signal in ((item.get("description") or "") + " " + (item.get("location") or "")).casefold()
                    for signal in (*FINANCE_SIGNAL, keyword.casefold())
                )
            ][:max_results]
            result["items"] = items
            result["filter"] = {"keyword": keyword, "follower_min": follower, "follower_max": follower_max, "location": location, "max_results": max_results}
            contacts = []
            for item in items:
                username = item.get("username")
                contacts.append({
                    "name": item.get("name", ""),
                    **extract_contacts(item.get("description")),
                    "x": f"https://x.com/{username}" if username else "",
                })
            result["contacts"] = contacts
            output = Path(__file__).resolve().parent.parent / "results" / "x_ui_discovery.json"
            output.parent.mkdir(parents=True, exist_ok=True)
            output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
            table_output = output.with_suffix(".html")
            table_output.write_text(render_json_table(result, f"X discovery: {keyword}"), encoding="utf-8")
            db_status = None
            try:
                conn = get_conn()
                try:
                    loaded = load_platform_results(conn, "twitter", items)
                finally:
                    conn.close()
                db_status = f"loaded {loaded} into Postgres"
            except Exception as exc:
                db_status = f"Postgres load skipped: {exc}"
        elif source == "telegram":
            async def collect() -> list[dict]:
                candidates = await search_telegram_entities([keyword], 50)
                settings = Settings.from_env()
                results = []
                async with build_client(settings) as client:
                    for candidate in candidates:
                        try:
                            entity = await client.get_entity(candidate.get("username") or candidate["platform_id"])
                            from telethon.tl.functions.channels import GetFullChannelRequest
                            full = await client(GetFullChannelRequest(entity))
                            count = getattr(getattr(full, "full_chat", None), "participants_count", None) or 0
                            about = getattr(getattr(full, "full_chat", None), "about", "") or ""
                            searchable = " ".join((candidate.get("title", ""), candidate.get("username", ""), " ".join(candidate.get("keywords", [])), about))
                            if (
                                count >= follower
                                and (follower_max is None or count <= follower_max)
                                and _location_match(searchable, location)
                                and any(signal in searchable.casefold() for signal in (*FINANCE_SIGNAL, keyword.casefold()))
                            ):
                                results.append({**candidate, "participants_count": count, "about": about})
                                if len(results) >= max_results:
                                    break
                        except Exception:
                            continue
                return results
            items = asyncio.run(collect())
            result = {"source": "telegram", "keyword": keyword, "follower_min": follower, "follower_max": follower_max, "location": location, "max_results": max_results, "items": items}
            contacts = []
            for item in items:
                username = item.get("username")
                contacts.append({
                    "name": item.get("title", ""),
                    **extract_contacts(item.get("about")),
                    "telegram": f"https://t.me/{username}" if username else "",
                })
            result["contacts"] = contacts
            output = Path(__file__).resolve().parent.parent / "results" / "telegram_ui_discovery.json"
            output.parent.mkdir(parents=True, exist_ok=True)
            output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
            table_output = output.with_suffix(".html")
            table_output.write_text(render_json_table(result, f"Telegram discovery: {keyword}"), encoding="utf-8")
            db_status = None
            try:
                conn = get_conn()
                try:
                    loaded = load_platform_results(conn, "telegram", items)
                finally:
                    conn.close()
                db_status = f"loaded {loaded} into Postgres"
            except Exception as exc:
                db_status = f"Postgres load skipped: {exc}"

        with JOBS_LOCK:
            JOBS[job_id].update(status="SUCCEEDED", items=items, contacts=contacts, item_count=len(items), output_path=str(output), table_path=str(table_output), db_status=db_status, source=source)
    except Exception as exc:
        with JOBS_LOCK:
            JOBS[job_id].update(status="FAILED", error=str(exc))


@app.post("/api/discovery/run")
def start_discovery():
    data = request.get_json(force=True, silent=True) or {}
    source = (data.get("source") or "").strip().lower()
    keyword = (data.get("keyword") or "").strip()
    location = (data.get("location") or "").strip()
    try:
        follower = max(0, int(data.get("follower", 0)))
        follower_max = data.get("follower_max")
        follower_max = int(follower_max) if follower_max not in (None, "") else None
        max_results = min(500, max(1, int(data.get("max_results", 10))))
    except (TypeError, ValueError):
        return jsonify(error="follower must be a number"), 400
    if source not in {"telegram", "youtube", "x"} or not keyword:
        return jsonify(error="source and keyword are required"), 400
    if follower_max is not None and follower_max < follower:
        return jsonify(error="follower_max must be >= follower"), 400
    job_id = uuid.uuid4().hex[:12]
    with JOBS_LOCK:
        JOBS[job_id] = {"status": "STARTING", "item_count": 0, "source": source}
    threading.Thread(target=_run_discovery_job, args=(job_id, source, keyword, follower, follower_max, location, max_results), daemon=True).start()
    return jsonify(job_id=job_id)


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
