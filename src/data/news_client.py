"""NewsAPI client for company news with simple sentiment scoring.

This module provides a single high-level helper, :func:`fetch_news`, which
retrieves recent news for a given company name using the public NewsAPI
(``https://newsapi.org``). It returns a list of normalized :class:`NewsItem`
models with a lightweight rule-based ``sentiment_score`` for each article.

Notes
-----
* Requires the ``NEWS_API_KEY`` environment variable to be set.
* Uses the ``/v2/everything`` endpoint filtered by company name and date range.
* The sentiment score is a heuristic meant to give the downstream agent a
  starting point; the dedicated SentimentAnalyzer node can refine it later.
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Iterable, List, Optional

import httpx
import yfinance as yf

from .normalizer import NewsItem

NEWS_API_URL = "https://newsapi.org/v2/everything"


class NewsClientError(RuntimeError):
    """Raised when the NewsAPI client encounters an error."""


def _get_api_key() -> str:
    """Return the NewsAPI key from the environment or raise a clear error."""

    api_key = os.getenv("NEWS_API_KEY")
    if not api_key:
        raise NewsClientError(
            "NEWS_API_KEY environment variable is not set. "
            "Create a free key at https://newsapi.org and add it to your .env file."
        )
    return api_key


def _build_query(company_name: str) -> str:
    """Build a NewsAPI query string for a company name."""

    name = company_name.strip()
    if not name:
        raise NewsClientError("Company name must be a non-empty string.")
    # Prefer exact phrase matching but allow some flexibility.
    return f'"{name}"'


def _normalize_article(article: Dict[str, Any], company_name: str) -> NewsItem:
    """Convert a NewsAPI article dict into a ``NewsItem``."""

    source = article.get("source") or {}
    source_name = source.get("name")

    published_raw: Optional[str] = article.get("publishedAt")
    published_at_dt: Optional[datetime]
    if published_raw:
        try:
            published_at_dt = datetime.fromisoformat(published_raw.replace("Z", "+00:00"))
        except ValueError:
            published_at_dt = None
    else:
        published_at_dt = None

    title = article.get("title") or ""
    description = article.get("description")
    content = article.get("content")

    sentiment_score = _compute_sentiment_score(
        title=title,
        description=description,
        content=content,
    )
    sentiment_label: str
    if sentiment_score > 0.1:
        sentiment_label = "positive"
    elif sentiment_score < -0.1:
        sentiment_label = "negative"
    else:
        sentiment_label = "neutral"

    return NewsItem(
        id=article.get("url"),
        ticker="",  # Ticker mapping is handled at a higher layer; here we track company name.
        tickers=[],
        source_name=source_name,
        author=article.get("author"),
        title=title,
        description=description,
        url=article.get("url") or "",
        image_url=article.get("urlToImage"),
        published_at=published_at_dt,
        content=content,
        sentiment_score=sentiment_score,
        sentiment_label=sentiment_label,
        relevance_score=None,
    )


def _compute_sentiment_score_raw(text: str) -> float:
    """Score sentiment using keyword analysis. Returns float in [-1, 1]."""
    if not text:
        return 0.0
    text_lower = text.lower()

    positive_words = [
        "surge", "soar", "jump", "rally", "gain", "rise",
        "grew", "growth", "profit", "beat", "record",
        "strong", "bullish", "upgrade", "buy", "outperform",
        "success", "win", "boost", "high", "up", "positive",
        "exceeded", "revenue up", "earnings beat", "new high",
        "expands", "increases", "improved", "advances",
        "breakthrough", "innovative", "leading", "dominant",
        "partnership", "deal", "acquisition", "launch",
        "dividend", "buyback", "raised guidance",
    ]

    negative_words = [
        "fall", "drop", "decline", "crash", "plunge", "sink",
        "loss", "miss", "weak", "bearish", "downgrade", "sell",
        "underperform", "fail", "risk", "warning", "cut",
        "layoff", "lawsuit", "debt", "below", "concern",
        "disappoints", "struggles", "drops", "slump",
        "investigation", "fine", "penalty", "recall",
        "competition", "pressure", "inflation", "recession",
        "bankruptcy", "fraud", "scandal", "hack", "breach",
        "missed", "lowered guidance", "revenue down",
    ]

    pos_count = sum(1 for w in positive_words if w in text_lower)
    neg_count = sum(1 for w in negative_words if w in text_lower)
    total = pos_count + neg_count
    if total == 0:
        return 0.0
    score = (pos_count - neg_count) / max(total, 1)
    return round(max(-1.0, min(1.0, score)), 3)


def _compute_sentiment_score(
    *,
    title: str,
    description: Optional[str],
    content: Optional[str],
) -> float:
    """Compute sentiment score in [-1, 1] from article title, description, and content."""
    pieces: List[str] = [title or ""]
    if description:
        pieces.append(description)
    if content:
        pieces.append(content)
    combined = " ".join(pieces)
    return _compute_sentiment_score_raw(combined)


def _fetch_news_from_newsapi(
    company_or_ticker: str, days: int, page_size: int
) -> List[NewsItem]:
    """Try NewsAPI and return list of NewsItem. Returns empty list on error or no articles."""
    if not (company_or_ticker or "").strip():
        return []
    try:
        api_key = _get_api_key()
        query = _build_query(company_or_ticker)
        now = datetime.now(timezone.utc)
        from_date = now - timedelta(days=days)
        params = {
            "q": query,
            "from": from_date.date().isoformat(),
            "to": now.date().isoformat(),
            "language": "en",
            "sortBy": "publishedAt",
            "pageSize": page_size,
        }
        headers = {"X-Api-Key": api_key}
        with httpx.Client(timeout=10.0, headers=headers) as client:
            response = client.get(NEWS_API_URL, params=params)
        if response.status_code != 200:
            return []
        payload = response.json()
        if payload.get("status") != "ok":
            return []
        articles = payload.get("articles") or []
        return [_normalize_article(a, company_name=company_or_ticker) for a in articles]
    except (NewsClientError, httpx.RequestError, ValueError, KeyError):
        return []


def _fetch_news_from_yfinance(ticker: str) -> List[NewsItem]:
    """Fetch news directly from Yahoo Finance — no API key needed."""
    try:
        stock = yf.Ticker(ticker)
        news = stock.news
        if not news:
            return []

        items: List[NewsItem] = []
        for item in news[:10]:
            title = item.get("title", "") or ""
            summary = (item.get("summary") or title) or ""
            text = f"{title} {summary}".strip()
            sentiment = _compute_sentiment_score(title=text, description=None, content=None)
            sentiment_label = (
                "positive" if sentiment > 0.05 else "negative" if sentiment < -0.05 else "neutral"
            )
            pub_ts = item.get("providerPublishTime")
            published_at_dt: Optional[datetime] = None
            if pub_ts:
                try:
                    published_at_dt = datetime.fromtimestamp(int(pub_ts), tz=timezone.utc)
                except (ValueError, TypeError):
                    pass
            items.append(
                NewsItem(
                    id=item.get("link"),
                    ticker=ticker,
                    tickers=[ticker],
                    source_name=item.get("publisher") or "Yahoo Finance",
                    author=None,
                    title=title,
                    description=summary or None,
                    url=item.get("link") or "",
                    image_url=None,
                    published_at=published_at_dt,
                    content=summary or None,
                    sentiment_score=sentiment,
                    sentiment_label=sentiment_label,
                    relevance_score=None,
                )
            )
        return items
    except Exception:
        return []


def fetch_news(
    company_name: str,
    days: int = 30,
    *,
    page_size: int = 50,
    ticker: Optional[str] = None,
) -> List[NewsItem]:
    """Fetch recent news for a company. Tries NewsAPI first, then Yahoo Finance fallback.

    Parameters
    ----------
    company_name:
        Company name or ticker for NewsAPI query, e.g. ``\"Apple\"`` or ``\"AAPL\"``.
    days:
        Number of days of lookback from today (UTC). Defaults to 30.
    page_size:
        Maximum number of articles to request from NewsAPI (1–100).

    Returns
    -------
    list[NewsItem]
        A list of normalized news articles with a basic sentiment score.

    Raises
    ------
    NewsClientError
        If the API key is missing, if NewsAPI returns an error, or if the
        response shape is unexpected.
    ticker:
        Resolved ticker symbol for Yahoo Finance fallback. Defaults to company_name.

    Returns
    -------
    list[NewsItem]
        A list of normalized news articles. Uses NewsAPI first, then Yahoo Finance
        if NewsAPI returns no articles.
    """
    if days <= 0:
        raise NewsClientError("Parameter 'days' must be a positive integer.")
    if not (1 <= page_size <= 100):
        raise NewsClientError("Parameter 'page_size' must be between 1 and 100.")

    ticker_for_yf = (ticker or company_name).strip()

    # 1. Try NewsAPI with company name
    articles = _fetch_news_from_newsapi(company_name.strip(), days, page_size)

    # 2. If 0 articles, try NewsAPI with ticker
    if not articles and ticker_for_yf and ticker_for_yf.upper() != company_name.strip().upper():
        articles = _fetch_news_from_newsapi(ticker_for_yf, days, page_size)

    # 3. If still 0, try Yahoo Finance (free, no API key)
    if not articles and ticker_for_yf:
        articles = _fetch_news_from_yfinance(ticker_for_yf.upper())

    return articles

