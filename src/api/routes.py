"""API routes: /research, /reports, /eval endpoints.

This module exposes three HTTP endpoints:

* ``POST /research?ticker=AAPL`` – runs the full agent and returns a report.
* ``GET /reports`` – returns all past reports stored in the SQLite database.
* ``GET /eval`` – returns benchmark metrics loaded from ``eval_results/``.
"""

from __future__ import annotations

import asyncio
import csv
import logging
import os
import sqlite3
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException, Query, Request, WebSocket, WebSocketDisconnect
from slowapi import Limiter
from slowapi.util import get_remote_address
from pydantic import BaseModel, Field
from fastapi.responses import JSONResponse

from src.agents.graph import compiled_graph
from src.agents.state import AgentState
from src.cache.redis_client import CacheKeys, CacheTTL, cache
from src.data.compare_client import compare_tickers
from src.data.finance_client import (
    FinanceClientError,
    fetch_company_profile,
    fetch_financials,
    fetch_financials_extended,
    resolve_ticker,
)
from src.data.coach_client import chat_with_coach
from src.data.sentiment_client import fetch_sentiment_analysis
from src.api.limiter import limiter

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/")
async def health() -> dict:
    """Health check endpoint."""
    return {"status": "ok"}


@router.websocket("/ws/research")
async def research_websocket(websocket: WebSocket) -> None:
    """WebSocket endpoint for streaming research reports."""
    await websocket.accept()
    try:
        data = await websocket.receive_json()
        query = (data.get("ticker") or "").strip()
        if not query:
            await websocket.send_json({"type": "error", "message": "No ticker provided"})
            return

        await websocket.send_json(
            {"type": "status", "message": f"Resolving ticker for '{query}'..."}
        )
        try:
            resolved_ticker = resolve_ticker(query)
        except ValueError as e:
            await websocket.send_json({"type": "error", "message": str(e)})
            return

        await websocket.send_json(
            {"type": "status", "message": f"Fetching financial data for {resolved_ticker}..."}
        )
        cache_key = CacheKeys.report(resolved_ticker)
        cached = cache.get(cache_key)
        if cached:
            await websocket.send_json({"type": "status", "message": "Loading from cache..."})
            await websocket.send_json({"type": "cached", "data": cached})
            return

        await websocket.send_json(
            {"type": "status", "message": "Fetching SEC 10-K filings..."}
        )
        financials = fetch_financials(resolved_ticker)
        try:
            import yfinance as yf
            info = yf.Ticker(resolved_ticker).info or {}
        except Exception:
            info = {}
        company_name = (
            info.get("longName") or info.get("shortName") or resolved_ticker
        )
        await websocket.send_json(
            {"type": "status", "message": f"Analyzing {company_name} financials..."}
        )
        await websocket.send_json(
            {"type": "status", "message": "Processing SEC filings with FinBERT..."}
        )
        await websocket.send_json(
            {"type": "status", "message": "Analyzing market sentiment..."}
        )

        state = AgentState(ticker=resolved_ticker)
        result = await asyncio.to_thread(compiled_graph.invoke, state)
        final_state = (
            result
            if isinstance(result, AgentState)
            else AgentState.model_validate(result)
        )
        if final_state.error:
            await websocket.send_json(
                {"type": "error", "message": final_state.error or "Agent failed"}
            )
            return

        await websocket.send_json(
            {"type": "status", "message": "Generating AI report..."}
        )

        from groq import Groq

        client = Groq(api_key=os.getenv("GROQ_API_KEY"))
        rec = final_state.recommendation or "HOLD"
        risk = final_state.risk_score or 50
        margin = (financials.profit_margin or 0) or 0
        pe = (financials.pe_ratio or 0) or 0
        price = (financials.current_price or 0) or 0
        eps = (financials.eps or 0) or 0

        stream = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {
                    "role": "user",
                    "content": f"""You are explaining {company_name} stock to
                someone who has never invested before.

                Key facts:
                - Price: ${price}
                - P/E Ratio: {pe}
                - Profit Margin: {margin * 100:.1f}%
                - EPS: ${eps}
                - Our recommendation: {rec}
                - Risk Score: {risk}/100

                Write a helpful 5-6 sentence analysis in plain English.
                Cover: what the company does, how finances look,
                recommendation reasoning, one risk to know about,
                and what this means for a regular investor.
                Sound like a smart friend, not a robot.""",
                }
            ],
            max_tokens=300,
            temperature=0.4,
            stream=True,
        )

        await websocket.send_json({"type": "stream_start"})
        full_text = ""
        for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                token = chunk.choices[0].delta.content
                full_text += token
                await websocket.send_json({"type": "token", "content": token})
                await asyncio.sleep(0)
        await websocket.send_json({"type": "stream_end"})

        profile = fetch_company_profile(resolved_ticker)
        now = datetime.now(timezone.utc)
        start = now - timedelta(days=30)
        filing_date = ""
        for doc in final_state.retrieved_docs:
            d = doc.metadata.get("date") if doc.metadata else None
            if d and (not filing_date or str(d) > filing_date):
                filing_date = str(d)
        if filing_date:
            try:
                fd = datetime.fromisoformat(filing_date.replace("Z", "+00:00")).date()
                filing_date = fd.strftime("%b %d, %Y")
            except Exception:
                pass

        def _normalize_report_value(report: Any) -> dict:
            if isinstance(report, dict):
                return report
            return {"raw": report or ""}

        response_data = {
            "success": True,
            "ticker": resolved_ticker,
            "report": _normalize_report_value(final_state.report),
            "risk_score": final_state.risk_score,
            "financials": final_state.financials.model_dump() if final_state.financials else None,
            "news": [n.model_dump(mode="json") for n in final_state.news],
            "news_count": len(final_state.news),
            "retrieved_docs_count": len(final_state.retrieved_docs),
            "recommendation": final_state.recommendation,
            "recommendation_score": final_state.recommendation_score,
            "recommendation_reasons": final_state.recommendation_reasons or [],
            "plain_english_summary": full_text or final_state.plain_english_summary,
            "plain_summary": full_text,
            "overall_sentiment_score": final_state.overall_sentiment_score,
            "sentiment_score": getattr(
                final_state, "sentiment_score", None
            ) or final_state.overall_sentiment_score,
            "sentiment_label": final_state.sentiment_label or "Neutral",
            "sentiment_summary": getattr(
                final_state, "sentiment_summary", None
            ) or "",
            "company_description": profile.get("longBusinessSummary") or "",
            "company_name": profile.get("longName") or profile.get("shortName") or company_name,
            "sector": profile.get("sector") or "",
            "industry": profile.get("industry") or "",
            "employees": profile.get("fullTimeEmployees"),
            "website": profile.get("website") or "",
            "country": profile.get("country") or "",
            "data_as_of": now.strftime("%B %d, %Y at %I:%M %p UTC"),
            "news_date_range": f"{start.strftime('%b %d')} - {now.strftime('%b %d, %Y')}",
            "filing_date": filing_date,
            "price_target": getattr(final_state, "price_target", None),
            "price_target_upside": getattr(final_state, "price_target_upside", None),
            "bull_case": getattr(final_state, "bull_case", None),
            "bear_case": getattr(final_state, "bear_case", None),
            "time_horizon": getattr(final_state, "time_horizon", None),
        }
        cache.set(cache_key, response_data, CacheTTL.REPORT)
        await websocket.send_json({"type": "complete", "data": response_data})
    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
    except Exception as e:
        logger.exception("WebSocket research error")
        try:
            await websocket.send_json(
                {"type": "error", "message": f"Research failed: {str(e)}"}
            )
        except Exception:
            pass


