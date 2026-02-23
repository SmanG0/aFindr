"""Stock data fetcher using yfinance for quotes, fundamentals, and analyst data."""
from __future__ import annotations

import time
from typing import Optional, Dict, Any

import yfinance as yf

# ─── Cache ───

_quote_cache: Dict[str, Dict] = {}
QUOTE_CACHE_TTL = 60  # 1 minute for quotes
INFO_CACHE_TTL = 300  # 5 minutes for fundamentals


def _is_fresh(cache_entry: Dict, ttl: int) -> bool:
    if not cache_entry:
        return False
    return time.time() - cache_entry.get("timestamp", 0) < ttl


# ─── Public API ───

def fetch_stock_quote(ticker: str) -> Optional[Dict[str, Any]]:
    """Fetch real-time quote data for a stock ticker."""
    cache_key = f"quote:{ticker}"
    if cache_key in _quote_cache and _is_fresh(_quote_cache[cache_key], QUOTE_CACHE_TTL):
        return _quote_cache[cache_key]["data"]

    try:
        stock = yf.Ticker(ticker)
        info = stock.info
        if not info or "regularMarketPrice" not in info:
            return None

        price = info.get("regularMarketPrice", 0)
        prev_close = info.get("previousClose", price)
        change = round(price - prev_close, 2)
        change_pct = round((change / prev_close * 100) if prev_close else 0, 2)

        data = {
            "ticker": ticker.upper(),
            "name": info.get("shortName", info.get("longName", ticker)),
            "price": round(price, 2),
            "change": change,
            "changePct": change_pct,
            "prevClose": round(prev_close, 2),
            "marketCap": _format_large_number(info.get("marketCap")),
            "volume": _format_large_number(info.get("regularMarketVolume")),
            "pe": str(round(info.get("trailingPE", 0), 2)) if info.get("trailingPE") else "-",
            "eps": str(round(info.get("trailingEps", 0), 2)) if info.get("trailingEps") else "-",
            "divYield": f"{round(info.get('dividendYield', 0) * 100, 2)}%" if info.get("dividendYield") else "-",
            "shortInterest": f"{round(info.get('shortPercentOfFloat', 0) * 100, 2)}%" if info.get("shortPercentOfFloat") else "-",
            "weekHigh52": round(info.get("fiftyTwoWeekHigh", 0), 2),
            "weekLow52": round(info.get("fiftyTwoWeekLow", 0), 2),
            "dayHigh": round(info.get("dayHigh", 0), 2),
            "dayLow": round(info.get("dayLow", 0), 2),
            "exchange": info.get("exchange", "N/A"),
            "sector": info.get("sector", "N/A"),
        }

        _quote_cache[cache_key] = {"data": data, "timestamp": time.time()}
        return data
    except Exception:
        return None


def fetch_analyst_ratings(ticker: str) -> list[Dict[str, Any]]:
    """Fetch analyst recommendations for a ticker."""
    try:
        stock = yf.Ticker(ticker)
        recs = stock.recommendations
        if recs is None or recs.empty:
            return []

        ratings = []
        for _, row in recs.tail(10).iterrows():
            ratings.append({
                "firm": str(row.get("Firm", "Unknown")),
                "rating": str(row.get("To Grade", row.get("toGrade", "N/A"))),
                "date": str(row.name.strftime("%b %d, %Y")) if hasattr(row.name, "strftime") else str(row.name),
            })
        ratings.reverse()
        return ratings
    except Exception:
        return []


def fetch_related_stocks(ticker: str) -> list[Dict[str, Any]]:
    """Fetch related/peer stocks based on sector."""
    try:
        stock = yf.Ticker(ticker)
        info = stock.info
        sector = info.get("sector")
        industry = info.get("industry")

        # Use a curated list of sector peers
        sector_peers = _get_sector_peers(ticker, sector, industry)
        results = []

        for peer in sector_peers[:5]:
            quote = fetch_stock_quote(peer)
            if quote:
                results.append({
                    "ticker": quote["ticker"],
                    "name": quote["name"][:15] + "..." if len(quote.get("name", "")) > 15 else quote.get("name", ""),
                    "price": quote["price"],
                    "change": quote["change"],
                    "changePct": quote["changePct"],
                })
        return results
    except Exception:
        return []


# ─── Helpers ───

def _format_large_number(n) -> str:
    """Format large numbers with K/M/B suffixes."""
    if n is None:
        return "-"
    if n >= 1_000_000_000_000:
        return f"${n / 1_000_000_000_000:.2f}T"
    if n >= 1_000_000_000:
        return f"${n / 1_000_000_000:.2f}B"
    if n >= 1_000_000:
        return f"${n / 1_000_000:.2f}M"
    if n >= 1_000:
        return f"{n / 1_000:.0f}K"
    return str(n)


def _get_sector_peers(ticker: str, sector: Optional[str], industry: Optional[str]) -> list[str]:
    """Get peer tickers based on sector/industry."""
    # Curated peer lists for common sectors
    tech_peers = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "AMD", "INTC", "CRM"]
    finance_peers = ["JPM", "BAC", "WFC", "GS", "MS", "C", "BLK", "SCHW"]
    energy_peers = ["XOM", "CVX", "COP", "SLB", "EOG", "MPC", "PSX", "VLO"]
    healthcare_peers = ["UNH", "JNJ", "PFE", "ABBV", "MRK", "LLY", "TMO", "ABT"]
    nuclear_peers = ["NNE", "SMR", "OKLO", "LEU", "BWXT", "CCJ", "UEC"]

    ticker_upper = ticker.upper()
    if ticker_upper in nuclear_peers:
        return [p for p in nuclear_peers if p != ticker_upper]
    if sector == "Technology" or ticker_upper in tech_peers:
        return [p for p in tech_peers if p != ticker_upper]
    if sector == "Financial Services" or ticker_upper in finance_peers:
        return [p for p in finance_peers if p != ticker_upper]
    if sector == "Energy" or ticker_upper in energy_peers:
        return [p for p in energy_peers if p != ticker_upper]
    if sector == "Healthcare" or ticker_upper in healthcare_peers:
        return [p for p in healthcare_peers if p != ticker_upper]

    # Fallback: top-of-market
    return [p for p in ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA"] if p != ticker_upper]
