"""
SERP Analysis → Supabase
Reads keywords from Supabase, fetches SERP data from DataForSEO,
writes results back with today's scan_date.

Usage:
  python scripts/serp_to_supabase.py --market BENL
  python scripts/serp_to_supabase.py --market BEFR
  python scripts/serp_to_supabase.py  # runs both markets

Env vars required:
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  DATAFORSEO_LOGIN
  DATAFORSEO_PASSWORD
"""

import os
import sys
import time
import base64
import argparse
import requests
from datetime import date

try:
    from supabase import create_client
except ImportError:
    print("❌ Missing dependency: pip install supabase")
    sys.exit(1)

# ─── Config ──────────────────────────────────────────────────────────────────

SITE = "dedecker.be"
CLIENT_DOMAINS = ["dedecker.be", "www.dedecker.be"]

MARKETS = {
    "BENL": {
        "location_code": 2056,
        "language_code": "nl",
        "competitors": {
            "default": ["vika.be", "dsmkeukens.be", "cuisinesdovy.be", "diapal.be"],
            "Badkamers": ["groepwouters.be", "debbadbeke.be", "x2o.be", "facq.be", "vanmarcke.be"],
        },
        "comp_names": {
            "vika.be": "Vika",
            "dsmkeukens.be": "DSM Keukens",
            "cuisinesdovy.be": "Dovy",
            "diapal.be": "Diapal",
            "groepwouters.be": "Groep Wouters",
            "debbadbeke.be": "De Badbeke",
            "x2o.be": "X2O",
            "facq.be": "Facq",
            "vanmarcke.be": "Vanmarcke",
        },
    },
    "BEFR": {
        "location_code": 2056,
        "language_code": "fr",
        "competitors": {
            "default": ["cuisinesdovy.be", "ixina.be", "vandenborrekitchen.be", "dsmcuisines.be"],
            "Salle de bains": ["sanijura.fr", "mobalpa.com", "x2o.be", "facq.be", "vanmarcke.be"],
        },
        "comp_names": {
            "cuisinesdovy.be": "Dovy",
            "ixina.be": "Ixina",
            "vandenborrekitchen.be": "Vandenborre",
            "dsmcuisines.be": "DSM Cuisines",
            "sanijura.fr": "Sanijura",
            "mobalpa.com": "Mobalpa",
            "x2o.be": "X2O",
            "facq.be": "Facq",
            "vanmarcke.be": "Vanmarcke",
        },
    },
}


def get_auth_header():
    login = os.environ["DATAFORSEO_LOGIN"]
    password = os.environ["DATAFORSEO_PASSWORD"]
    creds = f"{login}:{password}"
    return {
        "Authorization": f"Basic {base64.b64encode(creds.encode()).decode()}",
        "Content-Type": "application/json",
    }


def analyze_serp(keyword: str, market_cfg: dict) -> dict:
    """Fetch SERP data for one keyword."""
    all_comp_domains = [
        d for comps in market_cfg["competitors"].values() for d in comps
    ]
    output = {
        "client_pos": None,
        "client_url": "",
        "has_ai": False,
        "dedecker_in_ai": False,
        "competitors": {},
    }

    try:
        r = requests.post(
            "https://api.dataforseo.com/v3/serp/google/organic/live/advanced",
            headers=get_auth_header(),
            json=[{
                "keyword": keyword,
                "location_code": market_cfg["location_code"],
                "language_code": market_cfg["language_code"],
                "device": "desktop",
                "os": "windows",
                "depth": 100,
                "load_async_ai_overview": True,
                "expand_ai_overview": True,
            }],
            timeout=90,
        )
        data = r.json()

        if data.get("status_code") != 20000:
            print(f"   ⚠️  API error for [{keyword}]: {data.get('status_message')}")
            return output

        task = data.get("tasks", [{}])[0]
        result = task.get("result", [None])[0]
        if not result:
            return output

        items = result.get("items", []) or []
        item_types = result.get("item_types", []) or []

        for item in items:
            if item.get("type") != "organic":
                continue
            domain = (item.get("domain") or "").lower().replace("www.", "")
            pos = item.get("rank_absolute", 0)

            if output["client_pos"] is None:
                if any(cd.replace("www.", "") in domain for cd in CLIENT_DOMAINS):
                    output["client_pos"] = pos
                    output["client_url"] = item.get("url", "")

            for comp_domain in all_comp_domains:
                comp_clean = comp_domain.lower().replace("www.", "")
                if comp_clean not in output["competitors"] and comp_clean in domain:
                    comp_name = market_cfg["comp_names"].get(comp_domain, comp_domain)
                    output["competitors"][comp_name] = pos

        output["has_ai"] = "ai_overview" in item_types
        if output["has_ai"]:
            for item in items:
                if item.get("type") in ("ai_overview", "ai_overview_element"):
                    for ref in item.get("references", []) or []:
                        ref_domain = (ref.get("domain") or "").lower()
                        if any(cd.replace("www.", "") in ref_domain for cd in CLIENT_DOMAINS):
                            output["dedecker_in_ai"] = True

    except Exception as e:
        print(f"   ❌ Error [{keyword}]: {e}")

    return output


