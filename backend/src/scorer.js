// Rule-based investment scoring engine.
// No LLM required — uses real financial ratios from Yahoo Finance.

function pct(raw) {
  if (raw == null) return null;
  return (raw * 100).toFixed(1) + "%";
}

function num(raw, decimals = 2) {
  if (raw == null) return null;
  return Number(raw).toFixed(decimals);
}

/**
 * Score a company's financials and produce a structured investment analysis.
 * @param {string} symbol - Ticker symbol (for display)
 * @param {object} data   - quoteSummary result from Yahoo Finance
 * @returns {{ decision, analysis }}
 */
export function scoreAndAnalyze(symbol, data) {
  const {
    price = {},
    summaryProfile = {},
    financialData = {},
    defaultKeyStatistics = {},
    recommendationTrend = {},
    assetProfile = {},
  } = data;

  const strengths = [];
  const risks = [];
  let score = 0;
  let maxScore = 0;

  // ── Profitability ─────────────────────────────────────────────────────────
  const profitMargin = financialData?.profitMargins?.raw;
  maxScore += 2;
  if (profitMargin != null) {
    if (profitMargin > 0.2) {
      strengths.push(`Strong profit margin of ${pct(profitMargin)}`);
      score += 2;
    } else if (profitMargin > 0.08) {
      strengths.push(`Decent profit margin of ${pct(profitMargin)}`);
      score += 1;
    } else if (profitMargin > 0) {
      risks.push(`Thin profit margin of ${pct(profitMargin)} — limited pricing power`);
    } else {
      risks.push(`Company is currently unprofitable (margin: ${pct(profitMargin)})`);
    }
  }

  // ── Revenue Growth ────────────────────────────────────────────────────────
  const revenueGrowth = financialData?.revenueGrowth?.raw;
  maxScore += 2;
  if (revenueGrowth != null) {
    if (revenueGrowth > 0.2) {
      strengths.push(`Strong revenue growth of ${pct(revenueGrowth)} YoY`);
      score += 2;
    } else if (revenueGrowth > 0.05) {
      strengths.push(`Moderate revenue growth of ${pct(revenueGrowth)} YoY`);
      score += 1;
    } else if (revenueGrowth >= 0) {
      risks.push(`Slow revenue growth of ${pct(revenueGrowth)} YoY`);
    } else {
      risks.push(`Revenue declining ${pct(Math.abs(revenueGrowth))} YoY — concerning trend`);
    }
  }

  // ── Earnings Growth ───────────────────────────────────────────────────────
  const earningsGrowth = financialData?.earningsGrowth?.raw;
  maxScore += 1;
  if (earningsGrowth != null) {
    if (earningsGrowth > 0.15) {
      strengths.push(`Earnings growing at ${pct(earningsGrowth)} YoY`);
      score += 1;
    } else if (earningsGrowth < -0.1) {
      risks.push(`Earnings declining at ${pct(Math.abs(earningsGrowth))} YoY`);
    }
  }

  // ── Return on Equity ──────────────────────────────────────────────────────
  const roe = financialData?.returnOnEquity?.raw;
  maxScore += 1;
  if (roe != null) {
    if (roe > 0.15) {
      strengths.push(`High return on equity of ${pct(roe)} — efficient capital use`);
      score += 1;
    } else if (roe < 0) {
      risks.push(`Negative return on equity (${pct(roe)}) — destroying shareholder value`);
    }
  }

  // ── Debt / Equity ─────────────────────────────────────────────────────────
  // Yahoo returns D/E as a percentage (e.g. 45.2 means 0.452)
  const deRaw = defaultKeyStatistics?.debtToEquity?.raw;
  maxScore += 1;
  if (deRaw != null) {
    const de = deRaw / 100;
    if (de < 0.5) {
      strengths.push(`Low debt-to-equity ratio of ${num(de)} — financially conservative`);
      score += 1;
    } else if (de > 2) {
      risks.push(`High leverage — debt-to-equity of ${num(de)} raises solvency risk`);
    }
  }

  // ── Current Ratio ─────────────────────────────────────────────────────────
  const currentRatio = financialData?.currentRatio?.raw;
  maxScore += 1;
  if (currentRatio != null) {
    if (currentRatio > 1.5) {
      strengths.push(`Healthy current ratio of ${num(currentRatio)} — strong short-term liquidity`);
      score += 1;
    } else if (currentRatio < 1) {
      risks.push(`Current ratio of ${num(currentRatio)} is below 1 — liquidity concern`);
    }
  }

  // ── Valuation (PE) ────────────────────────────────────────────────────────
  const forwardPE = defaultKeyStatistics?.forwardPE?.raw;
  const trailingPE = defaultKeyStatistics?.trailingPE?.raw;
  const pe = forwardPE ?? trailingPE;
  const peLabel = forwardPE ? "forward P/E" : "trailing P/E";
  maxScore += 1;
  if (pe != null && pe > 0) {
    if (pe < 15) {
      strengths.push(`Attractively valued at ${num(pe, 1)}x ${peLabel}`);
      score += 1;
    } else if (pe > 60) {
      risks.push(`Expensive at ${num(pe, 1)}x ${peLabel} — priced for perfection`);
    } else {
      strengths.push(`Reasonable valuation at ${num(pe, 1)}x ${peLabel}`);
      score += 0.5;
    }
  }

  // ── Analyst Sentiment ─────────────────────────────────────────────────────
  const trend = recommendationTrend?.trend?.[0]; // most recent period
  maxScore += 1;
  if (trend) {
    const total =
      (trend.strongBuy || 0) +
      (trend.buy || 0) +
      (trend.hold || 0) +
      (trend.sell || 0) +
      (trend.strongSell || 0);
    const bullish = (trend.strongBuy || 0) + (trend.buy || 0);
    if (total >= 3) {
      const bullPct = bullish / total;
      if (bullPct >= 0.6) {
        strengths.push(
          `${Math.round(bullPct * 100)}% of ${total} analysts rate it Buy or Strong Buy`
        );
        score += 1;
      } else if (bullPct < 0.25) {
        risks.push(
          `Only ${Math.round(bullPct * 100)}% of ${total} analysts are bullish on the stock`
        );
      } else {
        strengths.push(`Mixed analyst sentiment — ${bullish} buys out of ${total} ratings`);
        score += 0.4;
      }
    }
  }

  // ── Free Cash Flow ────────────────────────────────────────────────────────
  const fcf = financialData?.freeCashflow?.raw;
  maxScore += 1;
  if (fcf != null) {
    if (fcf > 0) {
      const fcfFmt = financialData.freeCashflow?.fmt || `$${(fcf / 1e9).toFixed(1)}B`;
      strengths.push(`Positive free cash flow of ${fcfFmt} — self-funding operations`);
      score += 1;
    } else {
      risks.push(`Negative free cash flow — company is cash-burning`);
    }
  }

  // ── Verdict ───────────────────────────────────────────────────────────────
  const ratio = maxScore > 0 ? score / maxScore : 0;
  let verdict, confidence;

  if (ratio >= 0.65) {
    verdict = "INVEST";
    confidence = ratio >= 0.8 ? "high" : "medium";
  } else if (ratio >= 0.45) {
    verdict = "PASS";
    confidence = "low";
  } else {
    verdict = "PASS";
    confidence = ratio < 0.3 ? "high" : "medium";
  }

  // ── Financial signal sentence ──────────────────────────────────────────────
  const parts = [];
  if (financialData?.totalRevenue?.fmt) parts.push(`Revenue: ${financialData.totalRevenue.fmt}`);
  if (financialData?.ebitda?.fmt) parts.push(`EBITDA: ${financialData.ebitda.fmt}`);
  if (price?.marketCap?.fmt) parts.push(`Market cap: ${price.marketCap.fmt}`);
  if (financialData?.grossProfits?.fmt) parts.push(`Gross profit: ${financialData.grossProfits.fmt}`);
  const financialSignal = parts.length ? parts.join(" · ") : "Insufficient financial data from Yahoo Finance.";

  // ── Business summary ──────────────────────────────────────────────────────
  const rawDesc =
    summaryProfile?.longBusinessSummary ||
    assetProfile?.longBusinessSummary ||
    "";
  const sector = summaryProfile?.sector || assetProfile?.sector || "";
  const industry = summaryProfile?.industry || assetProfile?.industry || "";
  const country = summaryProfile?.country || assetProfile?.country || "";

  let businessSummary = rawDesc ? rawDesc.slice(0, 350) + (rawDesc.length > 350 ? "…" : "") : "";
  if (!businessSummary) {
    businessSummary = `${price?.longName || symbol} is a publicly listed company`;
    if (sector) businessSummary += ` operating in the ${sector} sector`;
    if (industry) businessSummary += ` (${industry})`;
    if (country) businessSummary += `, headquartered in ${country}`;
    businessSummary += ".";
  }

  // ── Data quality ──────────────────────────────────────────────────────────
  const filledFields = [
    profitMargin, revenueGrowth, roe, deRaw, currentRatio, pe, fcf,
  ].filter((v) => v != null).length;
  const dataQuality = filledFields >= 5 ? "strong" : filledFields >= 3 ? "moderate" : "weak";

  // ── One-line thesis ───────────────────────────────────────────────────────
  const displayName = price?.shortName || price?.longName || symbol;
  const keySignal =
    verdict === "INVEST"
      ? strengths[0]?.toLowerCase() || "solid fundamentals"
      : risks[0]?.toLowerCase() || "weak fundamentals";
  const oneLineThesis =
    verdict === "INVEST"
      ? `${displayName} is a ${confidence}-conviction BUY driven by ${keySignal}.`
      : `${displayName} gets a PASS — primary concern: ${keySignal}.`;

  // ── Reasoning bullets ─────────────────────────────────────────────────────
  const reasoning = [
    ...strengths.slice(0, 3).map((s) => `✅ ${s}`),
    ...risks.slice(0, 3).map((r) => `⚠️ ${r}`),
  ];
  if (reasoning.length === 0)
    reasoning.push("Insufficient data available to form a strong conviction either way.");

  // Fill empty arrays so the UI doesn't break
  if (!strengths.length) strengths.push("No clear positive signals identified from available data.");
  if (!risks.length) risks.push("No specific risk factors identified from available data.");

  return {
    decision: { verdict, confidence, reasoning, oneLineThesis },
    analysis: { businessSummary, strengths, risks, financialSignal, dataQuality },
  };
}
