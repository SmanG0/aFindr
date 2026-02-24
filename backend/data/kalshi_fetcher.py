"""Kalshi prediction market fetcher — no API key needed for public reads.

US-regulated exchange for event contracts (Fed decisions, elections, economics).
Base URL: https://api.elections.kalshi.com/trade-api/v2
"""
from __future__ import annotations

from typing import Any

import httpx

_BASE = "https://api.elections.kalshi.com/trade-api/v2"


def _request(endpoint: str, params: dict | None = None) -> dict | None:
    try:
        resp = httpx.get(
            f"{_BASE}/{endpoint}",
            params=params or {},
            timeout=10,
            headers={"Accept": "application/json"},
        )
        resp.raise_for_status()
        return resp.json()
    except Exception:
        return None


def _parse_event(e: dict) -> dict[str, Any]:
    """Normalize a Kalshi event to a consistent market shape."""
    ticker = e.get("event_ticker", "")
    return {
        "title": e.get("title", ""),
        "ticker": ticker,
        "category": e.get("category", ""),
        "volume": e.get("volume", 0),
        "openInterest": e.get("open_interest", 0),
        "closeTime": e.get("close_time") or e.get("expiration_time"),
        "status": e.get("status", ""),
        "url": f"https://kalshi.com/events/{ticker}" if ticker else None,
        "source": "kalshi",
    }


def _parse_market(m: dict) -> dict[str, Any]:
    """Normalize a Kalshi market object to a consistent shape."""
    yes_price = m.get("yes_bid") or m.get("last_price")
    no_price = m.get("no_bid")
    if yes_price is not None and no_price is None:
        no_price = 100 - yes_price if isinstance(yes_price, (int, float)) else None

    # Kalshi prices are in cents (0-100) — convert to fraction
    yes_pct = yes_price / 100 if isinstance(yes_price, (int, float)) else None
    no_pct = no_price / 100 if isinstance(no_price, (int, float)) else None

    return {
        "title": m.get("title") or m.get("subtitle", ""),
        "ticker": m.get("ticker", ""),
        "yesPrice": yes_pct,
        "noPrice": no_pct,
        "volume": m.get("volume", 0),
        "openInterest": m.get("open_interest", 0),
        "closeTime": m.get("close_time") or m.get("expiration_time"),
        "category": m.get("category", ""),
        "status": m.get("status", ""),
        "url": f"https://kalshi.com/markets/{m.get('ticker', '')}" if m.get("ticker") else None,
        "source": "kalshi",
    }


def search_markets(query: str, limit: int = 10) -> list[dict[str, Any]]:
    """Search Kalshi events matching a query, then return top markets."""
    # Use events endpoint for better searchability
    data = _request("events", {
        "limit": 100,
        "status": "open",
    })

    if not data or "events" not in data:
        return []

    events = data["events"]
    query_lower = query.lower()

    # Filter events by query text
    matching = []
    for e in events:
        title = (e.get("title") or "").lower()
        category = (e.get("category") or "").lower()
        ticker = (e.get("event_ticker") or "").lower()
        if query_lower in title or query_lower in category or query_lower in ticker:
            matching.append(_parse_event(e))
        if len(matching) >= limit:
            break

    # If no text matches, return top events
    if not matching:
        matching = [_parse_event(e) for e in events[:limit]]

    return matching[:limit]


def get_market(ticker: str) -> dict[str, Any] | None:
    """Fetch a single Kalshi market by its ticker."""
    data = _request(f"markets/{ticker}")

    if not data or "market" not in data:
        return None

    return _parse_market(data["market"])
