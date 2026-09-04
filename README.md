# PipsAndPartners

Static marketing site for **PipsAndPartners** — learn the basics of trading, then
partner with TMGM as an Introducing Broker.

## Pages

All marketing-site files live in [`docs/`](docs/) — nothing else does, which is
also what lets both GitHub Pages and Cloudflare Pages deploy that one folder
directly without touching `a-function/` or anything else in the repo.

| File | Purpose |
|---|---|
| `docs/index.html` | Home / hero, live-looking price ticker, section cards |
| `docs/learn.html` | Three plain-language trading lessons |
| `docs/partner.html` | How the IB partnership works + register interest |
| `docs/tools.html` | Pip value calculator |
| `docs/about.html` | About Guo |
| `docs/style.css` | Shared styles for every page |

Plain HTML/CSS/JS — no build step. Open `docs/index.html` in a browser, or serve
the folder:

```bash
cd docs && python -m http.server 4173
```

## A-function

The **A-function** tab in the site nav points to the local IB discovery
pipeline (a Flask app) that lives in [`a-function/`](a-function/). It runs
separately, and needs its own login (see that folder's README):

```bash
cd a-function
python web/app.py        # then open http://127.0.0.1:5000
```

See [`a-function/README.md`](a-function/README.md) for full setup (Postgres,
Apify token, login, scoring, reports). The nav link only resolves while that
app is running locally.

## Run it online

### The marketing site → GitHub Pages (free)

The site is plain static files in [`docs/`](docs/), which GitHub Pages supports
as a source folder natively — no build step or Action needed.
Repo **Settings → Pages** → **Source:** *Deploy from a branch* → **Branch:** `main`,
**folder:** `/docs` → Save. Live in ~1 min; every push to `main` redeploys.
All internal links are relative, so the site works both at a project sub‑path and
at a domain root.

### Getting a clean `pipsandpartners.github.io` URL (no personal username)

A repo under a personal account is published as
`https://<username>.github.io/<repo>/`, which exposes the username. To publish at
`https://pipsandpartners.github.io/` instead, the site must live in an account or
**organization literally named `pipsandpartners`**, in a repo named exactly
`pipsandpartners.github.io`:

1. Create a **free GitHub organization** named `PipsAndPartners`
   (github.com → *Your organizations* → *New organization* → Free).
2. In that org, create a repo named **`pipsandpartners.github.io`**.
3. Push this code to it (`git remote set-url origin <new repo>` then
   `git push -u origin main`), or transfer the existing repo into the org and
   rename it to `pipsandpartners.github.io`.
4. **Settings → Pages** → branch `main`, `/docs`. Site goes live at
   `https://pipsandpartners.github.io/`.

Best privacy/branding option: buy a domain (e.g. `pipsandpartners.com`), add a
`CNAME` file with that domain, and point the DNS at GitHub Pages — visitors then
never see any github.io URL.

### The A-function app → NOT GitHub Pages

`a-function/` is a Python/Flask server with a Postgres database — GitHub Pages
only hosts static files, so it cannot run there. Host it on a Python platform
instead (Render, Railway, Fly.io, PythonAnywhere). Rough steps for Render:

- New **Web Service**, repo = this one, **root directory** = `a-function`.
- Build: `pip install -r requirements.txt` · Start: `gunicorn web.app:app`
  (there is already a `Procfile`).
- Add a Postgres instance and set env vars: `APIFY_TOKEN`, `DATABASE_URL`,
  `SECRET_KEY`, `TOKEN_ENC_KEY`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`,
  `ADMIN_APIFY_TOKEN` (see `a-function/README.md` → "Web console login").

Once both are deployed, update the hard‑coded `http://127.0.0.1:*` URLs:
the **A-function** menu item in each page's nav, and the **Home** /
**Register as IB** links in `a-function/web/templates/index.html`.

## License

Proprietary — see [`LICENSE.txt`](LICENSE.txt).
