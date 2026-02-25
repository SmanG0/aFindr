"""News router — RSS feed aggregation endpoints."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Query, Request

from rate_limit import limiter
from data.news_fetcher import fetch_all_news, get_available_sources
from data.stock_fetcher import fetch_stock_quote, fetch_analyst_ratings, fetch_related_stocks, fetch_stock_detail_full

router = APIRouter(prefix="/api/news", tags=["news"])


@router.get("/feed")
@limiter.limit("60/minute")
async def get_news_feed(
    request: Request,
    category: Optional[str] = Query(None, description="Filter by category"),
    ticker: Optional[str] = Query(None, description="Filter by ticker"),
    source: Optional[str] = Query(None, description="Filter by source"),
    limit: int = Query(50, ge=1, le=200, description="Max articles"),
):
    """Get aggregated news feed from all RSS sources."""
    items = fetch_all_news(category=category, ticker=ticker, source=source, limit=limit)
    return {"articles": items, "count": len(items)}


@router.get("/sources")
@limiter.limit("60/minute")
async def get_sources(request: Request):
    """Get list of configured news sources."""
    return {"sources": get_available_sources()}


@router.get("/stock/{ticker}")
@limiter.limit("60/minute")
async def get_stock_detail(request: Request, ticker: str):
    """Get stock detail with quote, ratings, and related stocks."""
    quote = fetch_stock_quote(ticker.upper())
    if not quote:
        return {"error": f"Could not fetch data for {ticker}"}

    ratings = fetch_analyst_ratings(ticker.upper())
    related = fetch_related_stocks(ticker.upper())

    return {
        **quote,
        "ratings": ratings,
        "relatedStocks": related,
    }


@router.get("/stock/{ticker}/full")
@limiter.limit("60/minute")
async def get_stock_detail_full(request: Request, ticker: str):
    """Get comprehensive stock detail via yfinance: fundamentals, earnings, analyst data, ownership."""
    data = fetch_stock_detail_full(ticker.upper())
    if not data:
        return {"error": f"Could not fetch data for {ticker}"}
    return data
