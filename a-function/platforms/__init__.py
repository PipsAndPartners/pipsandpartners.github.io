"""One module per social platform: its Apify actor ID, default input, and override rules."""

from . import douyin, facebook, facebook_post, instagram, linkedin, telegram, tiktok, twitter, youtube

PLATFORMS = {
    "linkedin": linkedin,
    "instagram": instagram,
    "twitter": twitter,
    "facebook": facebook,
    "facebook_post": facebook_post,
    "tiktok": tiktok,
    "douyin": douyin,
    "youtube": youtube,
    "telegram": telegram,
}

# Platforms scraped through an Apify actor (pipeline.py / the web "Run any actor"
# form). Telegram/YouTube are native-API only and have no ACTOR_ID.
ACTOR_PLATFORMS = [name for name, mod in PLATFORMS.items() if hasattr(mod, "ACTOR_ID")]
