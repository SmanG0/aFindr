"""Stock data fetcher using yfinance for quotes, fundamentals, and analyst data."""
from __future__ import annotations

import math
import time
from typing import Optional, Dict, Any

import yfinance as yf


def _safe_float(v) -> Optional[float]:
    """Convert a value to float, returning None for NaN/Inf/missing."""
    if v is None:
        return None
    try:
        f = float(v)
        if math.isnan(f) or math.isinf(f):
            return None
        return f
    except (TypeError, ValueError):
        return None

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
            "divYield": f"{round(info.get('dividendYield', 0), 2)}%" if info.get("dividendYield") else "-",
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
    """Format large numbers with K/M/B suffixes and $ prefix (for dollar amounts)."""
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


def _format_large_count(n) -> str:
    """Format large numbers with K/M/B suffixes (no $ prefix — for share counts etc.)."""
    if n is None:
        return "-"
    if n >= 1_000_000_000:
        return f"{n / 1_000_000_000:.2f}B"
    if n >= 1_000_000:
        return f"{n / 1_000_000:.2f}M"
    if n >= 1_000:
        return f"{n / 1_000:.0f}K"
    return str(int(n))


def fetch_stock_detail_full(ticker: str) -> Optional[Dict[str, Any]]:
    """Fetch comprehensive stock detail: quote, fundamentals, earnings, analyst data, ownership."""
    cache_key = f"detail_full:{ticker}"
    if cache_key in _quote_cache and _is_fresh(_quote_cache[cache_key], INFO_CACHE_TTL):
        return _quote_cache[cache_key]["data"]

    try:
        stock = yf.Ticker(ticker)
        info = stock.info or {}

        if not info.get("regularMarketPrice") and not info.get("currentPrice"):
            return None

        price = info.get("regularMarketPrice", info.get("currentPrice", 0))
        prev_close = info.get("previousClose", price)
        change = round(price - prev_close, 2)
        change_pct = round((change / prev_close * 100) if prev_close else 0, 2)

        fmt_large = _format_large_number
        fmt_count = _format_large_count
        def fmt_pct(v):
            """Format ratio → percentage (e.g. 0.27 → '27.0%')."""
            v = _safe_float(v)
            if v is None:
                return "-"
            return f"{round(v * 100, 2)}%"
        def fmt_pct_already(v):
            """Format value that yfinance already returns as a percentage (e.g. 0.39 → '0.39%')."""
            v = _safe_float(v)
            if v is None:
                return "-"
            return f"{round(v, 2)}%"
        def fmt_num(v, decimals=2):
            v = _safe_float(v)
            if v is None:
                return "-"
            return str(round(v, decimals))

        # Officers / CEO
        officers = info.get("companyOfficers", [])
        ceo = "-"
        for o in officers:
            if "ceo" in (o.get("title", "") or "").lower():
                ceo = o.get("name", "-")
                break
        if ceo == "-" and officers:
            ceo = officers[0].get("name", "-")

        # Earnings data
        earnings_history = []
        yearly_financials = []
        quarterly_financials = []
        current_quarter_estimate = None
        current_quarter_date = ""
        next_earnings_date = "-"

        try:
            # earnings_dates gives us next earnings date + EPS history
            ed = stock.earnings_dates
            if ed is not None and not ed.empty:
                import datetime
                now = datetime.datetime.now(tz=datetime.timezone.utc)
                future_dates = ed.index[ed.index >= now]
                if len(future_dates) > 0:
                    next_earnings_date = str(future_dates[0].strftime("%Y-%m-%d"))

                # EPS history from earnings_dates (has estimate, actual, surprise)
                for idx, row in ed.iterrows():
                    reported = row.get("Reported EPS")
                    estimate = row.get("EPS Estimate")
                    # Format as "Q1 2025" style
                    month = idx.month if hasattr(idx, "month") else 0
                    year = idx.year if hasattr(idx, "year") else 0
                    q_num = (month - 1) // 3 + 1
                    quarter_label = f"Q{q_num} {year}" if year else str(idx)[:10]
                    actual_val = _safe_float(reported)
                    estimate_val = _safe_float(estimate)
                    if actual_val is None:
                        continue
                    earnings_history.append({
                        "quarter": quarter_label,
                        "actual": round(actual_val, 2),
                        "estimate": round(estimate_val, 2) if estimate_val is not None else None,
                    })
                earnings_history = earnings_history[:8]  # limit to 8 quarters
        except Exception:
            pass

        try:
            # Yearly financials from income_stmt (replaces deprecated stock.earnings)
            yi = stock.income_stmt
            if yi is not None and not yi.empty:
                for col in yi.columns:
                    rev = yi.loc["Total Revenue", col] if "Total Revenue" in yi.index else None
                    ni = yi.loc["Net Income", col] if "Net Income" in yi.index else None
                    year_str = str(col.year) if hasattr(col, "year") else str(col)[:4]
                    yearly_financials.append({
                        "year": year_str,
                        "revenue": _safe_float(rev),
                        "earnings": _safe_float(ni),
                    })
        except Exception:
            pass

        try:
            # Quarterly financials from quarterly_income_stmt
            qi = stock.quarterly_income_stmt
            if qi is not None and not qi.empty:
                for col in qi.columns[:4]:
                    rev = qi.loc["Total Revenue", col] if "Total Revenue" in qi.index else None
                    ni = qi.loc["Net Income", col] if "Net Income" in qi.index else None
                    month = col.month if hasattr(col, "month") else 0
                    year = col.year if hasattr(col, "year") else 0
                    q_num = (month - 1) // 3 + 1
                    q_label = f"Q{q_num} {year}" if year else str(col)[:10]
                    quarterly_financials.append({
                        "quarter": q_label,
                        "revenue": _safe_float(rev),
                        "earnings": _safe_float(ni),
                    })
        except Exception:
            pass

        # Analyst recommendations (upgrade/downgrade history)
        recent_ratings = []
        try:
            recs = stock.upgrades_downgrades
            if recs is not None and not recs.empty:
                for idx, row in recs.head(8).iterrows():
                    recent_ratings.append({
                        "firm": str(row.get("Firm", "-")),
                        "toGrade": str(row.get("ToGrade", "-")),
                        "fromGrade": str(row.get("FromGrade", "-")),
                        "action": str(row.get("Action", "-")).lower(),
                        "date": str(idx.strftime("%Y-%m-%d")) if hasattr(idx, "strftime") else str(idx)[:10],
                    })
        except Exception:
            pass

        # Analyst ratings aggregate
        buy_count = 0
        hold_count = 0
        sell_count = 0
        try:
            recs_summary = stock.recommendations
            if recs_summary is not None and not recs_summary.empty:
                latest = recs_summary.iloc[0] if len(recs_summary) > 0 else None
                if latest is not None:
                    buy_count = int(latest.get("strongBuy", 0) or 0) + int(latest.get("buy", 0) or 0)
                    hold_count = int(latest.get("hold", 0) or 0)
                    sell_count = int(latest.get("sell", 0) or 0) + int(latest.get("strongSell", 0) or 0)
        except Exception:
            pass
        total_ratings = buy_count + hold_count + sell_count

        # Peers
        peers = []
        sector_peers = _get_sector_peers(ticker, info.get("sector"), info.get("industry"))
        for peer_sym in sector_peers[:5]:
            pq = fetch_stock_quote(peer_sym)
            if pq:
                peers.append({
                    "ticker": pq["ticker"],
                    "name": pq["name"],
                    "price": pq["price"],
                    "change": pq["change"],
                    "changePct": pq["changePct"],
                })

        # Calendar events
        ex_dividend_date = "-"
        dividend_date = "-"
        try:
            cal = stock.calendar
            if cal:
                if isinstance(cal, dict):
                    ed_val = cal.get("Ex-Dividend Date")
                    if ed_val:
                        ex_dividend_date = str(ed_val)[:10]
                    dd_val = cal.get("Dividend Date")
                    if dd_val:
                        dividend_date = str(dd_val)[:10]
        except Exception:
            pass

        data = {
            "ticker": ticker.upper(),
            "name": info.get("shortName", info.get("longName", ticker)),
            "price": round(price, 2),
            "change": change,
            "changePct": change_pct,
            "prevClose": round(prev_close, 2),
            # About
            "description": info.get("longBusinessSummary", ""),
            "ceo": ceo,
            "employees": info.get("fullTimeEmployees", 0) or 0,
            "headquarters": ", ".join(filter(None, [info.get("city"), info.get("state"), info.get("country")])) or "-",
            "founded": "-",
            "industry": info.get("industry", "-") or "-",
            "website": info.get("website", "-") or "-",
            # Key Stats
            "marketCap": fmt_large(info.get("marketCap")),
            "peRatio": fmt_num(info.get("trailingPE")),
            "dividendYield": fmt_pct_already(info.get("dividendYield")),
            "avgVolume": fmt_large(info.get("averageDailyVolume10Day")),
            "volume": fmt_large(info.get("regularMarketVolume")),
            "dayHigh": round(_safe_float(info.get("dayHigh")) or 0, 2),
            "dayLow": round(_safe_float(info.get("dayLow")) or 0, 2),
            "open": round(_safe_float(info.get("regularMarketOpen") or info.get("open")) or 0, 2),
            "week52High": round(_safe_float(info.get("fiftyTwoWeekHigh")) or 0, 2),
            "week52Low": round(_safe_float(info.get("fiftyTwoWeekLow")) or 0, 2),
            "shortFloat": fmt_pct(info.get("shortPercentOfFloat")),
            # Valuation
            "forwardPE": fmt_num(info.get("forwardPE")),
            "pegRatio": fmt_num(info.get("pegRatio")),
            "priceToBook": fmt_num(info.get("priceToBook")),
            "priceToSales": fmt_num(info.get("priceToSalesTrailing12Months")),
            "enterpriseValue": fmt_large(info.get("enterpriseValue")),
            "evToRevenue": fmt_num(info.get("enterpriseToRevenue")),
            "evToEBITDA": fmt_num(info.get("enterpriseToEbitda")),
            "bookValue": fmt_num(info.get("bookValue")),
            # Profitability
            "profitMargin": fmt_pct(info.get("profitMargins")),
            "operatingMargin": fmt_pct(info.get("operatingMargins")),
            "grossMargin": fmt_pct(info.get("grossMargins")),
            "returnOnEquity": fmt_pct(info.get("returnOnEquity")),
            "returnOnAssets": fmt_pct(info.get("returnOnAssets")),
            "revenuePerShare": fmt_num(info.get("revenuePerShare")),
            "totalRevenue": fmt_large(info.get("totalRevenue")),
            "netIncome": fmt_large(info.get("netIncomeToCommon")),
            "freeCashFlow": fmt_large(info.get("freeCashflow")),
            "operatingCashFlow": fmt_large(info.get("operatingCashflow")),
            "totalCash": fmt_large(info.get("totalCash")),
            "totalDebt": fmt_large(info.get("totalDebt")),
            # Balance Sheet
            "debtToEquity": fmt_num(info.get("debtToEquity")),
            "currentRatio": fmt_num(info.get("currentRatio")),
            "quickRatio": fmt_num(info.get("quickRatio")),
            # Technical
            "beta": fmt_num(info.get("beta")),
            "fiftyDayMA": fmt_num(info.get("fiftyDayAverage")),
            "twoHundredDayMA": fmt_num(info.get("twoHundredDayAverage")),
            # EPS
            "trailingEPS": fmt_num(info.get("trailingEps")),
            "forwardEPS": fmt_num(info.get("forwardEps")),
            # Shares
            "sharesOutstanding": fmt_count(info.get("sharesOutstanding")),
            "floatShares": fmt_count(info.get("floatShares")),
            "shortRatio": fmt_num(info.get("shortRatio")),
            "sharesShort": fmt_count(info.get("sharesShort")),
            # Ownership
            "insiderPercent": fmt_pct(info.get("heldPercentInsiders")),
            "institutionalPercent": fmt_pct(info.get("heldPercentInstitutions")),
            # Price Targets
            "targetMeanPrice": _safe_float(info.get("targetMeanPrice")),
            "targetMedianPrice": _safe_float(info.get("targetMedianPrice")),
            "targetHighPrice": _safe_float(info.get("targetHighPrice")),
            "targetLowPrice": _safe_float(info.get("targetLowPrice")),
            "numberOfAnalysts": int(_safe_float(info.get("numberOfAnalystOpinions")) or 0),
            "recommendationKey": info.get("recommendationKey", "-") or "-",
            # Dividends
            "exDividendDate": ex_dividend_date,
            "dividendDate": dividend_date,
            # Earnings
            "nextEarningsDate": next_earnings_date,
            "earningsHistory": earnings_history,
            "currentQuarterEstimate": current_quarter_estimate,
            "currentQuarterDate": current_quarter_date,
            "yearlyFinancials": yearly_financials[-4:],  # last 4 years
            "quarterlyFinancials": quarterly_financials[-4:],  # last 4 quarters
            # Analyst Ratings
            "analystRatings": {
                "buy": buy_count,
                "hold": hold_count,
                "sell": sell_count,
                "total": total_ratings,
                "buyPercent": round((buy_count / total_ratings * 1000) / 10, 1) if total_ratings > 0 else 0,
                "holdPercent": round((hold_count / total_ratings * 1000) / 10, 1) if total_ratings > 0 else 0,
                "sellPercent": round((sell_count / total_ratings * 1000) / 10, 1) if total_ratings > 0 else 0,
            },
            "recentRatings": recent_ratings,
            # Peers & Meta
            "peers": peers,
            "exchange": info.get("exchange", "-") or "-",
            "sector": info.get("sector", "-") or "-",
        }

        _quote_cache[cache_key] = {"data": data, "timestamp": time.time()}
        return data
    except Exception:
        return None


