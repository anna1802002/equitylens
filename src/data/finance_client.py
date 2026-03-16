"""yfinance wrapper for live financial and price data.

This module provides a high-level helper, :func:`fetch_financials`, which
retrieves a small set of commonly used metrics for a single ticker symbol:

* current price
* trailing P/E ratio
* trailing EPS
* latest annual revenue
* profit margin
* one-year daily OHLCV price history

The function is intentionally defensive:

* network and remote API issues are wrapped in :class:`FinanceClientError`
* missing fields are returned as ``None`` rather than raising
* the price history is normalized into a simple list of records that can be
  easily serialized for APIs or stored in SQLite
"""

from __future__ import annotations

from dataclasses import dataclass

from src.cache.redis_client import CacheKeys, CacheTTL, cache
from datetime import date as Date
from typing import List, Optional

import pandas as pd
from pydantic import BaseModel, ConfigDict, Field


class FinanceClientError(RuntimeError):
    """Raised when the yfinance client cannot fulfill a request."""


class OHLCVBar(BaseModel):
    """Single daily OHLCV bar for a ticker."""

    model_config = ConfigDict(from_attributes=True)

    date: Date = Field(..., description="Trading date (UTC) for this bar.")
    open: Optional[float] = Field(default=None, description="Open price.")
    high: Optional[float] = Field(default=None, description="High price.")
    low: Optional[float] = Field(default=None, description="Low price.")
    close: Optional[float] = Field(default=None, description="Close price.")
    volume: Optional[int] = Field(default=None, description="Trading volume.")


class FinancialSnapshot(BaseModel):
    """Summary financial snapshot plus one-year price history for a ticker."""

    model_config = ConfigDict(from_attributes=True)

    ticker: str = Field(..., description="Ticker symbol, e.g. 'AAPL'.")
    current_price: Optional[float] = Field(
        default=None,
        description="Latest traded price from yfinance.",
    )
    pe_ratio: Optional[float] = Field(
        default=None,
        description="Trailing price-to-earnings ratio.",
    )
    eps: Optional[float] = Field(
        default=None,
        description="Trailing twelve-month earnings per share.",
    )
    revenue: Optional[float] = Field(
        default=None,
        description="Most recent annual total revenue, if available.",
    )
    profit_margin: Optional[float] = Field(
        default=None,
        description="Net profit margin as a decimal (e.g. 0.15 for 15%).",
    )
    history: List[OHLCVBar] = Field(
        default_factory=list,
        description="One-year daily OHLCV history.",
    )


@dataclass
class _RawSnapshot:
    """Internal representation of yfinance data before validation."""

    ticker: str
    current_price: Optional[float]
    pe_ratio: Optional[float]
    eps: Optional[float]
    revenue: Optional[float]
    profit_margin: Optional[float]
    history: List[OHLCVBar]


