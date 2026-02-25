"""Options chain fetcher using yfinance (no API key required).

Fetches options chains with strikes, IV, volume, OI, and computes
approximate Greeks using Black-Scholes.
"""
from __future__ import annotations

import math
from datetime import datetime
from typing import Any

import yfinance as yf
from scipy.stats import norm


# ─── Black-Scholes Greeks ───

def _d1(S: float, K: float, T: float, r: float, sigma: float) -> float:
    if T <= 0 or sigma <= 0:
        return 0.0
    return (math.log(S / K) + (r + 0.5 * sigma**2) * T) / (sigma * math.sqrt(T))


def _d2(S: float, K: float, T: float, r: float, sigma: float) -> float:
    return _d1(S, K, T, r, sigma) - sigma * math.sqrt(T)


def _compute_greeks(
    S: float, K: float, T: float, r: float, sigma: float, option_type: str
) -> dict[str, float]:
    """Compute Black-Scholes Greeks for a single option."""
    if T <= 0 or sigma <= 0 or S <= 0 or K <= 0:
        return {"delta": 0, "gamma": 0, "theta": 0, "vega": 0, "rho": 0}

    d1 = _d1(S, K, T, r, sigma)
    d2 = _d2(S, K, T, r, sigma)
    sqrt_T = math.sqrt(T)

    if option_type == "call":
        delta = norm.cdf(d1)
        rho = K * T * math.exp(-r * T) * norm.cdf(d2) / 100
    else:
        delta = norm.cdf(d1) - 1
        rho = -K * T * math.exp(-r * T) * norm.cdf(-d2) / 100

    gamma = norm.pdf(d1) / (S * sigma * sqrt_T)
    vega = S * norm.pdf(d1) * sqrt_T / 100
    theta = (
        -(S * norm.pdf(d1) * sigma) / (2 * sqrt_T)
        - r * K * math.exp(-r * T) * (norm.cdf(d2) if option_type == "call" else norm.cdf(-d2))
    ) / 365

    return {
        "delta": round(delta, 4),
        "gamma": round(gamma, 6),
        "theta": round(theta, 4),
        "vega": round(vega, 4),
        "rho": round(rho, 4),
    }


# ─── Public API ───

def fetch_options_chain(ticker: str) -> dict[str, Any]:
    """Fetch the full options chain for a ticker via yfinance.

    Returns expiry dates, and for each expiry: calls and puts with
    strike, bid, ask, last, volume, OI, IV.
    """
    stock = yf.Ticker(ticker)

    try:
        expirations = stock.options
    except Exception:
        return {"error": f"No options data available for {ticker}"}

    if not expirations:
        return {"error": f"No options expirations found for {ticker}"}

    # Get current price for context
    info = stock.fast_info
    current_price = getattr(info, "last_price", None) or getattr(info, "previous_close", None)

    chains: list[dict] = []
    # Limit to nearest 5 expirations to keep payload reasonable
    for exp in expirations[:5]:
        try:
            chain = stock.option_chain(exp)
        except Exception:
            continue

        calls = []
        for _, row in chain.calls.iterrows():
            calls.append({
                "strike": round(float(row["strike"]), 2),
                "bid": round(float(row.get("bid", 0)), 2),
                "ask": round(float(row.get("ask", 0)), 2),
                "last": round(float(row.get("lastPrice", 0)), 2),
                "volume": int(row.get("volume", 0)) if not math.isnan(row.get("volume", 0)) else 0,
                "openInterest": int(row.get("openInterest", 0)) if not math.isnan(row.get("openInterest", 0)) else 0,
                "impliedVolatility": round(float(row.get("impliedVolatility", 0)), 4),
                "inTheMoney": bool(row.get("inTheMoney", False)),
            })

        puts = []
        for _, row in chain.puts.iterrows():
            puts.append({
                "strike": round(float(row["strike"]), 2),
                "bid": round(float(row.get("bid", 0)), 2),
                "ask": round(float(row.get("ask", 0)), 2),
                "last": round(float(row.get("lastPrice", 0)), 2),
                "volume": int(row.get("volume", 0)) if not math.isnan(row.get("volume", 0)) else 0,
                "openInterest": int(row.get("openInterest", 0)) if not math.isnan(row.get("openInterest", 0)) else 0,
                "impliedVolatility": round(float(row.get("impliedVolatility", 0)), 4),
                "inTheMoney": bool(row.get("inTheMoney", False)),
            })

        chains.append({
            "expiration": exp,
            "calls": calls,
            "puts": puts,
        })

    return {
        "ticker": ticker,
        "currentPrice": current_price,
        "expirations": expirations[:5],
        "chains": chains,
    }


def fetch_options_greeks(ticker: str, expiration: str | None = None) -> dict[str, Any]:
    """Fetch options chain with computed Greeks for the nearest expiration.

    Uses Black-Scholes with IV from yfinance. Risk-free rate defaults to 4.5%.
    """
    stock = yf.Ticker(ticker)

    try:
        expirations = stock.options
    except Exception:
        return {"error": f"No options data available for {ticker}"}

    if not expirations:
        return {"error": f"No options expirations found for {ticker}"}

    exp = expiration if expiration and expiration in expirations else expirations[0]

    info = stock.fast_info
    S = getattr(info, "last_price", None) or getattr(info, "previous_close", 0)
    if not S:
        return {"error": f"Cannot determine current price for {ticker}"}

    r = 0.045  # risk-free rate approximation
    exp_date = datetime.strptime(exp, "%Y-%m-%d")
    T = max((exp_date - datetime.now()).days / 365.0, 1 / 365)

    try:
        chain = stock.option_chain(exp)
    except Exception as e:
        return {"error": f"Failed to fetch chain for {exp}: {str(e)}"}

    calls_with_greeks = []
    for _, row in chain.calls.iterrows():
        K = float(row["strike"])
        iv = float(row.get("impliedVolatility", 0))
        greeks = _compute_greeks(S, K, T, r, iv, "call") if iv > 0 else {}
        calls_with_greeks.append({
            "strike": round(K, 2),
            "bid": round(float(row.get("bid", 0)), 2),
            "ask": round(float(row.get("ask", 0)), 2),
            "last": round(float(row.get("lastPrice", 0)), 2),
            "volume": int(row.get("volume", 0)) if not math.isnan(row.get("volume", 0)) else 0,
            "openInterest": int(row.get("openInterest", 0)) if not math.isnan(row.get("openInterest", 0)) else 0,
            "iv": round(iv, 4),
            **greeks,
        })

    puts_with_greeks = []
    for _, row in chain.puts.iterrows():
        K = float(row["strike"])
        iv = float(row.get("impliedVolatility", 0))
        greeks = _compute_greeks(S, K, T, r, iv, "put") if iv > 0 else {}
        puts_with_greeks.append({
            "strike": round(K, 2),
            "bid": round(float(row.get("bid", 0)), 2),
            "ask": round(float(row.get("ask", 0)), 2),
            "last": round(float(row.get("lastPrice", 0)), 2),
            "volume": int(row.get("volume", 0)) if not math.isnan(row.get("volume", 0)) else 0,
            "openInterest": int(row.get("openInterest", 0)) if not math.isnan(row.get("openInterest", 0)) else 0,
            "iv": round(iv, 4),
            **greeks,
        })

    return {
        "ticker": ticker,
        "currentPrice": round(S, 2),
        "expiration": exp,
        "daysToExpiry": max((exp_date - datetime.now()).days, 0),
        "riskFreeRate": r,
        "calls": calls_with_greeks,
        "puts": puts_with_greeks,
    }
