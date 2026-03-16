"""LangGraph StateGraph definition for the stock research agent.

This module wires together the five agent nodes into a LangGraph StateGraph:

1. DataFetcher
2. RAGRetriever
3. SentimentAnalyzer
4. FinancialAnalyzer
5. ReportGenerator

If any node sets ``state.error``, control is routed to ``END`` immediately so
the caller can inspect the error message.
"""

from __future__ import annotations

from typing import Literal

from langgraph.graph import END, StateGraph

from src.agents.state import AgentState
from src.agents.nodes import (
    data_fetcher_node,
    rag_retriever_node,
    sentiment_analyzer_node,
    financial_analyzer_node,
    report_generator_node,
)


def _route_on_error(state: AgentState) -> Literal["ok", "error"]:
    """Route to next node or END based on presence of an error."""

    return "error" if state.error else "ok"


def create_graph() -> StateGraph:
    """Build and return the LangGraph StateGraph (uncompiled) with all nodes wired."""

    graph = StateGraph(AgentState)

    # Register nodes.
    graph.add_node("DataFetcher", data_fetcher_node)
    graph.add_node("RAGRetriever", rag_retriever_node)
    graph.add_node("SentimentAnalyzer", sentiment_analyzer_node)
    graph.add_node("FinancialAnalyzer", financial_analyzer_node)
    graph.add_node("ReportGenerator", report_generator_node)

    # Entry point.
    graph.set_entry_point("DataFetcher")

    # Conditional edges for error short-circuiting.
    graph.add_conditional_edges(
        "DataFetcher",
        _route_on_error,
        {
            "ok": "RAGRetriever",
            "error": END,
        },
    )
    graph.add_conditional_edges(
        "RAGRetriever",
        _route_on_error,
        {
            "ok": "SentimentAnalyzer",
            "error": END,
        },
    )
    graph.add_conditional_edges(
        "SentimentAnalyzer",
        _route_on_error,
        {
            "ok": "FinancialAnalyzer",
            "error": END,
        },
    )
    graph.add_conditional_edges(
        "FinancialAnalyzer",
        _route_on_error,
        {
            "ok": "ReportGenerator",
            "error": END,
        },
    )
    graph.add_conditional_edges(
        "ReportGenerator",
        _route_on_error,
        {
            "ok": END,
            "error": END,
        },
    )

    return graph


def build_graph() -> StateGraph:
    """Create and return the **compiled** LangGraph graph for the agent."""

    return create_graph().compile()


# Convenience alias for immediate use.
compiled_graph = build_graph()

