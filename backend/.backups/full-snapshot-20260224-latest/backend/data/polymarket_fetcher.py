"""Polymarket prediction market fetcher — no API key needed.

Public read-only API for prediction market data (odds, volume, liquidity).
Uses the Gamma API events endpoint for search (markets endpoint ignores search params).
Base URL: https://gamma-api.polymarket.com
"""
from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from data.cache import TTLCache

logger = logging.getLogger("afindr.polymarket")

# 5-minute TTL cache for market searches
_market_cache = TTLCache(default_ttl=300.0, max_size=100)

_BASE = "https://gamma-api.polymarket.com"


def _request(endpoint: str, params: dict | None = None) -> list | dict | None:
    try:
        resp = httpx.get(f"{_BASE}/{endpoint}", params=params or {}, timeout=10)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        logger.warning(f"Polymarket API error: {e}")
        return None


def _parse_market(m: dict) -> dict[str, Any]:
    """Normalize a Polymarket market object to a consistent shape."""
    prices_raw = m.get("outcomePrices", "")
    outcomes = m.get("outcomes", "")
    if isinstance(prices_raw, str):
        try:
            prices_raw = json.loads(prices_raw)
        except Exception:
            prices_raw = []
    if isinstance(outcomes, str):
        try:
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


def _parse_event_markets(event: dict) -> list[dict[str, Any]]:
    """Extract and parse individual markets from a Polymarket event.

    Each event groups related markets (e.g. "US strikes Iran by Feb 24?",
    "US strikes Iran by Feb 25?" are markets under one event).
    Returns the most relevant/active markets from the event.
    """
    markets_raw = event.get("markets", [])
    event_title = event.get("title", "")
    event_slug = event.get("slug", "")
    event_volume = float(event.get("volume", 0) or 0)

    if not markets_raw:
        # Return event-level info if no nested markets
        return [{
            "title": event_title,
            "outcomes": [],
            "volume": event_volume,
            "liquidity": 0,
            "endDate": event.get("endDate"),
            "active": True,
            "url": f"https://polymarket.com/event/{event_slug}" if event_slug else None,
            "source": "polymarket",
        }]

    # Parse each market, filter to active/open ones, sort by volume
    parsed = []
    for m in markets_raw:
        if m.get("closed") or not m.get("active", True):
            continue
        p = _parse_market(m)
        # Use event slug for URL if market doesn't have one
        if not p["url"] and event_slug:
            p["url"] = f"https://polymarket.com/event/{event_slug}"
        parsed.append(p)

    # Sort by volume descending, return top ones
    parsed.sort(key=lambda x: x["volume"], reverse=True)
    return parsed


def search_markets(query: str, limit: int = 10) -> list[dict[str, Any]]:
    """Search Polymarket for markets matching a query string.

    Uses the /events endpoint (which returns grouped markets) and filters
    by text match. The /markets endpoint does NOT support text search.
    """
    cache_key = f"poly:{query.lower().strip()}:{limit}"
    cached = _market_cache.get(cache_key)
    if cached is not None:
        return cached

    query_lower = query.lower()
    query_words = [w for w in query_lower.split() if len(w) >= 2]

    # Fetch events sorted by volume (Iran events are high-volume, top 20)
    data = _request("events", {
        "_limit": 100,
        "closed": "false",
        "active": "true",
        "order": "volume",
        "ascending": "false",
    })

    if not data or not isinstance(data, list):
        return []

    # Filter events by query text — check title, slug, tags
    matching_events = []
    for event in data:
        title = (event.get("title") or "").lower()
        slug = (event.get("slug") or "").lower()
        tags_str = str(event.get("tags", "")).lower()
        searchable = f"{title} {slug} {tags_str}"

        if any(w in searchable for w in query_words):
            matching_events.append(event)

    # Extract markets from matching events
    results = []
    for event in matching_events:
        event_markets = _parse_event_markets(event)
        # Take top markets from each event (most relevant by volume)
        for m in event_markets[:5]:
            results.append(m)
            if len(results) >= limit:
                final_early = results[:limit]
                _market_cache.set(cache_key, final_early)
                return final_early

    # If still no results, return empty — don't return unrelated markets
    final = results[:limit]
    _market_cache.set(cache_key, final)
    return final


def get_trending_markets(limit: int = 10) -> list[dict[str, Any]]:
    """Fetch currently active markets sorted by volume (most popular)."""
    data = _request("events", {
        "_limit": limit,
        "closed": "false",
        "active": "true",
        "order": "volume",
        "ascending": "false",
    })

    if not data or not isinstance(data, list):
        return []

    results = []
    for event in data:
        event_markets = _parse_event_markets(event)
        if event_markets:
            results.append(event_markets[0])  # Top market per event
        if len(results) >= limit:
            break

    return results[:limit]
