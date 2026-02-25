// ─── Ticker → Domain map for Clearbit logo fetching ───
export const TICKER_DOMAINS: Record<string, string> = {
  AAPL: "apple.com", MSFT: "microsoft.com", GOOGL: "google.com", GOOG: "google.com",
  AMZN: "amazon.com", META: "meta.com", TSLA: "tesla.com", NVDA: "nvidia.com",
  NFLX: "netflix.com", AMD: "amd.com", INTC: "intel.com", CRM: "salesforce.com",
  ORCL: "oracle.com", ADBE: "adobe.com", PYPL: "paypal.com", SQ: "squareup.com",
  SHOP: "shopify.com", UBER: "uber.com", LYFT: "lyft.com", SNAP: "snap.com",
  TWLO: "twilio.com", SPOT: "spotify.com", ZM: "zoom.us", COIN: "coinbase.com",
  PLTR: "palantir.com", RBLX: "roblox.com", ABNB: "airbnb.com", DIS: "disney.com",
  BA: "boeing.com", JPM: "jpmorganchase.com", GS: "goldmansachs.com", V: "visa.com",
  MA: "mastercard.com", WMT: "walmart.com", KO: "coca-cola.com", PEP: "pepsico.com",
  NKE: "nike.com", SBUX: "starbucks.com", MCD: "mcdonalds.com", UNH: "unitedhealthgroup.com",
  JNJ: "jnj.com", PFE: "pfizer.com", MRNA: "modernatx.com", XOM: "exxonmobil.com",
  CVX: "chevron.com", T: "att.com", VZ: "verizon.com", CMCSA: "comcast.com",
  SPY: "ssga.com", QQQ: "invesco.com", DIA: "ssga.com", IWM: "ishares.com",
  BABA: "alibaba.com", TSM: "tsmc.com", SONY: "sony.com", TM: "toyota.com",
};

export function getLogoUrl(ticker: string): string | null {
  const clean = ticker.replace(/[=.].*$/, "");
  const domain = TICKER_DOMAINS[clean.toUpperCase()];
  if (!domain) return null;
  return `https://logo.clearbit.com/${domain}?size=40`;
}

// ─── Donut chart palette ───
export const ALLOCATION_COLORS = [
  "#C47B3A", // accent
  "#22AB94", // buy green
  "#E54D4D", // sell red
  "#5B8DEF", // blue
  "#A78BFA", // purple
  "#F59E0B", // amber
  "#EC4899", // pink
  "#14B8A6", // teal
  "#8B5CF6", // violet
  "#6366F1", // indigo
];

// ─── Stock Metadata (sector, industry, HQ country + coordinates) ───

export interface StockMeta {
  sector: string;
  industry: string;
  country: string;
  city: string;
  lat: number;
  lng: number;
}

