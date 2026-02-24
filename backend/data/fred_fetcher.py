"""FRED (Federal Reserve Economic Data) fetcher.

Provides economic indicators (GDP, CPI, rates) and treasury yield data.
Requires FRED_API_KEY environment variable (free at https://fred.stlouisfed.org/docs/api/api_key.html).
"""
from __future__ import annotations

import os
from typing import Any

import httpx

_BASE = "https://api.stlouisfed.org/fred"

# Common FRED series IDs for quick access
POPULAR_SERIES = {
    "gdp": {"id": "GDP", "name": "Real Gross Domestic Product", "frequency": "Quarterly"},
    "cpi": {"id": "CPIAUCSL", "name": "Consumer Price Index (All Urban)", "frequency": "Monthly"},
    "core_cpi": {"id": "CPILFESL", "name": "Core CPI (Ex Food & Energy)", "frequency": "Monthly"},
    "fed_funds": {"id": "FEDFUNDS", "name": "Federal Funds Effective Rate", "frequency": "Monthly"},
    "unemployment": {"id": "UNRATE", "name": "Unemployment Rate", "frequency": "Monthly"},
    "pce": {"id": "PCE", "name": "Personal Consumption Expenditures", "frequency": "Monthly"},
    "core_pce": {"id": "PCEPILFE", "name": "Core PCE Price Index", "frequency": "Monthly"},
    "m2": {"id": "M2SL", "name": "M2 Money Supply", "frequency": "Monthly"},
    "housing_starts": {"id": "HOUST", "name": "Housing Starts", "frequency": "Monthly"},
    "retail_sales": {"id": "RSAFS", "name": "Retail Sales", "frequency": "Monthly"},
    "industrial_production": {"id": "INDPRO", "name": "Industrial Production Index", "frequency": "Monthly"},
    "consumer_sentiment": {"id": "UMCSENT", "name": "U of Michigan Consumer Sentiment", "frequency": "Monthly"},
    "initial_claims": {"id": "ICSA", "name": "Initial Jobless Claims", "frequency": "Weekly"},
    "t10y2y": {"id": "T10Y2Y", "name": "10-Year minus 2-Year Treasury Spread", "frequency": "Daily"},
    "vix": {"id": "VIXCLS", "name": "CBOE Volatility Index (VIX)", "frequency": "Daily"},
}

TREASURY_SERIES = {
    "3m": "DGS3MO",
    "6m": "DGS6MO",
    "1y": "DGS1",
    "2y": "DGS2",
    "5y": "DGS5",
    "7y": "DGS7",
    "10y": "DGS10",
    "20y": "DGS20",
    "30y": "DGS30",
}


def _get_key() -> str | None:
    return os.environ.get("FRED_API_KEY")


def _request(endpoint: str, params: dict | None = None) -> dict | None:
    key = _get_key()
    if not key:
        return None
    p = {"api_key": key, "file_type": "json", **(params or {})}
    try:
        resp = httpx.get(f"{_BASE}/{endpoint}", params=p, timeout=10)
        resp.raise_for_status()
        return resp.json()
    except Exception:
        return None


def fetch_economic_indicator(series_id: str, limit: int = 24) -> dict[str, Any]:
    """Fetch an economic indicator time series from FRED.

    Args:
        series_id: FRED series ID (e.g. "GDP", "CPIAUCSL") or a shorthand
                   from POPULAR_SERIES (e.g. "gdp", "cpi", "fed_funds").
        limit: Number of recent observations to return.
    """
    if not _get_key():
        return {"error": "FRED_API_KEY not configured. Get a free key at https://fred.stlouisfed.org/docs/api/api_key.html"}

    # Resolve shorthand names
    resolved = series_id
    meta = None
    if series_id.lower() in POPULAR_SERIES:
        meta = POPULAR_SERIES[series_id.lower()]
        resolved = meta["id"]

    # Get series info
    info_data = _request("series", {"series_id": resolved})
    series_info = {}
    if info_data and "seriess" in info_data and info_data["seriess"]:
        s = info_data["seriess"][0]
        series_info = {
            "id": s.get("id"),
            "title": s.get("title"),
            "frequency": s.get("frequency"),
            "units": s.get("units"),
            "seasonalAdjustment": s.get("seasonal_adjustment"),
            "lastUpdated": s.get("last_updated"),
        }

    # Get observations
    obs_data = _request("series/observations", {
        "series_id": resolved,
        "sort_order": "desc",
        "limit": limit,
    })

    if not obs_data or "observations" not in obs_data:
        return {"seriesId": resolved, "error": "No data returned from FRED", "observations": []}

    observations = []
    for obs in reversed(obs_data["observations"]):
        val = obs.get("value", ".")
        observations.append({
            "date": obs.get("date"),
            "value": float(val) if val != "." else None,
        })

    latest = observations[-1] if observations else None

    return {
        "seriesId": resolved,
        "info": series_info,
        "latest": latest,
        "observations": observations,
        "count": len(observations),
    }