def run_market(market: str, supabase, scan_date: str, dry_run: bool = False):
    market_cfg = MARKETS[market]
    print(f"\n{'='*60}")
    print(f"📍 Market: {market} | Date: {scan_date}")
    print(f"{'='*60}")

    # 1. Fetch keywords from Supabase
    response = supabase.table("keywords").select("id, keyword, category").eq("market", market).execute()
    keywords = response.data
    print(f"✅ {len(keywords)} keywords loaded from Supabase")

    if not keywords:
        print("⚠️  No keywords found, skipping.")
        return

    total = len(keywords)
    for i, kw_row in enumerate(keywords, 1):
        keyword = kw_row["keyword"]
        kw_id = kw_row["id"]
        print(f"[{i:4d}/{total}] {keyword}")

        if dry_run:
            print("        [dry-run] skipping API call")
            time.sleep(0.1)
            continue

        serp = analyze_serp(keyword, market_cfg)
        time.sleep(1.2)  # Rate limiting

        if dry_run:
            continue

        # 2. Insert serp_snapshot
        snap = supabase.table("serp_snapshots").insert({
            "keyword_id": kw_id,
            "scan_date": scan_date,
            "pos_dedecker": serp["client_pos"],
            "url_dedecker": serp["client_url"] or "",
            "has_ai": serp["has_ai"],
            "dedecker_in_ai": serp["dedecker_in_ai"],
        }).execute()

        snapshot_id = snap.data[0]["id"]

        # 3. Insert competitor positions
        if serp["competitors"]:
            comp_rows = [
                {"snapshot_id": snapshot_id, "competitor_name": name, "position": pos}
                for name, pos in serp["competitors"].items()
            ]
            supabase.table("competitor_positions").insert(comp_rows).execute()

        if serp["client_pos"]:
            print(f"        ✓ DeDecker: pos {serp['client_pos']} | AI: {serp['has_ai']} | Comps: {len(serp['competitors'])}")
        else:
            print(f"        – Not ranked | AI: {serp['has_ai']}")

    print(f"\n✅ {market} done — {total} keywords written to Supabase for {scan_date}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--market", choices=["BENL", "BEFR", "ALL"], default="ALL")
    parser.add_argument("--date", default=str(date.today()), help="Scan date (YYYY-MM-DD)")
    parser.add_argument("--dry-run", action="store_true", help="Skip API calls, test DB connection only")
    args = parser.parse_args()

    # Validate env vars
    required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "DATAFORSEO_LOGIN", "DATAFORSEO_PASSWORD"]
    missing = [v for v in required if not os.environ.get(v)]
    if missing:
        print(f"❌ Missing environment variables: {', '.join(missing)}")
        sys.exit(1)

    supabase = create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_ROLE_KEY"],
    )

    markets_to_run = ["BENL", "BEFR"] if args.market == "ALL" else [args.market]

    for market in markets_to_run:
        run_market(market, supabase, args.date, dry_run=args.dry_run)

    print("\n🎉 All done!")


if __name__ == "__main__":
    main()
