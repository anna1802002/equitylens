"""Groq LLM-based market sentiment analysis.

This module provides sentiment analysis for a ticker by calling the Groq API
to generate realistic market sentiment, headlines, trend data, and drivers.
"""

from __future__ import annotations

import json
import os
from typing import Any, Dict, List

from src.data.finance_client import fetch_company_profile


def fetch_sentiment_analysis(ticker: str) -> dict:
    """Generate market sentiment analysis for a ticker via Groq LLM.

    Returns a dict with:
    - overall_score: float in [-1, 1]
    - label: Bullish/Bearish/Neutral/Slightly Bullish/Slightly Bearish
    - headlines: list of 6 items with title, source, date, sentiment, score, one_line_summary
    - trend: list of 30 floats (daily sentiment scores)
    - positive_drivers: list of 3 strings
    - negative_drivers: list of 3 strings
    - plain_summary: 3 sentences plain English
    - company_name: str
    """
    from groq import Groq

    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError(
            "GROQ_API_KEY is not set. Obtain a key from console.groq.com and add to .env"
        )

    symbol = ticker.strip().upper()
    profile = fetch_company_profile(symbol)
    company_name = profile.get("longName") or profile.get("shortName") or symbol

    client = Groq(api_key=api_key)
    prompt = f"""Generate realistic market sentiment analysis for {company_name} ({symbol}) as of March 2026.

Return ONLY valid JSON, no other text. Use this exact structure:

{{
  "overall_score": <float between -1 and 1>,
  "label": "<Bullish|Slightly Bullish|Neutral|Slightly Bearish|Bearish>",
  "news_sentiment_score": <float -1 to 1>,
  "news_sentiment_label": "<Positive|Neutral|Negative>",
  "market_momentum_score": <float -1 to 1>,
  "market_momentum_label": "<Positive|Neutral|Negative>",
  "analyst_outlook_score": <float -1 to 1>,
  "analyst_outlook_label": "<Positive|Neutral|Negative>",
  "headlines": [
    {{"title": "<realistic headline>", "source": "<Forbes|Reuters|Bloomberg|CNBC|WSJ|etc>", "date": "<2026-03-XX>", "sentiment": "<Positive|Negative|Neutral>", "score": <float -1 to 1>, "one_line_summary": "<why this matters>"}},
    ...6 total
  ],
  "trend": [<30 floats between -1 and 1 representing daily sentiment over last 30 days, oldest first>],
  "positive_drivers": ["<driver 1>", "<driver 2>", "<driver 3>"],
  "negative_drivers": ["<driver 1>", "<driver 2>", "<driver 3>"],
  "plain_summary": "<3 sentences in plain English explaining overall sentiment and what it means for investors>"
}}

Make headlines realistic for {company_name}. Include varied sources. Make trend values gradually change over 30 days. news_sentiment = news/media tone; market_momentum = recent price action feel; analyst_outlook = analyst consensus."""

    response = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[
            {
                "role": "system",
                "content": "You are a financial analyst. Return only valid JSON. No markdown, no explanation.",
            },
            {"role": "user", "content": prompt},
        ],
        max_tokens=2000,
        temperature=0.4,
    )

    text = (response.choices[0].message.content or "").strip()
    text = text.replace("```json", "").replace("```", "").strip()

    try:
        data: dict = json.loads(text)
    except json.JSONDecodeError:
        data = _default_response(company_name, symbol)

    # Ensure all required fields exist
    data.setdefault("overall_score", 0.0)
    data.setdefault("label", "Neutral")
    data.setdefault("headlines", [])
    data.setdefault("news_sentiment_score", data.get("overall_score", 0))
    data.setdefault("news_sentiment_label", "Neutral")
    data.setdefault("market_momentum_score", data.get("overall_score", 0))
    data.setdefault("market_momentum_label", "Neutral")
    data.setdefault("analyst_outlook_score", data.get("overall_score", 0))
    data.setdefault("analyst_outlook_label", "Neutral")
    data.setdefault("trend", [0.0] * 30)
    data.setdefault("positive_drivers", [])
    data.setdefault("negative_drivers", [])
    data.setdefault("plain_summary", f"Sentiment for {company_name} is neutral.")
    data["company_name"] = company_name
    data["ticker"] = symbol

    # Normalize trend to exactly 30 items
    trend = data.get("trend") or []
    if len(trend) != 30:
        trend = (trend + [0.0] * 30)[:30]
    data["trend"] = [float(x) for x in trend]

    return data


def _default_response(company_name: str, ticker: str) -> dict:
    """Return a fallback response when LLM parsing fails."""
    return {
        "overall_score": 0.0,
        "label": "Neutral",
        "news_sentiment_score": 0.0,
        "news_sentiment_label": "Neutral",
        "market_momentum_score": 0.0,
        "market_momentum_label": "Neutral",
        "analyst_outlook_score": 0.0,
        "analyst_outlook_label": "Neutral",
        "headlines": [
            {"title": f"{company_name} stock shows mixed signals", "source": "Reuters", "date": "2026-03-09", "sentiment": "Neutral", "score": 0.0, "one_line_summary": "Markets await further catalysts."},
            {"title": f"Analysts weigh in on {company_name} outlook", "source": "Bloomberg", "date": "2026-03-08", "sentiment": "Neutral", "score": 0.0, "one_line_summary": "Wall Street remains cautious."},
            {"title": f"{company_name} earnings in focus", "source": "CNBC", "date": "2026-03-07", "sentiment": "Neutral", "score": 0.0, "one_line_summary": "Upcoming results could shift sentiment."},
        ] * 2,
        "trend": [0.0] * 30,
        "positive_drivers": ["Steady fundamentals", "Market confidence", "Strong sector"],
        "negative_drivers": ["Macro uncertainty", "Competition", "Valuation concerns"],
        "plain_summary": f"Sentiment for {company_name} is currently neutral. Investors are taking a wait-and-see approach amid mixed signals. Consider monitoring key catalysts for direction.",
    }
