"""One module per social platform: its Apify actor ID, default input, and override rules."""

from . import douyin, facebook, instagram, linkedin, tiktok, twitter, youtube

PLATFORMS = {
    "linkedin": linkedin,
    "instagram": instagram,
    "twitter": twitter,
    "facebook": facebook,
    "tiktok": tiktok,
    "douyin": douyin,
    "youtube": youtube,
}
