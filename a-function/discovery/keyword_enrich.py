"""Keyword discovery & relevance scoring: expand a seed (e.g. "trading") into a
scored, tiered keyword list, for regenerating the search-keyword files
(discovery/data/youtube_keywords_*.txt) and augmenting the RELEVANCE_KEYWORDS
lexicon (scoring.py) without hand-curating every term.

Sources (free HTTP, no Apify/API quota):
  - Google autocomplete  (suggestqueries.google.com, client=firefox)
  - YouTube autocomplete (same endpoint, ds=youtube -- YouTube-flavored suggestions)
Each seed's direct suggestions are depth 0. --alphabet also sweeps "seed <char>"
at depth 1 for a wider net (classic "alphabet soup" keyword expansion). The chars
and the hl hint come from --lang, so the same sweep works for TH/ID/ZH/KO/EU when
this expands beyond Vietnam (see LANGS).

Relevance score blends three signals into 0-100:
  - anchor_overlap  : scoring.score_creator_relevance(term) -- reuses the forex/IB
                       lexicon already tuned for this niche, so "trading" scores
                       high and "kế toán" (accounting) scores low/zero.
  - source_agreement: how many distinct (engine, seed) queries surfaced the term
  - proximity       : 1 / (1 + depth) -- a direct suggestion outranks a letter-sweep hit
Tiers: >=40 core (high), 15-40 adjacent (medium), <15 drop (low) -- matches
gate.DEFAULT_MIN_RELEVANCE=20. Filter to a band with --level high|medium|low.

Length is reported (word_count) and used only as a lever, never folded into the
relevance score: short "head" terms cast a wide net, long "long-tail" terms are
specific. Select with --min-words / --max-words; ties break shortest-first
(--prefer long to flip).

This is a keyword-text heuristic, not semantic similarity -- a true "accounting is
adjacent-but-distinct" judgement needs embedding-cosine against an anchor vector.
Swap score_keyword()'s anchor term for that later; the rest of the pipeline (shape
of the scored rows, tiering, file output) doesn't need to change.

    python -m discovery.keyword_enrich trading forex --top 40 --level high
    python -m discovery.keyword_enrich การเทรด --lang th --alphabet
    python -m discovery.keyword_enrich trading --max-words 2 --write-tiers
"""

from __future__ import annotations

import argparse
import json
import string
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path

from scoring import score_creator_relevance

SUGGEST_URL = "https://suggestqueries.google.com/complete/search"
DATA_DIR = Path(__file__).resolve().parent / "data"

CORE_MIN = 40
ADJACENT_MIN = 15
WEIGHTS = {"anchor": 0.5, "source": 0.3, "proximity": 0.2}
ENGINES = (("google", None), ("youtube", "youtube"))  # (label, ds param)

# Tier <-> human relevance level. core=high, adjacent=medium, drop=low.
TIER_LEVEL = {"core": "high", "adjacent": "medium", "drop": "low"}
LEVEL_TIER = {v: k for k, v in TIER_LEVEL.items()}

# Per-language autocomplete sweep alphabets. Each entry is (hl_hint, chars, sep):
# `sep` is "" for scripts that don't space words (CJK/Thai) so we append the char
# directly, " " for the rest. Chinese uses pinyin letters (works in Google/YT
# suggest); add common leading characters here when a run needs deeper zh coverage.
_LATIN = string.ascii_lowercase
_LATIN_EU = _LATIN + "àâäéèêëïîôöùûüçñßœ"
_THAI = "กขคงจฉชซฌญฐฑฒณดตถทธนบปผฝพฟภมยรลวศษสหฬอฮ"
_HANGUL = "ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎ"
LANGS: dict[str, tuple[str, str, str]] = {
    "vi": ("vi", _LATIN, " "),
    "en": ("en", _LATIN, " "),
    "id": ("id", _LATIN, " "),
    "ms": ("ms", _LATIN, " "),
    "th": ("th", _THAI, ""),
    "ko": ("ko", _HANGUL, ""),
    "zh": ("zh-CN", _LATIN, ""),
    "fr": ("fr", _LATIN_EU, " "),
    "de": ("de", _LATIN_EU, " "),
    "es": ("es", _LATIN_EU, " "),
    "it": ("it", _LATIN, " "),
    "pt": ("pt", _LATIN, " "),
    "pl": ("pl", _LATIN_EU, " "),
    "nl": ("nl", _LATIN, " "),
}