export const STOCK_META: Record<string, StockMeta> = {
  AAPL:  { sector: "Technology",      industry: "Consumer Electronics",   country: "US", city: "Cupertino, CA",      lat: 37.33, lng: -122.03 },
  MSFT:  { sector: "Technology",      industry: "Software",              country: "US", city: "Redmond, WA",        lat: 47.64, lng: -122.13 },
  GOOGL: { sector: "Technology",      industry: "Internet Services",     country: "US", city: "Mountain View, CA",  lat: 37.39, lng: -122.08 },
  GOOG:  { sector: "Technology",      industry: "Internet Services",     country: "US", city: "Mountain View, CA",  lat: 37.39, lng: -122.08 },
  AMZN:  { sector: "Consumer Cyclical", industry: "E-Commerce",          country: "US", city: "Seattle, WA",        lat: 47.62, lng: -122.34 },
  META:  { sector: "Technology",      industry: "Social Media",          country: "US", city: "Menlo Park, CA",     lat: 37.45, lng: -122.18 },
  TSLA:  { sector: "Consumer Cyclical", industry: "Auto Manufacturers",  country: "US", city: "Austin, TX",         lat: 30.27, lng: -97.74 },
  NVDA:  { sector: "Technology",      industry: "Semiconductors",        country: "US", city: "Santa Clara, CA",    lat: 37.35, lng: -121.95 },
  NFLX:  { sector: "Communication",   industry: "Entertainment",         country: "US", city: "Los Gatos, CA",      lat: 37.23, lng: -121.97 },
  AMD:   { sector: "Technology",      industry: "Semiconductors",        country: "US", city: "Santa Clara, CA",    lat: 37.35, lng: -121.95 },
  INTC:  { sector: "Technology",      industry: "Semiconductors",        country: "US", city: "Santa Clara, CA",    lat: 37.35, lng: -121.95 },
  CRM:   { sector: "Technology",      industry: "Software",              country: "US", city: "San Francisco, CA",  lat: 37.79, lng: -122.40 },
  ORCL:  { sector: "Technology",      industry: "Software",              country: "US", city: "Austin, TX",         lat: 30.27, lng: -97.74 },
  ADBE:  { sector: "Technology",      industry: "Software",              country: "US", city: "San Jose, CA",       lat: 37.34, lng: -121.89 },
  PYPL:  { sector: "Financial",       industry: "Fintech",               country: "US", city: "San Jose, CA",       lat: 37.34, lng: -121.89 },
  SQ:    { sector: "Financial",       industry: "Fintech",               country: "US", city: "San Francisco, CA",  lat: 37.79, lng: -122.40 },
  SHOP:  { sector: "Technology",      industry: "E-Commerce Software",   country: "CA", city: "Ottawa, ON",         lat: 45.42, lng: -75.70 },
  UBER:  { sector: "Technology",      industry: "Ride-Sharing",          country: "US", city: "San Francisco, CA",  lat: 37.79, lng: -122.40 },
  LYFT:  { sector: "Technology",      industry: "Ride-Sharing",          country: "US", city: "San Francisco, CA",  lat: 37.79, lng: -122.40 },
  SNAP:  { sector: "Communication",   industry: "Social Media",          country: "US", city: "Santa Monica, CA",   lat: 34.02, lng: -118.49 },
  SPOT:  { sector: "Communication",   industry: "Music Streaming",       country: "SE", city: "Stockholm",          lat: 59.33, lng: 18.07 },
  COIN:  { sector: "Financial",       industry: "Crypto Exchange",       country: "US", city: "San Francisco, CA",  lat: 37.79, lng: -122.40 },
  PLTR:  { sector: "Technology",      industry: "Data Analytics",        country: "US", city: "Denver, CO",         lat: 39.74, lng: -104.99 },
  RBLX:  { sector: "Communication",   industry: "Gaming",                country: "US", city: "San Mateo, CA",      lat: 37.56, lng: -122.32 },
  ABNB:  { sector: "Consumer Cyclical", industry: "Travel & Leisure",    country: "US", city: "San Francisco, CA",  lat: 37.79, lng: -122.40 },
  DIS:   { sector: "Communication",   industry: "Entertainment",         country: "US", city: "Burbank, CA",        lat: 34.18, lng: -118.33 },
  BA:    { sector: "Industrials",     industry: "Aerospace & Defense",   country: "US", city: "Arlington, VA",      lat: 38.88, lng: -77.10 },
  JPM:   { sector: "Financial",       industry: "Banking",               country: "US", city: "New York, NY",       lat: 40.76, lng: -73.98 },
  GS:    { sector: "Financial",       industry: "Investment Banking",    country: "US", city: "New York, NY",       lat: 40.71, lng: -74.01 },
  V:     { sector: "Financial",       industry: "Payments",              country: "US", city: "San Francisco, CA",  lat: 37.79, lng: -122.40 },
  MA:    { sector: "Financial",       industry: "Payments",              country: "US", city: "Purchase, NY",       lat: 41.04, lng: -73.71 },
  WMT:   { sector: "Consumer Defensive", industry: "Retail",             country: "US", city: "Bentonville, AR",    lat: 36.37, lng: -94.21 },
  KO:    { sector: "Consumer Defensive", industry: "Beverages",          country: "US", city: "Atlanta, GA",        lat: 33.75, lng: -84.39 },
  PEP:   { sector: "Consumer Defensive", industry: "Beverages",          country: "US", city: "Purchase, NY",       lat: 41.04, lng: -73.71 },
  NKE:   { sector: "Consumer Cyclical", industry: "Footwear & Apparel",  country: "US", city: "Beaverton, OR",      lat: 45.49, lng: -122.80 },
  SBUX:  { sector: "Consumer Cyclical", industry: "Restaurants",         country: "US", city: "Seattle, WA",        lat: 47.58, lng: -122.33 },
  MCD:   { sector: "Consumer Cyclical", industry: "Restaurants",         country: "US", city: "Chicago, IL",        lat: 41.88, lng: -87.63 },
  UNH:   { sector: "Healthcare",      industry: "Health Insurance",      country: "US", city: "Minnetonka, MN",    lat: 44.92, lng: -93.47 },
  JNJ:   { sector: "Healthcare",      industry: "Pharmaceuticals",       country: "US", city: "New Brunswick, NJ",  lat: 40.49, lng: -74.45 },
  PFE:   { sector: "Healthcare",      industry: "Pharmaceuticals",       country: "US", city: "New York, NY",       lat: 40.75, lng: -73.99 },
  MRNA:  { sector: "Healthcare",      industry: "Biotechnology",         country: "US", city: "Cambridge, MA",      lat: 42.37, lng: -71.08 },
  XOM:   { sector: "Energy",          industry: "Oil & Gas",             country: "US", city: "Houston, TX",        lat: 29.76, lng: -95.37 },
  CVX:   { sector: "Energy",          industry: "Oil & Gas",             country: "US", city: "San Ramon, CA",      lat: 37.78, lng: -121.98 },
  T:     { sector: "Communication",   industry: "Telecom",               country: "US", city: "Dallas, TX",         lat: 32.78, lng: -96.80 },
  VZ:    { sector: "Communication",   industry: "Telecom",               country: "US", city: "New York, NY",       lat: 40.76, lng: -73.97 },
  CMCSA: { sector: "Communication",   industry: "Telecom",               country: "US", city: "Philadelphia, PA",   lat: 39.95, lng: -75.17 },
  BABA:  { sector: "Consumer Cyclical", industry: "E-Commerce",          country: "CN", city: "Hangzhou",           lat: 30.27, lng: 120.15 },
  TSM:   { sector: "Technology",      industry: "Semiconductors",        country: "TW", city: "Hsinchu",            lat: 24.80, lng: 120.97 },
  SONY:  { sector: "Technology",      industry: "Consumer Electronics",  country: "JP", city: "Tokyo",              lat: 35.68, lng: 139.69 },
  TM:    { sector: "Consumer Cyclical", industry: "Auto Manufacturers",  country: "JP", city: "Toyota City",        lat: 35.08, lng: 137.16 },
  TWLO:  { sector: "Technology",      industry: "Cloud Communications",  country: "US", city: "San Francisco, CA",  lat: 37.79, lng: -122.40 },
  ZM:    { sector: "Technology",      industry: "Video Communications",  country: "US", city: "San Jose, CA",       lat: 37.34, lng: -121.89 },
  // Crypto — mapped to origin country of founding team
  "BTC-USD":  { sector: "Crypto",    industry: "Currency",              country: "US", city: "Decentralized",       lat: 39.8,  lng: -98.6 },
  "ETH-USD":  { sector: "Crypto",    industry: "Smart Contracts",       country: "CH", city: "Zug",                 lat: 47.17, lng: 8.52 },
  "SOL-USD":  { sector: "Crypto",    industry: "Smart Contracts",       country: "US", city: "Decentralized",       lat: 39.8,  lng: -98.6 },
  "BNB-USD":  { sector: "Crypto",    industry: "Exchange Token",        country: "CN", city: "Decentralized",       lat: 35.9,  lng: 104.2 },
  "XRP-USD":  { sector: "Crypto",    industry: "Payments",              country: "US", city: "San Francisco, CA",   lat: 37.79, lng: -122.40 },
  "DOGE-USD": { sector: "Crypto",    industry: "Currency",              country: "US", city: "Decentralized",       lat: 39.8,  lng: -98.6 },
  "AVAX-USD": { sector: "Crypto",    industry: "Smart Contracts",       country: "US", city: "New York, NY",        lat: 40.71, lng: -74.01 },
};

