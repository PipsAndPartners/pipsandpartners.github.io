import unittest

from discovery.website_enrich import (
    _cf_decode,
    broker_ref_name,
    candidate_urls,
    classify,
    contact_page_links,
    extract_from_html,
)


class ClassifyTests(unittest.TestCase):
    def test_social_host(self):
        self.assertEqual(classify("https://www.facebook.com/AzFinVietNam"), "social")
        self.assertEqual(classify("https://www.youtube.com/channel/UCx"), "social")

    def test_biolink_host(self):
        self.assertEqual(classify("https://linktr.ee/salfx"), "biolink")
        self.assertEqual(classify("beacons.ai/mrdam"), "biolink")

    def test_short_host(self):
        self.assertEqual(classify("https://bit.ly/3VLkFsL"), "short")
        # shorturl.at: missing from an earlier version of this list, so its own
        # landing page (not the real destination) got crawled directly and its
        # generic support@ address got misattributed as the entity's own.
        self.assertEqual(classify("https://www.shorturl.at/tqcpE"), "short")

    def test_broker_ref_by_domain(self):
        self.assertEqual(classify("https://one.exnessonelink.com/a/tbsenbse"), "broker_ref")

    def test_broker_ref_by_query_param(self):
        self.assertEqual(classify("https://dbgvn.com/register?shareUserSetId=abc"), "broker_ref")

    def test_broker_ref_by_short_r_param(self):
        # a bare "r=" is the narrowest possible referral-param signal (also the
        # most collision-prone -- kucoin.com/#/?r=K32gsP is real production data)
        self.assertEqual(classify("https://www.kucoin.com/#/?r=K32gsP"), "broker_ref")

    def test_broker_ref_by_vn_broker_referral_params(self):
        # VN retail brokers use their own tracking param names, not "ref="
        self.assertEqual(classify("https://openaccount.vps.com.vn/?MKTID=BJ3V"), "broker_ref")
        self.assertEqual(classify("https://apex.vn/mo-tai-khoan/?agent_id=08020018"), "broker_ref")
        self.assertEqual(classify("https://www.fpts.com.vn/x?brokerId=NHUNGLH"), "broker_ref")

    def test_broker_ref_by_invite_or_join_path(self):
        self.assertEqual(classify("https://bingx.com/vi/invite/VGNCDW"), "broker_ref")
        self.assertEqual(classify("https://remitano.net/vn/join?isInvited=true"), "broker_ref")

    def test_broker_ref_by_utm_tracking_params(self):
        self.assertEqual(classify("https://doto.com/za?utm_campaign=x&af_xp=y"), "broker_ref")

    def test_broker_ref_by_known_domain_even_without_query(self):
        # openaccount.vps.com.vn with no tracking param at all -- only the
        # known-institution list (referral_domains.txt) catches this one
        self.assertEqual(classify("https://openaccount.vps.com.vn/"), "broker_ref")
        self.assertEqual(classify("https://www.kucoin.com/"), "broker_ref")
        self.assertEqual(classify("https://www.tradezella.com/"), "broker_ref")

    def test_unrelated_institution_domain_is_broker_ref(self):
        # not a broker, but a bio incidentally linking to it should never
        # contribute that institution's own generic contact address either
        self.assertEqual(classify("https://hanoi.mfa.gov.il/"), "broker_ref")
        self.assertEqual(classify("https://www.littlefox.com/"), "broker_ref")

    def test_junk_host(self):
        self.assertEqual(classify("https://mobile.capcutshare.com/sv2/x"), "junk")

    def test_plain_site(self):
        self.assertEqual(classify("https://hoctrademienphi.com/"), "site")

    def test_empty(self):
        self.assertEqual(classify(""), "junk")


class BrokerRefNameTests(unittest.TestCase):
    def test_extracts_brand(self):
        self.assertEqual(broker_ref_name("https://one.exnessonelink.com/a/x"), "exness")


class CandidateUrlsTests(unittest.TestCase):
    def test_gathers_and_dedupes_by_host(self):
        urls = candidate_urls(
            "https://azfin.vn",
            None,
            "Website: https://azfin.vn/about  Zalo https://zalo.me/g/x facebook.com/azfin",
        )
        self.assertEqual(urls[0], "https://azfin.vn")  # website_url wins, first-seen host
        hosts = {u for u in urls}
        self.assertTrue(any("zalo.me" in u for u in urls))

    def test_bare_www_domain_gets_scheme(self):
        # a bare domain with no "www." or "http(s)://" is not matched (same
        # convention as the bio-URL regexes elsewhere in discovery/) -- "www."
        # is the minimum signal that a token in free text is really a URL.
        urls = candidate_urls(None, None, "site: www.kimgarden.vn")
        self.assertEqual(urls, ["http://www.kimgarden.vn"])

    def test_bare_domain_without_www_is_not_picked_up(self):
        self.assertEqual(candidate_urls(None, None, "site: kimgarden.vn"), [])

    def test_no_urls(self):
        self.assertEqual(candidate_urls(None, None, "no links here"), [])


