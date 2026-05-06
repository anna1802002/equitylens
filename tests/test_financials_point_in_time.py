from __future__ import annotations

import pandas as pd
import pytest

from src.data.finance_client import FinanceClientError, fetch_financials_extended


def test_fetch_financials_extended_rejects_bad_as_of() -> None:
    with pytest.raises(FinanceClientError):
        fetch_financials_extended("AAPL", period="1Y", as_of="not-a-date")


def test_as_of_filter_logic_example() -> None:
    rows = [
        {"date": "2025-01-01T00:00:00+00:00", "close": 100},
        {"date": "2025-02-01T00:00:00+00:00", "close": 110},
    ]
    cutoff = pd.to_datetime("2025-01-15T00:00:00+00:00", utc=True)
    filtered = [r for r in rows if pd.to_datetime(r["date"], utc=True) <= cutoff]
    assert len(filtered) == 1