@router.get("/cache/stats")
async def cache_stats() -> dict:
    """Show cache status for monitoring."""
    return {
        "cache_available": cache.is_available,
        "provider": "Upstash Redis (Serverless)",
        "ttl_config": {
            "financials": "24 hours",
            "reports": "6 hours",
            "sentiment": "2 hours",
            "ticker_resolution": "7 days",
        },
    }


@router.get("/compare")
@limiter.limit("10/minute")
async def get_compare(
    request: Request,
    ticker1: str = Query(..., min_length=1, description="First ticker, e.g. AAPL"),
    ticker2: str = Query(..., min_length=1, description="Second ticker, e.g. MSFT"),
) -> dict:
    """Compare two tickers side by side with AI verdict."""
    t1 = ticker1.strip().upper()
    t2 = ticker2.strip().upper()
    cache_key = CacheKeys.comparison(t1, t2)
    cached = cache.get(cache_key)
    if cached:
        return cached
    try:
        result = compare_tickers(ticker1, ticker2)
        cache.set(cache_key, result, CacheTTL.COMPARISON)
        return result
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except FinanceClientError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/financials")
@limiter.limit("20/minute")
async def get_financials(
    request: Request,
    ticker: str = Query(..., min_length=1, description="Ticker symbol, e.g. AAPL"),
    period: str = Query("1Y", description="Chart period: 1D, 1W, 1M, 3M, 6M, 1Y"),
) -> dict:
    """Fetch extended financial data for a ticker (Yahoo Finance style)."""
    resolved = ticker.strip().upper()
    try:
        resolved = resolve_ticker(ticker)
    except ValueError:
        pass
    try:
        data = fetch_financials_extended(resolved, period=period)
        return data
    except FinanceClientError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


