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
            "default": ["vika.be", "dsmkeukens.be", "dovykeukens.be", "diapal.be"],
            "Badkamers": ["groepwouters.be", "debbadbeke.be", "x2o.be", "facq.be", "vanmarcke.be"],
        },
        "comp_names": {
            "vika.be": "Vika",
            "dsmkeukens.be": "DSM Keukens",
            "dovykeukens.be": "Dovy",
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


def run_market(market: str, supabase, scan_date: str, dry_run: bool = False, force: bool = False):
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

    # 1b. Skip keywords already scanned today (unless force mode)
    kw_ids = {k["id"] for k in keywords}
    already = supabase.table("serp_snapshots").select("id, keyword_id").eq("scan_date", scan_date).execute()
    existing_by_kw = {r["keyword_id"]: r["id"] for r in already.data or [] if r["keyword_id"] in kw_ids}

    if force and not dry_run and existing_by_kw:
        print(f"🗑️  Force mode: deleting {len(existing_by_kw)} existing snapshots for {market} {scan_date}")
        existing_ids = list(existing_by_kw.values())
        # delete competitor positions first, then snapshots
        try:
            supabase.table("competitor_positions").delete().in_("snapshot_id", existing_ids).execute()
        except Exception as e:
            print(f"   ⚠️ Could not delete competitor_positions: {e}")
        try:
            supabase.table("serp_snapshots").delete().in_("id", existing_ids).execute()
        except Exception as e:
            print(f"   ⚠️ Could not delete serp_snapshots: {e}")
        existing_by_kw = {}

    done_ids = set(existing_by_kw.keys())
    keywords = [k for k in keywords if k["id"] not in done_ids]
    print(f"⏭️  {len(done_ids)} already scanned for {scan_date}, {len(keywords)} remaining")

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

        progress = f"{i}/{total}"
        if serp["client_pos"]:
            print(f"[{progress:>8}] ✓ DeDecker: pos {serp['client_pos']} | AI: {serp['has_ai']} | {serp['client_url'][:60]}")
        else:
            print(f"[{progress:>8}] – Not ranked | AI: {serp['has_ai']}")

        time.sleep(0.1)

    print(f"\n✅ {market} done — {total} keywords written to Supabase for {scan_date}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--market", choices=["BENL", "BEFR", "ALL"], default="ALL")
    parser.add_argument("--date", default=str(date.today()), help="Scan date (YYYY-MM-DD)")
    parser.add_argument("--dry-run", action="store_true", help="Skip API calls, test DB connection only")
    parser.add_argument("--force", action="store_true", help="Re-scan keywords already in Supabase for this date")
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
        run_market(market, supabase, args.date, dry_run=args.dry_run, force=args.force)

    print("\n🎉 All done!")


if __name__ == "__main__":
    main()
