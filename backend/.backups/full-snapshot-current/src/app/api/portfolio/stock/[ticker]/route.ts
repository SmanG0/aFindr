import { NextRequest, NextResponse } from "next/server";

const FASTAPI_URL = process.env.FASTAPI_URL || "http://127.0.0.1:8000";

// ─── In-memory cache (60s TTL) ───
const cache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL = 60_000;

// ─── Yahoo Finance crumb cache (30min TTL) ───
let yahooCrumb: { crumb: string; cookie: string; ts: number } | null = null;
const CRUMB_TTL = 30 * 60_000;

async function getYahooCrumb(): Promise<{ crumb: string; cookie: string }> {
  if (yahooCrumb && Date.now() - yahooCrumb.ts < CRUMB_TTL) {
    return { crumb: yahooCrumb.crumb, cookie: yahooCrumb.cookie };
  }
  // Step 1: Hit fc.yahoo.com to get a cookie
  const initRes = await fetch("https://fc.yahoo.com/", {
    headers: { "User-Agent": "Mozilla/5.0" },
    redirect: "manual",
  });
  const setCookieHeader = initRes.headers.get("set-cookie") || "";
  const cookie = setCookieHeader.split(";")[0] || "";

  // Step 2: Get crumb using the cookie
  const crumbRes = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", {
    headers: { "User-Agent": "Mozilla/5.0", Cookie: cookie },
  });
  const crumb = await crumbRes.text();
  yahooCrumb = { crumb, cookie, ts: Date.now() };
  return { crumb, cookie };
}