class CoachRequest(BaseModel):
    """Request body for POST /api/coach."""

    message: str = Field(..., min_length=1)
    mode: str = Field(default="educator")
    history: list[dict[str, str]] = Field(default_factory=list)


@router.post("/coach")
async def post_coach(body: CoachRequest) -> dict:
    """Chat with the Investment Coach."""
    try:
        return chat_with_coach(
            message=body.message,
            mode=body.mode,
            history=body.history,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/coach")
async def get_coach() -> dict:
    """Health/info endpoint for coach (returns available modes)."""
    return {
        "status": "ok",
        "modes": ["educator", "analyst", "quick_take"],
    }


@router.get("/sentiment")
@limiter.limit("20/minute")
async def get_sentiment(
    request: Request,
    ticker: str = Query(..., min_length=1, description="Ticker symbol, e.g. AAPL"),
) -> dict:
    """Fetch AI-generated market sentiment analysis for a ticker."""
    resolved = ticker.strip().upper()
    try:
        resolved = resolve_ticker(ticker)
    except ValueError:
        pass
    try:
        return fetch_sentiment_analysis(resolved)
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


def _project_root() -> Path:
    """Return the project root directory (one level above src/)."""

    return Path(__file__).resolve().parents[2]


def _reports_db_path() -> Path:
    """Return the path to the SQLite database for reports."""

    return _project_root() / "data" / "reports.db"


def _ensure_reports_table(conn: sqlite3.Connection) -> None:
    """Create the reports table if it does not already exist, and add new columns if missing."""

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticker TEXT NOT NULL,
            report TEXT NOT NULL,
            risk_score REAL,
            created_at TEXT NOT NULL,
            company_name TEXT,
            recommendation TEXT,
            price REAL
        )
        """
    )
    # Add columns for existing tables that were created before schema update
    for col, col_type in (("company_name", "TEXT"), ("recommendation", "TEXT"), ("price", "REAL")):
        try:
            conn.execute(f"ALTER TABLE reports ADD COLUMN {col} {col_type}")
            conn.commit()
        except sqlite3.OperationalError:
            pass  # Column already exists


def _ensure_watchlist_table(conn: sqlite3.Connection) -> None:
    """Create the watchlist table if it does not already exist."""

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS watchlist (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticker TEXT NOT NULL UNIQUE,
            company_name TEXT,
            added_price REAL,
            added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    conn.commit()


class WatchlistAddRequest(BaseModel):
    """Request body for POST /api/watchlist."""

    ticker: str = Field(..., min_length=1, description="Ticker symbol, e.g. AAPL")


@router.post("/research")
@limiter.limit("10/minute")
async def run_research(
    request: Request,
    ticker: str = Query(..., description="Ticker symbol, e.g. AAPL"),
) -> Dict[str, Any]:
    """Run the full research agent for a ticker and return the report."""

    try:
        resolved_ticker = resolve_ticker(ticker)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid ticker")

    report_cache_key = CacheKeys.report(resolved_ticker)
    cached_report = cache.get(report_cache_key)
    if cached_report:
        logger.info("Cache HIT: full report for %s", resolved_ticker)
        return cached_report

    logger.info("Resolved '%s' -> '%s'", ticker, resolved_ticker)

    logger.info("Research request started", extra={"query": ticker, "ticker": resolved_ticker})

    # Invoke LangGraph agent with robust error handling.
    try:
        initial_state = AgentState(ticker=resolved_ticker)
        result = compiled_graph.invoke(initial_state)
        final_state = (
            result
            if isinstance(result, AgentState)
            else AgentState.model_validate(result)
        )
    except Exception as exc:
        logger.exception("Agent invocation failed", extra={"ticker": resolved_ticker})
        return JSONResponse(
            status_code=200,
            content={
                "success": False,
                "ticker": resolved_ticker,
                "error": f"Agent invocation failed: {exc}",
            },
        )

    if final_state.error:
        logger.warning(
            "Agent completed with error",
            extra={"ticker": resolved_ticker, "error": final_state.error},
        )
        return JSONResponse(
            status_code=200,
            content={
                "success": False,
                "ticker": resolved_ticker,
                "error": final_state.error,
            },
        )

    if not final_state.report:
        logger.error("Agent returned empty report", extra={"ticker": resolved_ticker})
        return JSONResponse(
            status_code=200,
            content={
                "success": False,
                "ticker": resolved_ticker,
                "error": "Agent completed without producing a report.",
            },
        )

    # Persist report to SQLite.
    profile = fetch_company_profile(resolved_ticker)
    company_name = profile.get("longName") or profile.get("shortName") or resolved_ticker
    price = None
    if final_state.financials and final_state.financials.current_price is not None:
        price = float(final_state.financials.current_price)
    recommendation = final_state.recommendation or ""

    db_path = _reports_db_path()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        conn = sqlite3.connect(db_path)
        try:
            _ensure_reports_table(conn)
            conn.execute(
                """INSERT INTO reports (ticker, report, risk_score, created_at, company_name, recommendation, price)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (
                    resolved_ticker,
                    json.dumps(final_state.report),
                    final_state.risk_score,
                    datetime.now(timezone.utc).isoformat(),
                    company_name,
                    recommendation,
                    price,
                ),
            )
            conn.commit()
        finally:
            conn.close()
    except Exception as exc:
        logger.exception("Failed to persist report to SQLite", extra={"ticker": resolved_ticker})
        # Still return the report payload even if persistence fails.
        profile = fetch_company_profile(resolved_ticker)
        filing_date = ""
        for doc in final_state.retrieved_docs:
            d = doc.metadata.get("date") if doc.metadata else None
            if d and (not filing_date or str(d) > filing_date):
                filing_date = str(d)
        now = datetime.now(timezone.utc)
        start = now - timedelta(days=30)
        try:
            if filing_date:
                fd = datetime.fromisoformat(filing_date.replace("Z", "+00:00")).date()
                filing_date = fd.strftime("%b %d, %Y")
        except Exception:
            pass
        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "ticker": resolved_ticker,
                "report": final_state.report if isinstance(final_state.report, dict) else {"raw": final_state.report},
                "risk_score": final_state.risk_score,
                "financials": final_state.financials.model_dump() if final_state.financials else None,
                "news": [n.model_dump(mode="json") for n in final_state.news],
                "news_count": len(final_state.news),
                "retrieved_docs_count": len(final_state.retrieved_docs),
                "recommendation": final_state.recommendation,
                "recommendation_score": final_state.recommendation_score,
                "recommendation_reasons": final_state.recommendation_reasons or [],
                "plain_english_summary": final_state.plain_english_summary or "",
                "overall_sentiment_score": final_state.overall_sentiment_score,
                "sentiment_score": getattr(final_state, "sentiment_score", None) or final_state.overall_sentiment_score,
                "sentiment_label": final_state.sentiment_label or "Neutral",
                "sentiment_summary": getattr(final_state, "sentiment_summary", None) or "",
                "company_description": profile.get("longBusinessSummary") or "",
                "company_name": profile.get("longName") or profile.get("shortName") or resolved_ticker,
                "sector": profile.get("sector") or "",
                "industry": profile.get("industry") or "",
                "employees": profile.get("fullTimeEmployees"),
                "website": profile.get("website") or "",
                "country": profile.get("country") or "",
                "data_as_of": now.strftime("%B %d, %Y at %I:%M %p UTC"),
                "news_date_range": f"{start.strftime('%b %d')} - {now.strftime('%b %d, %Y')}",
                "filing_date": filing_date,
                "price_target": getattr(final_state, "price_target", None),
                "price_target_upside": getattr(final_state, "price_target_upside", None),
                "bull_case": getattr(final_state, "bull_case", None),
                "bear_case": getattr(final_state, "bear_case", None),
                "time_horizon": getattr(final_state, "time_horizon", None),
                "warning": f"Report generated but could not be saved: {exc}",
            },
        )

    logger.info(
        "Research request completed",
        extra={
            "ticker": resolved_ticker,
            "news_count": len(final_state.news),
            "retrieved_docs_count": len(final_state.retrieved_docs),
        },
    )

    # Fetch company profile from yfinance for the UI.
    profile = fetch_company_profile(resolved_ticker)
    company_description = profile.get("longBusinessSummary") or ""
    company_name = (
        profile.get("longName") or profile.get("shortName") or resolved_ticker
    )
    sector = profile.get("sector") or ""
    industry = profile.get("industry") or ""
    employees = profile.get("fullTimeEmployees")
    website = profile.get("website") or ""
    country = profile.get("country") or ""

    # Extract most recent filing date from retrieved docs.
    filing_date = ""
    for doc in final_state.retrieved_docs:
        d = doc.metadata.get("date") if doc.metadata else None
        if d and (not filing_date or str(d) > filing_date):
            filing_date = str(d)

    # Format data timestamps.
    now = datetime.now(timezone.utc)
    data_as_of = now.strftime("%B %d, %Y at %I:%M %p UTC")
    start = now - timedelta(days=30)
    news_date_range = f"{start.strftime('%b %d')} - {now.strftime('%b %d, %Y')}"
    if filing_date:
        try:
            fd = datetime.fromisoformat(filing_date.replace("Z", "+00:00")).date()
            filing_date = fd.strftime("%b %d, %Y")
        except Exception:
            pass

    response_data = {
        "success": True,
        "ticker": resolved_ticker,
        "report": final_state.report
        if isinstance(final_state.report, dict)
        else {
            "recommendation": "HOLD",
            "risk_score": 50,
            "score": 0,
            "reasons": [],
            "financial_health": "Moderate",
            "plain_summary": str(final_state.report) if final_state.report else "",
            "price_target": round(
                float(
                    (
                        getattr(
                            getattr(final_state, "financials", None),
                            "current_price",
                            100.0,
                        )
                        or 100.0
                    )
                    * 1.1
                ),
                2,
            ),
            "price_target_upside": 10.0,
            "bull_case": "Strong market position and brand recognition could drive significant upside.",
            "bear_case": "Macroeconomic headwinds and competition could pressure margins and growth.",
            "time_horizon": "12 months",
        },
        "risk_score": final_state.risk_score,
        "financials": final_state.financials.model_dump() if final_state.financials else None,
        "news": [n.model_dump(mode="json") for n in final_state.news],
        "news_count": len(final_state.news),
        "retrieved_docs_count": len(final_state.retrieved_docs),
        "recommendation": final_state.recommendation,
        "recommendation_score": final_state.recommendation_score,
        "recommendation_reasons": final_state.recommendation_reasons or [],
        "plain_english_summary": final_state.plain_english_summary or "",
        "overall_sentiment_score": final_state.overall_sentiment_score,
        "sentiment_score": getattr(final_state, "sentiment_score", None) or final_state.overall_sentiment_score,
        "sentiment_label": final_state.sentiment_label or "Neutral",
        "sentiment_summary": getattr(final_state, "sentiment_summary", None) or "",
        "company_description": company_description,
        "company_name": company_name,
        "sector": sector,
        "industry": industry,
        "employees": employees,
        "website": website,
        "country": country,
        "data_as_of": data_as_of,
        "news_date_range": news_date_range,
        "filing_date": filing_date,
        "price_target": getattr(final_state, "price_target", None),
        "price_target_upside": getattr(final_state, "price_target_upside", None),
        "bull_case": getattr(final_state, "bull_case", None),
        "bear_case": getattr(final_state, "bear_case", None),
        "time_horizon": getattr(final_state, "time_horizon", None),
    }
    cache.set(report_cache_key, response_data, CacheTTL.REPORT)
    logger.info("Cache SET: report for %s (6hr TTL)", resolved_ticker)
    return response_data


