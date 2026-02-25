import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";

type Alert = Doc<"alerts">;

/** Fetch current prices for a batch of symbols from Yahoo Finance. */
async function fetchQuotes(
  symbols: string[],
): Promise<Record<string, number>> {
  const prices: Record<string, number> = {};
  // Fetch in parallel, max 20
  const batch = symbols.slice(0, 20);
  const results = await Promise.allSettled(
    batch.map(async (sym) => {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1d`;
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      if (!res.ok) return null;
      const json = await res.json();
      const meta = json.chart?.result?.[0]?.meta;
      if (!meta) return null;
      return {
        symbol: sym,
        price: meta.regularMarketPrice ?? 0,
      };
    }),
  );
  for (const r of results) {
    if (r.status === "fulfilled" && r.value) {
      prices[r.value.symbol] = r.value.price;
    }
  }
  return prices;
}

/** Evaluate whether a price alert has triggered. */
function isPriceTriggered(
  alert: Alert,
  currentPrice: number,
): boolean {
  if (!alert.condition || alert.targetPrice === undefined) return false;

  switch (alert.condition) {
    case "above":
      return currentPrice > alert.targetPrice;
    case "below":
      return currentPrice < alert.targetPrice;
    case "crosses_above":
      // Needs lastCheckedPrice to detect crossing
      if (alert.lastCheckedPrice === undefined) return false;
      return (
        alert.lastCheckedPrice <= alert.targetPrice &&
        currentPrice > alert.targetPrice
      );
    case "crosses_below":
      if (alert.lastCheckedPrice === undefined) return false;
      return (
        alert.lastCheckedPrice >= alert.targetPrice &&
        currentPrice < alert.targetPrice
      );
    default:
      return false;
  }
}

export const run = internalAction({
  args: {},
  handler: async (ctx) => {
    // 1. Get all active alerts
    const alerts: Alert[] = await ctx.runQuery(
      internal.alerts.getActiveAlerts,
    );
    if (alerts.length === 0) return;

    // 2. Group by symbol, fetch prices
    const priceAlerts = alerts.filter((a) => a.type === "price");
    const symbols = [...new Set(priceAlerts.map((a) => a.symbol))];
    const prices = symbols.length > 0 ? await fetchQuotes(symbols) : {};

    // 3. Evaluate each price alert
    for (const alert of priceAlerts) {
      const currentPrice = prices[alert.symbol];
      if (currentPrice === undefined) continue;

      if (isPriceTriggered(alert, currentPrice)) {
        // Create notification
        const condLabel = alert.condition?.replace("_", " ") ?? "";
        await ctx.runMutation(internal.notifications.create, {
          userId: alert.userId,
          alertId: alert._id,
          type: "price_alert",
          title: `${alert.symbol} ${condLabel} ${alert.targetPrice}`,
          body: `${alert.symbol} is now at ${currentPrice.toFixed(2)} (target: ${alert.targetPrice?.toFixed(2)} ${condLabel})`,
        });

        // Update lastTriggeredAt
        await ctx.runMutation(internal.alertChecker.updateAlertState, {
          alertId: alert._id,
          lastTriggeredAt: Date.now(),
          lastCheckedPrice: currentPrice,
        });
      } else {
        // Just update lastCheckedPrice for crosses detection
        await ctx.runMutation(internal.alertChecker.updateAlertState, {
          alertId: alert._id,
          lastCheckedPrice: currentPrice,
        });
      }
    }

    // 4. News alerts — check for keyword matches
    const newsAlerts = alerts.filter((a) => a.type === "news");
    if (newsAlerts.length > 0) {
      // Group by symbol for batch news fetching
      const newsSymbols = [...new Set(newsAlerts.map((a) => a.symbol))];
      for (const sym of newsSymbols) {
        try {
          const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1d`;
          // Use Yahoo Finance news endpoint
          const newsUrl = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(sym)}&region=US&lang=en-US`;
          const res = await fetch(newsUrl, {
            headers: { "User-Agent": "Mozilla/5.0" },
          });
          if (!res.ok) continue;
          const text = await res.text();

          // Simple XML title extraction
          const titles: string[] = [];
          const titleRegex = /<title><!\[CDATA\[(.*?)\]\]><\/title>/g;
          let match;
          while ((match = titleRegex.exec(text)) !== null) {
            titles.push(match[1]);
          }

          // Check each news alert for this symbol
          const symAlerts = newsAlerts.filter((a) => a.symbol === sym);
          for (const alert of symAlerts) {
            if (!alert.keywords || alert.keywords.length === 0) continue;
            // Check if any headline matches any keyword
            const matchedTitle = titles.find((title) =>
              alert.keywords!.some((kw) =>
                title.toLowerCase().includes(kw.toLowerCase()),
              ),
            );
            if (matchedTitle) {
              // Don't re-trigger within 1 hour
              if (
                alert.lastTriggeredAt &&
                Date.now() - alert.lastTriggeredAt < 3600000
              )
                continue;

              await ctx.runMutation(internal.notifications.create, {
                userId: alert.userId,
                alertId: alert._id,
                type: "news_alert",
                title: `News: ${alert.symbol}`,
                body: matchedTitle,
              });

              await ctx.runMutation(internal.alertChecker.updateAlertState, {
                alertId: alert._id,
                lastTriggeredAt: Date.now(),
              });
            }
          }
          void url; // suppress unused
        } catch {
          // Skip on error, try next symbol
        }
      }
    }
  },
});

/** Internal mutation to update alert state (lastCheckedPrice, lastTriggeredAt). */
import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const updateAlertState = internalMutation({
  args: {
    alertId: v.id("alerts"),
    lastCheckedPrice: v.optional(v.number()),
    lastTriggeredAt: v.optional(v.number()),
  },
  handler: async (ctx, { alertId, lastCheckedPrice, lastTriggeredAt }) => {
    const patch: Record<string, unknown> = {};
    if (lastCheckedPrice !== undefined) patch.lastCheckedPrice = lastCheckedPrice;
    if (lastTriggeredAt !== undefined) patch.lastTriggeredAt = lastTriggeredAt;
    await ctx.db.patch(alertId, patch);
  },
});
