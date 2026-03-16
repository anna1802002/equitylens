"""Semantic search over Pinecone vector store.

Uses FinBERT embeddings and Pinecone for production-grade
semantic search over SEC filing chunks.
"""

from __future__ import annotations

from typing import Any, Dict, List

from .embedder import embedder
from .vector_store import vector_store


def retrieve(
    query: str,
    ticker: str,
    top_k: int = 5,
) -> List[Dict[str, Any]]:
    """
    Semantic search over SEC filing chunks for a ticker.
    Uses FinBERT embeddings and Pinecone.
    Returns list of {id, text, metadata, score} for RetrievedDoc compatibility.
    """
    query_embedding = embedder.embed_query(query)
    raw = vector_store.search(
        query_embedding=query_embedding,
        ticker=ticker,
        top_k=top_k,
    )
    results = []
    for i, r in enumerate(raw):
        results.append(
            {
                "id": f"{ticker}_{i}",
                "text": r.get("text", ""),
                "metadata": {
                    "section": r.get("section", ""),
                    "ticker": r.get("ticker", ticker),
                },
                "score": r.get("score"),
            }
        )
    return results


class RetrieverError(RuntimeError):
    """Raised when retrieval fails."""


class Retriever:
    """
    Retriever that uses module-level vector_store and embedder.
    Wraps retrieve() for compatibility with existing callers.
    """

    def __init__(
        self,
        *,
        embedder_instance: Any = None,
        vector_store_instance: Any = None,
    ) -> None:
        self.embedder = embedder_instance or embedder
        self.vector_store = vector_store_instance or vector_store

    def search(
        self,
        query: str,
        *,
        top_k: int = 5,
        candidate_pool_size: int = 25,
        where: Dict[str, Any] | None = None,
    ) -> List[Dict[str, Any]]:
        """
        Retrieve top-k relevant chunks for a query.
        where must contain {"ticker": "AAPL"} for Pinecone namespace.
        """
        ticker = (where or {}).get("ticker", "")
        if not ticker:
            return []
        k = max(top_k, candidate_pool_size)
        return retrieve(query=query, ticker=ticker, top_k=k)