export const COUNTRY_NAMES: Record<string, string> = {
  US: "United States", CA: "Canada", CN: "China", TW: "Taiwan",
  JP: "Japan", SE: "Sweden", GB: "United Kingdom", DE: "Germany",
  KR: "South Korea", IN: "India", BR: "Brazil", AU: "Australia",
  CH: "Switzerland", IE: "Ireland", NL: "Netherlands", FR: "France",
};

/** Center lat/lng for country-level map highlighting */
export const COUNTRY_CENTER: Record<string, { lat: number; lng: number }> = {
  US: { lat: 39.8, lng: -98.6 },
  CA: { lat: 56.1, lng: -106.3 },
  CN: { lat: 35.9, lng: 104.2 },
  TW: { lat: 23.7, lng: 120.9 },
  JP: { lat: 36.2, lng: 138.3 },
  SE: { lat: 62.0, lng: 15.0 },
  GB: { lat: 54.0, lng: -2.0 },
  DE: { lat: 51.2, lng: 10.4 },
  KR: { lat: 35.9, lng: 127.8 },
  IN: { lat: 20.6, lng: 78.9 },
  BR: { lat: -14.2, lng: -51.9 },
  AU: { lat: -25.3, lng: 133.8 },
  CH: { lat: 46.8, lng: 8.2 },
  IE: { lat: 53.4, lng: -8.2 },
  NL: { lat: 52.1, lng: 5.3 },
  FR: { lat: 46.6, lng: 2.2 },
};