def resolve_lang(lang: str, hl: str | None = None) -> tuple[str, str, str]:
    """Return (hl, chars, sep) for a language code. Unknown lang -> latin sweep,
    lang used verbatim as the hl hint. An explicit hl always wins."""
    hint, chars, sep = LANGS.get(lang, (lang, _LATIN, " "))
    return (hl or hint, chars, sep)


def fetch_suggest(query: str, *, ds: str | None = None, hl: str = "vi", timeout: int = 10) -> list[str]:
    """One Google/YouTube autocomplete call. Returns [] on any failure -- this is
    best-effort enrichment, not a step the rest of the pipeline depends on."""
    params = {"client": "firefox", "hl": hl, "q": query}
    if ds:
        params["ds"] = ds
    url = f"{SUGGEST_URL}?{urllib.parse.urlencode(params)}"
    try:
        with urllib.request.urlopen(url, timeout=timeout) as response:
            data = json.load(response)
        return [s for s in data[1] if isinstance(s, str) and s.strip()]
    except Exception:
        return []


def expand_seeds(seeds: list[str], *, lang: str = "vi", hl: str | None = None,
                 alphabet_expand: bool = False) -> dict[str, dict]:
    """Query autocomplete for each seed (depth 0), optionally "seed <char>" sweeps
    (depth 1) over the language's alphabet. Returns
    {term: {"sources": {"engine:seed", ...}, "depth": int}}."""
    hl, chars, sep = resolve_lang(lang, hl)
    found: dict[str, dict] = {}

    def add(term: str, engine: str, seed: str, depth: int) -> None:
        entry = found.setdefault(term, {"sources": set(), "depth": depth})
        entry["sources"].add(f"{engine}:{seed}")
        entry["depth"] = min(entry["depth"], depth)

    for seed in seeds:
        for engine, ds in ENGINES:
            for term in fetch_suggest(seed, ds=ds, hl=hl):
                add(term, engine, seed, 0)
        if alphabet_expand:
            for ch in chars:
                for engine, ds in ENGINES:
                    for term in fetch_suggest(f"{seed}{sep}{ch}", ds=ds, hl=hl):
                        add(term, engine, seed, 1)
    return found


def score_keyword(term: str, sources: set[str], depth: int, total_sources: int) -> dict:
    """Blend anchor-lexicon overlap + cross-source agreement + suggest-depth into
    one 0-100 relevance score and a core/adjacent/drop tier. Length is reported
    (word_count) but deliberately does not move the score."""
    anchor = score_creator_relevance(term)["score"] / 100.0
    agreement = min(1.0, len(sources) / max(1, total_sources))
    proximity = 1.0 / (1 + depth)
    raw = WEIGHTS["anchor"] * anchor + WEIGHTS["source"] * agreement + WEIGHTS["proximity"] * proximity
    score = round(raw * 100)
    tier = "core" if score >= CORE_MIN else "adjacent" if score >= ADJACENT_MIN else "drop"
    return {
        "term": term,
        "score": score,
        "tier": tier,
        "level": TIER_LEVEL[tier],
        "word_count": len(term.split()),
        "sources": sorted(sources),
        "depth": depth,
    }


def _level_tiers(levels: list[str] | None) -> set[str] | None:
    """Map requested levels (high/medium/low, or the tier names) to tier names."""
    if not levels:
        return None
    return {LEVEL_TIER.get(lv, lv) for lv in levels}