function fetchWithTimeout(url: string, opts: RequestInit & { next?: { revalidate: number } }, ms = 3000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...opts, signal: controller.signal }).finally(() => clearTimeout(timer));
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const { ticker } = await params;
    const sym = ticker.toUpperCase();

    // Check cache
    const cached = cache.get(sym);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return NextResponse.json(cached.data);
    }

    // Race: try backend with 500ms timeout, fall through if slow/down
    try {
      const backendRes = await fetchWithTimeout(
        `${FASTAPI_URL}/api/news/stock/${encodeURIComponent(sym)}/full`,
        { next: { revalidate: 0 } },
        500
      );
      if (backendRes.ok) {
        const data = await backendRes.json();
        if (!data.error) {
          cache.set(sym, { data, ts: Date.now() });
          return NextResponse.json(data);
        }
      }
    } catch {
      // Backend unavailable or too slow, fall through
    }

    // ─── Fire all Yahoo requests in parallel ───
    // Get crumb for authenticated requests
    let authCrumb: { crumb: string; cookie: string } | null = null;
    try { authCrumb = await getYahooCrumb(); } catch { /* continue without crumb */ }

    const yahooHeaders: Record<string, string> = { "User-Agent": "Mozilla/5.0" };
    if (authCrumb?.cookie) yahooHeaders["Cookie"] = authCrumb.cookie;

    const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=5d`;
    const modules = [
      "assetProfile", "defaultKeyStatistics", "financialData",
      "summaryDetail", "recommendationTrend", "earnings", "upgradeDowngradeHistory",
    ].join(",");
    const crumbParam = authCrumb?.crumb ? `&crumb=${encodeURIComponent(authCrumb.crumb)}` : "";
    const summaryUrl = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(sym)}?modules=${modules}${crumbParam}`;

    // Guess peers early (based on ticker alone) so we can fetch them in parallel
    const guessedPeers = getSectorPeers(sym, "");

    const peerUrls = guessedPeers.slice(0, 5).map(
      (p) => `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(p)}?interval=1d&range=1d`
    );

    // Fire all requests simultaneously
    const [chartRes, summaryRes, ...peerResults] = await Promise.allSettled([
      fetchWithTimeout(chartUrl, { headers: yahooHeaders, next: { revalidate: 0 } }, 5000),
      fetchWithTimeout(summaryUrl, { headers: yahooHeaders, next: { revalidate: 0 } }, 5000),
      ...peerUrls.map((url) =>
        fetchWithTimeout(url, { headers: yahooHeaders, next: { revalidate: 0 } }, 4000)
      ),
    ]);

    // ─── Parse chart data ───
    let meta: Record<string, unknown> | null = null;
    if (chartRes.status === "fulfilled" && chartRes.value.ok) {
      const chartJson = await chartRes.value.json();
      meta = chartJson.chart?.result?.[0]?.meta ?? null;
    }
    if (!meta) {
      return NextResponse.json({ error: "No chart data" }, { status: 404 });
    }

    const price = (meta.regularMarketPrice as number) ?? 0;
    const prevClose = (meta.chartPreviousClose as number) ?? (meta.previousClose as number) ?? price;
    const change = Math.round((price - prevClose) * 100) / 100;
    const changePct = prevClose ? Math.round(((price - prevClose) / prevClose) * 10000) / 100 : 0;

    // ─── Parse summary data (best-effort) ───
    let profile: Record<string, unknown> = {};
    let keyStats: Record<string, unknown> = {};
    let finData: Record<string, unknown> = {};
    let summaryDetail: Record<string, unknown> = {};
    let recTrend: Record<string, unknown>[] = [];
    let earningsData: Record<string, unknown> = {};
    let upgradeHistory: Record<string, unknown>[] = [];

    if (summaryRes.status === "fulfilled" && summaryRes.value.ok) {
      try {
        const summaryJson = await summaryRes.value.json();
        const result = summaryJson.quoteSummary?.result?.[0];
        if (result) {
          profile = result.assetProfile || {};
          keyStats = result.defaultKeyStatistics || {};
          finData = result.financialData || {};
          summaryDetail = result.summaryDetail || {};
          recTrend = result.recommendationTrend?.trend || [];
          earningsData = result.earnings || {};
          upgradeHistory = result.upgradeDowngradeHistory?.history || [];
        }
      } catch { /* parse error, continue with basic data */ }
    }

    // ─── Parse peers (already fetched in parallel) ───
    const actualSector = (profile.sector as string) || "";
    const actualPeers = getSectorPeers(sym, actualSector);
    // If guessed peers match actual peers, use the parallel results
    const peersMatch = guessedPeers.length === actualPeers.length &&
      guessedPeers.every((p, i) => p === actualPeers[i]);

    let peers: { ticker: string; name: string; price: number; change: number; changePct: number }[] = [];

    if (peersMatch) {
      // Use already-fetched peer data
      const peerData = await Promise.all(
        peerResults.map(async (r, i) => {
          if (r.status !== "fulfilled" || !r.value.ok) return null;
          try {
            const peerJson = await r.value.json();
            const peerMeta = peerJson.chart?.result?.[0]?.meta;
            if (!peerMeta) return null;
            const peerPrice = peerMeta.regularMarketPrice ?? 0;
            const peerPrev = peerMeta.chartPreviousClose ?? peerMeta.previousClose ?? peerPrice;
            const peerChange = peerPrice - peerPrev;
            const peerChangePct = peerPrev ? (peerChange / peerPrev) * 100 : 0;
            return {
              ticker: guessedPeers[i], name: peerMeta.shortName || guessedPeers[i],
              price: Math.round(peerPrice * 100) / 100,
              change: Math.round(peerChange * 100) / 100,
              changePct: Math.round(peerChangePct * 100) / 100,
            };
          } catch { return null; }
        })
      );
      peers = peerData.filter(Boolean) as typeof peers;
    } else {
      // Different peers needed — fetch them now (rare case)
      const peerPromises = actualPeers.slice(0, 5).map(async (peerSym) => {
        try {
          const peerUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(peerSym)}?interval=1d&range=1d`;
          const peerRes = await fetchWithTimeout(peerUrl, { headers: yahooHeaders, next: { revalidate: 0 } }, 4000);
          if (!peerRes.ok) return null;
          const peerJson = await peerRes.json();
          const peerMeta = peerJson.chart?.result?.[0]?.meta;
          if (!peerMeta) return null;
          const peerPrice = peerMeta.regularMarketPrice ?? 0;
          const peerPrev = peerMeta.chartPreviousClose ?? peerMeta.previousClose ?? peerPrice;
          const peerChange = peerPrice - peerPrev;
          const peerChangePct = peerPrev ? (peerChange / peerPrev) * 100 : 0;
          return {
            ticker: peerSym, name: peerMeta.shortName || peerSym,
            price: Math.round(peerPrice * 100) / 100,
            change: Math.round(peerChange * 100) / 100,
            changePct: Math.round(peerChangePct * 100) / 100,
          };
        } catch { return null; }
      });
      peers = (await Promise.all(peerPromises)).filter(Boolean) as typeof peers;
    }

    // ─── Helpers ───
    const rawVal = (obj: Record<string, unknown>, key: string): number | null => {
      const v = obj[key];
      if (v && typeof v === "object" && "raw" in (v as Record<string, unknown>)) {
        return (v as { raw: number }).raw;
      }
      return typeof v === "number" ? v : null;
    };
    const fmtLarge = (n: number | null): string => {
      if (n == null || !isFinite(n)) return "-";
      if (n >= 1e12) return "$" + (n / 1e12).toFixed(2) + "T";
      if (n >= 1e9) return "$" + (n / 1e9).toFixed(2) + "B";
      if (n >= 1e6) return "$" + (n / 1e6).toFixed(2) + "M";
      if (n >= 1e3) return "$" + (n / 1e3).toFixed(1) + "K";
      return "$" + n.toFixed(2);
    };
    const fmtCount = (n: number | null): string => {
      if (n == null || !isFinite(n)) return "-";
      if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
      if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
      if (n >= 1e3) return (n / 1e3).toFixed(0) + "K";
      return String(Math.round(n));
    };
    const fmtPct = (n: number | null): string => {
      if (n == null || !isFinite(n)) return "-";
      return (n * 100).toFixed(2) + "%";
    };
    const fmtPctAlready = (n: number | null): string => {
      if (n == null || !isFinite(n)) return "-";
      return n.toFixed(2) + "%";
    };
    const fmtNum = (n: number | null, decimals = 2): string => {
      if (n == null || !isFinite(n)) return "-";
      return n.toFixed(decimals);
    };

    // Analyst ratings
    const latestRec = recTrend.find((t: Record<string, unknown>) => t.period === "0m") || recTrend[0] || {};
    const buyCount = ((latestRec.strongBuy as number) || 0) + ((latestRec.buy as number) || 0);
    const holdCount = (latestRec.hold as number) || 0;
    const sellCount = ((latestRec.sell as number) || 0) + ((latestRec.strongSell as number) || 0);
    const totalRatings = buyCount + holdCount + sellCount;

    // Officers
    const officers = (profile.companyOfficers || []) as { name?: string; title?: string }[];
    const ceo = officers.find((o) => o.title?.toLowerCase().includes("ceo"))?.name || officers[0]?.name || "-";

    // Earnings
    const earningsChart = (earningsData as Record<string, unknown>).earningsChart as Record<string, unknown> | undefined;
    const financialsChart = (earningsData as Record<string, unknown>).financialsChart as Record<string, unknown> | undefined;
    const qtrEarnings = ((earningsChart?.quarterly || []) as Record<string, unknown>[]).map((q) => ({
      quarter: (q.date as string) || "",
      actual: rawVal(q, "actual"),
      estimate: rawVal(q, "estimate"),
    }));
    const yearlyFinancials = ((financialsChart?.yearly || []) as Record<string, unknown>[]).map((y) => ({
      year: (y.date as string) || "",
      revenue: rawVal(y, "revenue"),
      earnings: rawVal(y, "earnings"),
    }));
    const quarterlyFinancials = ((financialsChart?.quarterly || []) as Record<string, unknown>[]).map((q) => ({
      quarter: (q.date as string) || "",
      revenue: rawVal(q, "revenue"),
      earnings: rawVal(q, "earnings"),
    }));

    // Upgrade/downgrade history
    const recentRatings = upgradeHistory.slice(0, 8).map((item) => {
      const epochDate = rawVal(item, "epochGradeDate");
      return {
        firm: (item.firm as string) || "-",
        toGrade: (item.toGrade as string) || "-",
        fromGrade: (item.fromGrade as string) || "-",
        action: (item.action as string) || "-",
        date: epochDate ? new Date(epochDate * 1000).toISOString().split("T")[0] : "-",
      };
    });

    const data = {
      ticker: sym,
      name: (meta.shortName as string) || (meta.longName as string) || sym,
      price: Math.round(price * 100) / 100,
      change, changePct,
      prevClose: Math.round(prevClose * 100) / 100,
      description: (profile.longBusinessSummary as string) || "",
      ceo, employees: rawVal(profile as Record<string, unknown>, "fullTimeEmployees") || 0,
      headquarters: [profile.city, profile.state, profile.country].filter(Boolean).join(", ") || "-",
      founded: (profile.startDate as string) || "-",
      industry: (profile.industry as string) || "-",
      website: (profile.website as string) || "-",
      marketCap: fmtLarge(rawVal(summaryDetail, "marketCap") || rawVal(finData, "marketCap") || rawVal(keyStats, "enterpriseValue")),
      peRatio: fmtNum(rawVal(summaryDetail, "trailingPE") || rawVal(keyStats, "trailingPE")),
      dividendYield: fmtPctAlready(rawVal(summaryDetail, "dividendYield") ?? rawVal(keyStats, "dividendYield")),
      avgVolume: fmtLarge(rawVal(summaryDetail, "averageDailyVolume10Day") || rawVal(finData, "averageDailyVolume10Day")),
      volume: fmtLarge(rawVal(summaryDetail, "volume") || rawVal(finData, "volume")),
      dayHigh: rawVal(summaryDetail, "dayHigh") || rawVal(finData, "dayHigh") || 0,
      dayLow: rawVal(summaryDetail, "dayLow") || rawVal(finData, "dayLow") || 0,
      open: rawVal(summaryDetail, "open") || rawVal(finData, "open") || 0,
      week52High: rawVal(summaryDetail, "fiftyTwoWeekHigh") || rawVal(keyStats, "fiftyTwoWeekHigh") || 0,
      week52Low: rawVal(summaryDetail, "fiftyTwoWeekLow") || rawVal(keyStats, "fiftyTwoWeekLow") || 0,
      shortFloat: fmtPct(rawVal(keyStats, "shortPercentOfFloat")),
      forwardPE: fmtNum(rawVal(keyStats, "forwardPE")),
      pegRatio: fmtNum(rawVal(keyStats, "pegRatio")),
      priceToBook: fmtNum(rawVal(keyStats, "priceToBook")),
      priceToSales: fmtNum(rawVal(keyStats, "priceToSalesTrailing12Months")),
      enterpriseValue: fmtLarge(rawVal(keyStats, "enterpriseValue")),
      evToRevenue: fmtNum(rawVal(keyStats, "enterpriseToRevenue")),
      evToEBITDA: fmtNum(rawVal(keyStats, "enterpriseToEbitda")),
      bookValue: fmtNum(rawVal(keyStats, "bookValue")),
      profitMargin: fmtPct(rawVal(finData, "profitMargins")),
      operatingMargin: fmtPct(rawVal(finData, "operatingMargins")),
      grossMargin: fmtPct(rawVal(finData, "grossMargins")),
      returnOnEquity: fmtPct(rawVal(finData, "returnOnEquity")),
      returnOnAssets: fmtPct(rawVal(finData, "returnOnAssets")),
      revenuePerShare: fmtNum(rawVal(finData, "revenuePerShare")),
      totalRevenue: fmtLarge(rawVal(finData, "totalRevenue")),
      netIncome: fmtLarge(rawVal(keyStats, "netIncomeToCommon")),
      freeCashFlow: fmtLarge(rawVal(finData, "freeCashflow")),
      operatingCashFlow: fmtLarge(rawVal(finData, "operatingCashflow")),
      totalCash: fmtLarge(rawVal(finData, "totalCash")),
      totalDebt: fmtLarge(rawVal(finData, "totalDebt")),
      debtToEquity: fmtNum(rawVal(finData, "debtToEquity")),
      currentRatio: fmtNum(rawVal(finData, "currentRatio")),
      quickRatio: fmtNum(rawVal(finData, "quickRatio")),
      beta: fmtNum(rawVal(keyStats, "beta") || rawVal(summaryDetail, "beta")),
      fiftyDayMA: fmtNum(rawVal(keyStats, "fiftyDayAverage")),
      twoHundredDayMA: fmtNum(rawVal(keyStats, "twoHundredDayAverage")),
      trailingEPS: fmtNum(rawVal(keyStats, "trailingEps")),
      forwardEPS: fmtNum(rawVal(keyStats, "forwardEps")),
      sharesOutstanding: fmtCount(rawVal(keyStats, "sharesOutstanding")),
      floatShares: fmtCount(rawVal(keyStats, "floatShares")),
      shortRatio: fmtNum(rawVal(keyStats, "shortRatio")),
      sharesShort: fmtCount(rawVal(keyStats, "sharesShort")),
      insiderPercent: fmtPct(rawVal(keyStats, "heldPercentInsiders")),
      institutionalPercent: fmtPct(rawVal(keyStats, "heldPercentInstitutions")),
      targetMeanPrice: rawVal(finData, "targetMeanPrice"),
      targetMedianPrice: rawVal(finData, "targetMedianPrice"),
      targetHighPrice: rawVal(finData, "targetHighPrice"),
      targetLowPrice: rawVal(finData, "targetLowPrice"),
      numberOfAnalysts: rawVal(finData, "numberOfAnalystOpinions") || 0,
      recommendationKey: (finData.recommendationKey as string) || "-",
      exDividendDate: "-", dividendDate: "-",
      nextEarningsDate: "-",
      earningsHistory: qtrEarnings,
      currentQuarterEstimate: null as number | null,
      currentQuarterDate: "",
      yearlyFinancials,
      quarterlyFinancials,
      analystRatings: {
        buy: buyCount, hold: holdCount, sell: sellCount, total: totalRatings,
        buyPercent: totalRatings > 0 ? Math.round((buyCount / totalRatings) * 1000) / 10 : 0,
        holdPercent: totalRatings > 0 ? Math.round((holdCount / totalRatings) * 1000) / 10 : 0,
        sellPercent: totalRatings > 0 ? Math.round((sellCount / totalRatings) * 1000) / 10 : 0,
      },
      recentRatings,
      peers,
      exchange: (meta.exchangeName as string) || "-",
      sector: actualSector || "-",
    };

    cache.set(sym, { data, ts: Date.now() });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch stock detail", detail: String(err) },
      { status: 500 }
    );
  }
}

function getSectorPeers(ticker: string, sector: string): string[] {
  const techPeers = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "AMD", "CRM", "NFLX"];
  const financePeers = ["JPM", "BAC", "WFC", "GS", "MS", "C", "BLK", "SCHW"];
  const energyPeers = ["XOM", "CVX", "COP", "SLB", "EOG", "MPC", "PSX", "VLO"];
  const healthcarePeers = ["UNH", "JNJ", "PFE", "ABBV", "MRK", "LLY", "TMO", "ABT"];

  const t = ticker.toUpperCase();
  if (sector === "Technology" || techPeers.includes(t)) return techPeers.filter((p) => p !== t);
  if (sector === "Financial Services" || financePeers.includes(t)) return financePeers.filter((p) => p !== t);
  if (sector === "Energy" || energyPeers.includes(t)) return energyPeers.filter((p) => p !== t);
  if (sector === "Healthcare" || healthcarePeers.includes(t)) return healthcarePeers.filter((p) => p !== t);
  return ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA"].filter((p) => p !== t);
}
