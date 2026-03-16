"""Pydantic v2 data models used across the stock research agent.

This module defines the core normalized schemas that every part of the system
works with: raw market data, SEC filings, news, and derived financial metrics.
All other layers (data fetchers, RAG, agent nodes, API, and dashboard) should
depend on these models for a consistent contract.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class StockData(BaseModel):
    """Normalized snapshot of core market and reference data for a single ticker."""

    model_config = ConfigDict(from_attributes=True)

    ticker: str = Field(..., description="Ticker symbol, e.g. 'AAPL'.")
    company_name: Optional[str] = Field(
        default=None,
        description="Company's full name, if available from the data source.",
    )
    exchange: Optional[str] = Field(
        default=None,
        description="Exchange code, e.g. 'NASDAQ', 'NYSE'.",
    )
    currency: Optional[str] = Field(
        default=None,
        description="Trading currency code, e.g. 'USD'.",
    )
    sector: Optional[str] = Field(
        default=None,
        description="GICS sector name, if provided by the data source.",
    )
    industry: Optional[str] = Field(
        default=None,
        description="Industry or sub-industry classification.",
    )

    current_price: Optional[float] = Field(
        default=None,
        description="Latest traded price for the ticker.",
    )
    previous_close: Optional[float] = Field(
        default=None,
        description="Previous market close price.",
    )
    price_change: Optional[float] = Field(
        default=None,
        description="Absolute price change vs previous close.",
    )
    price_change_percent: Optional[float] = Field(
        default=None,
        description="Percentage price change vs previous close.",
    )

    market_cap: Optional[float] = Field(
        default=None,
        description="Market capitalization in trading currency.",
    )
    volume: Optional[int] = Field(
        default=None,
        description="Latest trading volume.",
    )
    average_volume: Optional[int] = Field(
        default=None,
        description="Average daily volume over a recent window (e.g. 10d or 30d).",
    )

    fifty_two_week_high: Optional[float] = Field(
        default=None,
        description="52-week high price.",
    )
    fifty_two_week_low: Optional[float] = Field(
        default=None,
        description="52-week low price.",
    )

    pe_ratio: Optional[float] = Field(
        default=None,
        description="Trailing price-to-earnings ratio.",
    )
    forward_pe_ratio: Optional[float] = Field(
        default=None,
        description="Forward price-to-earnings ratio, if available.",
    )
    eps: Optional[float] = Field(
        default=None,
        description="Trailing twelve-month earnings per share.",
    )
    dividend_yield: Optional[float] = Field(
        default=None,
        description="Dividend yield as a decimal (e.g. 0.02 for 2%).",
    )

    beta: Optional[float] = Field(
        default=None,
        description="Beta vs benchmark, if provided by the data source.",
    )

    as_of: datetime = Field(
        default_factory=datetime.utcnow,
        description="Timestamp when these values were last refreshed.",
    )


class FilingData(BaseModel):
    """Normalized representation of a single SEC filing or equivalent document."""

    model_config = ConfigDict(from_attributes=True)

    ticker: str = Field(..., description="Ticker symbol associated with the filing.")
    cik: Optional[str] = Field(
        default=None,
        description="Central Index Key (CIK) for the issuer.",
    )
    company_name: Optional[str] = Field(
        default=None,
        description="Issuer name as reported in the filing.",
    )

    accession_number: Optional[str] = Field(
        default=None,
        description="SEC accession number or equivalent unique filing identifier.",
    )
    filing_type: Optional[str] = Field(
        default=None,
        description="Form type, e.g. 10-K, 10-Q, 8-K.",
    )
    filing_date: Optional[date] = Field(
        default=None,
        description="Date the filing was submitted.",
    )
    period_of_report: Optional[date] = Field(
        default=None,
        description="Reporting period end date for the filing.",
    )

    source: str = Field(
        default="sec_edgar",
        description="Source system for the filing content, e.g. 'sec_edgar'.",
    )
    primary_doc_url: Optional[str] = Field(
        default=None,
        description="URL to the main filing document (e.g. HTML).",
    )
    pdf_url: Optional[str] = Field(
        default=None,
        description="URL to a PDF copy of the filing, if available.",
    )

    text: Optional[str] = Field(
        default=None,
        description="Raw or lightly cleaned text content of the filing.",
    )
    item_count: Optional[int] = Field(
        default=None,
        description="Number of logical sections/items parsed from the filing.",
    )


class NewsItem(BaseModel):
    """News article or headline normalized from NewsAPI or other feeds."""

    model_config = ConfigDict(from_attributes=True)

    id: Optional[str] = Field(
        default=None,
        description="Stable identifier for the article if provided by the source.",
    )
    ticker: str = Field(
        ...,
        description="Primary ticker symbol this article is associated with.",
    )
    tickers: List[str] = Field(
        default_factory=list,
        description="All tickers detected or tagged for this article.",
    )

    source_name: Optional[str] = Field(
        default=None,
        description="Publisher or source name, e.g. 'Reuters'.",
    )
    author: Optional[str] = Field(
        default=None,
        description="Author as reported by the source.",
    )

    title: str = Field(..., description="Headline or article title.")
    description: Optional[str] = Field(
        default=None,
        description="Short summary or deck, if provided.",
    )
    url: str = Field(..., description="Canonical URL to the article.")
    image_url: Optional[str] = Field(
        default=None,
        description="URL to the lead image, if available.",
    )

    published_at: Optional[datetime] = Field(
        default=None,
        description="Publication datetime (UTC if known).",
    )
    collected_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="Timestamp when this article was ingested into the system.",
    )

    content: Optional[str] = Field(
        default=None,
        description="Full or partial article body text.",
    )

    sentiment_score: Optional[float] = Field(
        default=None,
        ge=-1.0,
        le=1.0,
        description=(
            "Model-derived sentiment score in [-1, 1], where -1 is very negative "
            "and 1 is very positive."
        ),
    )
    sentiment_label: Optional[str] = Field(
        default=None,
        description="Coarse sentiment label such as 'positive', 'neutral', or 'negative'.",
    )
    relevance_score: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="Heuristic score for how relevant this article is to the ticker.",
    )


class FinancialMetrics(BaseModel):
    """Derived financial metrics used for risk scoring and KPI summaries."""

    model_config = ConfigDict(from_attributes=True)

    ticker: str = Field(..., description="Ticker symbol these metrics belong to.")
    as_of: Optional[date] = Field(
        default=None,
        description="Date these metrics are considered current as of.",
    )

    # Growth and profitability
    revenue_ttm: Optional[float] = Field(
        default=None,
        description="Trailing twelve-month revenue.",
    )
    revenue_growth_yoy: Optional[float] = Field(
        default=None,
        description="Year-over-year revenue growth as a decimal.",
    )
    gross_margin: Optional[float] = Field(
        default=None,
        description="Gross margin percentage as a decimal.",
    )
    operating_margin: Optional[float] = Field(
        default=None,
        description="Operating margin percentage as a decimal.",
    )
    net_margin: Optional[float] = Field(
        default=None,
        description="Net income margin percentage as a decimal.",
    )
    ebitda_margin: Optional[float] = Field(
        default=None,
        description="EBITDA margin percentage as a decimal.",
    )

    # Cash flow and leverage
    free_cash_flow_ttm: Optional[float] = Field(
        default=None,
        description="Trailing twelve-month free cash flow.",
    )
    debt_to_equity: Optional[float] = Field(
        default=None,
        description="Total debt divided by total equity.",
    )
    current_ratio: Optional[float] = Field(
        default=None,
        description="Current assets divided by current liabilities.",
    )
    interest_coverage: Optional[float] = Field(
        default=None,
        description="EBIT or EBITDA divided by interest expense.",
    )

    # Returns and valuation
    return_on_equity: Optional[float] = Field(
        default=None,
        description="Return on equity (ROE) as a decimal.",
    )
    return_on_assets: Optional[float] = Field(
        default=None,
        description="Return on assets (ROA) as a decimal.",
    )
    pe_ratio: Optional[float] = Field(
        default=None,
        description="Current price-to-earnings ratio (may duplicate StockData.pe_ratio).",
    )
    forward_pe_ratio: Optional[float] = Field(
        default=None,
        description="Forward price-to-earnings ratio.",
    )
    peg_ratio: Optional[float] = Field(
        default=None,
        description="Price/earnings-to-growth ratio.",
    )
    dividend_yield: Optional[float] = Field(
        default=None,
        description="Dividend yield as a decimal.",
    )
    payout_ratio: Optional[float] = Field(
        default=None,
        description="Dividend payout ratio as a decimal.",
    )

    # Risk signaling
    risk_score: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=100.0,
        description="Composite risk score on a 0–100 scale (higher = riskier).",
    )
    risk_flags: List[str] = Field(
        default_factory=list,
        description=(
            "Textual flags indicating specific risk factors, "
            "e.g. 'high leverage', 'negative FCF', 'margin compression'."
        ),
    )

