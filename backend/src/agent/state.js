import { Annotation } from "@langchain/langgraph";

// Shared state that flows through every node in the graph.
// Each node reads from this and returns a partial update.
export const AgentState = Annotation.Root({
  companyName: Annotation(),

  // Raw search results (array of { title, url, content, score })
  newsResults: Annotation({
    reducer: (_, next) => next,
    default: () => [],
  }),
  financialResults: Annotation({
    reducer: (_, next) => next,
    default: () => [],
  }),

  // Structured extraction from the LLM after reading search results
  analysis: Annotation({
    reducer: (_, next) => next,
    default: () => null,
  }),

  // Final structured decision
  decision: Annotation({
    reducer: (_, next) => next,
    default: () => null,
  }),

  // Human-readable log of what the agent did, step by step (for UI trail)
  trail: Annotation({
    reducer: (curr, next) => [...(curr ?? []), ...(Array.isArray(next) ? next : [next])],
    default: () => [],
  }),

  error: Annotation({
    reducer: (_, next) => next,
    default: () => null,
  }),
});
