from __future__ import annotations

import json
from pathlib import Path

from src.evaluation.deepeval_runner import evaluate_report_quality


CASES = [
    {
        "name": "apple_basic",
        "input_prompt": "Analyze AAPL fundamentals and risks",
        "output_text": "Apple shows strong cash generation and stable margins, but valuation remains elevated.",
        "context": ["Apple generated strong cash flows and maintained healthy operating margins."],
    },
    {
        "name": "tesla_risk",
        "input_prompt": "Analyze TSLA risk profile",
        "output_text": "Tesla has high growth potential but execution and demand volatility increase downside risk.",
        "context": ["Tesla faces demand variability and execution risk in competitive EV markets."],
    },
]


def main() -> None:
    results = []
    for case in CASES:
        res = evaluate_report_quality(
            input_prompt=case["input_prompt"],
            output_text=case["output_text"],
            context=case["context"],
        )
        results.append({"case": case["name"], **res})

    passes = sum(1 for r in results if r["passes"])
    summary = {
        "total_cases": len(results),
        "passed_cases": passes,
        "pass_rate": round(passes / max(1, len(results)), 3),
        "mode_counts": {
            "deepeval": sum(1 for r in results if r.get("mode") == "deepeval"),
            "fallback": sum(1 for r in results if r.get("mode") == "fallback"),
        },
        "results": results,
    }

    out = Path("eval_results")
    out.mkdir(exist_ok=True)
    (out / "benchmark_summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print("Saved eval_results/benchmark_summary.json")


if __name__ == "__main__":
    main()
