"""Investment committee helper.

Provides a small multi-role decision workflow for portfolio demonstration.
If AutoGen is available and configured, this module can be extended to run a
true LLM multi-agent conversation. For now, it guarantees a deterministic,
offline-safe fallback so the API remains reliable.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class CommitteeInput:
    ticker: str
    recommendation: str
    risk_score: float
    sentiment_score: float
    pe_ratio: float | None
    profit_margin: float | None


def _agent_bull_case(data: CommitteeInput) -> str:
    points: list[str] = []
    if data.profit_margin is not None and data.profit_margin > 0.15:
        points.append(f"healthy profit margin ({data.profit_margin * 100:.1f}%)")
    if data.sentiment_score > 0.1:
        points.append("supportive market sentiment")
    if data.recommendation.upper() == "BUY":
        points.append("base model already leans bullish")
    if not points:
        points.append("stable operating profile with potential upside")
    return "Bull analyst: " + ", ".join(points) + "."


def _agent_bear_case(data: CommitteeInput) -> str:
    points: list[str] = []
    if data.pe_ratio is not None and data.pe_ratio > 35:
        points.append(f"valuation appears stretched (P/E {data.pe_ratio:.1f})")
    if data.risk_score > 60:
        points.append("elevated risk score")
    if data.sentiment_score < -0.1:
        points.append("negative sentiment trend")
    if not points:
        points.append("execution or macro risk can still pressure returns")
    return "Bear analyst: " + ", ".join(points) + "."


def _agent_risk_officer(data: CommitteeInput) -> str:
    band = "low" if data.risk_score < 40 else "medium" if data.risk_score < 65 else "high"
    return f"Risk officer: overall risk is {band} ({data.risk_score:.1f}/100); size position accordingly."


def _chair_verdict(data: CommitteeInput) -> dict[str, Any]:
    score = 0
    if data.recommendation.upper() == "BUY":
        score += 1
    if data.sentiment_score > 0.1:
        score += 1
    if data.risk_score > 65:
        score -= 2
    elif data.risk_score > 50:
        score -= 1
    if data.pe_ratio is not None and data.pe_ratio > 40:
        score -= 1

    if score >= 1:
        final = "APPROVE_BUY"
    elif score <= -1:
        final = "REJECT_BUY"
    else:
        final = "WATCHLIST"

    return {
        "decision": final,
        "confidence": min(0.95, max(0.55, 0.65 + (abs(score) * 0.1))),
    }


def run_committee(data: CommitteeInput) -> dict[str, Any]:
    """Run a simple investment committee workflow and return structured output."""
    bull = _agent_bull_case(data)
    bear = _agent_bear_case(data)
    risk = _agent_risk_officer(data)
    verdict = _chair_verdict(data)
    return {
        "bull_view": bull,
        "bear_view": bear,
        "risk_view": risk,
        "chair": verdict,
    }
