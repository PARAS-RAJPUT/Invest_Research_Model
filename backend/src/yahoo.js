// Yahoo Finance public endpoints — no API key required.
// Runs server-side (Vercel function), so no CORS issues.

const YF1 = "https://query1.finance.yahoo.com";
const YF2 = "https://query2.finance.yahoo.com";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Accept: "application/json",
  "Accept-Language": "en-US,en;q=0.9",
};

/**
 * Search Yahoo Finance for a ticker symbol given a company name.
 * Returns the best-matching equity symbol, or null if not found.
 */
export async function searchTicker(query) {
  const url = `${YF1}/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=5&newsCount=0&enableFuzzyQuery=true`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Yahoo Finance search failed: ${res.status}`);
  const data = await res.json();
  const quotes = data.result?.quotes || [];
  // Prefer EQUITY type, then ETF, then anything
  const equity =
    quotes.find((q) => q.quoteType === "EQUITY") ||
    quotes.find((q) => q.quoteType === "ETF") ||
    quotes[0];
  return equity ? { symbol: equity.symbol, name: equity.longname || equity.shortname } : null;
}

/**
 * Fetch comprehensive financial summary for a symbol.
 * Returns the parsed quoteSummary result object, or null on failure.
 */
export async function getQuoteSummary(symbol) {
  const modules = [
    "price",
    "summaryProfile",
    "financialData",
    "defaultKeyStatistics",
    "recommendationTrend",
    "assetProfile",
    "earningsTrend",
  ].join(",");

  // Try query1 first, fall back to query2
  for (const base of [YF1, YF2]) {
    try {
      const url = `${base}/v10/finance/quoteSummary/${symbol}?modules=${modules}&corsDomain=finance.yahoo.com`;
      const res = await fetch(url, { headers: HEADERS });
      if (!res.ok) continue;
      const data = await res.json();
      const result = data.quoteSummary?.result?.[0];
      if (result) return result;
    } catch {
      // try next base
    }
  }
  return null;
}

/**
 * Fetch recent news headlines for a symbol from Yahoo Finance search.
 */
export async function getNews(symbol) {
  try {
    const url = `${YF1}/v1/finance/search?q=${encodeURIComponent(symbol)}&quotesCount=0&newsCount=6`;
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.result?.news || []).map((n) => ({
      title: n.title,
      url: n.link || `https://finance.yahoo.com/quote/${symbol}/news`,
    }));
  } catch {
    return [];
  }
}
