from src.agents.committee import CommitteeInput, run_committee


def test_committee_returns_structured_verdict() -> None:
    result = run_committee(
        CommitteeInput(
            ticker="AAPL",
            recommendation="BUY",
            risk_score=42.0,
            sentiment_score=0.3,
            pe_ratio=28.0,
            profit_margin=0.21,
        )
    )
    assert "bull_view" in result
    assert "bear_view" in result
    assert "risk_view" in result
    assert "chair" in result
    assert result["chair"]["decision"] in {"APPROVE_BUY", "REJECT_BUY", "WATCHLIST"}
