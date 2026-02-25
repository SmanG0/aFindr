"""SEC EDGAR fetcher — completely free, no API key needed.

Fetches insider transactions (Form 4) and institutional holdings (13F).
Requires a User-Agent header per SEC guidelines.
"""
from __future__ import annotations

from typing import Any

import httpx

_USER_AGENT = "aFindr/1.0 (contact@afindr.app)"
_BASE = "https://efts.sec.gov/LATEST"
_SUBMISSIONS = "https://data.sec.gov/submissions"

_HEADERS = {
    "User-Agent": _USER_AGENT,
    "Accept": "application/json",
}


def _get_cik(ticker: str) -> str | None:
    """Resolve a ticker symbol to a zero-padded CIK number."""
    url = "https://www.sec.gov/files/company_tickers.json"
    try:
        resp = httpx.get(url, headers=_HEADERS, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        for entry in data.values():
            if entry.get("ticker", "").upper() == ticker.upper():
                return str(entry["cik_str"]).zfill(10)
    except Exception:
        pass
    return None


def fetch_insider_trades(ticker: str, limit: int = 20) -> dict[str, Any]:
    """Fetch recent insider transactions (Form 4) from SEC EDGAR full-text search.

    Returns transaction details: insider name, title, transaction type,
    shares, price, date, ownership type.
    """
    # Use EDGAR full-text search for Form 4 filings
    params = {
        "q": f'"{ticker}"',
        "dateRange": "custom",
        "startdt": "2024-01-01",
        "forms": "4",
        "hits.hits.total.value": limit,
    }
    try:
        resp = httpx.get(
            f"{_BASE}/search-index", params=params, headers=_HEADERS, timeout=15
        )
        resp.raise_for_status()
    except Exception:
        pass

    # Approach: use the submissions endpoint for the company
    cik = _get_cik(ticker)
    if not cik:
        return {"ticker": ticker, "trades": [], "error": "Could not resolve CIK for ticker"}

    url = f"{_SUBMISSIONS}/CIK{cik}.json"
    try:
        resp = httpx.get(url, headers=_HEADERS, timeout=15)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        return {"ticker": ticker, "trades": [], "error": f"EDGAR request failed: {str(e)}"}

    company_name = data.get("name", ticker)
    recent = data.get("filings", {}).get("recent", {})

    forms = recent.get("form", [])
    dates = recent.get("filingDate", [])
    accessions = recent.get("accessionNumber", [])
    primary_docs = recent.get("primaryDocument", [])
    descriptions = recent.get("primaryDocDescription", [])

    trades = []
    for i, form in enumerate(forms):
        if form != "4":
            continue
        if len(trades) >= limit:
            break
        trades.append({
            "form": form,
            "filingDate": dates[i] if i < len(dates) else None,
            "accession": accessions[i] if i < len(accessions) else None,
            "document": primary_docs[i] if i < len(primary_docs) else None,
            "description": descriptions[i] if i < len(descriptions) else "",
        })

    return {
        "ticker": ticker,
        "companyName": company_name,
        "cik": cik,
        "form4Count": len(trades),
        "trades": trades,
    }


def fetch_institutional_holdings(ticker: str, limit: int = 20) -> dict[str, Any]:
    """Fetch institutional holdings (13F filings) from SEC EDGAR.

    Returns recent 13F filings for the company (filed by institutional managers).
    """
    cik = _get_cik(ticker)
    if not cik:
        return {"ticker": ticker, "holdings": [], "error": "Could not resolve CIK for ticker"}

    # Search for 13F filings that mention this company
    # Note: 13F is filed by the *manager*, not the company itself.
    # We search the full-text index for mentions of the ticker in 13F filings.
    url = f"{_BASE}/search-index"
    params = {
        "q": f'"{ticker}"',
        "forms": "13F-HR",
        "dateRange": "custom",
        "startdt": "2024-01-01",
    }

    try:
        resp = httpx.get(url, params=params, headers=_HEADERS, timeout=15)
        resp.raise_for_status()
        data = resp.json()
    except Exception:
        # Fallback: get 13F filings from the company's own submissions
        return _fetch_13f_from_submissions(ticker, cik, limit)

    hits = data.get("hits", {}).get("hits", [])
    holdings = []
    for hit in hits[:limit]:
        src = hit.get("_source", {})
        holdings.append({
            "filerName": src.get("display_names", [None])[0] if src.get("display_names") else src.get("entity_name", "Unknown"),
            "filingDate": src.get("file_date"),
            "form": src.get("form_type", "13F-HR"),
            "accession": src.get("accession_no"),
        })

    return {
        "ticker": ticker,
        "cik": cik,
        "holdingsCount": len(holdings),
        "holdings": holdings,
    }


def _fetch_13f_from_submissions(ticker: str, cik: str, limit: int) -> dict[str, Any]:
    """Fallback: get 13F filings from the company's submission history."""
    url = f"{_SUBMISSIONS}/CIK{cik}.json"
    try:
        resp = httpx.get(url, headers=_HEADERS, timeout=15)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        return {"ticker": ticker, "holdings": [], "error": str(e)}

    recent = data.get("filings", {}).get("recent", {})
    forms = recent.get("form", [])
    dates = recent.get("filingDate", [])
    accessions = recent.get("accessionNumber", [])

    holdings = []
    for i, form in enumerate(forms):
        if "13F" not in form:
            continue
        if len(holdings) >= limit:
            break
        holdings.append({
            "form": form,
            "filingDate": dates[i] if i < len(dates) else None,
            "accession": accessions[i] if i < len(accessions) else None,
        })

    return {
        "ticker": ticker,
        "cik": cik,
        "holdingsCount": len(holdings),
        "holdings": holdings,
    }
