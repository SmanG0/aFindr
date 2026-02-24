# News Feed Audit

## Summary

All news tabs now use **true Yahoo Finance RSS feeds** where available. Fallback to mock data occurs only when RSS fetch fails or returns empty.

## RSS Feed Mapping

| Category    | RSS Feed URL                                              | Source        |
|------------|------------------------------------------------------------|---------------|
| All        | `https://finance.yahoo.com/news/rssindex`                  | Yahoo Finance |
| Markets    | `https://finance.yahoo.com/rss/topfinstories`             | Yahoo Finance |
| Earnings   | `https://finance.yahoo.com/rss/industry?s=earnings`       | Yahoo Finance |
| Commodities| `https://finance.yahoo.com/rss/industry?s=commodities`    | Yahoo Finance |
| Futures    | `https://finance.yahoo.com/rss/topfinstories`             | Yahoo Finance |
| Macro      | `https://finance.yahoo.com/rss/topfinstories`             | Yahoo Finance |
| Bonds      | `https://finance.yahoo.com/rss/topfinstories`             | Yahoo Finance |
| Global     | `https://finance.yahoo.com/rss/topfinstories`             | Yahoo Finance |
| Technology | `https://finance.yahoo.com/rss/industry?s=technology`     | Yahoo Finance |

**Stock-specific:** When `?ticker=AAPL` is passed, uses:
`https://finance.yahoo.com/rss/headline?s=AAPL`

## Changes Made

1. **Expanded RSS mapping** – All NEWS_CATEGORIES (All, Markets, Futures, Commodities, Macro, Earnings, Bonds, Global) now map to real Yahoo Finance RSS feeds.
2. **Stock-specific RSS** – `fetchNewsFeed({ ticker: "AAPL" })` fetches headlines for that ticker.
3. **Source inference** – Parsed articles infer source (Reuters, Bloomberg, etc.) from the link URL when not in RSS metadata.
4. **Response metadata** – API returns `source: "rss"` or `source: "fallback"` so clients know the data origin.

## Future: Perplexity Finance API

Settings > APIs & Data includes a placeholder for **Perplexity Finance API**. When added, it can:
- Enrich headlines with AI summaries
- Add sentiment (bullish/bearish/neutral)
- Improve relevance for stock-specific queries

News feed works without it; Perplexity is optional enhancement.

## Components

- **NewsPage** – Main news tab; fetches from `/api/news/feed` with category.
- **NewsFeedView** – Renders the list; receives articles from NewsPage.
- **NewsFeed** (sidebar) – Not currently used; uses mock data. Can be wired to `fetchNewsFeed` if needed.
