"""Simple vectorbt backtesting helpers."""

from __future__ import annotations

import pandas as pd
import vectorbt as vbt


def run_signal_backtest(close_prices: pd.Series, entries: pd.Series, exits: pd.Series) -> dict:
    """Run a long-only backtest and return summary stats."""
    portfolio = vbt.Portfolio.from_signals(
        close=close_prices,
        entries=entries,
        exits=exits,
        init_cash=10_000.0,
        fees=0.001,
        slippage=0.001,
    )
    stats = portfolio.stats()
    return {
        "total_return_pct": float(stats.get("Total Return [%]", 0.0)),
        "max_drawdown_pct": float(stats.get("Max Drawdown [%]", 0.0)),
        "sharpe_ratio": float(stats.get("Sharpe Ratio", 0.0)),
        "win_rate_pct": float(stats.get("Win Rate [%]", 0.0)),
    }
