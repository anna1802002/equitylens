"""Qdrant-backed optional vector store for research chunks."""

from __future__ import annotations

import os
from typing import Iterable

from qdrant_client import QdrantClient
from qdrant_client.http import models as rest


def get_qdrant_client() -> QdrantClient:
    url = os.getenv("QDRANT_URL", "http://localhost:6333")
    api_key = os.getenv("QDRANT_API_KEY")
    return QdrantClient(url=url, api_key=api_key)


def ensure_collection(name: str = "equitylens_docs", size: int = 768) -> None:
    client = get_qdrant_client()
    collections = {c.name for c in client.get_collections().collections}
    if name in collections:
        return
    client.create_collection(
        collection_name=name,
        vectors_config=rest.VectorParams(size=size, distance=rest.Distance.COSINE),
    )


def upsert_vectors(
    points: Iterable[rest.PointStruct],
    collection_name: str = "equitylens_docs",
) -> None:
    client = get_qdrant_client()
    ensure_collection(collection_name)
    client.upsert(collection_name=collection_name, points=list(points))