def resolve_ticker(query: str) -> str:
    """
    Use Groq LLM to resolve ANY company name or
    misspelling to a valid ticker symbol.
    Works for: "tesla", "TESLA", "testa", "Teslla",
    "walmart", "Walmart", "WALMART", "wallmart",
    "apple", "Apple Inc", "aple", "appl",
    "amd", "AMD", "Advanced Micro Devices",
    "google", "Google", "alphabet", "Alphabet Inc"
    """
    import os

    import yfinance as yf
    from groq import Groq

    query = query.strip()

    # Check cache first
    cache_key = CacheKeys.ticker_resolution(query)
    cached = cache.get(cache_key)
    if cached:
        print(f"Cache HIT: ticker resolution for '{query}' -> {cached}")
        return cached

    # Step 1: Ask LLM to resolve the ticker
    try:
        client = Groq(api_key=os.getenv("GROQ_API_KEY"))
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {
                    "role": "system",
                    "content": """You are a financial expert
                    who knows every stock ticker symbol.
                    When given a company name, misspelling,
                    or partial name, return ONLY the correct
                    US stock ticker symbol. Nothing else.
                    If unsure, make your best guess.
                    Never say you don't know - always return
                    a ticker. Examples:
                    tesla -> TSLA
                    testa -> TSLA
                    teslla -> TSLA
                    apple -> AAPL
                    appl -> AAPL
                    aple -> AAPL
                    Apple Inc -> AAPL
                    walmart -> WMT
                    wallmart -> WMT
                    Wal-Mart -> WMT
                    microsoft -> MSFT
                    micro soft -> MSFT
                    google -> GOOGL
                    alphabet -> GOOGL
                    amazon -> AMZN
                    amazn -> AMZN
                    nvidia -> NVDA
                    envida -> NVDA
                    meta -> META
                    facebook -> META
                    netflix -> NFLX
                    amd -> AMD
                    advanced micro devices -> AMD
                    intel -> INTC
                    samsung -> 005930.KS
                    toyota -> TM
                    coca cola -> KO
                    pepsi -> PEP
                    mcdonalds -> MCD
                    starbucks -> SBUX
                    nike -> NKE
                    disney -> DIS
                    uber -> UBER
                    airbnb -> ABNB
                    spotify -> SPOT
                    paypal -> PYPL
                    visa -> V
                    mastercard -> MA
                    jpmorgan -> JPM
                    goldman sachs -> GS
                    berkshire -> BRK-B
                    snowflake -> SNOW
                    palantir -> PLTR
                    coinbase -> COIN
                    robinhood -> HOOD
                    shopify -> SHOP
                    zoom -> ZM
                    """,
                },
                {
                    "role": "user",
                    "content": f"What is the stock ticker for: {query}",
                },
            ],
            max_tokens=10,
            temperature=0,
        )

        raw = (response.choices[0].message.content or "").strip().upper()
        # Clean up any extra text LLM might add
        ticker = raw.split()[0] if raw else ""
        ticker = "".join(c for c in ticker if c.isalnum() or c in ".-")
        if not ticker:
            raise ValueError(f"LLM returned empty or invalid ticker for '{query}'")

    except Exception as e:
        raise ValueError(f"Could not resolve ticker for '{query}': {str(e)}")

    def _validate_ticker(sym: str) -> bool:
        """Check if ticker exists in yfinance."""
        try:
            info = yf.Ticker(sym).info
            return bool(
                info
                and (
                    info.get("regularMarketPrice")
                    or info.get("currentPrice")
                    or info.get("previousClose")
                )
            )
        except Exception:
            return False

    def _ensure_publicly_traded(sym: str) -> None:
        """Raise ValueError if company is not publicly traded (no real price data)."""
        try:
            info = yf.Ticker(sym).info
            price = info.get("regularMarketPrice") or info.get("currentPrice") or info.get("previousClose")
            if not price or float(price) < 0.001:
                raise ValueError(
                    f"'{query}' does not appear to be a publicly traded company. "
                    "Private companies like Whoop, OpenAI, SpaceX cannot be researched here. "
                    "Try publicly traded companies like: Apple (AAPL), Tesla (TSLA), Nike (NKE), "
                    "Amazon (AMZN), Microsoft (MSFT)"
                )
        except ValueError:
            raise
        except Exception:
            pass

    # Step 2: Validate the ticker. If it fails, try fallbacks.
    resolved = None
    if _validate_ticker(ticker):
        resolved = ticker
    elif query.upper().replace(" ", ""):
        query_upper = query.upper().replace(" ", "")
        if _validate_ticker(query_upper):
            resolved = query_upper
    if not resolved:
        for suffix in (".L", ".NS", ".TO"):
            candidate = (query.upper().replace(" ", "") or ticker) + suffix
            if _validate_ticker(candidate):
                resolved = candidate
                break
    if not resolved:
        try:
            import httpx

            url = f"https://query2.finance.yahoo.com/v1/finance/search?q={query}&quotesCount=1&newsCount=0"
            headers = {"User-Agent": "Mozilla/5.0"}
            with httpx.Client(timeout=5.0) as client:
                r = client.get(url, headers=headers)
            r.raise_for_status()
            data = r.json()
            quotes = data.get("quotes") or []
            if quotes and quotes[0].get("symbol"):
                found = str(quotes[0]["symbol"]).strip()
                if found and _validate_ticker(found):
                    resolved = found
        except Exception:
            pass

    if not resolved:
        raise ValueError(f"Could not find a valid ticker for '{query}'")

    _ensure_publicly_traded(resolved)
    cache.set(cache_key, resolved, CacheTTL.TICKER_RESOLUTION)
    print(f"Cache SET: ticker resolution for '{query}' -> {resolved}")
    return resolved


