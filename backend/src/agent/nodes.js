import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

const model = process.env.OPENAI_MODEL || "llama-3.3-70b-versatile";

const llm = new ChatOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  model,
  configuration: {
    baseURL: "https://api.groq.com/openai/v1",
  },
});

async function tavilySearch(query, maxResults = 5) {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
      max_results: maxResults,
      search_depth: "advanced",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Tavily API error (${res.status}): ${text}`);
  }
  const data = await res.json();
  return (data.results || []).map((r) => ({
    title: r.title,
    url: r.url,
    content: r.content,
    score: r.score,
  }));
}

export async function searchNewsNode(state) {
  const query = `${state.companyName} company news, leadership, controversies, competitive position, latest developments`;
  let results = [];
  try {
    results = await tavilySearch(query, 5);
  } catch (err) {
    return { newsResults: [], trail: [`News search failed: ${err.message}`] };
  }
  return {
    newsResults: results,
    trail: [`Searched news/qualitative signals for "${state.companyName}" — found ${results.length} sources.`],
  };
}

export async function searchFinancialsNode(state) {
  const query = `${state.companyName} revenue, profit, funding, valuation, financial performance, stock or growth metrics`;
  let results = [];
  try {
    results = await tavilySearch(query, 5);
  } catch (err) {
    return { financialResults: [], trail: [`Financial search failed: ${err.message}`] };
  }
  return {
    financialResults: results,
    trail: [`Searched financial/business performance signals — found ${results.length} sources.`],
  };
}

const AnalysisSchema = z.object({
  businessSummary: z.string().describe("2-3 sentence summary of what the company does and its market position"),
  strengths: z.array(z.string()).describe("Key positive signals found in research (3-5 items)"),
  risks: z.array(z.string()).describe("Key risk factors or red flags found in research (3-5 items)"),
  financialSignal: z.string().describe("Summary of financial health/trajectory based on findings, or 'insufficient data' if not found"),
  dataQuality: z.enum(["strong", "moderate", "weak"]).describe("How reliable/sufficient the gathered research is for making an investment call"),
});

export async function analyzeNode(state) {
  const structuredLlm = llm.withStructuredOutput(AnalysisSchema, {
    name: "analysis",
    method: "function_calling",
  });

  const newsText = state.newsResults
    .map((r, i) => `[News ${i + 1}] ${r.title}\n${r.content}\nSource: ${r.url}`)
    .join("\n\n");
  const finText = state.financialResults
    .map((r, i) => `[Financial ${i + 1}] ${r.title}\n${r.content}\nSource: ${r.url}`)
    .join("\n\n");

  const prompt = `You are an equity research analyst. Analyze the following raw web search results about "${state.companyName}" and extract a structured, factual analysis. Be skeptical of marketing language and weigh credible sources higher. If data is thin, say so honestly rather than inventing facts.

=== NEWS & QUALITATIVE SOURCES ===
${newsText || "No news results found."}

=== FINANCIAL/BUSINESS SOURCES ===
${finText || "No financial results found."}`;

  const analysis = await structuredLlm.invoke(prompt);

  return {
    analysis,
    trail: [`Analyzed ${state.newsResults.length + state.financialResults.length} sources and extracted structured findings (data quality: ${analysis.dataQuality}).`],
  };
}

const DecisionSchema = z.object({
  verdict: z.enum(["INVEST", "PASS"]).describe("Final investment recommendation"),
  confidence: z.enum(["low", "medium", "high"]).describe("Confidence in this verdict given available data"),
  reasoning: z.array(z.string()).describe("3-6 bullet points explaining the reasoning behind the verdict, referencing specific findings"),
  oneLineThesis: z.string().describe("A single sentence investment thesis summarizing the call"),
});

export async function decideNode(state) {
  const structuredLlm = llm.withStructuredOutput(DecisionSchema, {
    name: "decision",
    method: "function_calling",
  });

  const prompt = `You are a disciplined venture/equity investor making a go/no-go call on "${state.companyName}".

Here is the structured research analysis:
${JSON.stringify(state.analysis, null, 2)}

Based ONLY on this analysis, decide INVEST or PASS. Be decisive but honest about uncertainty — if data quality is weak, factor that into your confidence level (not into avoiding a decision). Ground every reasoning bullet in something from the analysis above, don't invent new facts.`;

  const decision = await structuredLlm.invoke(prompt);

  return {
    decision,
    trail: [`Final verdict: ${decision.verdict} (confidence: ${decision.confidence}).`],
  };
}