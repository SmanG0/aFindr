"""BLS (Bureau of Labor Statistics) API v2 fetcher.

Provides labor market data: CPI, unemployment, nonfarm payrolls, PPI, wages.
Requires BLS_API_KEY environment variable (free at https://www.bls.gov/developers/).
500 queries/day, 50 series/query, 20 years of data.
"""
from __future__ import annotations

import os
from datetime import datetime
from typing import Any

import httpx

_BASE = "https://api.bls.gov/publicAPI/v2/timeseries/data/"

# Common BLS series for quick access — shorthand -> {id, name, units}
POPULAR_SERIES = {
    "cpi": {
        "id": "CUSR0000SA0",
        "name": "CPI — All Urban Consumers (Seasonally Adjusted)",
        "units": "Index (1982-84=100)",
        "frequency": "Monthly",
    },
    "core_cpi": {
        "id": "CUSR0000SA0L1E",
        "name": "CPI — All Items Less Food and Energy",
        "units": "Index (1982-84=100)",
        "frequency": "Monthly",
    },
    "unemployment": {
        "id": "LNS14000000",
        "name": "Unemployment Rate",
        "units": "Percent",
        "frequency": "Monthly",
    },
    "nonfarm_payrolls": {
        "id": "CES0000000001",
        "name": "Total Nonfarm Payrolls",
        "units": "Thousands of Persons",
        "frequency": "Monthly",
    },
    "ppi": {
        "id": "WPSFD4",
        "name": "PPI — Finished Goods",
        "units": "Index (1982=100)",
        "frequency": "Monthly",
    },
    "avg_hourly_earnings": {
        "id": "CES0500000003",
        "name": "Average Hourly Earnings — All Employees",
        "units": "Dollars per Hour",
        "frequency": "Monthly",
    },
    "labor_force_participation": {
        "id": "LNS11300000",
        "name": "Labor Force Participation Rate",
        "units": "Percent",
        "frequency": "Monthly",
    },
    "initial_claims": {
        "id": "LNS13000000",
        "name": "Unemployed Persons",
        "units": "Thousands of Persons",
        "frequency": "Monthly",
    },
    "employment_population": {
        "id": "LNS12300000",
        "name": "Employment-Population Ratio",
        "units": "Percent",
        "frequency": "Monthly",
    },
}


def _get_key() -> str | None:
    return os.environ.get("BLS_API_KEY")


def fetch_bls_series(
    series_ids: list[str],
    start_year: int | None = None,
    end_year: int | None = None,
) -> dict[str, Any]:
    """Fetch one or more BLS time series via the v2 API.

    Args:
        series_ids: List of BLS series IDs (max 50).
        start_year: Start year (defaults to 3 years ago).
        end_year: End year (defaults to current year).

    Returns dict per series with observations in the same shape as FRED.
    """
    key = _get_key()
    if not key:
        return {"error": "BLS_API_KEY not configured. Get a free key at https://www.bls.gov/developers/"}

    now = datetime.now()
    if end_year is None:
        end_year = now.year
    if start_year is None:
        start_year = end_year - 3

    payload = {
        "seriesid": series_ids[:50],
        "startyear": str(start_year),
        "endyear": str(end_year),
        "registrationkey": key,
    }

    try:
        resp = httpx.post(_BASE, json=payload, timeout=15)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        return {"error": f"BLS API request failed: {str(e)}"}

    if data.get("status") != "REQUEST_SUCCEEDED":
        msg = data.get("message", [])
        return {"error": f"BLS API error: {'; '.join(msg) if isinstance(msg, list) else str(msg)}"}

    results = {}
    for series in data.get("Results", {}).get("series", []):
        sid = series.get("seriesID", "")
        raw_data = series.get("data", [])

        # BLS returns newest first — reverse to chronological
        observations = []
        for row in reversed(raw_data):
            year = row.get("year", "")
            period = row.get("periodName", "")
            val_str = row.get("value", "")
            try:
                val = float(val_str)
            except (ValueError, TypeError):
                val = None
            observations.append({
                "date": f"{year} {period}".strip(),
                "value": val,
            })

        latest = observations[-1] if observations else None

        # Try to find the series metadata from our dict
        meta = None
        for _short, info in POPULAR_SERIES.items():
            if info["id"] == sid:
                meta = info
                break

        results[sid] = {
            "seriesId": sid,
            "info": {
                "id": sid,
                "title": meta["name"] if meta else sid,
                "frequency": meta.get("frequency", "Monthly") if meta else "Monthly",
                "units": meta.get("units", "") if meta else "",
            },
            "latest": latest,
            "observations": observations,
            "count": len(observations),
        }

    # If single series, unwrap
    if len(series_ids) == 1 and series_ids[0] in results:
        return results[series_ids[0]]

    return {"series": results, "count": len(results)}


def fetch_bls_indicator(shorthand: str, years: int = 3) -> dict[str, Any]:
    """Convenience wrapper — fetch a popular BLS indicator by shorthand.

    Supported shorthands: cpi, core_cpi, unemployment, nonfarm_payrolls,
    ppi, avg_hourly_earnings, labor_force_participation, initial_claims,
    employment_population.
    """
    key_lower = shorthand.lower().strip()
    if key_lower in POPULAR_SERIES:
        series_id = POPULAR_SERIES[key_lower]["id"]
    else:
        # Treat as raw series ID
        series_id = shorthand

    now = datetime.now()
    return fetch_bls_series(
        [series_id],
        start_year=now.year - years,
        end_year=now.year,
    )


def list_popular_series() -> list[dict]:
    """Return the list of popular BLS series for easy access."""
    return [
        {"shorthand": k, **v}
        for k, v in POPULAR_SERIES.items()
    ]
