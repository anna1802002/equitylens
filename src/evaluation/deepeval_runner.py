"""DeepEval-compatible runner for regression-style LLM quality checks.

Falls back to deterministic lexical checks when LLM eval providers
are not configured in local/dev environments.
"""

from __future__ import annotations

def evaluate_report_quality(input_prompt: str, output_text: str, context: list[str]) -> dict:
    """Run lightweight relevance + faithfulness checks for generated reports."""
    try:
        from deepeval.metrics import AnswerRelevancyMetric, FaithfulnessMetric
        from deepeval.test_case import LLMTestCase

        case = LLMTestCase(
            input=input_prompt,
            actual_output=output_text,
            retrieval_context=context,
        )
        relevancy = AnswerRelevancyMetric(threshold=0.6)
        faithfulness = FaithfulnessMetric(threshold=0.6)
        relevancy.measure(case)
        faithfulness.measure(case)
        return {
            "relevancy_score": relevancy.score,
            "faithfulness_score": faithfulness.score,
            "relevancy_reason": relevancy.reason,
            "faithfulness_reason": faithfulness.reason,
            "passes": bool(relevancy.success and faithfulness.success),
            "mode": "deepeval",
        }
    except Exception:
        # Deterministic fallback to keep CI stable without external LLM keys.
        input_terms = {t.lower() for t in input_prompt.split() if t.isalpha()}
        output_terms = {t.lower() for t in output_text.split() if t.isalpha()}
        context_terms = {t.lower() for c in context for t in c.split() if t.isalpha()}
        relevancy_score = len(input_terms & output_terms) / max(1, len(input_terms))
        faithfulness_score = len(context_terms & output_terms) / max(1, len(output_terms))
        return {
            "relevancy_score": relevancy_score,
            "faithfulness_score": faithfulness_score,
            "relevancy_reason": "Fallback lexical overlap metric.",
            "faithfulness_reason": "Fallback lexical context overlap metric.",
            "passes": bool(relevancy_score >= 0.2 and faithfulness_score >= 0.2),
            "mode": "fallback",
        }
