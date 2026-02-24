"""Finnhub fetcher — free tier (60 calls/min).

Provides insider sentiment, earnings calendar, and company news.
Requires FINNHUB_API_KEY environment variable.
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta
from typing import Any

import httpx

_BASE = "https://finnhub.io/api/v1"


def _get_key() -> str | None:
    return os.environ.get("FINNHUB_API_KEY")


def _request(endpoint: str, params: dict | None = None) -> dict | list | None:
    key = _get_key()
    if not key:
        return None
    p = {"token": key, **(params or {})}
    try:
        resp = httpx.get(f"{_BASE}/{endpoint}", params=p, timeout=10)
        resp.raise_for_status()
        return resp.json()
    except Exception:
        return None


def fetch_insider_sentiment(ticker: str) -> dict[str, Any]:
    """Fetch insider transaction sentiment aggregated monthly.

    Returns monthly MSPR (Monthly Share Purchase Ratio) and change values.
    """
    if not _get_key():
        return {"ticker": ticker, "error": "FINNHUB_API_KEY not configured", "sentiment": []}

    data = _request("stock/insider-sentiment", {"symbol": ticker, "from": "2024-01-01"})
    if not data or "data" not in data:
        return {"ticker": ticker, "sentiment": [], "error": "No insider sentiment data"}

    entries = []
    for row in data["data"][-12:]:  # last 12 months
        entries.append({
            "year": row.get("year"),
            "month": row.get("month"),
            "change": row.get("change", 0),
            "mspr": round(row.get("mspr", 0), 4),
        })

    return {
        "ticker": ticker,
        "symbol": data.get("symbol", ticker),
        "sentimentCount": len(entries),
        "sentiment": entries,
    }


def fetch_earnings_calendar(ticker: str) -> dict[str, Any]:
    """Fetch upcoming and recent earnings dates for a ticker.

    Returns expected EPS, actual EPS (if reported), revenue estimates.
    """
    if not _get_key():
        return {"ticker": ticker, "error": "FINNHUB_API_KEY not configured", "earnings": []}

    today = datetime.now()
    from_date = (today - timedelta(days=90)).strftime("%Y-%m-%d")
    to_date = (today + timedelta(days=90)).strftime("%Y-%m-%d")

    data = _request("calendar/earnings", {"symbol": ticker, "from": from_date, "to": to_date})
    if not data or "earningsCalendar" not in data:
        return {"ticker": ticker, "earnings": []}

    earnings = []
    for row in data["earningsCalendar"]:
        earnings.append({
            "date": row.get("date"),
            "epsEstimate": row.get("epsEstimate"),
            "epsActual": row.get("epsActual"),
            "revenueEstimate": row.get("revenueEstimate"),
            "revenueActual": row.get("revenueActual"),
            "quarter": row.get("quarter"),
            "year": row.get("year"),
            "hour": row.get("hour", ""),  # bmo/amc
            "symbol": row.get("symbol", ticker),
        })

    return {
        "ticker": ticker,
        "earningsCount": len(earnings),
        "earnings": earnings,
    }


def fetch_company_news(ticker: str, days: int = 7) -> dict[str, Any]:
    """Fetch recent company news articles from Finnhub.

    Returns headline, source, summary, sentiment, and URL.
    """
    if not _get_key():
        return {"ticker": ticker, "error": "FINNHUB_API_KEY not configured", "news": []}

    today = datetime.now()
    from_date = (today - timedelta(days=days)).strftime("%Y-%m-%d")
    to_date = today.strftime("%Y-%m-%d")

    data = _request("company-news", {"symbol": ticker, "from": from_date, "to": to_date})
    if not data or not isinstance(data, list):
        return {"ticker": ticker, "news": []}

    articles = []
    for item in data[:15]:
        articles.append({
            "headline": item.get("headline", ""),
            "source": item.get("source", ""),
            "summary": item.get("summary", "")[:300],
            "url": item.get("url", ""),
            "datetime": item.get("datetime"),
            "category": item.get("category", ""),
            "related": item.get("related", ""),
        })

    return {
        "ticker": ticker,
        "newsCount": len(articles),
        "news": articles,
    }