def fetch_treasury_yields() -> dict[str, Any]:
    """Fetch current treasury yield curve data across all maturities.

    Returns the latest yield for each maturity (3M through 30Y),
    plus a simple inverted-yield-curve check.
    """
    if not _get_key():
        return {"error": "FRED_API_KEY not configured"}

    yields_data: dict[str, float | None] = {}
    for label, series_id in TREASURY_SERIES.items():
        obs = _request("series/observations", {
            "series_id": series_id,
            "sort_order": "desc",
            "limit": 1,
        })
        val = None
        date = None
        if obs and "observations" in obs and obs["observations"]:
            raw = obs["observations"][0].get("value", ".")
            date = obs["observations"][0].get("date")
            if raw != ".":
                val = round(float(raw), 3)
        yields_data[label] = val

    # Check for yield curve inversion
    y2 = yields_data.get("2y")
    y10 = yields_data.get("10y")
    inverted = (y2 is not None and y10 is not None and y2 > y10)
    spread_10y2y = round(y10 - y2, 3) if y2 is not None and y10 is not None else None

    return {
        "yields": yields_data,
        "spread_10y_2y": spread_10y2y,
        "inverted": inverted,
        "asOfDate": date,
    }


# ─── Free Proxy Functions (yfinance ETFs/indices as FRED alternatives) ───

# Map FRED shorthands to yfinance proxy tickers
_PROXY_TICKERS = {
    "vix": "^VIX",
    "t10y2y": None,  # computed from ^TNX and DGS2 proxy
    "fed_funds": "^IRX",  # 13-week T-bill as proxy
    "gdp": "SPY",  # S&P 500 as GDP proxy (directionally)
}

# Treasury yield proxies via yfinance
_TREASURY_PROXIES = {
    "3m": "^IRX",    # 13-week T-bill
    "10y": "^TNX",   # 10-year Treasury yield
    "30y": "^TYX",   # 30-year Treasury yield
    "5y": "^FVX",    # 5-year Treasury yield
}


def fetch_economic_indicator_free(series_id: str, limit: int = 24) -> dict:
    """Fetch economic indicator data using free yfinance proxies.

    Falls back to ETF/index proxies when FRED API key is unavailable.
    Supports: vix, fed_funds, and select others via proxy tickers.
    """
    import yfinance as yf

    series_lower = series_id.lower()

    # Direct proxy tickers
    proxy_map = {
        "vix": ("^VIX", "CBOE Volatility Index (VIX)"),
        "fed_funds": ("^IRX", "13-Week Treasury Bill (Fed Funds Proxy)"),
        "consumer_sentiment": ("XLY", "Consumer Discretionary ETF (Sentiment Proxy)"),
    }

    if series_lower in proxy_map:
        ticker_sym, name = proxy_map[series_lower]
        ticker = yf.Ticker(ticker_sym)
        hist = ticker.history(period="2y", interval="1d")
        if hist.empty:
            return {"seriesId": series_id, "error": "No data from yfinance proxy", "observations": []}

        observations = []
        for idx, row in hist.tail(limit).iterrows():
            observations.append({
                "date": str(idx.strftime("%Y-%m-%d")),
                "value": round(float(row["Close"]), 3),
            })

        latest = observations[-1] if observations else None
        return {
            "seriesId": series_id,
            "info": {"title": name, "source": "yfinance proxy", "units": "Index" if "VIX" in ticker_sym else "Percent"},
            "latest": latest,
            "observations": observations,
            "count": len(observations),
        }

    return {"seriesId": series_id, "error": f"No free proxy available for '{series_id}'. Configure FRED_API_KEY for full access.", "observations": []}


def fetch_treasury_yields_free() -> dict:
    """Fetch current treasury yields using free yfinance index proxies.

    Uses ^IRX (3m), ^FVX (5y), ^TNX (10y), ^TYX (30y).
    """
    import yfinance as yf

    yields_data = {}
    date = None

    for label, ticker_sym in _TREASURY_PROXIES.items():
        try:
            ticker = yf.Ticker(ticker_sym)
            hist = ticker.history(period="5d", interval="1d")
            if not hist.empty:
                last_row = hist.iloc[-1]
                yields_data[label] = round(float(last_row["Close"]), 3)
                date = str(hist.index[-1].strftime("%Y-%m-%d"))
            else:
                yields_data[label] = None
        except Exception:
            yields_data[label] = None

    y10 = yields_data.get("10y")
    # Estimate 2y from interpolation or use None
    y2 = None
    y5 = yields_data.get("5y")
    y3m = yields_data.get("3m")
    if y5 is not None and y3m is not None:
        y2 = round((y3m + y5) / 2, 3)  # rough interpolation
        yields_data["2y"] = y2

    inverted = (y2 is not None and y10 is not None and y2 > y10)
    spread = round(y10 - y2, 3) if y2 is not None and y10 is not None else None

    return {
        "yields": yields_data,
        "spread_10y_2y": spread,
        "inverted": inverted,
        "asOfDate": date,
        "source": "yfinance_proxy",
        "note": "2y yield is interpolated; use FRED_API_KEY for exact values",
    }


def list_popular_series() -> list[dict]:
    """Return the list of popular/common FRED series for easy access."""
    return [
        {"shorthand": k, **v}
        for k, v in POPULAR_SERIES.items()
    ]