def _extract_history(df: pd.DataFrame) -> List[OHLCVBar]:
    """Convert a yfinance price history DataFrame into OHLCVBar objects."""

    if df is None or df.empty:
        return []

    # Standardize column naming to what we expect.
    columns = {c.lower(): c for c in df.columns}
    o_col = columns.get("open")
    h_col = columns.get("high")
    l_col = columns.get("low")
    c_col = columns.get("close")
    v_col = columns.get("volume")

    bars: List[OHLCVBar] = []
    for idx, row in df.iterrows():
        # yfinance usually uses DatetimeIndex.
        bar_date = idx.date() if hasattr(idx, "date") else Date.fromisoformat(str(idx))
        bars.append(
            OHLCVBar(
                date=bar_date,
                open=(
                    float(row.get(o_col))
                    if o_col is not None and pd.notna(row.get(o_col))
                    else None
                ),
                high=(
                    float(row.get(h_col))
                    if h_col is not None and pd.notna(row.get(h_col))
                    else None
                ),
                low=(
                    float(row.get(l_col))
                    if l_col is not None and pd.notna(row.get(l_col))
                    else None
                ),
                close=(
                    float(row.get(c_col))
                    if c_col is not None and pd.notna(row.get(c_col))
                    else None
                ),
                volume=(
                    int(row.get(v_col))
                    if v_col is not None and pd.notna(row.get(v_col))
                    else None
                ),
            )
        )

    return bars


def _safe_get(dictionary: dict, key: str) -> Optional[float]:
    """Return a numeric field from a dict, coercing non-numeric types to float."""

    value = dictionary.get(key)
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def fetch_financials(ticker: str) -> FinancialSnapshot:
    """Fetch current financial snapshot and one-year price history for a ticker.

    This function uses the public ``yfinance`` package and does not require an
    API key. It collects a handful of useful metrics and normalizes the result
    into a :class:`FinancialSnapshot` model.

    Parameters
    ----------
    ticker:
        The ticker symbol to query (for example, ``\"AAPL\"``).

    Returns
    -------
    FinancialSnapshot
        A validated snapshot including basic valuation metrics and a one-year
        daily OHLCV history.

    Raises
    ------
    FinanceClientError
        If the ticker is invalid, if yfinance cannot be reached, or if the
        response is in an unexpected format.
    """

    if not ticker or not ticker.strip():
        raise FinanceClientError("Ticker symbol must be a non-empty string.")

    symbol = ticker.upper().strip()

    # Check cache first
    cache_key = CacheKeys.financials(symbol)
    cached = cache.get(cache_key)
    if cached:
        print(f"Cache HIT: financials for {symbol}")
        return FinancialSnapshot.model_validate(cached)

    try:
        import yfinance as yf  # type: ignore
    except ModuleNotFoundError as exc:
        raise FinanceClientError(
            "yfinance is not installed. Run: pip install -r requirements.txt"
        ) from exc

    try:
        yf_ticker = yf.Ticker(symbol)
    except Exception as exc:  # pragma: no cover - defensive against yfinance internals
        raise FinanceClientError(f"Failed to create yfinance Ticker for {symbol!r}: {exc}") from exc

    # Price and valuation: prefer fast_info where available.
    current_price: Optional[float] = None
    pe_ratio: Optional[float] = None
    eps: Optional[float] = None

    try:
        fast_info = getattr(yf_ticker, "fast_info", None) or {}
    except Exception:  # pragma: no cover - yfinance may raise on some tickers
        fast_info = {}

    if isinstance(fast_info, dict):
        current_price = _safe_get(fast_info, "last_price") or _safe_get(
            fast_info, "lastPrice"
        )
        pe_ratio = _safe_get(fast_info, "trailing_pe") or _safe_get(
            fast_info, "trailingPE"
        )

    # Fallback to the heavier .info dict for fields we did not obtain yet.
    info: dict = {}
    try:
        info = yf_ticker.info or {}
    except Exception:
        info = {}

    if current_price is None:
        current_price = _safe_get(info, "currentPrice") or _safe_get(info, "regularMarketPrice")

    if pe_ratio is None:
        pe_ratio = _safe_get(info, "trailingPE")

    eps = _safe_get(info, "trailingEps")

    # Revenue and profit margin: try info first, then financial statements.
    revenue: Optional[float] = _safe_get(info, "totalRevenue")
    profit_margin: Optional[float] = _safe_get(info, "profitMargins")

    if revenue is None or profit_margin is None:
        try:
            # financials: rows are line items, columns are periods (most recent first).
            fin_df: pd.DataFrame = yf_ticker.financials  # type: ignore[assignment]
        except Exception:
            fin_df = pd.DataFrame()

        if not fin_df.empty:
            # Attempt to pull the most recent column for revenue and net income.
            latest_col = fin_df.columns[0]
            if revenue is None:
                for revenue_key in ("Total Revenue", "TotalRevenue", "totalRevenue"):
                    if revenue_key in fin_df.index:
                        try:
                            value = fin_df.loc[revenue_key, latest_col]
                            revenue = float(value)
                            break
                        except Exception:
                            continue

            if profit_margin is None:
                net_income = None
                for ni_key in ("Net Income", "NetIncome", "netIncome"):
                    if ni_key in fin_df.index:
                        try:
                            value = fin_df.loc[ni_key, latest_col]
                            net_income = float(value)
                            break
                        except Exception:
                            continue
                if net_income is not None and revenue not in (None, 0):
                    profit_margin = net_income / revenue

    # Price history: one year of daily candles.
    try:
        history_df = yf_ticker.history(period="1y", interval="1d", auto_adjust=False)
    except Exception as exc:
        raise FinanceClientError(f"Failed to retrieve price history for {symbol!r}: {exc}") from exc

    history_bars = _extract_history(history_df)

    snapshot = _RawSnapshot(
        ticker=symbol,
        current_price=current_price,
        pe_ratio=pe_ratio,
        eps=eps,
        revenue=revenue,
        profit_margin=profit_margin,
        history=history_bars,
    )

    data = FinancialSnapshot(
        ticker=snapshot.ticker,
        current_price=snapshot.current_price,
        pe_ratio=snapshot.pe_ratio,
        eps=snapshot.eps,
        revenue=snapshot.revenue,
        profit_margin=snapshot.profit_margin,
        history=snapshot.history,
    )
    cache.set(cache_key, data.model_dump(mode="json"), CacheTTL.FINANCIALS)
    print(f"Cache SET: financials for {symbol} (24hr TTL)")
    return data


