"""Agent state schema (Pydantic v2) for LangGraph.

This module defines the shared state object that flows between LangGraph
nodes. It captures the core artifacts of a research run for a single ticker:

* ticker symbol
* retrieved documents from RAG
* normalized financial snapshot
* normalized news items
* final LLM report text
* numeric risk score
* error information (if any step fails)
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Union

from pydantic import BaseModel, ConfigDict, Field

from src.data.finance_client import FinancialSnapshot
from src.data.normalizer import NewsItem


class RetrievedDoc(BaseModel):
    """Lightweight representation of a retrieved document chunk."""

    model_config = ConfigDict(from_attributes=True)

    id: str = Field(..., description="Unique identifier of the chunk in the vector store.")
    text: str = Field(..., description="Retrieved passage text.")
    metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Metadata such as ticker, filing_type, date, section, etc.",
    )
    score: Optional[float] = Field(
        default=None,
        description="Relevance score (e.g. rerank score or similarity).",
    )


class AgentState(BaseModel):
    """LangGraph agent state for a single research request."""

    model_config = ConfigDict(from_attributes=True)

    ticker: Optional[str] = Field(
        default=None,
        description="Ticker symbol being researched, e.g. 'AAPL'.",
    )

    retrieved_docs: List[RetrievedDoc] = Field(
        default_factory=list,
        description="Top retrieved filing passages used as context.",
    )

    financials: Optional[FinancialSnapshot] = Field(
        default=None,
        description="Normalized financial snapshot for the ticker.",
    )

    news: List[NewsItem] = Field(
        default_factory=list,
        description="Recent news items associated with the ticker.",
    )

    report: Union[dict, str] = Field(
        default_factory=dict,
        description="Structured analyst-style research report (recommendation, price targets, bull/bear cases, etc).",
    )

    risk_score: Optional[float] = Field(
        default=None,
        description="Overall risk score on a 0–100 scale (higher = riskier).",
        ge=0.0,
        le=100.0,
    )

    recommendation: Optional[str] = Field(
        default=None,
        description="BUY / HOLD / SELL recommendation from calculate_recommendation.",
    )
    recommendation_score: Optional[int] = Field(
        default=None,
        description="Numeric score used to derive recommendation (-4 to +6 range).",
    )
    recommendation_reasons: List[str] = Field(
        default_factory=list,
        description="List of plain-English reasons for the recommendation.",
    )
    plain_english_summary: Optional[str] = Field(
        default=None,
        description="4-5 sentence plain-English summary for the Bottom Line section.",
    )
    overall_sentiment_score: Optional[float] = Field(
        default=None,
        description="Weighted average sentiment from news articles in [-1, 1].",
    )
    sentiment_score: float = Field(
        default=0.0,
        description="LLM-derived overall market sentiment score in [-1, 1].",
    )
    sentiment_label: str = Field(
        default="Neutral",
        description="Bullish / Slightly Bullish / Neutral / Slightly Bearish / Bearish.",
    )
    sentiment_summary: str = Field(
        default="",
        description="2-sentence LLM summary of current market sentiment.",
    )
    price_target: Optional[float] = Field(
        default=None,
        description="12-month price target from analyst-style bull/bear analysis.",
    )
    price_target_upside: Optional[float] = Field(
        default=None,
        description="Percent upside/downside from current price to price target.",
    )
    bull_case: Optional[str] = Field(
        default=None,
        description="Best case scenario for the stock.",
    )
    bear_case: Optional[str] = Field(
        default=None,
        description="Worst case scenario for the stock.",
    )
    time_horizon: Optional[str] = Field(
        default=None,
        description="Time horizon for price target (e.g. 12 months).",
    )

    error: Optional[str] = Field(
        default=None,
        description="Error message if any node fails; should be surfaced to the client.",
    )

