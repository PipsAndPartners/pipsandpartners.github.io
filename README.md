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

## License

Proprietary — see [`LICENSE.txt`](LICENSE.txt).
