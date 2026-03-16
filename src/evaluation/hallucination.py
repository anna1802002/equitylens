"""Number fact-checker vs yfinance for hallucination detection.

This module provides a lightweight numeric hallucination checker that scans an
LLM-generated report for key financial numbers (price, P/E, EPS, revenue,
profit margin, dividend yield) and cross-verifies them against live data from
``yfinance`` via :func:`src.data.finance_client.fetch_financials`.

The goal is not perfect parsing, but to flag obviously inconsistent numbers,
for example:

* The report claims "P/E of 80x" when the ground-truth P/E is 18x
* The report claims "current price around $100" when the spot price is $210
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass
from typing import Dict, List, Optional

from src.data.finance_client import FinancialSnapshot, FinanceClientError, fetch_financials


@dataclass
class NumberDiscrepancy:
    """Represents a single mismatched numeric claim."""

    kind: str  # e.g. "pe_ratio", "current_price"
    claimed: float
    actual: Optional[float]
    relative_error: Optional[float]
    snippet: str


@dataclass
class HallucinationReport:
    """Aggregate hallucination analysis for a single report."""

    ticker: str
    discrepancies: List[NumberDiscrepancy]

    @property
    def is_clean(self) -> bool:
        """True if no discrepancies were detected."""

        return len(self.discrepancies) == 0


def _safe_rel_error(claimed: float, actual: Optional[float]) -> Optional[float]:
    if actual is None or actual == 0:
        return None
    try:
        return abs(claimed - actual) / abs(actual)
    except ZeroDivisionError:
        return None


def _find_numbers_near_keywords(text: str, keyword_patterns: Dict[str, str]) -> Dict[str, List[NumberDiscrepancy]]:
    """Find numeric claims near certain keywords in the text.

    Returns a dict mapping kind -> list[NumberDiscrepancy] with only the
    claimed value and snippet populated; actual and relative_error are filled
    in later during comparison.
    """

    out: Dict[str, List[NumberDiscrepancy]] = {k: [] for k in keyword_patterns}
    # Simple windowed regex: keyword followed by up to ~40 characters and a number.
    for kind, pattern in keyword_patterns.items():
        # Example built pattern: r'(?i)(pe|p\/e)[^0-9]{0,40}([0-9]+(\.[0-9]+)?)'
        regex = re.compile(pattern, re.IGNORECASE)
        for m in regex.finditer(text):
            number_str = m.group("value") if "value" in m.groupdict() else m.group(2) or m.group(1)
            try:
                claimed = float(number_str.replace(",", ""))
            except (TypeError, ValueError):
                continue
            # Capture a small snippet around the match for debugging.
            start, end = m.span()
            snippet_start = max(0, start - 40)
            snippet_end = min(len(text), end + 40)
            snippet = text[snippet_start:snippet_end].strip()
            out[kind].append(
                NumberDiscrepancy(
                    kind=kind,
                    claimed=claimed,
                    actual=None,
                    relative_error=None,
                    snippet=snippet,
                )
            )
    return out


def _compare_to_snapshot(
    ticker: str,
    snapshot: FinancialSnapshot,
    text: str,
    *,
    rel_tol: float = 0.25,
) -> HallucinationReport:
    """Compare numeric claims in text against a FinancialSnapshot."""

    # Build patterns: keyword followed by up to 40 non-digits and then a number.
    patterns: Dict[str, str] = {
        "current_price": r"(price|share price|trading at)[^0-9]{0,40}(?P<value>[0-9]+(?:\.[0-9]+)?)",
        "pe_ratio": r"(p\/e|pe ratio|price\/earnings)[^0-9]{0,40}(?P<value>[0-9]+(?:\.[0-9]+)?)",
        "eps": r"(eps|earnings per share)[^0-9]{0,40}(?P<value>[0-9]+(?:\.[0-9]+)?)",
        "revenue": r"(revenue|sales)[^0-9]{0,40}(?P<value>[0-9]+(?:\.[0-9]+)?)",
        "profit_margin": r"(profit margin|net margin)[^0-9]{0,40}(?P<value>[0-9]+(?:\.[0-9]+)?)",
        "dividend_yield": r"(dividend yield)[^0-9]{0,40}(?P<value>[0-9]+(?:\.[0-9]+)?)",
    }

    found = _find_numbers_near_keywords(text, patterns)

    discrepancies: List[NumberDiscrepancy] = []

    # Map from kind to snapshot attribute.
    attr_map = {
        "current_price": "current_price",
        "pe_ratio": "pe_ratio",
        "eps": "eps",
        "revenue": "revenue",
        "profit_margin": "profit_margin",
        "dividend_yield": "dividend_yield",
    }

    for kind, claims in found.items():
        actual = getattr(snapshot, attr_map[kind], None)
        if actual is None:
            continue
        for claim in claims:
            rel_err = _safe_rel_error(claim.claimed, actual)
            if rel_err is None:
                continue
            # If the claimed value deviates by more than rel_tol, flag it.
            if rel_err > rel_tol:
                discrepancies.append(
                    NumberDiscrepancy(
                        kind=kind,
                        claimed=claim.claimed,
                        actual=actual,
                        relative_error=rel_err,
                        snippet=claim.snippet,
                    )
                )

    return HallucinationReport(ticker=ticker.upper(), discrepancies=discrepancies)


def check_report_numbers(
    ticker: str,
    report_text: str,
    *,
    rel_tol: float = 0.25,
) -> HallucinationReport:
    """Check an LLM report for numeric hallucinations vs yfinance data.

    Parameters
    ----------
    ticker:
        Ticker symbol used to fetch ground-truth financial data.
    report_text:
        LLM-generated report to scan for numeric claims.
    rel_tol:
        Relative error tolerance. If ``abs(claim - actual) / actual`` exceeds
        this value, the claim is considered a discrepancy.

    Returns
    -------
    HallucinationReport
        Contains a list of numeric discrepancies. If the list is empty,
        ``is_clean`` will be True.
    """

    if not ticker or not ticker.strip():
        raise ValueError("ticker must be a non-empty string.")
    if not report_text or not report_text.strip():
        return HallucinationReport(ticker=ticker.upper(), discrepancies=[])

    symbol = ticker.strip().upper()

    try:
        snapshot = fetch_financials(symbol)
    except FinanceClientError:
        # If we cannot fetch ground truth, we cannot judge hallucinations;
        # return a "clean" report so the caller can decide how to handle this.
        return HallucinationReport(ticker=symbol, discrepancies=[])

    return _compare_to_snapshot(symbol, snapshot, report_text, rel_tol=rel_tol)