def fetch_company_profile(ticker: str) -> dict:
    """Fetch company profile fields from yfinance for display in the research UI.

    Returns a dict with: longBusinessSummary, sector, industry, country,
    fullTimeEmployees, website, founded, shortName, longName.
    Missing fields are returned as None or empty string.
    """
    import yfinance as yf  # type: ignore

    if not ticker or not ticker.strip():
        return {}

    symbol = ticker.upper().strip()
    try:
        yf_ticker = yf.Ticker(symbol)
        info = yf_ticker.info or {}
    except Exception:
        return {}

    def _str(v: object) -> str | None:
        if v is None:
            return None
        s = str(v).strip()
        return s if s else None

    def _int(v: object) -> int | None:
        if v is None:
            return None
        try:
            return int(float(v))
        except (TypeError, ValueError):
            return None

    return {
        "longBusinessSummary": _str(info.get("longBusinessSummary")),
        "sector": _str(info.get("sector")),
        "industry": _str(info.get("industry")),
        "country": _str(info.get("country")),
        "fullTimeEmployees": _int(info.get("fullTimeEmployees")),
        "website": _str(info.get("website")),
        "founded": _str(info.get("founded") or info.get("yearFounded")),
        "shortName": _str(info.get("shortName")),
        "longName": _str(info.get("longName")),
    }