export const SECTOR_COLORS: Record<string, string> = {
  "Technology": "#5B8DEF",
  "Financial": "#22AB94",
  "Consumer Cyclical": "#F59E0B",
  "Consumer Defensive": "#C47B3A",
  "Healthcare": "#EC4899",
  "Communication": "#A78BFA",
  "Energy": "#E54D4D",
  "Industrials": "#14B8A6",
  "Crypto": "#F7931A",
};

export function getStockMeta(ticker: string): StockMeta | null {
  const clean = ticker.replace(/[=.].*$/, "").toUpperCase();
  return STOCK_META[clean] ?? null;
}

// ─── Formatting helpers ───

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatLargeNumber(value: number | null | undefined): string {
  if (value == null) return "-";
  if (value >= 1e12) return (value / 1e12).toFixed(2) + "T";
  if (value >= 1e9) return (value / 1e9).toFixed(2) + "B";
  if (value >= 1e6) return (value / 1e6).toFixed(2) + "M";
  if (value >= 1e3) return (value / 1e3).toFixed(2) + "K";
  return value.toString();
}

export function formatPercent(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return sign + value.toFixed(2) + "%";
}

export function formatPnl(value: number): string {
  const prefix = value >= 0 ? "+$" : "-$";
  return `${prefix}${Math.abs(value).toFixed(2)}`;
}

export function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const ts = timestamp > 1e12 ? timestamp : timestamp * 1000;
  const diff = now - ts;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return minutes + "m";
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + "h";
  const days = Math.floor(hours / 24);
  return days + "d";
}
