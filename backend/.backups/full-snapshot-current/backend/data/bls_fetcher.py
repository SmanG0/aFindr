"""BLS (Bureau of Labor Statistics) API v2 fetcher.

Provides labor market, inflation, wage, productivity, and industry-level data
that FRED does not cover. Requires BLS_API_KEY environment variable
(free at https://www.bls.gov/developers/).
500 queries/day, 50 series/query, 20 years of data.
"""
from __future__ import annotations

import os
from datetime import datetime
from typing import Any

import httpx

_BASE = "https://api.bls.gov/publicAPI/v2/timeseries/data/"

# ──────────────────────────────────────────────────────────────────────
# BLS Series Catalog — grouped by program
#
# FOCUS: series that FRED does NOT cover or covers poorly.
# Overlap notes: CPI/unemployment/nonfarm_payrolls also exist in FRED
# but are kept here so the agent can route BLS-specific questions.
# ──────────────────────────────────────────────────────────────────────

POPULAR_SERIES: dict[str, dict[str, str]] = {
    # ── Current Employment Statistics (CES) ──
    "nonfarm_payrolls": {
        "id": "CES0000000001",
        "name": "Total Nonfarm Payrolls",
        "units": "Thousands of Persons",
        "frequency": "Monthly",
        "category": "employment",
    },
    "private_payrolls": {
        "id": "CES0500000001",
        "name": "Total Private Payrolls",
        "units": "Thousands of Persons",
        "frequency": "Monthly",
        "category": "employment",
    },
    "avg_hourly_earnings": {
        "id": "CES0500000003",
        "name": "Average Hourly Earnings — All Private Employees",
        "units": "Dollars per Hour",
        "frequency": "Monthly",
        "category": "wages",
    },
    "avg_weekly_hours": {
        "id": "CES0500000002",
        "name": "Average Weekly Hours — All Private Employees",
        "units": "Hours",
        "frequency": "Monthly",
        "category": "employment",
    },
    "avg_weekly_earnings": {
        "id": "CES0500000011",
        "name": "Average Weekly Earnings — All Private Employees",
        "units": "Dollars",
        "frequency": "Monthly",
        "category": "wages",
    },
    "manufacturing_payrolls": {
        "id": "CES3000000001",
        "name": "Manufacturing Payrolls",
        "units": "Thousands of Persons",
        "frequency": "Monthly",
        "category": "employment",
    },
    "construction_payrolls": {
        "id": "CES2000000001",
        "name": "Construction Payrolls",
        "units": "Thousands of Persons",
        "frequency": "Monthly",
        "category": "employment",
    },
    "healthcare_payrolls": {
        "id": "CES6562000001",
        "name": "Health Care Payrolls",
        "units": "Thousands of Persons",
        "frequency": "Monthly",
        "category": "employment",
    },
    "tech_payrolls": {
        "id": "CES5051200001",
        "name": "Information Sector Payrolls (Tech)",
        "units": "Thousands of Persons",
        "frequency": "Monthly",
        "category": "employment",
    },
    "leisure_payrolls": {
        "id": "CES7000000001",
        "name": "Leisure & Hospitality Payrolls",
        "units": "Thousands of Persons",
        "frequency": "Monthly",
        "category": "employment",
    },
    "govt_payrolls": {
        "id": "CES9000000001",
        "name": "Government Payrolls",
        "units": "Thousands of Persons",
        "frequency": "Monthly",
        "category": "employment",
    },

    # ── Current Population Survey (CPS) — Labor Force ──
    "unemployment": {
        "id": "LNS14000000",
        "name": "Unemployment Rate",
        "units": "Percent",
        "frequency": "Monthly",
        "category": "labor_force",
    },
    "u6_unemployment": {
        "id": "LNS13327709",
        "name": "U-6 Unemployment Rate (Total Underemployment)",
        "units": "Percent",
        "frequency": "Monthly",
        "category": "labor_force",
    },
    "labor_force_participation": {
        "id": "LNS11300000",
        "name": "Labor Force Participation Rate",
        "units": "Percent",
        "frequency": "Monthly",
        "category": "labor_force",
    },
    "employment_population": {
        "id": "LNS12300000",
        "name": "Employment-Population Ratio",
        "units": "Percent",
        "frequency": "Monthly",
        "category": "labor_force",
    },
    "long_term_unemployed": {
        "id": "LNS13025703",
        "name": "Unemployed 27 Weeks and Over",
        "units": "Thousands of Persons",
        "frequency": "Monthly",
        "category": "labor_force",
    },
    "part_time_economic": {
        "id": "LNS12032194",
        "name": "Part-Time for Economic Reasons",
        "units": "Thousands of Persons",
        "frequency": "Monthly",
        "category": "labor_force",
    },
    "median_weeks_unemployed": {
        "id": "LNS13008276",
        "name": "Median Weeks Unemployed",
        "units": "Weeks",
        "frequency": "Monthly",
        "category": "labor_force",
    },
    "prime_age_lfpr": {
        "id": "LNS11300060",
        "name": "Prime-Age (25-54) Labor Force Participation",
        "units": "Percent",
        "frequency": "Monthly",
        "category": "labor_force",
    },

    # ── JOLTS (Job Openings and Labor Turnover Survey) ── BLS EXCLUSIVE
    "job_openings": {
        "id": "JTS000000000000000JOL",
        "name": "JOLTS — Total Job Openings",
        "units": "Thousands",
        "frequency": "Monthly",
        "category": "jolts",
    },
    "jolts_hires": {
        "id": "JTS000000000000000HIL",
        "name": "JOLTS — Total Hires",
        "units": "Thousands",
        "frequency": "Monthly",
        "category": "jolts",
    },
    "jolts_quits": {
        "id": "JTS000000000000000QUL",
        "name": "JOLTS — Total Quits (Quit Rate Proxy)",
        "units": "Thousands",
        "frequency": "Monthly",
        "category": "jolts",
    },
    "jolts_layoffs": {
        "id": "JTS000000000000000LDL",
        "name": "JOLTS — Layoffs & Discharges",
        "units": "Thousands",
        "frequency": "Monthly",
        "category": "jolts",
    },
    "jolts_separations": {
        "id": "JTS000000000000000TSL",
        "name": "JOLTS — Total Separations",
        "units": "Thousands",
        "frequency": "Monthly",
        "category": "jolts",
    },

    # ── Consumer Price Index (CPI) ──
    "cpi": {
        "id": "CUSR0000SA0",
        "name": "CPI — All Urban Consumers (Seasonally Adjusted)",
        "units": "Index (1982-84=100)",
        "frequency": "Monthly",
        "category": "inflation",
    },
    "core_cpi": {
        "id": "CUSR0000SA0L1E",
        "name": "CPI — All Items Less Food and Energy",
        "units": "Index (1982-84=100)",
        "frequency": "Monthly",
        "category": "inflation",
    },
    "cpi_food": {
        "id": "CUSR0000SAF1",
        "name": "CPI — Food",
        "units": "Index (1982-84=100)",
        "frequency": "Monthly",
        "category": "inflation",
    },
    "cpi_energy": {
        "id": "CUSR0000SA0E",
        "name": "CPI — Energy",
        "units": "Index (1982-84=100)",
        "frequency": "Monthly",
        "category": "inflation",
    },
    "cpi_shelter": {
        "id": "CUSR0000SAH1",
        "name": "CPI — Shelter (Housing)",
        "units": "Index (1982-84=100)",
        "frequency": "Monthly",
        "category": "inflation",
    },
    "cpi_medical": {
        "id": "CUSR0000SAM",
        "name": "CPI — Medical Care",
        "units": "Index (1982-84=100)",
        "frequency": "Monthly",
        "category": "inflation",
    },
    "cpi_transport": {
        "id": "CUSR0000SAT",
        "name": "CPI — Transportation",
        "units": "Index (1982-84=100)",
        "frequency": "Monthly",
        "category": "inflation",
    },
    "cpi_services": {
        "id": "CUSR0000SAS",
        "name": "CPI — Services (Super Sticky)",
        "units": "Index (1982-84=100)",
        "frequency": "Monthly",
        "category": "inflation",
    },

    # ── Producer Price Index (PPI) ──
    "ppi": {
        "id": "WPSFD4",
        "name": "PPI — Finished Goods",
        "units": "Index (1982=100)",
        "frequency": "Monthly",
        "category": "inflation",
    },
    "ppi_final_demand": {
        "id": "WPUFD4",
        "name": "PPI — Final Demand",
        "units": "Index (Nov 2009=100)",
        "frequency": "Monthly",
        "category": "inflation",
    },

    # ── Import/Export Price Indexes ── BLS EXCLUSIVE
    "import_prices": {
        "id": "EIUIR",
        "name": "Import Price Index — All Imports",
        "units": "Index (2000=100)",
        "frequency": "Monthly",
        "category": "trade",
    },
    "export_prices": {
        "id": "EIUIQ",
        "name": "Export Price Index — All Exports",
        "units": "Index (2000=100)",
        "frequency": "Monthly",
        "category": "trade",
    },
    "import_fuel": {
        "id": "EIUIR1",
        "name": "Import Price Index — Fuels",
        "units": "Index (2000=100)",
        "frequency": "Monthly",
        "category": "trade",
    },
    "import_nonfuel": {
        "id": "EIUIR2",
        "name": "Import Price Index — All Non-Fuel",
        "units": "Index (2000=100)",
        "frequency": "Monthly",
        "category": "trade",
    },

    # ── Employment Cost Index (ECI) ── BLS EXCLUSIVE
    "eci_total": {
        "id": "CIU1010000000000A",
        "name": "Employment Cost Index — Total Compensation",
        "units": "Index (Dec 2005=100)",
        "frequency": "Quarterly",
        "category": "wages",
    },
    "eci_wages": {
        "id": "CIU2010000000000A",
        "name": "Employment Cost Index — Wages & Salaries",
        "units": "Index (Dec 2005=100)",
        "frequency": "Quarterly",
        "category": "wages",
    },
    "eci_benefits": {
        "id": "CIU3010000000000A",
        "name": "Employment Cost Index — Benefits",
        "units": "Index (Dec 2005=100)",
        "frequency": "Quarterly",
        "category": "wages",
    },

    # ── Productivity & Costs ── BLS EXCLUSIVE
    "productivity": {
        "id": "PRS85006092",
        "name": "Nonfarm Business Labor Productivity",
        "units": "Index (2012=100)",
        "frequency": "Quarterly",
        "category": "productivity",
    },
    "unit_labor_costs": {
        "id": "PRS85006112",
        "name": "Nonfarm Business Unit Labor Costs",
        "units": "Index (2012=100)",
        "frequency": "Quarterly",
        "category": "productivity",
    },
    "real_compensation": {
        "id": "PRS85006152",
        "name": "Nonfarm Business Real Compensation Per Hour",
        "units": "Index (2012=100)",
        "frequency": "Quarterly",
        "category": "productivity",
    },

    # ── Work Stoppages ── BLS EXCLUSIVE
    "work_stoppages": {
        "id": "WSU001",
        "name": "Work Stoppages — Number of Stoppages",
        "units": "Count",
        "frequency": "Annual",
        "category": "labor_relations",
    },
}

