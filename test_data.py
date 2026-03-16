"""Quick integration test for Phase 1 data clients.

Runs the three data fetchers for a single ticker (AAPL) and prints a readable
summary of what came back:

* SEC filings via the SEC EDGAR EFTS API (no key required)
* Financial snapshot + 1Y OHLCV history via yfinance (no key required)
* News articles via NewsAPI (requires NEWS_API_KEY)

Usage
-----
From an activated venv with dependencies installed:

    python test_data.py
"""

from __future__ import annotations

import os
import sys
from typing import Any

from dotenv import load_dotenv

from src.data.finance_client import FinanceClientError, fetch_financials
from src.data.news_client import NewsClientError, fetch_news
from src.data.sec_client import SECClientError, fetch_filings


def _print_kv(key: str, value: Any) -> None:
    print(f"- {key}: {value}")


def main() -> int:
    load_dotenv()

    ticker = "AAPL"
    company_name = "Apple"

    print("=== Finance (yfinance) ===")
    try:
        fin = fetch_financials(ticker)
        _print_kv("ticker", fin.ticker)
        _print_kv("current_price", fin.current_price)
        _print_kv("pe_ratio", fin.pe_ratio)
        _print_kv("eps", fin.eps)
        _print_kv("revenue", fin.revenue)
        _print_kv("profit_margin", fin.profit_margin)
        _print_kv("history_bars_1y", len(fin.history))
        if fin.history:
            _print_kv("history_first_bar", fin.history[0].model_dump())
            _print_kv("history_last_bar", fin.history[-1].model_dump())
    except FinanceClientError as exc:
        print(f"Finance error: {exc}")

    print("\n=== SEC Filings (EFTS) ===")
    if not os.getenv("SEC_USER_AGENT"):
        print(
            "Note: SEC_USER_AGENT not set; using default. "
            "Set SEC_USER_AGENT='YourApp/1.0 (email@domain.com)' for SEC compliance."
        )
    try:
        filings = fetch_filings(ticker, "10-K", count=5)
        _print_kv("requested_form_type", "10-K")
        _print_kv("filings_returned", len(filings))
        for i, f in enumerate(filings[:3], start=1):
            print(f"  {i}. {f.filing_type} filed={f.filing_date} url={f.primary_doc_url}")
    except SECClientError as exc:
        print(f"SEC error: {exc}")

    print("\n=== News (NewsAPI) ===")
    try:
        news = fetch_news(company_name, days=7)
        _print_kv("company_name", company_name)
        _print_kv("articles_returned", len(news))
        for i, n in enumerate(news[:5], start=1):
            print(
                f"  {i}. score={n.sentiment_score} label={n.sentiment_label} "
                f"published={n.published_at} title={n.title}"
            )
    except NewsClientError as exc:
        print(f"News error: {exc}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

