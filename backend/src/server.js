import "dotenv/config";
import express from "express";
import cors from "cors";
import researchRouter from "./routes/research.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api", researchRouter);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Investment research agent backend running on http://localhost:${PORT}`);
  if (!process.env.OPENAI_API_KEY) console.warn("WARNING: OPENAI_API_KEY is not set.");
  if (!process.env.TAVILY_API_KEY) console.warn("WARNING: TAVILY_API_KEY is not set.");
});