# Category descriptions for the agent
CATEGORY_DESCRIPTIONS = {
    "employment": "Payroll employment data by sector (nonfarm, private, manufacturing, construction, tech, healthcare, etc.)",
    "labor_force": "Household survey: unemployment rates (U-3, U-6), participation, employment ratios, duration of unemployment",
    "jolts": "Job Openings & Labor Turnover: openings, hires, quits, layoffs — key Fed indicators (BLS exclusive)",
    "inflation": "CPI & PPI sub-components: food, energy, shelter, medical, transportation, services — granular inflation breakdown",
    "trade": "Import/Export price indexes: all imports, fuels, non-fuel — tariff and trade impact data (BLS exclusive)",
    "wages": "Employment Cost Index and earnings: total compensation, wages vs benefits breakdown (BLS exclusive)",
    "productivity": "Labor productivity, unit labor costs, real compensation — efficiency and cost pressure metrics (BLS exclusive)",
    "labor_relations": "Work stoppages (strikes/lockouts) — labor unrest indicator (BLS exclusive)",
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
    """Fetch a BLS indicator by shorthand or raw series ID.

    See POPULAR_SERIES keys for all available shorthands.
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


def fetch_bls_multi(shorthands: list[str], years: int = 3) -> dict[str, Any]:
    """Fetch multiple BLS series in a single API call (max 50).

    Returns a dict with each series keyed by shorthand.
    Useful for comparing indicators (e.g. job_openings vs jolts_quits).
    """
    series_ids = []
    id_to_shorthand: dict[str, str] = {}

    for s in shorthands[:50]:
        key = s.lower().strip()
        if key in POPULAR_SERIES:
            sid = POPULAR_SERIES[key]["id"]
        else:
            sid = s
        series_ids.append(sid)
        id_to_shorthand[sid] = key

    now = datetime.now()
    result = fetch_bls_series(
        series_ids,
        start_year=now.year - years,
        end_year=now.year,
    )

    if "error" in result:
        return result

    # Re-key by shorthand for easier agent consumption
    if "series" in result:
        rekeyed = {}
        for sid, data in result["series"].items():
            shorthand_key = id_to_shorthand.get(sid, sid)
            rekeyed[shorthand_key] = data
        return {"series": rekeyed, "count": len(rekeyed)}

    return result


def list_popular_series() -> list[dict]:
    """Return the list of popular BLS series for easy access."""
    return [
        {"shorthand": k, **v}
        for k, v in POPULAR_SERIES.items()
    ]


def list_categories() -> dict[str, Any]:
    """Return series grouped by category with descriptions."""
    grouped: dict[str, list[dict]] = {}
    for shorthand, info in POPULAR_SERIES.items():
        cat = info.get("category", "other")
        if cat not in grouped:
            grouped[cat] = []
        grouped[cat].append({"shorthand": shorthand, "name": info["name"]})

    return {
        cat: {
            "description": CATEGORY_DESCRIPTIONS.get(cat, ""),
            "series": items,
        }
        for cat, items in grouped.items()
    }