def enrich_keywords(seeds: list[str], *, lang: str = "vi", hl: str | None = None,
                    alphabet_expand: bool = False, top: int | None = None,
                    levels: list[str] | None = None, min_words: int | None = None,
                    max_words: int | None = None, prefer: str = "short") -> list[dict]:
    """Expand `seeds`, score each candidate's relevance, filter, and rank. Ranking
    is by score desc; ties break by length (prefer 'short'|'long'|'none')."""
    found = expand_seeds(seeds, lang=lang, hl=hl, alphabet_expand=alphabet_expand)
    # Denominator is the breadth of source labels we *could* have matched
    # (engine x seed), not the ones that happened to return results -- otherwise a
    # term is credited full agreement whenever only one engine responded. Alphabet
    # sweeps don't widen this: a "seed <char>" hit is still labelled engine:seed.
    total_sources = len(seeds) * len(ENGINES)
    rows = [score_keyword(term, e["sources"], e["depth"], total_sources) for term, e in found.items()]

    keep_tiers = _level_tiers(levels)
    filtered = []
    for r in rows:
        if keep_tiers is not None and r["tier"] not in keep_tiers:
            continue
        if min_words is not None and r["word_count"] < min_words:
            continue
        if max_words is not None and r["word_count"] > max_words:
            continue
        filtered.append(r)

    tie = {"short": lambda r: r["word_count"], "long": lambda r: -r["word_count"]}.get(prefer, lambda r: 0)
    filtered.sort(key=lambda r: (-r["score"], tie(r)))
    return filtered[:top] if top else filtered


def write_tier_files(rows: list[dict], out_dir: Path, name: str) -> dict[str, Path]:
    """Write <name>.txt (core) and <name>_adjacent.txt (adjacent tier), one term
    per line with a header comment -- same shape _load_lines() (shortlist.py)
    and --keywords-file (youtube_data_api.py) already read."""
    paths = {}
    for tier, suffix in (("core", ""), ("adjacent", "_adjacent")):
        terms = [r["term"] for r in rows if r["tier"] == tier]
        if not terms:
            continue
        path = out_dir / f"{name}{suffix}.txt"
        header = f"# Auto-generated by discovery/keyword_enrich.py -- {tier} tier ({len(terms)} terms)\n"
        path.write_text(header + "\n".join(terms) + "\n", encoding="utf-8")
        paths[tier] = path
    return paths


def main() -> None:
    ap = argparse.ArgumentParser(description="Expand seed keywords + score relevance (autocomplete-based)")
    ap.add_argument("seeds", nargs="+", help="Seed keyword(s), e.g. trading forex")
    ap.add_argument("--lang", default="vi", choices=sorted(LANGS),
                    help="Language: sets the hl hint AND the --alphabet sweep charset")
    ap.add_argument("--hl", default=None, help="Override the autocomplete language hint from --lang")
    ap.add_argument("--alphabet", action="store_true",
                    help="Also sweep 'seed <char>' over the language's alphabet (wider, slower)")
    ap.add_argument("--level", default=None,
                    help="Keep only these relevance bands: high|medium|low (comma-separated)")
    ap.add_argument("--min-words", type=int, default=None, help="Drop keywords shorter than N words")
    ap.add_argument("--max-words", type=int, default=None, help="Drop keywords longer than N words")
    ap.add_argument("--prefer", default="short", choices=("short", "long", "none"),
                    help="Tie-break order for equal scores (default: shorter first)")
    ap.add_argument("--top", type=int, default=None)
    ap.add_argument("--output", type=Path, default=Path("results/keyword_enrich.json"))
    ap.add_argument("--write-tiers", action="store_true",
                    help="Also write <name>.txt + <name>_adjacent.txt into --tiers-dir")
    ap.add_argument("--tiers-dir", type=Path, default=DATA_DIR)
    ap.add_argument("--name", default="keywords", help="Basename for --write-tiers output")
    args = ap.parse_args()

    levels = [lv.strip() for lv in args.level.split(",")] if args.level else None
    rows = enrich_keywords(
        args.seeds, lang=args.lang, hl=args.hl, alphabet_expand=args.alphabet, top=args.top,
        levels=levels, min_words=args.min_words, max_words=args.max_words, prefer=args.prefer,
    )

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")

    counts: dict[str, int] = defaultdict(int)
    for r in rows:
        counts[r["level"]] += 1
    print(json.dumps({"seeds": args.seeds, "lang": args.lang, "total": len(rows),
                      "by_level": dict(counts)}, ensure_ascii=False))
    print(f"saved -> {args.output}")

    if args.write_tiers:
        args.tiers_dir.mkdir(parents=True, exist_ok=True)
        for tier, path in write_tier_files(rows, args.tiers_dir, args.name).items():
            print(f"{tier} -> {path}")


if __name__ == "__main__":
    main()
