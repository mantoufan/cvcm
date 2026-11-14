#!/usr/bin/env python3
"""
Refresh src/shared/ideas-data.json for the Ideas channel (/{locale}/ideas/) from Google Ads Keyword Planner.

Run locally once a month (Keyword Planner history updates monthly):

    python3 -m venv /tmp/gads && /tmp/gads/bin/pip install google-ads
    /tmp/gads/bin/python scripts/ideas/fetch_kp.py            # fetch + derive
    /tmp/gads/bin/python scripts/ideas/fetch_kp.py --derive   # re-derive from the local cache only

Needs ~/.config/gads/google-ads.yaml (developer token with Basic access, login_customer_id = the MCC).

The repo is public, so raw Keyword Planner figures (exact volumes, bids) never go into it: they stay in
~/.cache/cvcm-ideas/. The page data holds only derived values: a demand band, an index curve scaled to its own
peak, percentage changes, a forecast, bands for click value and traffic value, and 0-100 scores. The method is
described on the hub page (ideas.json "method").
"""
import json
import math
import os
import re
import sys
import urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
KEYWORDS = ROOT / "scripts/ideas/keywords.json"
OUT = ROOT / "src/shared/ideas-data.json"
CACHE = Path.home() / ".cache/cvcm-ideas"
CUSTOMER = "7007031245"  # the MCC; its currency is CNY, so bids come back in CNY
LANG = {"en": 1000, "zh-CN": 1017, "zh-TW": 1018, "ja": 1005, "ko": 1012, "vi": 1040, "id": 1025, "es": 1003}
MONTHS = 48

# Bands shown on pages (upper bounds; the last band is open-ended).
DEMAND_BANDS = [100, 1_000, 10_000, 100_000, 1_000_000]   # monthly searches: <100, 100-1K, 1K-10K, 10K-100K, 100K-1M, 1M+
CPC_BANDS = [0.5, 1, 3, 10]                                # USD per click: <0.5, 0.5-1, 1-3, 3-10, 10+
VALUE_BANDS = [1_000, 10_000, 100_000, 1_000_000]          # USD per month: <1K, 1K-10K, 10K-100K, 100K-1M, 1M+


def band(value, bounds):
    for i, b in enumerate(bounds):
        if value < b:
            return i
    return len(bounds)


def clamp(x, lo=0.0, hi=100.0):
    return max(lo, min(hi, x))


