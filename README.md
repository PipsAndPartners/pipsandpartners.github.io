# PipsAndPartners

Static marketing site for **PipsAndPartners** — learn the basics of trading, then
partner with TMGM as an Introducing Broker.

## Pages

| File | Purpose |
|---|---|
| `index.html` | Home / hero, live-looking price ticker, section cards |
| `learn.html` | Three plain-language trading lessons |
| `partner.html` | How the IB partnership works + register interest |
| `tools.html` | Pip value calculator |
| `about.html` | About Khanh |
| `style.css` | Shared styles for every page |

Plain HTML/CSS/JS — no build step. Open `index.html` in a browser, or serve the
folder:

```bash
python -m http.server 4173
```

## Apify Staging

The **Apify Staging** tab in the site nav points to the local IB discovery
pipeline (a Flask app) that lives in [`apify-staging/`](apify-staging/). It runs
separately:

```bash
cd apify-staging
python web/app.py        # then open http://127.0.0.1:5000
```

See [`apify-staging/README.md`](apify-staging/README.md) for full setup (Postgres,
Apify token, scoring, reports). The nav link only resolves while that app is
running locally.

## Run it online

### The marketing site → GitHub Pages (free)

The site is plain static files at the repo root, so GitHub Pages serves it as‑is:

1. Push to GitHub (already done: `github.com/KhanhQuy/PipsAndPartners`).
2. Repo **Settings → Pages**.
3. **Source:** *Deploy from a branch*. **Branch:** `main`, **folder:** `/ (root)`. Save.
4. After ~1 min the site is live at **https://khanhquy.github.io/PipsAndPartners/**.

All links are relative, so they keep working under that sub‑path. Every push to
`main` redeploys.

### The Apify Staging app → NOT GitHub Pages

`apify-staging/` is a Python/Flask server with a Postgres database — GitHub Pages
only hosts static files, so it cannot run there. Host it on a Python platform
instead (Render, Railway, Fly.io, PythonAnywhere). Rough steps for Render:

- New **Web Service**, repo = this one, **root directory** = `apify-staging`.
- Build: `pip install -r requirements.txt` · Start: `gunicorn web.app:app`
  (there is already a `Procfile`).
- Add a Postgres instance and set env vars: `APIFY_TOKEN`, `DATABASE_URL`,
  `WEB_USERNAME`, `WEB_PASSWORD` (see `apify-staging/README.md`).

Once both are deployed, update the hard‑coded `http://127.0.0.1:*` URLs:
the **Apify Staging** menu item in each page's nav, and the **Home** /
**Register as IB** links in `apify-staging/web/templates/index.html`.

## License

Proprietary — see [`LICENSE.txt`](LICENSE.txt).
