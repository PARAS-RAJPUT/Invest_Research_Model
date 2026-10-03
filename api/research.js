import { runResearch } from "../backend/src/agent/graph.js";

export const config = {
  maxDuration: 60,
};

export default async function handler(req, res) {
  // Allow CORS for local dev and cross-origin requests
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { companyName } = req.body;
  if (!companyName || typeof companyName !== "string" || !companyName.trim()) {
    return res.status(400).json({ error: "companyName is required" });
  }

  try {
    const result = await runResearch(companyName.trim());
    return res.json({
      companyName: result.companyName,
      decision: result.decision,
      analysis: result.analysis,
      trail: result.trail,
      sources: {
        news: result.newsResults?.map((r) => ({ title: r.title, url: r.url })) ?? [],
        financial: result.financialResults?.map((r) => ({ title: r.title, url: r.url })) ?? [],
      },
    });
  } catch (err) {
    console.error("Research failed:", err);
    return res.status(500).json({ error: "Research agent failed", detail: err.message });
  }
}
