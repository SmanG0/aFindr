#!/usr/bin/env python3
"""
Download headshots for quote authors from DuckDuckGo image search.
Saves to public/headshots/ for use in the app.
Run: python scripts/download_headshots.py
"""

import os
import re
import time
import urllib.request
from pathlib import Path

# All quote authors who need headshots
AUTHORS = [
    "Warren Buffett",
    "Charlie Munger",
    "Benjamin Graham",
    "John Maynard Keynes",
    "George Soros",
    "Ray Dalio",
    "Peter Lynch",
    "Howard Marks",
    "Paul Tudor Jones",
    "Mellody Hobson",
    "Edwin Lefevre",
    "Sir John Templeton",
    "Ed Seykota",
    "Alexander Elder",
    "William J. O'Neil",
    "Philip Fisher",
    "Robert Arnott",
    "Victor Sperandeo",
    "Robert Olstein",
    "Ken Fisher",
    "Larry Hite",
    "Nicolas Darvas",
    "Jesse Livermore",
    "Morgan Housel",
]

OUTPUT_DIR = Path(__file__).parent.parent / "public" / "headshots"


def slug(name: str) -> str:
    return re.sub(r"[.'\s]+", "-", name).strip("-").lower()


def search_and_download(name: str, ddgs=None) -> bool:
    """Use DuckDuckGo to find and download a headshot."""
    try:
        from duckduckgo_search import DDGS

        if ddgs is None:
            ddgs = DDGS()
        results = list(ddgs.images(f"{name} headshot portrait", max_results=10))
    except ImportError:
        print("  Install: pip install duckduckgo-search")
        return False

    if not results:
        print(f"  No results for {name}")
        return False

    for r in results:
        url = r.get("image")
        if not url or not url.startswith("http"):
            continue
        try:
            req = urllib.request.Request(
                url,
                headers={
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"
                },
            )
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = resp.read()
            if len(data) < 5000:
                continue
            out = OUTPUT_DIR / f"{slug(name)}.jpg"
            out.write_bytes(data)
            print(f"  ✓ {name}")
            return True
        except Exception as e:
            continue
    print(f"  ✗ {name} (failed)")
    return False


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Saving to {OUTPUT_DIR}\n")
    ok = 0
    try:
        try:
            from ddgs import DDGS
        except ImportError:
            from duckduckgo_search import DDGS

        ddgs = DDGS()
    except ImportError:
        ddgs = None
    for i, name in enumerate(AUTHORS):
        out_jpg = OUTPUT_DIR / f"{slug(name)}.jpg"
        out_png = OUTPUT_DIR / f"{slug(name)}.png"
        if out_jpg.exists() and out_jpg.stat().st_size > 10000:
            print(f"[{i+1}/{len(AUTHORS)}] {name} (skip, exists)")
            ok += 1
            continue
        if out_png.exists() and out_png.stat().st_size > 10000:
            print(f"[{i+1}/{len(AUTHORS)}] {name} (skip, exists)")
            ok += 1
            continue
        print(f"[{i+1}/{len(AUTHORS)}] {name}")
        for attempt in range(2):
            try:
                if search_and_download(name, ddgs):
                    ok += 1
                break
            except Exception as e:
                if "Ratelimit" in str(e) and attempt == 0:
                    print(f"  Rate limited. Waiting 60s...")
                    time.sleep(60)
                else:
                    print(f"  Error: {e}")
                    break
        time.sleep(5)
    print(f"\nDone: {ok}/{len(AUTHORS)} downloaded")


if __name__ == "__main__":
    main()
