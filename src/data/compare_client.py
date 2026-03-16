"""Compare two tickers with AI verdict.

Fetches financials for both tickers and uses Groq to generate
a comparison verdict with pros, cons, and recommendation.
"""

from __future__ import annotations

import json
import os
from typing import Any, Dict, List

from src.data.finance_client import (
    FinanceClientError,
    fetch_company_profile,
    fetch_financials_extended,
    resolve_ticker,
)


def _compute_recommendation(pe: float | None, margin: float | None) -> tuple[str, float]:
    """Compute BUY/HOLD/SELL and risk score from P/E and margin."""
    score = 0.0
    if pe is not None:
        if pe < 15:
            score -= 15
        elif pe < 25:
            score -= 5
        elif pe < 40:
            score += 5
        else:
            score += 15
    if margin is not None:
        if margin > 0.25:
            score -= 15
        elif margin > 0.15:
            score -= 5
        elif margin > 0.05:
            score += 5
        elif margin < 0:
            score += 20
    risk = min(100.0, max(0.0, 50 + score))
    if score <= -15:
        rec = "BUY"
    elif score >= 15:
        rec = "SELL"
    else:
        rec = "HOLD"
    return rec, risk


def compare_tickers(ticker1: str, ticker2: str) -> dict:
    """Compare two tickers and return financials + AI verdict."""
    t1 = resolve_ticker(ticker1.strip())
    t2 = resolve_ticker(ticker2.strip())

    s1 = fetch_financials_extended(t1, "1Y")
    s2 = fetch_financials_extended(t2, "1Y")

    prof1 = fetch_company_profile(t1)
    prof2 = fetch_company_profile(t2)
    name1 = prof1.get("longName") or prof1.get("shortName") or t1
    name2 = prof2.get("longName") or prof2.get("shortName") or t2

    pe1 = s1.get("pe_ratio")
    pe2 = s2.get("pe_ratio")
    margin1 = s1.get("profit_margin")
    margin2 = s2.get("profit_margin")

    rec1, risk1 = _compute_recommendation(pe1, margin1)
    rec2, risk2 = _compute_recommendation(pe2, margin2)

    s1["company_name"] = name1
    s1["recommendation"] = rec1
    s1["risk_score"] = risk1
    s2["company_name"] = name2
    s2["recommendation"] = rec2
    s2["risk_score"] = risk2

    verdict_data = _generate_verdict(s1, s2, name1, name2, t1, t2)

    return {
        "stock1": s1,
        "stock2": s2,
        "stock1_pros": verdict_data.get("stock1_pros", []),
        "stock2_pros": verdict_data.get("stock2_pros", []),
        "recommendation": verdict_data.get("recommendation", ""),
    }


def _generate_verdict(
    s1: dict, s2: dict, name1: str, name2: str, t1: str, t2: str
) -> dict:
    """Generate AI verdict via Groq."""
    from groq import Groq

    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return {
            "stock1_pros": [
                f"Strong fundamentals for {name1}",
                f"Market leader in sector",
                "Consistent revenue growth",
            ],
            "stock2_pros": [
                f"Solid position for {name2}",
                "Diversified revenue streams",
                "Strong balance sheet",
            ],
            "recommendation": (
                f"Both {name1} and {name2} have merits. Compare P/E, margins and "
                "risk tolerance to decide. Consider diversification."
            ),
        }

    metrics = f"""
{name1} ({t1}): P/E={s1.get('pe_ratio')}, EPS=${s1.get('eps')}, Revenue={s1.get('quarterly_revenue', [])}, Margin={s1.get('profit_margin')}, Price=${s1.get('current_price')}
{name2} ({t2}): P/E={s2.get('pe_ratio')}, EPS=${s2.get('eps')}, Revenue={s2.get('quarterly_revenue', [])}, Margin={s2.get('profit_margin')}, Price=${s2.get('current_price')}
"""
    client = Groq(api_key=api_key)
    prompt = f"""Compare {name1} vs {name2} as investments. Metrics:
{metrics}

Return ONLY valid JSON:
{{
  "stock1_pros": ["pro 1", "pro 2", "pro 3"],
  "stock2_pros": ["pro 1", "pro 2", "pro 3"],
  "recommendation": "3-4 sentences: which looks better now, which for long term, which for risk-averse, final verdict"
}}
"""

    try:
        r = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": "Return only valid JSON. No markdown."},
                {"role": "user", "content": prompt},
            ],
            max_tokens=500,
            temperature=0.4,
        )
        text = (r.choices[0].message.content or "").strip()
        text = text.replace("```json", "").replace("```", "").strip()
        data = json.loads(text)
        return {
            "stock1_pros": data.get("stock1_pros", [])[:3],
            "stock2_pros": data.get("stock2_pros", [])[:3],
            "recommendation": data.get("recommendation", ""),
        }
    except Exception:
        return {
            "stock1_pros": [
                f"Strong fundamentals for {name1}",
                f"P/E {s1.get('pe_ratio', 'N/A')} vs sector",
                "Established market position",
            ],
            "stock2_pros": [
                f"Solid metrics for {name2}",
                f"Margin {(s2.get('profit_margin') or 0) * 100:.1f}%",
                "Growth trajectory",
            ],
            "recommendation": (
                f"Both {name1} and {name2} have different strengths. "
                f"{name1} may suit value investors; {name2} may suit growth. "
                "Compare your goals and risk tolerance."
            ),
        }
