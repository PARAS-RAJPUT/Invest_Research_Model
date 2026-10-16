// Investment research pipeline — no LLM or external API keys required.
// Uses Yahoo Finance public endpoints + rule-based scoring.

import { searchTicker, getQuoteSummary, getNews } from "../yahoo.js";
import { scoreAndAnalyze } from "../scorer.js";

/**
 * Run a full investment research pipeline for a given company name.
 * Returns a result object in the same shape as before (compatible with api/research.js).
 */
export async function runResearch(companyName) {
  const trail = [`Opening a file on "${companyName}".`];

  // Step 1: Resolve company name → ticker symbol
  trail.push(`Searching for "${companyName}" on Yahoo Finance…`);
  const match = await searchTicker(companyName);
  if (!match) {
    throw new Error(
      `Could not find a listed stock for "${companyName}". Try a more specific name or the ticker symbol.`
    );
  }
  const { symbol, name } = match;
  trail.push(`Found: ${name || symbol} (${symbol}).`);

  // Step 2: Fetch financial data + news in parallel
  trail.push(`Fetching financial data from Yahoo Finance for ${symbol}…`);
  const [summaryData, news] = await Promise.all([
    getQuoteSummary(symbol),
    getNews(symbol),
  ]);

  if (!summaryData) {
    throw new Error(
      `Yahoo Finance returned no data for ${symbol}. The stock may be delisted or the ticker may have changed.`
    );
  }

  const modulesLoaded = Object.keys(summaryData).join(", ");
  trail.push(`Retrieved: ${modulesLoaded}.`);
  if (news.length) trail.push(`Found ${news.length} recent news articles.`);

  // Step 3: Score with rule-based engine
  trail.push(`Running quantitative analysis across 10 financial signals…`);
  const { decision, analysis } = scoreAndAnalyze(symbol, summaryData);
  trail.push(
    `Analysis complete — data quality: ${analysis.dataQuality}. Evaluated: profit margin, revenue growth, earnings growth, ROE, D/E ratio, current ratio, valuation (P/E), analyst consensus, and free cash flow.`
  );
  trail.push(`Final verdict: ${decision.verdict} (confidence: ${decision.confidence}).`);

  // Build source links (Yahoo Finance pages for this ticker)
  const financialResults = [
    {
      title: `${symbol} Summary — Yahoo Finance`,
      url: `https://finance.yahoo.com/quote/${symbol}`,
    },
    {
      title: `${symbol} Financials — Yahoo Finance`,
      url: `https://finance.yahoo.com/quote/${symbol}/financials`,
    },
    {
      title: `${symbol} Statistics — Yahoo Finance`,
      url: `https://finance.yahoo.com/quote/${symbol}/key-statistics`,
    },
    {
      title: `${symbol} Analyst Ratings — Yahoo Finance`,
      url: `https://finance.yahoo.com/quote/${symbol}/analysis`,
    },
  ];

  return {
    companyName:
      summaryData.price?.longName ||
      summaryData.price?.shortName ||
      name ||
      companyName,
    decision,
    analysis,
    trail,
    newsResults: news,
    financialResults,
  };
}