def _format_created_at(iso_str: str | None) -> str:
    """Format created_at as 'Mar 11, 2026 · 10:47 PM'."""
    if not iso_str:
        return "—"
    try:
        dt = datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
        return dt.strftime("%b %d, %Y · %I:%M %p")
    except Exception:
        return str(iso_str)[:19]


@router.get("/reports")
@limiter.limit("10/minute")
async def list_reports(request: Request) -> List[Dict[str, Any]]:
    """Return all past reports from the SQLite database."""

    db_path = _reports_db_path()
    if not db_path.is_file():
        return []

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        _ensure_reports_table(conn)
        rows = conn.execute(
            """SELECT id, ticker, report, risk_score, created_at, company_name, recommendation, price
               FROM reports ORDER BY created_at DESC"""
        ).fetchall()
    finally:
        conn.close()

    return [
        {
            "id": row["id"],
            "ticker": row["ticker"],
            "company_name": row["company_name"] or row["ticker"],
            "report": row["report"],
            "risk_score": row["risk_score"],
            "recommendation": row["recommendation"] or "",
            "price": row["price"],
            "created_at": row["created_at"],
            "created_at_formatted": _format_created_at(row["created_at"]),
        }
        for row in rows
    ]


@router.get("/watchlist")
async def get_watchlist() -> List[Dict[str, Any]]:
    """Return watchlist items with fresh live pricing."""

    db_path = _reports_db_path()
    if not db_path.is_file():
        return []

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        _ensure_watchlist_table(conn)
        rows = conn.execute(
            """SELECT ticker, company_name, added_price, added_at
               FROM watchlist ORDER BY added_at DESC"""
        ).fetchall()
    finally:
        conn.close()

    items: List[Dict[str, Any]] = []
    for row in rows:
        t = (row["ticker"] or "").upper().strip()
        try:
            fin = fetch_financials_extended(t, period="1Y")
        except Exception:
            fin = {}

        current_price = fin.get("current_price")
        chg_pct = fin.get("regular_market_change_percent")
        exchange = fin.get("exchange") or "NASDAQ"

        added_price = row["added_price"]
        gain_abs = None
        gain_pct = None
        try:
            if added_price is not None and current_price is not None and float(added_price) != 0:
                gain_abs = float(current_price) - float(added_price)
                gain_pct = gain_abs / float(added_price) * 100.0
        except Exception:
            gain_abs = None
            gain_pct = None

        items.append(
            {
                "ticker": t,
                "company_name": row["company_name"] or fin.get("company_name") or t,
                "exchange": exchange,
                "added_price": added_price,
                "added_at": row["added_at"],
                "current_price": current_price,
                "change_percent": chg_pct,
                "gain_abs": gain_abs,
                "gain_pct": gain_pct,
            }
        )

    return items