def month_range():
    """The last MONTHS full months before this one, e.g. 2022-11 .. 2026-10 when run in November 2026."""
    today = date.today()
    end_y, end_m = (today.year, today.month - 1) if today.month > 1 else (today.year - 1, 12)
    start_total = end_y * 12 + (end_m - 1) - (MONTHS - 1)
    return (start_total // 12, start_total % 12 + 1), (end_y, end_m)


def fetch():
    from google.ads.googleads.client import GoogleAdsClient

    client = GoogleAdsClient.load_from_storage(str(Path.home() / ".config/gads/google-ads.yaml"))
    svc = client.get_service("KeywordPlanIdeaService")
    ga = client.get_service("GoogleAdsService")
    month_enum = client.enums.MonthOfYearEnum
    names = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"]
    (sy, sm), (ey, em) = month_range()
    kw = json.loads(KEYWORDS.read_text())
    raw = {"from": f"{sy}-{sm:02d}", "to": f"{ey}-{em:02d}", "fetched": date.today().isoformat(), "langs": {}}
    for locale, lang_id in LANG.items():
        words = sorted({w for idea in kw.values() for w in idea.get(locale, [])})
        req = client.get_type("GenerateKeywordHistoricalMetricsRequest")
        req.customer_id = CUSTOMER
        req.language = ga.language_constant_path(lang_id)
        req.keywords.extend(words)
        req.keyword_plan_network = client.enums.KeywordPlanNetworkEnum.GOOGLE_SEARCH
        rng = req.historical_metrics_options.year_month_range
        rng.start.year, rng.start.month = sy, getattr(month_enum, names[sm - 1])
        rng.end.year, rng.end.month = ey, getattr(month_enum, names[em - 1])
        res = svc.generate_keyword_historical_metrics(request=req)
        out = {}
        short = []
        for r in res.results:
            m = r.keyword_metrics
            series = [x.monthly_searches for x in m.monthly_search_volumes]
            if 0 < len(series) != MONTHS:  # no history at all is just a phrase nobody searches
                short.append(f"{r.text} ({len(series)})")
            row = {
                "key": r.text.lower(),
                "avg": m.avg_monthly_searches,
                # competition_index is 0 both for "no competition" and "unknown": keep it only when Google rated it.
                "ci": m.competition_index if m.competition.name in ("LOW", "MEDIUM", "HIGH") else None,
                "lo": m.low_top_of_page_bid_micros / 1e6,
                "hi": m.high_top_of_page_bid_micros / 1e6,
                "h": series,
            }
            # A result covers the searched text and its close variants; map every one back.
            for text in [r.text, *r.close_variants]:
                out[text.lower()] = row
        raw["langs"][locale] = out
        if short:
            # Usually last month is not published yet (run after the first week of the month).
            raise SystemExit(f"{locale}: {len(short)} keywords lack {MONTHS} months of history, e.g. {short[:3]}; Keyword Planner may not have published {ey}-{em:02d} yet")
        print(f"{locale}: {len(words)} keywords, {len(res.results)} results", file=sys.stderr)
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / f"raw-{raw['to']}.json"
    path.write_text(json.dumps(raw, ensure_ascii=False))
    print(f"raw cache: {path}", file=sys.stderr)
    return raw


def cny_to_usd():
    try:
        with urllib.request.urlopen("https://api.frankfurter.app/latest?from=CNY&to=USD", timeout=20) as r:
            return json.load(r)["rates"]["USD"]
    except Exception as e:  # noqa: BLE001 - a stale rate is better than no refresh
        print(f"FX fetch failed ({e}); using 0.14", file=sys.stderr)
        return 0.14


def despike(series):
    """Replace one-off spikes (a month over 3x the median of the 6 months either side) with that median: Keyword
    Planner sometimes reports a single month far off a keyword's level (e.g. 8,100 between months of ~100). A rise that
    lasts several months raises the median too, so it stays."""
    out = list(series)
    # The last 3 months have no later months to compare with: a jump there may be a real breakout, so it stays.
    for t, v in enumerate(series[:-3]):
        window = sorted(series[max(0, t - 6):t] + series[t + 1:t + 7])
        med = window[len(window) // 2]
        if v > 3 * med and v - med > 100:
            out[t] = med
    return out


def forecast(series):
    """Seasonal (calendar-month) profile + damped linear trend on log searches, 12 months ahead, with an ~80% band."""
    y = [math.log(v + 1) for v in series]
    n = len(y)
    # Seasonality from the series minus its centred 12-month (2x12) moving average, so a trend or a level change within
    # a year is not mistaken for a seasonal pattern.
    diffs = [[] for _ in range(12)]
    for t in range(6, n - 6):
        ma = (0.5 * y[t - 6] + sum(y[t - 5:t + 6]) + 0.5 * y[t + 6]) / 12
        diffs[t % 12].append(y[t] - ma)
    seas = [sum(d) / len(d) if d else 0.0 for d in diffs]
    mean_s = sum(seas) / 12
    seas = [s - mean_s for s in seas]
    d = [y[t] - seas[t % 12] for t in range(n)]
    tail = d[-24:]
    xs = list(range(len(tail)))
    xm, ym = sum(xs) / len(xs), sum(tail) / len(tail)
    sxx = sum((x - xm) ** 2 for x in xs)
    slope = sum((x - xm) * (v - ym) for x, v in zip(xs, tail)) / sxx
    fit = [ym + slope * (x - xm) for x in xs]
    sigma = math.sqrt(sum((v - f) ** 2 for v, f in zip(tail, fit)) / max(1, len(tail) - 2))
    level = fit[-1]
    phi = 0.9
    mid, lo, hi = [], [], []
    acc = 0.0
    for h in range(1, 13):
        acc += phi ** h
        base = level + slope * acc + seas[(n + h - 1) % 12]
        width = 1.28 * sigma * math.sqrt(1 + 0.15 * h)
        mid.append(max(0.0, math.exp(base) - 1))
        lo.append(max(0.0, math.exp(base - width) - 1))
        hi.append(max(0.0, math.exp(base + width) - 1))
    return mid, lo, hi


def derive(raw):
    kw = json.loads(KEYWORDS.read_text())
    fx = cny_to_usd()
    ideas = {}
    for idea_id, by_locale in kw.items():
        seen = set()
        total = [0] * MONTHS
        lang_rows = {}
        bid_weight = ci_sum = ci_weight = 0.0
        value_usd = 0.0
        for locale, words in by_locale.items():
            loc_series = [0] * MONTHS
            for w in words:
                row = raw["langs"].get(locale, {}).get(w.lower())
                if not row or len(row["h"]) != MONTHS or not any(row["h"]):
                    continue
                # A searched phrase and its close variants come back as one result, and the same CJK spelling can be
                # searched in several languages (副業 in ja and zh-TW): count each underlying keyword once.
                key = (row.get("key") or w.lower()).replace(" ", "")
                # Keyword Planner does not split a phrase by language: "amazon fba" or 副業 returns the same worldwide
                # figure whether asked in en, ja or es. A phrase listed under several locales is counted once, for the
                # first locale that lists it, so a language row never shows another language's searches.
                if key in seen:
                    continue
                seen.add(key)
                series = despike(row["h"])
                loc_series = [a + b for a, b in zip(loc_series, series)]
                total = [a + b for a, b in zip(total, series)]
                avg12 = sum(series[-12:]) / 12
                mid_cny = (row["lo"] + row["hi"]) / 2
                if mid_cny > 0:
                    bid_weight += avg12
                    value_usd += avg12 * mid_cny * fx
                if row.get("ci") is not None:
                    ci_sum += row["ci"] * avg12
                    ci_weight += avg12
            last12 = sum(loc_series[-12:]) / 12
            prev12 = sum(loc_series[-24:-12]) / 12
            if last12 >= 10:
                lang_rows[locale] = {
                    "demand": band(last12, DEMAND_BANDS),
                    "yoy": round(100 * (last12 / prev12 - 1)) if prev12 >= 10 else None,
                }
        last12 = sum(total[-12:]) / 12
        prev12 = sum(total[-24:-12]) / 12
        first12 = sum(total[:12]) / 12
        if last12 <= 0:
            raise SystemExit(f"{idea_id}: no search data in any language")
        mid, lo, hi = forecast(total)
        next12 = sum(mid) / 12
        yoy = last12 / prev12 if prev12 else 1.0
        fc = next12 / last12
        cpc = value_usd / bid_weight if bid_weight else 0.0
        # No competition index for any phrase means unknown, not "no competition".
        ci = ci_sum / ci_weight if ci_weight else None
        momentum = math.sqrt(max(yoy, 1e-3) * max(fc, 1e-3))
        scores = {
            "demand": round(clamp(100 * (math.log10(last12) - 2) / 4)),
            "momentum": round(clamp(50 + 72.13 * math.log(momentum))),
            "value": round(clamp(100 * math.log10(max(cpc, 0.1) / 0.1) / math.log10(200))) if cpc else 0,
            "openness": round(100 - ci) if ci is not None else 50,
        }
        scores["total"] = round(0.35 * scores["demand"] + 0.35 * scores["momentum"] + 0.2 * scores["value"] + 0.1 * scores["openness"])
        peak = max(total)
        ideas[idea_id] = {
            "idx": [round(100 * v / peak) for v in total],
            "fc": [round(100 * v / peak) for v in mid],
            "fcLo": [round(100 * v / peak) for v in lo],
            "fcHi": [round(100 * v / peak) for v in hi],
            "demand": band(last12, DEMAND_BANDS),
            "yoy": round(100 * (yoy - 1)),
            "fourYear": round(last12 / first12, 1) if first12 else None,
            "next12": round(100 * (fc - 1)),
            "cpc": band(cpc, CPC_BANDS) if cpc else None,
            "value": band(value_usd, VALUE_BANDS) if value_usd else None,
            "competition": None if ci is None else "low" if ci < 34 else "medium" if ci < 67 else "high",
            "scores": scores,
            "langs": lang_rows,
        }
    data = {
        "from": raw["from"],
        "to": raw["to"],
        # When the searches were fetched, not when they were re-derived (--derive keeps the cache's date).
        "fetched": raw.get("fetched") or date.today().isoformat(),
        "bands": {"demand": DEMAND_BANDS, "cpc": CPC_BANDS, "value": VALUE_BANDS},
        "ideas": ideas,
    }
    OUT.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n")
    # The sitemap reads the snapshot date from ideas.ts, not the JSON (tests/ideas.test.ts checks they match).
    ts = ROOT / "src/shared/ideas.ts"
    ts.write_text(re.sub(r'export const IDEAS_DATA_FETCHED = "[0-9-]+";', f'export const IDEAS_DATA_FETCHED = "{data["fetched"]}";', ts.read_text()))
    print(f"wrote {OUT.relative_to(ROOT)} ({len(ideas)} ideas, fx CNY→USD {fx})", file=sys.stderr)
    return data


if __name__ == "__main__":
    if "--derive" in sys.argv:
        caches = sorted(CACHE.glob("raw-*.json"))
        if not caches:
            raise SystemExit("no cache; run without --derive first")
        raw = json.loads(caches[-1].read_text())
    else:
        raw = fetch()
    data = derive(raw)
    rank = sorted(data["ideas"].items(), key=lambda kv: -kv[1]["scores"]["total"])
    for k, v in rank:
        s = v["scores"]
        print(f'{s["total"]:>3} d{s["demand"]:>3} m{s["momentum"]:>3} v{s["value"]:>3} o{s["openness"]:>3}  yoy{v["yoy"]:>+5}% next{v["next12"]:>+5}% 4y x{v["fourYear"]}  {k}  langs={",".join(v["langs"])}')
