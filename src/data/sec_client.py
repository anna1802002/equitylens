"""SEC Edgar EFTS API client.

This module provides a small, focused client for the SEC EDGAR Full‑Text Search
API (EFTS) at ``https://efts.sec.gov/LATEST/search-index``. It exposes a single
high‑level function, :func:`fetch_filings`, which returns normalized
``FilingData`` models for a given ticker and form type (for example, all
10‑K or 10‑Q filings for ``AAPL``).

The EFTS API does not require an API key, but the SEC *does* require that you
send a descriptive ``User-Agent`` header with contact information. You can
configure this by setting the ``SEC_USER_AGENT`` environment variable; if it
is not set, a conservative default string is used.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any, Dict, List

import httpx
from pydantic import ValidationError

from .normalizer import FilingData

EFTS_SEARCH_URL = "https://efts.sec.gov/LATEST/search-index"
SEC_ARCHIVES_BASE = "https://www.sec.gov/Archives/edgar/data"


class SECClientError(RuntimeError):
    """Raised when the SEC EDGAR EFTS client encounters an error."""


@dataclass
class _RawFiling:
    """Internal representation of a single EFTS search result."""

    ticker: str
    cik: str | None
    company_name: str | None
    accession_number: str | None
    filing_type: str | None
    filing_date: date | None
    period_of_report: date | None
    primary_doc_url: str | None
    pdf_url: str | None
    text: str | None


def _get_user_agent() -> str:
    """Return a SEC‑compliant User‑Agent header value."""

    env_ua = os.getenv("SEC_USER_AGENT")
    if env_ua:
        return env_ua
    # The SEC requires contact information in the User-Agent.
    # Use a simple, SEC-friendly default format and encourage overriding via env.
    return "stock-research-agent/1.0 your@email.com"


def _parse_date(value: Any) -> date | None:
    """Parse a date string from EFTS into a ``date``."""

    if not value:
        return None
    try:
        # EFTS typically returns ISO 8601 date strings (YYYY-MM-DD).
        return datetime.fromisoformat(str(value)).date()
    except (TypeError, ValueError):
        return None


def _first_str(value: Any) -> str | None:
    """Return the first element if value is a list, else str(value)."""

    if value is None:
        return None
    if isinstance(value, list):
        for item in value:
            if item is None:
                continue
            s = str(item).strip()
            if s:
                return s
        return None
    s = str(value).strip()
    return s or None


def _build_filing_index_url(cik: str | None, accession: str | None) -> str | None:
    """Build a SEC filing index HTML URL from CIK and accession number."""

    if not cik or not accession:
        return None
    try:
        cik_int = int(str(cik).lstrip("0") or "0")
    except ValueError:
        return None
    accession_no_dashes = str(accession).replace("-", "")
    if not accession_no_dashes.isdigit():
        return None
    # Example:
    # https://www.sec.gov/Archives/edgar/data/320193/000032019323000106/0000320193-23-000106-index.html
    return f"{SEC_ARCHIVES_BASE}/{cik_int}/{accession_no_dashes}/{accession}-index.html"


def _normalize_result(raw: Dict[str, Any], ticker: str) -> _RawFiling:
    """Convert a raw EFTS hit into an internal filing structure."""

    # The exact shape of EFTS results can evolve; we defensively pick keys.
    hit: Dict[str, Any] = raw.get("_source", raw)

    # EFTS commonly returns:
    # - adsh (accession number)
    # - form (form type)
    # - file_date (YYYY-MM-DD)
    # - period_ending (YYYY-MM-DD)
    # - ciks (list of cik strings)
    # - display_names (list of issuer names)
    accession_number = _first_str(hit.get("adsh") or hit.get("accessionNo") or hit.get("accession_number"))
    filing_type = _first_str(hit.get("form") or hit.get("formType") or hit.get("form_type"))
    filing_date = _parse_date(hit.get("file_date") or hit.get("filed") or hit.get("filingDate"))
    period_of_report = _parse_date(hit.get("period_ending") or hit.get("period") or hit.get("periodOfReport"))

    cik = _first_str(hit.get("ciks") or hit.get("cik"))
    company_name = _first_str(hit.get("display_names") or hit.get("displayNames") or hit.get("companyName") or hit.get("company_name"))

    primary_doc_url = _build_filing_index_url(cik=cik, accession=accession_number) or hit.get("primary_doc_url")
    pdf_url = hit.get("pdf_url")

    # EFTS results may include snippets or text fields; we preserve what we get.
    text = hit.get("text") or hit.get("snippet")

    return _RawFiling(
        ticker=ticker.upper(),
        cik=cik,
        company_name=company_name,
        accession_number=accession_number,
        filing_type=filing_type,
        filing_date=filing_date,
        period_of_report=period_of_report,
        primary_doc_url=primary_doc_url,
        pdf_url=pdf_url,
        text=text,
    )


def _to_filing_data(raw: _RawFiling) -> FilingData:
    """Convert an internal filing representation into a ``FilingData`` model."""

    try:
        return FilingData(
            ticker=raw.ticker,
            cik=raw.cik,
            company_name=raw.company_name,
            accession_number=raw.accession_number,
            filing_type=raw.filing_type,
            filing_date=raw.filing_date,
            period_of_report=raw.period_of_report,
            source="sec_edgar",
            primary_doc_url=raw.primary_doc_url,
            pdf_url=raw.pdf_url,
            text=raw.text,
        )
    except ValidationError as exc:
        raise SECClientError(f"Failed to validate FilingData from SEC response: {exc}") from exc


def fetch_filings(
    ticker: str,
    form_type: str,
    *,
    count: int = 10,
    start: int = 0,
    timeout_seconds: float = 10.0,
) -> List[FilingData]:
    """Fetch recent SEC filings for a ticker and form type using EFTS.

    Parameters
    ----------
    ticker:
        Ticker symbol to search for (for example, ``\"AAPL\"``).
    form_type:
        Filing form type to filter by (for example, ``\"10-K\"`` or ``\"10-Q\"``).
    count:
        Maximum number of filings to return. Must be positive.
    start:
        Zero-based offset into the EFTS result set, useful for pagination.
    timeout_seconds:
        Network timeout for the HTTP request.

    Returns
    -------
    list[FilingData]
        A list of normalized filing models. If no filings are found, an empty
        list is returned.

    Raises
    ------
    SECClientError
        If the SEC API returns an error, if the response cannot be parsed, or
        if validation fails.
    """

    if count <= 0:
        raise SECClientError("Parameter 'count' must be a positive integer.")
    if start < 0:
        raise SECClientError("Parameter 'start' must be a non-negative integer.")

    # Known-working SEC EFTS format:
    # https://efts.sec.gov/LATEST/search-index?q=%22AAPL%22&forms=10-K
    #
    # The API accepts the query term in `q` and form filtering via `forms`.
    params = {
        "q": f"\"{ticker.upper()}\"",
        "forms": form_type,
        "start": start,
        "count": count,
    }

    headers = {
        "User-Agent": _get_user_agent(),
        "Accept": "application/json",
    }

    try:
        with httpx.Client(timeout=timeout_seconds, headers=headers) as client:
            response = client.get(EFTS_SEARCH_URL, params=params)
    except httpx.RequestError as exc:
        raise SECClientError(f"Network error while calling SEC EFTS API: {exc}") from exc

    if response.status_code != 200:
        # Try to extract some detail from the body, but do not rely on its shape.
        detail: str
        try:
            data = response.json()
            detail = str(data.get("error") or data.get("message") or data)  # type: ignore[assignment]
        except Exception:
            detail = response.text
        raise SECClientError(
            f"SEC EFTS API returned HTTP {response.status_code}: {detail!r}"
        )

    try:
        payload: Dict[str, Any] = response.json()
    except ValueError as exc:
        raise SECClientError("Failed to parse JSON from SEC EFTS response.") from exc

    # EFTS commonly uses 'hits' with an inner 'hits' list (Elasticsearch style),
    # but we defensively support a flat 'hits' list as well.
    hits_container = payload.get("hits", {})
    if isinstance(hits_container, dict):
        hits = hits_container.get("hits", [])
    else:
        hits = hits_container

    if not isinstance(hits, list):
        raise SECClientError(
            f"Unexpected EFTS response shape; expected list of hits, got: {type(hits)}"
        )

    # Some EFTS responses return a fixed-size page even when 'count' is provided.
    # Enforce the requested count locally for predictable downstream behavior.
    hits = hits[:count]
    normalized: List[_RawFiling] = [_normalize_result(hit, ticker) for hit in hits]
    filings = [_to_filing_data(item) for item in normalized]

    # De-duplicate by accession number while preserving order.
    deduped: List[FilingData] = []
    seen: set[str] = set()
    for f in filings:
        key = f.accession_number or f.primary_doc_url or ""
        if not key or key in seen:
            continue
        seen.add(key)
        deduped.append(f)

    return deduped

