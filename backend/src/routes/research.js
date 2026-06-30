import { Router } from "express";
import { runResearch } from "../agent/graph.js";

const router = Router();

router.post("/research", async (req, res) => {
  const { companyName } = req.body;
  if (!companyName || typeof companyName !== "string" || !companyName.trim()) {
    return res.status(400).json({ error: "companyName is required" });
  }
  try {
    const result = await runResearch(companyName.trim());
    res.json({
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
    res.status(500).json({ error: "Research agent failed", detail: err.message });
  }
});

export default router;