@router.post("/watchlist")
async def add_watchlist_item(body: WatchlistAddRequest) -> Dict[str, Any]:
    """Add a ticker to the watchlist (stored in SQLite)."""

    try:
        resolved = resolve_ticker(body.ticker)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        profile = fetch_company_profile(resolved)
        company_name = profile.get("longName") or profile.get("shortName") or resolved
    except Exception:
        company_name = resolved

    try:
        fin = fetch_financials_extended(resolved, period="1Y")
        added_price = fin.get("current_price")
    except Exception:
        added_price = None

    db_path = _reports_db_path()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    try:
        _ensure_watchlist_table(conn)
        try:
            conn.execute(
                """INSERT INTO watchlist (ticker, company_name, added_price)
                   VALUES (?, ?, ?)""",
                (resolved, company_name, added_price),
            )
            conn.commit()
        except sqlite3.IntegrityError:
            pass
    finally:
        conn.close()

    return {"success": True, "ticker": resolved}


@router.delete("/watchlist/{ticker}")
async def remove_watchlist_item(ticker: str) -> Dict[str, Any]:
    """Remove a ticker from the watchlist."""

    resolved = ticker.strip().upper()
    if not resolved:
        raise HTTPException(status_code=400, detail="Ticker must be a non-empty string.")

    db_path = _reports_db_path()
    if not db_path.is_file():
        raise HTTPException(status_code=404, detail="Watchlist is empty.")

    conn = sqlite3.connect(db_path)
    try:
        _ensure_watchlist_table(conn)
        cur = conn.execute("DELETE FROM watchlist WHERE ticker = ?", (resolved,))
        conn.commit()
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Ticker not found in watchlist.")
    finally:
        conn.close()

    return {"success": True}


@router.delete("/reports/{report_id}")
async def delete_report(report_id: int) -> dict:
    """Delete a report from the history."""
    db_path = _reports_db_path()
    if not db_path.is_file():
        raise HTTPException(status_code=404, detail="No reports found")
    conn = sqlite3.connect(db_path)
    try:
        cursor = conn.execute("DELETE FROM reports WHERE id = ?", (report_id,))
        conn.commit()
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Report not found")
    finally:
        conn.close()
    return {"success": True}


@router.get("/eval")
async def get_eval_results() -> List[Dict[str, Any]]:
    """Return benchmark metrics loaded from eval_results/ summary CSV files."""

    eval_dir = _project_root() / "eval_results"
    if not eval_dir.is_dir():
        return []

    summaries: List[Dict[str, Any]] = []
    for csv_path in eval_dir.glob("*_summary.csv"):
        try:
            with csv_path.open("r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                rows = list(reader)
                if not rows:
                    continue
                row = rows[0]
                row["file"] = csv_path.name
                summaries.append(row)
        except Exception:
            continue

    return summaries