def fetch_financials_extended(
    ticker: str, period: str = "1y"
) -> dict:
    """Fetch extended financial data for the financials page (Yahoo Finance style).

    Returns a dict with:
    - price_history: list of OHLCV bars for the requested period
    - current_price, open, high, low, volume, market_cap, pe_ratio, eps
    - 52_week_high, 52_week_low, avg_volume
    - profit_margin, gross_margin, operating_margin, return_on_equity
    - quarterly_revenue, quarterly_earnings (last 4 quarters)
    - currency, exchange, regular_market_change, regular_market_change_percent
    - company_name
    - market_state: "OPEN", "CLOSED", etc.
    """
    if not ticker or not ticker.strip():
        raise FinanceClientError("Ticker symbol must be a non-empty string.")

    symbol = ticker.upper().strip()

    try:
        import yfinance as yf
    except ModuleNotFoundError as exc:
        raise FinanceClientError(
            "yfinance is not installed. Run: pip install -r requirements.txt"
        ) from exc

    try:
        yf_ticker = yf.Ticker(symbol)
    except Exception as exc:
        raise FinanceClientError(
            f"Failed to create yfinance Ticker for {symbol!r}: {exc}"
        ) from exc

    info = yf_ticker.info or {}

    # Period to yfinance params
    period_map = {
        "1D": ("1d", "5m"),
        "1W": ("5d", "1h"),
        "1M": ("1mo", "1d"),
        "3M": ("3mo", "1d"),
        "6M": ("6mo", "1d"),
        "1Y": ("1y", "1d"),
    }
    yf_period, yf_interval = period_map.get(
        period.upper(), ("1y", "1d")
    )

    # Price history
    try:
        hist_df = yf_ticker.history(
            period=yf_period, interval=yf_interval, auto_adjust=False
        )
    except Exception as exc:
        raise FinanceClientError(
            f"Failed to retrieve price history for {symbol!r}: {exc}"
        ) from exc

    price_history = []
    if hist_df is not None and not hist_df.empty:
        for idx, row in hist_df.iterrows():
            ts = idx
            if hasattr(idx, "timestamp"):
                ts = idx
            price_history.append({
                "date": ts.isoformat() if hasattr(ts, "isoformat") else str(ts),
                "open": float(row.get("Open", 0)) if pd.notna(row.get("Open")) else None,
                "high": float(row.get("High", 0)) if pd.notna(row.get("High")) else None,
                "low": float(row.get("Low", 0)) if pd.notna(row.get("Low")) else None,
                "close": float(row.get("Close", 0)) if pd.notna(row.get("Close")) else None,
                "volume": int(row.get("Volume", 0)) if pd.notna(row.get("Volume")) else None,
            })

    # Current session OHLC (regular market)
    current_price = _safe_get(
        info, "regularMarketPrice"
    ) or _safe_get(info, "currentPrice") or _safe_get(info, "previousClose")
    open_price = _safe_get(info, "regularMarketOpen") or _safe_get(info, "open")
    high = _safe_get(info, "regularMarketDayHigh") or _safe_get(info, "dayHigh")
    low = _safe_get(info, "regularMarketDayLow") or _safe_get(info, "dayLow")
    volume = info.get("regularMarketVolume") or info.get("volume")
    if volume is not None:
        try:
            volume = int(volume)
        except (TypeError, ValueError):
            volume = None

    # Quarterly revenue and earnings
    quarterly_revenue = []
    quarterly_earnings = []
    try:
        qis = getattr(yf_ticker, "quarterly_income_stmt", None)
        if qis is not None and not qis.empty:
            for col in list(qis.columns)[:4]:
                col_str = str(col)
                for rev_key in ("Total Revenue", "TotalRevenue", "totalRevenue"):
                    if rev_key in qis.index:
                        try:
                            v = qis.loc[rev_key, col]
                            if pd.notna(v):
                                quarterly_revenue.append({
                                    "period": col_str[:10] if len(col_str) > 10 else col_str,
                                    "value": float(v),
                                })
                            break
                        except Exception:
                            pass
                for eps_key in (
                    "Diluted EPS", "Basic EPS", "DilutedEps", "BasicEps",
                    "Net Income", "NetIncome", "netIncome",
                ):
                    if eps_key in qis.index:
                        try:
                            v = qis.loc[eps_key, col]
                            if pd.notna(v):
                                quarterly_earnings.append({
                                    "period": col_str[:10] if len(col_str) > 10 else col_str,
                                    "value": float(v),
                                })
                            break
                        except Exception:
                            pass
    except Exception:
        pass

    prev_close = _safe_get(info, "previousClose")
    chg = _safe_get(info, "regularMarketChange")
    chg_pct = _safe_get(info, "regularMarketChangePercent")
    if chg is None and prev_close and current_price:
        chg = current_price - prev_close
    if chg_pct is None and prev_close and current_price and prev_close != 0:
        chg_pct = (current_price - prev_close) / prev_close * 100

    # Map Yahoo exchange codes to TradingView-compatible venue names.
    raw_exchange = (info.get("exchange") or "").upper()
    exchange_map = {
        "NMS": "NASDAQ",
        "NGM": "NASDAQ",
        "NAS": "NASDAQ",
        "NYQ": "NYSE",
        "NYS": "NYSE",
    }
    exchange = exchange_map.get(raw_exchange, raw_exchange or "NASDAQ")

    return {
        "ticker": symbol,
        "company_name": info.get("longName") or info.get("shortName") or symbol,
        "price_history": price_history,
        "current_price": current_price,
        "open": open_price,
        "high": high,
        "low": low,
        "volume": volume,
        "market_cap": _safe_get(info, "marketCap"),
        "pe_ratio": _safe_get(info, "trailingPE"),
        "eps": _safe_get(info, "trailingEps"),
        "52_week_high": _safe_get(info, "fiftyTwoWeekHigh"),
        "52_week_low": _safe_get(info, "fiftyTwoWeekLow"),
        "avg_volume": info.get("averageVolume"),
        "profit_margin": _safe_get(info, "profitMargins"),
        "gross_margin": _safe_get(info, "grossMargins"),
        "operating_margin": _safe_get(info, "operatingMargins"),
        "return_on_equity": _safe_get(info, "returnOnEquity"),
        "quarterly_revenue": quarterly_revenue[:4],
        "quarterly_earnings": quarterly_earnings[:4],
        "currency": info.get("currency") or "USD",
        "exchange": exchange,
        "regular_market_change": chg,
        "regular_market_change_percent": chg_pct,
        "market_state": info.get("marketState") or "UNKNOWN",
    }

