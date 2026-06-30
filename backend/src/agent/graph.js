import { StateGraph, START, END } from "@langchain/langgraph";
import { AgentState } from "./state.js";
import { searchNewsNode, searchFinancialsNode, analyzeNode, decideNode } from "./nodes.js";

const graph = new StateGraph(AgentState)
  .addNode("searchNews", searchNewsNode)
  .addNode("searchFinancials", searchFinancialsNode)
  .addNode("analyze", analyzeNode)
  .addNode("decide", decideNode)
  // Run both searches, then analyze once both are done, then decide.
  .addEdge(START, "searchNews")
  .addEdge(START, "searchFinancials")
  .addEdge("searchNews", "analyze")
  .addEdge("searchFinancials", "analyze")
  .addEdge("analyze", "decide")
  .addEdge("decide", END);

export const investmentAgent = graph.compile();

export async function runResearch(companyName) {
  const result = await investmentAgent.invoke({ companyName, trail: [`Starting research on "${companyName}".`] });
  return result;
}
