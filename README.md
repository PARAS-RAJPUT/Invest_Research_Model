# Investment Research Agent

An AI agent that takes a company name, researches it on the live web, and returns an **INVEST / PASS** call with transparent, source-grounded reasoning — built for the Altuni AI Labs / InsideIIM take-home assignment.

The UI frames each run as a "case file": you open a case on a company, watch the field notes stream in as the agent searches, and the result lands as a stamped verdict with the full reasoning trail and sources underneath it.

---

## Overview

Given a company name, the agent:

1. Searches the live web for recent news, leadership, and competitive-position signals.
2. Searches the live web for financial/business-performance signals (revenue, funding, valuation, growth).
3. Has an LLM read both sets of results and extract a structured analysis (business summary, strengths, risks, financial signal, and a self-reported data-quality rating).
4. Has a second LLM call make a disciplined INVEST/PASS call, grounded only in that analysis, with a confidence level and a bullet-pointed reasoning trail.

Every step is logged to a "trail" that the frontend renders live, and every source URL used is shown at the bottom — so the verdict is auditable, not a black box.

---

## How to run it

### Prerequisites
- Node.js 18+
- An [OpenAI API key](https://platform.openai.com/api-keys)
- A [Tavily API key](https://app.tavily.com) (free tier is enough — used for web search)

### Backend
```bash
cd backend
cp .env.example .env
# edit .env and paste in your OPENAI_API_KEY and TAVILY_API_KEY
npm install
npm run dev
```
Runs on `http://localhost:4000`.

### Frontend
```bash
cd frontend
cp .env.example .env
# VITE_API_BASE defaults to http://localhost:4000, change only if needed
npm install
npm run dev
```
Runs on `http://localhost:5173`.

Open the frontend URL, type a company name, click "Open Case."

### Environment variables
| Variable | Where | Purpose |
|---|---|---|
| `OPENAI_API_KEY` | backend `.env` | LLM calls (analysis + decision) |
| `TAVILY_API_KEY` | backend `.env` | Live web search |
| `OPENAI_MODEL` | backend `.env` | Optional, defaults to `gpt-4o-mini` |
| `VITE_API_BASE` | frontend `.env` | URL of the backend API |

---

## How it works

**Stack:** React + Vite (frontend), Node.js + Express (backend), LangGraph.js for the agent orchestration, OpenAI for the LLM, Tavily for web search.

**Why a graph instead of one big prompt:** the task naturally decomposes into independent research steps followed by reasoning steps, and LangGraph.js makes that decomposition explicit, debuggable, and inspectable (each node's output is visible in the trail), rather than hoping a single mega-prompt does research, analysis, and judgment all at once correctly.

**Graph shape:**
```
        ┌──────────────┐
START ──┤ searchNews    │──┐
        └──────────────┘  │
                           ├──▶ analyze ──▶ decide ──▶ END
        ┌──────────────┐  │
START ──┤ searchFinanc. │──┘
        └──────────────┘
```
- `searchNews` / `searchFinancials` run in parallel (LangGraph fans them both out from `START` and joins them before `analyze` runs), each hitting the Tavily search API with a different query angle.
- `analyze` is an LLM call constrained to a Zod schema (via `withStructuredOutput`) so the output is always well-formed JSON: business summary, strengths, risks, financial signal, and a self-rated data-quality flag.
- `decide` is a second, separate LLM call that only sees the structured analysis (not the raw search results) and is instructed to ground every reasoning bullet in that analysis rather than invent new facts. Forcing two distinct calls — research synthesis, then judgment — instead of one call that does both keeps the final decision auditable against a fixed analysis rather than a moving target.

**Backend** is a single `POST /api/research` endpoint that runs the graph and returns the full final state (decision, analysis, trail, sources) in one response.

**Frontend** is a single-page case-file UI: an intake form, a streaming-looking trail of field notes, and a stamped verdict (CSS animation + a subtle SVG turbulence filter so the stamp doesn't look like a flat vector box) with the structured findings and clickable sources underneath.

---

## Key decisions & trade-offs

- **Tavily over a raw SerpAPI/Bing wrapper:** Tavily is purpose-built for LLM agents (returns clean, already-summarized content blocks instead of raw SERPs), which meant less prompt engineering to get usable signal into the analysis step. I called its REST API directly rather than through `@langchain/community`'s wrapper — that package pulls in a large, unrelated dependency tree (it bundles dozens of unrelated integrations) that caused npm peer-dependency conflicts for the sake of one tool, so a 15-line `fetch` call was the more reliable choice.
- **Two LLM calls (analyze → decide) instead of one:** slightly more latency and token cost, but it means the decision step can be evaluated independently from the research-synthesis step, and the reasoning is provably grounded in the analysis rather than re-reading raw search results and possibly drifting.
- **No persistence / no auth:** the assignment is a single-shot research tool, not a multi-user product, so I didn't add a database or accounts. Every run is stateless. If this needed to be a real product, I'd add a Postgres table to store past case files and let users revisit them.
- **`gpt-4o-mini` as the default model:** good structured-output reliability at low cost/latency for an agent that makes two LLM calls per run; swappable via `OPENAI_MODEL` env var.
- **Two search queries instead of one broad query:** splitting "news/qualitative" from "financial/business performance" gets more targeted Tavily results than one generic "tell me about X" query, at the cost of one extra API call per run.
- **What I left out:** no PDF/10-K parsing, no stock price API, no multi-turn chat/follow-up Q&A on a case file, no streaming of LLM tokens to the frontend (the trail is rendered after each node completes, not token-by-token). These were cut to stay inside the 7-day scope and keep the core loop (search → analyze → decide) solid rather than spreading thin across many shallow features.
- **Ambiguity I resolved myself:** the brief doesn't specify what the agent should research or how confident it should sound. I chose recency-weighted news + financial signals as the two research angles, and made the agent state its own data-quality rating so a weak-data verdict is visibly flagged as low-confidence rather than presented with false certainty.

---

## Example runs

> Run the app locally with your own API keys and paste 2–3 real outputs here before submitting — screenshots of the stamped verdict plus the underlying JSON response from `/api/research` work well. I did not have live OpenAI/Tavily keys available while scaffolding this, so I left this section for you to fill in with genuine runs rather than fabricate sample output.

Suggested companies to try (a mix of well-covered and thinner-data cases, to show the data-quality flag actually responds to evidence): a large listed company, a recent unicorn/startup, and a lesser-known regional company.

---

## What I would improve with more time

- Stream LLM tokens to the frontend (SSE or WebSocket) so the analysis/decision text appears progressively instead of arriving all at once.
- Add a lightweight "self-critique" node: have the LLM check its own decision against the analysis for unsupported claims before returning it.
- Pull a real financial data API (e.g. a market data provider) for listed companies instead of relying purely on search-engine snippets for numbers.
- Persist case files (Postgres) so past research is browsable and comparable over time.
- Add eval cases (e.g. a fixed list of companies with expected verdict direction) to catch regressions when prompts change.
- Mobile polish on the dossier layout — current responsive breakpoint is basic.

---

## LLM chat session logs (bonus)

Add your transcript/logs here, or as a separate file in the submission zip, per the assignment's bonus instructions.
