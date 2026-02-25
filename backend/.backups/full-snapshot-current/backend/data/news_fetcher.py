"""RSS news aggregator for financial news feeds.

Fetches and normalizes news from multiple RSS sources with in-memory caching.
"""
from __future__ import annotations

import re
import time
import hashlib
import concurrent.futures
from typing import Optional, List, Dict
from datetime import datetime, timezone

import feedparser

# ─── RSS Feed Sources ───

RSS_FEEDS: Dict[str, Dict] = {
    "reuters_business": {
        "url": "https://feeds.reuters.com/reuters/businessNews",
        "source": "Reuters",
        "category": "Markets",
    },
    "reuters_markets": {
        "url": "https://feeds.reuters.com/reuters/companyNews",
        "source": "Reuters",
        "category": "Markets",
    },
    "cnbc_top": {
        "url": "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114",
        "source": "CNBC",
        "category": "Markets",
    },
    "cnbc_markets": {
        "url": "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=20910258",
        "source": "CNBC",
        "category": "Markets",
    },
    "cnbc_economy": {
        "url": "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=20910258",
        "source": "CNBC",
        "category": "Macro",
    },
    "yahoo_finance": {
        "url": "https://feeds.finance.yahoo.com/rss/2.0/headline?s=^GSPC,^DJI,^IXIC&region=US&lang=en-US",
        "source": "Yahoo Finance",
        "category": "Markets",
    },
    "marketwatch": {
        "url": "https://feeds.marketwatch.com/marketwatch/topstories/",
        "source": "MarketWatch",
        "category": "Markets",
    },
    "seeking_alpha": {
        "url": "https://news.google.com/rss/search?q=site:seekingalpha.com+stock+market&hl=en-US&gl=US&ceid=US:en",
        "source": "Seeking Alpha",
        "category": "Markets",
    },
    "bloomberg_markets": {
        "url": "https://news.google.com/rss/search?q=site:bloomberg.com+markets&hl=en-US&gl=US&ceid=US:en",
        "source": "Bloomberg",
        "category": "Markets",
    },
}

# Ticker extraction regex
TICKER_PATTERN = re.compile(
    r'\b([A-Z]{1,5}(?:=F)?)\b'
)

# Known futures tickers to recognize
KNOWN_TICKERS = {
    "NQ", "ES", "GC", "CL", "YM", "RTY", "ZB", "ZN", "ZF", "ZT",
    "AAPL", "MSFT", "GOOGL", "GOOG", "AMZN", "TSLA", "NVDA", "META",
    "JPM", "BAC", "WFC", "GS", "MS", "C", "V", "MA",
    "SPY", "QQQ", "DIA", "IWM", "VTI", "XLF", "XLE", "XLK",
    "BTC", "ETH", "SOL",
}

# Category keywords for auto-categorization
CATEGORY_KEYWORDS = {
    "Futures": ["futures", "nq", "es=f", "gc=f", "cl=f", "e-mini", "micro", "cme"],
    "Commodities": ["oil", "gold", "silver", "copper", "natural gas", "crude", "commodity", "opec"],
    "Macro": ["fed", "rate", "inflation", "cpi", "gdp", "employment", "jobs", "treasury", "yield", "fomc", "economy"],
    "Earnings": ["earnings", "revenue", "eps", "quarterly", "profit", "loss", "guidance", "forecast"],
    "Bonds": ["bond", "treasury", "yield", "fixed income", "debt"],
    "Global": ["europe", "asia", "china", "japan", "boj", "ecb", "boe", "emerging"],
}

# Source colors for frontend display
SOURCE_COLORS = {
    "Reuters": "#e8834a",
    "CNBC": "#005594",
    "Bloomberg": "#ff6b35",
    "Seeking Alpha": "#e8834a",
    "Yahoo Finance": "#7b61ff",
    "MarketWatch": "#22ab94",
}

# ─── Cache ───

_feed_cache: Dict[str, Dict] = {}
CACHE_TTL = 300  # 5 minutes


def _cache_key(feed_id: str) -> str:
    return f"feed:{feed_id}"


def _is_cache_fresh(key: str) -> bool:
    if key not in _feed_cache:
        return False
    return time.time() - _feed_cache[key]["timestamp"] < CACHE_TTL


# ─── Parsing ───

def _extract_tickers(text: str) -> List[str]:
    """Extract stock/futures tickers from text."""
    matches = TICKER_PATTERN.findall(text)
    return [m for m in matches if m in KNOWN_TICKERS or m.endswith("=F")]


def _detect_sentiment(title: str, summary: str) -> str:
    """Simple keyword-based sentiment detection."""
    text = (title + " " + summary).lower()
    bullish = ["surge", "rally", "gain", "rise", "jump", "soar", "high", "beat", "above", "strong", "bull"]
    bearish = ["fall", "drop", "decline", "loss", "slip", "plunge", "low", "miss", "below", "weak", "bear", "crash"]
    bull_count = sum(1 for w in bullish if w in text)
    bear_count = sum(1 for w in bearish if w in text)
    if bull_count > bear_count:
        return "bullish"
    if bear_count > bull_count:
        return "bearish"
    return "neutral"


def _detect_category(title: str, summary: str, default: str) -> str:
    """Auto-detect news category from content."""
    text = (title + " " + summary).lower()
    for category, keywords in CATEGORY_KEYWORDS.items():
        if any(kw in text for kw in keywords):
            return category
    return default


