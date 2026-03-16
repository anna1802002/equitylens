"""Evaluation metrics: ROUGE-L, factual accuracy, hallucination rate.

This module provides helper functions to:

* compute ROUGE-L between predicted and reference answers
* summarize factual QA accuracy from :class:`BenchmarkSummary`
* compute numeric hallucination rate using :class:`HallucinationReport`
* save evaluation results to ``eval_results/`` as CSV files
"""

from __future__ import annotations

import csv
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, List, Optional

from .benchmarks import BenchmarkSummary, ExampleResult
from .hallucination import HallucinationReport


def _lcs_length(a: str, b: str) -> int:
    """Return length of the longest common subsequence between two strings."""

    # Tokenize on whitespace for a simple ROUGE-L approximation.
    a_tokens = a.split()
    b_tokens = b.split()
    n, m = len(a_tokens), len(b_tokens)
    if n == 0 or m == 0:
        return 0

    dp = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            if a_tokens[i - 1] == b_tokens[j - 1]:
                dp[i][j] = dp[i - 1][j - 1] + 1
            else:
                dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])
    return dp[n][m]


def rouge_l(prediction: str, reference: str) -> float:
    """Compute a simple ROUGE-L F1 score between two strings."""

    if not prediction or not reference:
        return 0.0

    lcs = _lcs_length(prediction, reference)
    ref_len = len(reference.split())
    pred_len = len(prediction.split())
    if ref_len == 0 or pred_len == 0:
        return 0.0

    recall = lcs / ref_len
    precision = lcs / pred_len
    if recall + precision == 0:
        return 0.0
    return 2 * recall * precision / (recall + precision)


@dataclass
class MetricSummary:
    """High-level evaluation metrics for a benchmark run."""

    rouge_l_avg: float
    factual_accuracy: float
    hallucination_rate: float


def summarize_metrics(
    benchmark: BenchmarkSummary,
    hallucinations: Iterable[HallucinationReport],
) -> MetricSummary:
    """Compute ROUGE-L, accuracy, and hallucination rate for a benchmark run."""

    # ROUGE-L is computed against the short answer, using the full report.
    rouge_scores: List[float] = []
    for result in benchmark.results:
        gold = result.example.answer
        pred = result.prediction
        rouge_scores.append(rouge_l(pred, gold))

    rouge_l_avg = sum(rouge_scores) / len(rouge_scores) if rouge_scores else 0.0
    factual_accuracy = benchmark.accuracy

    hallucination_list = list(hallucinations)
    total_reports = len(hallucination_list)
    hallucinated = sum(1 for h in hallucination_list if not h.is_clean)
    hallucination_rate = float(hallucinated) / total_reports if total_reports > 0 else 0.0

    return MetricSummary(
        rouge_l_avg=rouge_l_avg,
        factual_accuracy=factual_accuracy,
        hallucination_rate=hallucination_rate,
    )


def calculate_metrics(
    predictions: List[str],
    references: List[str],
    hallucinations: Iterable[HallucinationReport],
) -> MetricSummary:
    """Calculate ROUGE-L, factual accuracy, and hallucination rate.

    Parameters
    ----------
    predictions:
        List of model-predicted answers or reports.
    references:
        List of ground-truth answers (same length as predictions).
    hallucinations:
        Iterable of :class:`HallucinationReport` objects for the same set of
        predictions. A report is considered hallucinated if ``is_clean`` is
        False.
    """

    if len(predictions) != len(references):
        raise ValueError("predictions and references must have the same length.")

    # ROUGE-L and factual accuracy from raw strings.
    rouge_scores: List[float] = []
    correct_flags: List[bool] = []
    for pred, ref in zip(predictions, references, strict=False):
        rouge_scores.append(rouge_l(pred or "", ref or ""))
        correct_flags.append((pred or "").strip().lower() == (ref or "").strip().lower())

    rouge_l_avg = sum(rouge_scores) / len(rouge_scores) if rouge_scores else 0.0
    factual_accuracy = (
        sum(1 for flag in correct_flags if flag) / len(correct_flags) if correct_flags else 0.0
    )

    hallucination_list = list(hallucinations)
    total_reports = len(hallucination_list)
    hallucinated = sum(1 for h in hallucination_list if not h.is_clean)
    hallucination_rate = float(hallucinated) / total_reports if total_reports > 0 else 0.0

    return MetricSummary(
        rouge_l_avg=rouge_l_avg,
        factual_accuracy=factual_accuracy,
        hallucination_rate=hallucination_rate,
    )


def save_benchmark_results_csv(
    benchmark: BenchmarkSummary,
    metrics: MetricSummary,
    output_path: str | Path,
) -> None:
    """Save per-example and aggregate metrics to CSV."""

    p = Path(output_path)
    p.parent.mkdir(parents=True, exist_ok=True)

    fieldnames = [
        "ticker",
        "question",
        "gold_answer",
        "prediction",
        "correct",
        "rouge_l",
    ]

    with p.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()

        for result in benchmark.results:
            rouge = rouge_l(result.prediction, result.example.answer)
            writer.writerow(
                {
                    "ticker": result.example.ticker,
                    "question": result.example.question,
                    "gold_answer": result.example.answer,
                    "prediction": result.prediction,
                    "correct": int(result.correct),
                    "rouge_l": f"{rouge:.4f}",
                }
            )

    # Also write a tiny summary CSV alongside the detailed file.
    summary_path = p.with_name(p.stem + "_summary.csv")
    with summary_path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
                "rouge_l_avg",
                "factual_accuracy",
                "hallucination_rate",
            ],
        )
        writer.writeheader()
        writer.writerow(
            {
                "rouge_l_avg": f"{metrics.rouge_l_avg:.4f}",
                "factual_accuracy": f"{metrics.factual_accuracy:.4f}",
                "hallucination_rate": f"{metrics.hallucination_rate:.4f}",
            }
        )