def fetch_stock_news(ticker: str, limit: int = 15) -> Dict[str, Any]:
    """Fetch recent news for a ticker via yfinance.

    Returns headlines, publisher, link, and publish time.
    """
    try:
        stock = yf.Ticker(ticker)
        news = stock.news
        if not news:
            return {"ticker": ticker, "news": [], "newsCount": 0}

        articles = []
        for item in news[:limit]:
            articles.append({
                "headline": item.get("title", ""),
                "source": item.get("publisher", ""),
                "url": item.get("link", ""),
                "datetime": item.get("providerPublishTime"),
                "summary": "",
                "related": ticker.upper(),
            })

        return {
            "ticker": ticker,
            "newsCount": len(articles),
            "news": articles,
            "source": "yfinance",
        }
    except Exception:
        return {"ticker": ticker, "news": [], "newsCount": 0}


def fetch_earnings_dates_free(ticker: str) -> Dict[str, Any]:
    """Fetch upcoming and recent earnings dates via yfinance.

    Free fallback when Finnhub is unavailable.
    """
    try:
        import datetime as dt
        stock = yf.Ticker(ticker)
        ed = stock.earnings_dates

        if ed is None or ed.empty:
            return {"ticker": ticker, "earnings": [], "earningsCount": 0, "source": "yfinance"}

        now = dt.datetime.now(tz=dt.timezone.utc)
        earnings = []

        for idx, row in ed.iterrows():
            eps_estimate = _safe_float(row.get("EPS Estimate"))
            eps_actual = _safe_float(row.get("Reported EPS"))
            surprise_pct = _safe_float(row.get("Surprise(%)"))

            month = idx.month if hasattr(idx, "month") else 0
            year = idx.year if hasattr(idx, "year") else 0
            q_num = (month - 1) // 3 + 1

            earnings.append({
                "date": str(idx.strftime("%Y-%m-%d")) if hasattr(idx, "strftime") else str(idx)[:10],
                "epsEstimate": round(eps_estimate, 2) if eps_estimate is not None else None,
                "epsActual": round(eps_actual, 2) if eps_actual is not None else None,
                "surprisePct": round(surprise_pct, 2) if surprise_pct is not None else None,
                "quarter": f"Q{q_num}" if q_num else None,
                "year": year or None,
                "symbol": ticker.upper(),
            })

        # Find next earnings date
        future = [e for e in earnings if e["date"] > now.strftime("%Y-%m-%d")]
        next_date = future[0]["date"] if future else None

        return {
            "ticker": ticker,
            "earningsCount": len(earnings),
            "earnings": earnings[:12],
            "nextEarningsDate": next_date,
            "source": "yfinance",
        }
    except Exception:
        return {"ticker": ticker, "earnings": [], "earningsCount": 0, "source": "yfinance"}


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