def _parse_published(entry) -> str:
    """Parse published date from feed entry."""
    published = entry.get("published_parsed") or entry.get("updated_parsed")
    if published:
        try:
            dt = datetime(*published[:6], tzinfo=timezone.utc)
            delta = datetime.now(timezone.utc) - dt
            hours = int(delta.total_seconds() / 3600)
            if hours < 1:
                mins = int(delta.total_seconds() / 60)
                return f"{mins}m ago" if mins > 0 else "Just now"
            if hours < 24:
                return f"{hours}h ago"
            days = hours // 24
            return f"{days}d ago"
        except Exception:
            pass
    return "Recent"


def _entry_to_news_item(entry, source: str, default_category: str) -> Dict:
    """Convert a feedparser entry to our normalized news item format."""
    title = entry.get("title", "").strip()
    summary = entry.get("summary", entry.get("description", "")).strip()
    # Strip HTML tags from summary
    summary = re.sub(r'<[^>]+>', '', summary).strip()
    # Truncate long summaries
    if len(summary) > 300:
        summary = summary[:297] + "..."

    link = entry.get("link", "")
    tickers = _extract_tickers(title + " " + summary)
    category = _detect_category(title, summary, default_category)
    sentiment = _detect_sentiment(title, summary)
    time_str = _parse_published(entry)

    # Generate stable ID from title
    item_id = hashlib.md5(title.encode()).hexdigest()[:12]

    item = {
        "id": item_id,
        "title": title,
        "source": source,
        "sourceColor": SOURCE_COLORS.get(source, "#e8834a"),
        "time": time_str,
        "category": category,
        "sentiment": sentiment,
        "summary": summary,
        "url": link,
    }

    if tickers:
        item["ticker"] = tickers[0]

    return item


# ─── Public API ───

def fetch_feed(feed_id: str) -> List[Dict]:
    """Fetch and parse a single RSS feed."""
    cache_key = _cache_key(feed_id)
    if _is_cache_fresh(cache_key):
        return _feed_cache[cache_key]["data"]

    feed_config = RSS_FEEDS.get(feed_id)
    if not feed_config:
        return []

    try:
        parsed = feedparser.parse(feed_config["url"])
        items = []
        for entry in parsed.entries[:20]:
            item = _entry_to_news_item(entry, feed_config["source"], feed_config["category"])
            if item["title"]:  # Skip empty titles
                items.append(item)

        _feed_cache[cache_key] = {"data": items, "timestamp": time.time()}
        return items
    except Exception:
        # Return cached data if available, even if stale
        if cache_key in _feed_cache:
            return _feed_cache[cache_key]["data"]
        return []


def fetch_all_news(
    category: Optional[str] = None,
    ticker: Optional[str] = None,
    source: Optional[str] = None,
    limit: int = 50,
) -> List[Dict]:
    """Fetch news from all RSS feeds, with optional filtering."""
    all_items = []
    seen_titles = set()

    feed_ids = list(RSS_FEEDS.keys())
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
        results = list(executor.map(fetch_feed, feed_ids))

    for items in results:
        for item in items:
            title_key = item["title"].lower()[:60]
            if title_key in seen_titles:
                continue
            seen_titles.add(title_key)
            all_items.append(item)

    # Apply filters
    if category and category != "All":
        all_items = [i for i in all_items if i["category"] == category]

    if ticker:
        ticker_upper = ticker.upper()
        all_items = [i for i in all_items if i.get("ticker", "").upper() == ticker_upper]

    if source:
        all_items = [i for i in all_items if i["source"].lower() == source.lower()]

    # Sort by time (most recent first — "Just now" and "Xm ago" come first)
    def sort_key(item):
        t = item.get("time", "")
        if t == "Just now":
            return 0
        if t.endswith("m ago"):
            return int(t.replace("m ago", ""))
        if t.endswith("h ago"):
            return int(t.replace("h ago", "")) * 60
        if t.endswith("d ago"):
            return int(t.replace("d ago", "")) * 1440
        return 99999

    all_items.sort(key=sort_key)
    return all_items[:limit]


def fetch_google_news_rss(query: str, limit: int = 15) -> List[Dict]:
    """Fetch news from Google News RSS for any search query.

    Works for topics ("tariffs", "OPEC"), tickers ("AAPL stock"), or general queries.
    """
    from urllib.parse import quote_plus

    url = f"https://news.google.com/rss/search?q={quote_plus(query)}&hl=en-US&gl=US&ceid=US:en"

    try:
        parsed = feedparser.parse(url)
        items = []
        for entry in parsed.entries[:limit]:
            item = _entry_to_news_item(entry, "Google News", "Markets")
            if item["title"]:
                items.append(item)
        return items
    except Exception:
        return []


def get_available_sources() -> List[Dict]:
    """Return list of configured news sources."""
    sources = {}
    for feed_id, config in RSS_FEEDS.items():
        src = config["source"]
        if src not in sources:
            sources[src] = {
                "id": src.lower().replace(" ", "_"),
                "name": src,
                "color": SOURCE_COLORS.get(src, "#e8834a"),
                "feeds": [],
            }
        sources[src]["feeds"].append(feed_id)
    return list(sources.values())
