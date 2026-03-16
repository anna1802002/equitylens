"""FinanceBench-style evaluation runner for the stock research agent.

This module provides a lightweight harness to test the end-to-end agent
against financial QA-style benchmarks (e.g. FinanceBench). It does **not**
ship the dataset itself; instead, it expects a CSV file with columns:

* ``ticker``  – e.g. AAPL
* ``question`` – natural-language financial question
* ``answer``   – ground-truth short answer string

For each row, the runner:
1. Invokes the LangGraph agent for the given ticker to generate a report.
2. Uses a simple heuristic scorer that checks whether the ground-truth answer
   appears (case-insensitive substring) in the generated report.
3. Aggregates accuracy statistics.
"""

from __future__ import annotations

import csv
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional

from src.agents.graph import compiled_graph
from src.agents.state import AgentState


@dataclass
class QAExample:
    """Single FinanceBench-style QA example."""

    ticker: str
    question: str
    answer: str


@dataclass
class ExampleResult:
    """Result of running the agent on a single QA example."""

    example: QAExample
    prediction: str
    correct: bool


@dataclass
class BenchmarkSummary:
    """Aggregated metrics from a benchmark run."""

    total: int
    correct: int
    accuracy: float
    results: List[ExampleResult]


def _load_qa_csv(path: str | Path, limit: Optional[int] = None) -> List[QAExample]:
    """Load QA examples from a CSV file."""

    p = Path(path)
    if not p.is_file():
        raise FileNotFoundError(f"FinanceBench CSV not found at: {p}")

    examples: List[QAExample] = []
    with p.open("r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        required = {"ticker", "question", "answer"}
        missing = required - set(reader.fieldnames or [])
        if missing:
            raise ValueError(
                f"CSV is missing required columns: {', '.join(sorted(missing))}"
            )

        for row in reader:
            ticker = (row.get("ticker") or "").strip()
            question = (row.get("question") or "").strip()
            answer = (row.get("answer") or "").strip()
            if not ticker or not question or not answer:
                continue
            examples.append(QAExample(ticker=ticker, question=question, answer=answer))
            if limit is not None and len(examples) >= limit:
                break

    return examples


def _score_answer(prediction: str, gold: str) -> bool:
    """Simple case-insensitive substring match scorer."""

    if not prediction or not gold:
        return False
    return gold.lower() in prediction.lower()


def run_financebench(
    csv_path: str | Path,
    *,
    limit: Optional[int] = None,
) -> BenchmarkSummary:
    """Run the agent against a FinanceBench-style CSV and compute accuracy.

    Parameters
    ----------
    csv_path:
        Path to a CSV file with columns: ``ticker``, ``question``, ``answer``.
    limit:
        Optional max number of examples to run (for quick smoke tests).

    Returns
    -------
    BenchmarkSummary
        Aggregated results and per-example outcomes.
    """

    examples = _load_qa_csv(csv_path, limit=limit)
    results: List[ExampleResult] = []

    for ex in examples:
        # Current agent produces a full research report per ticker.
        # We do not yet tailor the report to each question; instead we use
        # the report as a knowledge source and check whether the gold answer
        # is present in it.
        state = AgentState(ticker=ex.ticker.upper())
        final_state = compiled_graph.invoke(state)

        if final_state.error:
            prediction = f"[ERROR] {final_state.error}"
            correct = False
        else:
            prediction = final_state.report or ""
            correct = _score_answer(prediction, ex.answer)

        results.append(
            ExampleResult(
                example=ex,
                prediction=prediction,
                correct=correct,
            )
        )

    total = len(results)
    correct = sum(1 for r in results if r.correct)
    accuracy = float(correct) / total if total > 0 else 0.0

    return BenchmarkSummary(
        total=total,
        correct=correct,
        accuracy=accuracy,
        results=results,
    )

