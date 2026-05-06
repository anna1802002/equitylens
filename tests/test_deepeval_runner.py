from src.evaluation.deepeval_runner import evaluate_report_quality


def test_deepeval_runner_returns_expected_shape() -> None:
    result = evaluate_report_quality(
        input_prompt="Analyze AAPL",
        output_text="Apple has strong cash flow and moderate valuation risk.",
        context=["Apple reported strong cash flow in recent filings."],
    )
    assert "relevancy_score" in result
    assert "faithfulness_score" in result
    assert "passes" in result