class CfDecodeTests(unittest.TestCase):
    def test_decodes_known_vector(self):
        # "a@b.com" XORed with key 0x2a, hex-encoded, key byte first.
        key = 0x2A
        plain = "a@b.com"
        hexstr = f"{key:02x}" + "".join(f"{ord(c) ^ key:02x}" for c in plain)
        self.assertEqual(_cf_decode(hexstr), plain)

    def test_bad_input_is_empty(self):
        self.assertEqual(_cf_decode("zz"), "")


class ExtractFromHtmlTests(unittest.TestCase):
    def test_mailto_wins_over_prose(self):
        html = '<a href="mailto:contact@azfin.vn">Email</a><p>random text</p>'
        self.assertEqual(extract_from_html(html)["email"], "contact@azfin.vn")

    def test_cloudflare_obfuscated_email(self):
        key = 0x2A
        plain = "info@azfin.vn"
        hexstr = f"{key:02x}" + "".join(f"{ord(c) ^ key:02x}" for c in plain)
        html = f'<span class="__cf_email__" data-cfemail="{hexstr}">[email&#160;protected]</span>'
        self.assertEqual(extract_from_html(html)["email"], plain)

    def test_jsonld_email_and_phone(self):
        html = ('<script type="application/ld+json">'
                '{"@type":"Organization","email":"hi@azfin.vn","telephone":"+84 24 335 1292"}'
                '</script>')
        out = extract_from_html(html)
        self.assertEqual(out["email"], "hi@azfin.vn")
        self.assertEqual(out["phone"], "+84 24 335 1292")

    def test_jsonld_unfilled_template_placeholder_rejected(self):
        # a schema.org boilerplate snippet nobody customized -- real production
        # case (a hospital's site) that slipped through because JSON-LD's email
        # was trusted as a raw string with no shape check of its own.
        html = '<script type="application/ld+json">{"email":"your@email"}</script>'
        self.assertEqual(extract_from_html(html)["email"], "")

    def test_placeholder_domain_email_rejected(self):
        html = '<a href="mailto:cskh@domain.com">CSKH</a>'
        self.assertEqual(extract_from_html(html)["email"], "")

    def test_domain_matching_email_ranked_first(self):
        html = ('<a href="mailto:random@gmail.com">x</a>'
                '<a href="mailto:contact@azfin.vn">y</a>')
        self.assertEqual(extract_from_html(html, "https://azfin.vn")["email"], "contact@azfin.vn")

    def test_junk_email_rejected(self):
        html = '<a href="mailto:logo@2x.png">x</a><a href="mailto:noreply@service.com">y</a>'
        self.assertEqual(extract_from_html(html)["email"], "")

    def test_tel_link(self):
        html = '<a href="tel:+842433512920">Call</a>'
        self.assertEqual(extract_from_html(html)["phone"], "+842433512920")

    def test_repeated_digit_phone_rejected(self):
        html = '<p>Hotline: 0000000000</p>'
        self.assertEqual(extract_from_html(html)["phone"], "")

    def test_phone_near_hotline_label(self):
        html = '<p>Hotline: 0932.369.441</p>'
        self.assertEqual(extract_from_html(html)["phone"], "0932.369.441")

    def test_social_links_collected_from_a_href(self):
        html = '<a href="https://www.facebook.com/AzFinVietNam">FB</a><a href="https://x.com/foo">X</a>'
        socials = extract_from_html(html)["socials"]
        self.assertIn("facebook", socials)
        self.assertIn("x", socials)

    def test_next_data_wins_over_page_chrome(self):
        # Linktree-style page: the visible <a href> footer links to the
        # PLATFORM's own accounts (unrelated to this profile), but the
        # embedded __NEXT_DATA__ JSON holds the profile's real links -- only
        # the latter may be trusted as this entity's own contacts.
        html = (
            '<a href="https://www.tiktok.com/@linktr.ee">Get the app</a>'
            '<script id="__NEXT_DATA__" type="application/json">'
            '{"props":{"pageProps":{"socialLinks":[{"url":"https://tiktok.com/@salsanchezfx"}]}}}'
            '</script>'
        )
        socials = extract_from_html(html)["socials"]
        self.assertEqual(socials.get("tiktok"), "https://tiktok.com/@salsanchezfx")

    def test_socials_not_harvested_for_a_plain_site(self):
        html = '<a href="https://www.facebook.com/SomeUnrelatedWidget">FB</a>'
        self.assertEqual(extract_from_html(html, harvest_socials=False)["socials"], {})

    def test_empty_html(self):
        self.assertEqual(extract_from_html(""), {"email": "", "phone": "", "socials": {}})


class ContactPageLinksTests(unittest.TestCase):
    def test_finds_same_domain_contact_links(self):
        html = ('<a href="/lien-he">Liên hệ</a><a href="https://other.com/contact">ext</a>'
                '<a href="/gioi-thieu">About</a><a href="/blog">Blog</a>')
        links = contact_page_links(html, "https://azfin.vn")
        self.assertEqual(links, ["https://azfin.vn/lien-he", "https://azfin.vn/gioi-thieu"])

    def test_caps_at_max_pages(self):
        html = "".join(f'<a href="/contact-{i}">c</a>' for i in range(10))
        self.assertLessEqual(len(contact_page_links(html, "https://x.com")), 3)


if __name__ == "__main__":
    unittest.main()
