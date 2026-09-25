"""Per-KOL outreach mail fields (Subject + Content) for the IB shortlist.

Two ready-to-send columns are generated for every shortlisted KOL:

    Subject for mail  ->  "<name> | TMGM mời hợp tác."
    Content for mail  ->  the full Vietnamese outreach body

In the body, `A` (the recipient's name) is filled from the row, and `AA` (their
TMGM/forex-relevant standout) is either supplied per person via a `standouts`
map or inferred from the row's own name + bio. When neither yields anything
specific, the "Em đặc biệt ấn tượng với …" sentence is left out entirely rather
than filled with a generic line. Keeping the one template here means a single
edit changes every generated email.
"""

from __future__ import annotations

SUBJECT_TMPL = "{name} | TMGM mời hợp tác."

# {name} = A (recipient), {name_cap} = A capitalized (start of sentence),
# {standout_line} = "Em đặc biệt ấn tượng với AA.\n", or "" when there is no AA.
BODY_TMPL = """Kính gửi {name},

Em là Precy, phụ trách Business Development tại TMGM Australia (TMGM Úc) — một nhà môi giới CFD và forex đa tài sản toàn cầu.

{standout_line}TMGM Úc hiện đang ưu tiên tìm kiếm một số KOL và đối tác truyền thông có sức ảnh hưởng tại thị trường Việt Nam.

Nếu đội ngũ quan tâm đến việc hợp tác cùng TMGM Úc, em rất sẵn lòng sắp xếp một buổi trao đổi ngắn vào thời gian thuận tiện. {name_cap} có thể phản hồi email này hoặc thông tin liên hệ bên dưới.

Cảm ơn đội ngũ đã dành thời gian — em rất mong sớm nhận được phản hồi.

Trân trọng,
Precy"""

_PLATFORM_VI = {
    "tiktok": "TikTok",
    "youtube": "YouTube",
    "facebook": "Facebook",
    "facebook_post": "Facebook",
    "douyin": "Douyin",
    "instagram": "Instagram",
    "twitter": "X (Twitter)",
    "telegram": "Telegram",
}


# (signal-substrings, topic phrase), matched against lowercased name + bio. The
# earliest mention wins (a bio leads with its main topic); list order breaks
# ties, so narrower niches sit above broader ones.
_TOPIC_RULES: list[tuple[tuple[str, ...], str]] = [
    (("chứng khoán phái sinh", "phái sinh", "phai sinh", "derivatives", "hợp đồng tương lai"),
     "giao dịch chứng khoán phái sinh"),
    (("ai trading", "bot trading", "trading bot", "giao dịch tự động", "algo trading"),
     "ứng dụng AI và giao dịch tự động trong trading"),
    (("chứng khoán mỹ", "chung khoan my", "us stock", "phố wall", "wall street"),
     "thị trường chứng khoán Mỹ"),
    (("chứng khoán", "chung khoan", "cổ phiếu", "co phieu", "stock"),
     "phân tích và nhận định cổ phiếu"),
    # not bare "vàng": it also appears in unrelated names ("Cửa Sổ Vàng")
    (("forex", " fx", "ngoại hối", "ngoai hoi", "xauusd", "giá vàng", "thị trường vàng",
      "đầu tư vàng", "giao dịch vàng", "trade vàng", "gold"),
     "phân tích forex và thị trường vàng"),
    (("crypto", "bitcoin", "coin", "blockchain", "tài sản số"),
     "crypto và tài sản số"),
    (("chứng chỉ quỹ", "quỹ mở", "quỹ đầu tư"),
     "đầu tư qua quỹ và chứng chỉ quỹ"),
    (("vĩ mô", "vi mo", "macro"),
     "kinh tế vĩ mô và thị trường tài chính"),
    (("bất động sản", "bat dong san", "real estate", "property"),
     "đầu tư bất động sản"),
    (("tài chính cá nhân", "quản lý tài chính", "tự do tài chính", "làm giàu",
      "passive income", "thu nhập thụ động"),
     "đầu tư và quản lý tài chính cá nhân"),
]


def infer_topic(text: str) -> str | None:
    """The channel's topic phrase from its own text, or None if nothing matches."""
    low = (text or "").lower()
    best = None
    for order, (signals, phrase) in enumerate(_TOPIC_RULES):
        pos = min((low.find(s) for s in signals if s in low), default=None)
        if pos is not None and (best is None or (pos, order) < best[:2]):
            best = (pos, order, phrase)
    return best[2] if best else None


def _followers_vi(n: int) -> str:
    if n >= 1_000_000:
        return f"{n / 1_000_000:.1f}".rstrip("0").rstrip(".").replace(".", ",") + " triệu"
    return f"{n // 1000}K"


def recipient_name(row: dict) -> str:
    """A: display name, else the handle, else a neutral 'anh/chị'."""
    return (row.get("display_name") or (row.get("handle") or "").lstrip("@") or "anh/chị").strip()


def default_standout(row: dict) -> str | None:
    """AA inferred from the row itself (broker mention, else name + bio topic,
    + audience size when sizeable). None when there's no specific signal."""
    name = recipient_name(row)
    platform = _PLATFORM_VI.get((row.get("platform") or "").lower(), "mạng xã hội")
    if row.get("broker_hit"):
        return f"những nội dung của {name} về TMGM trên {platform}"
    topic = infer_topic(f"{row.get('display_name') or ''} {row.get('bio_text') or ''}")
    if not topic:
        return None
    standout = f"những nội dung của {name} về {topic} trên {platform}"
    followers = row.get("follower_count") or 0
    if followers >= 10_000:
        standout += f", nơi có hơn {_followers_vi(followers)} người theo dõi"
    return standout


def mail_fields(row: dict, standout: str | None = None) -> tuple[str, str]:
    """(subject, body) for one shortlist row. `standout` overrides AA; when it is
    empty/None, default_standout(row) is tried, and if that has nothing the
    standout sentence is dropped."""
    name = recipient_name(row)
    name_cap = name[0].upper() + name[1:] if name else name  # capitalized for start-of-sentence use
    aa = (standout or "").strip() or default_standout(row)
    line = f"Em đặc biệt ấn tượng với {aa}.\n" if aa else ""
    return SUBJECT_TMPL.format(name=name), BODY_TMPL.format(name=name, name_cap=name_cap, standout_line=line)


def standout_for(row: dict, standouts: dict[str, str] | None) -> str | None:
    """Look up a per-person AA override in a {handle-or-name: standout} map,
    matching on the handle (without @) first, then the display name."""
    if not standouts:
        return None
    lowered = {k.strip().lower().lstrip("@"): v for k, v in standouts.items()}
    handle = (row.get("handle") or "").strip().lower().lstrip("@")
    name = (row.get("display_name") or "").strip().lower()
    return lowered.get(handle) or lowered.get(name)
