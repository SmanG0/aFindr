"""Polymarket prediction market fetcher — no API key needed.

Public read-only API for prediction market data (odds, volume, liquidity).
Base URL: https://gamma-api.polymarket.com
"""
from __future__ import annotations

from typing import Any

import httpx

_BASE = "https://gamma-api.polymarket.com"


def _request(endpoint: str, params: dict | None = None) -> list | dict | None:
    try:
        resp = httpx.get(f"{_BASE}/{endpoint}", params=params or {}, timeout=10)
        resp.raise_for_status()
        return resp.json()
    except Exception:
        return None


def _parse_market(m: dict) -> dict[str, Any]:
    """Normalize a Polymarket market object to a consistent shape."""
    # outcomePrices is a JSON string like "[\"0.65\",\"0.35\"]"
    prices_raw = m.get("outcomePrices", "")
    outcomes = m.get("outcomes", "")
    if isinstance(prices_raw, str):
        try:
            import json
            prices_raw = json.loads(prices_raw)
        except Exception:
            prices_raw = []
    if isinstance(outcomes, str):
        try:
            import json
            outcomes = json.loads(outcomes)
        except Exception:
            outcomes = []

    outcome_prices = []
    for i, name in enumerate(outcomes):
        price = float(prices_raw[i]) if i < len(prices_raw) else None
        outcome_prices.append({"name": name, "price": price})

    slug = m.get("slug", "")
    url = f"https://polymarket.com/event/{slug}" if slug else None

    return {
        "title": m.get("question") or m.get("title", ""),
        "outcomes": outcome_prices,
        "volume": float(m.get("volume", 0) or 0),
        "liquidity": float(m.get("liquidity", 0) or 0),
        "endDate": m.get("endDate") or m.get("end_date_iso"),
        "active": m.get("active", True),
        "url": url,
        "source": "polymarket",
    }


def search_markets(query: str, limit: int = 10) -> list[dict[str, Any]]:
    """Search Polymarket for markets matching a query string."""
    data = _request("markets", {
        "_limit": limit,
        "closed": "false",
        "active": "true",
        "order": "volume",
        "ascending": "false",
        "tag_slug": query.lower().replace(" ", "-"),
    })

    if not data:
        # Try text search fallback
        data = _request("markets", {
            "_limit": limit,
            "closed": "false",
            "active": "true",
            "order": "volume",
            "ascending": "false",
        })

    if not data or not isinstance(data, list):
        return []

    # Filter by query text if results don't already match
    query_lower = query.lower()
    results = []
    for m in data:
        title = (m.get("question") or m.get("title") or "").lower()
        if query_lower in title or not query.strip():
            results.append(_parse_market(m))
        if len(results) >= limit:
            break

    # If no matches from tag search, return all results (API already filtered)
    if not results:
        results = [_parse_market(m) for m in data[:limit]]

    return results


def get_trending_markets(limit: int = 10) -> list[dict[str, Any]]:
    """Fetch currently active markets sorted by volume (most popular)."""
    data = _request("markets", {
        "_limit": limit,
        "closed": "false",
        "active": "true",
        "order": "volume",
        "ascending": "false",
    })

    if not data or not isinstance(data, list):
        return []

    return [_parse_market(m) for m in data[:limit]]
