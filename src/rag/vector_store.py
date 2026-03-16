from __future__ import annotations

from dotenv import load_dotenv
load_dotenv()

import os
import hashlib
from typing import List, Dict, Any
from pinecone import Pinecone, ServerlessSpec


class VectorStoreError(RuntimeError):
    """Raised when vector store operations fail."""


class PineconeVectorStore:
    """
    Production-grade vector store using Pinecone.
    Stores FinBERT embeddings (768-dim) of SEC filings.
    """

    def __init__(self) -> None:
        api_key = os.getenv("PINECONE_API_KEY")
        if not api_key:
            raise VectorStoreError(
                "PINECONE_API_KEY not set in .env file. "
                "Get a free key at pinecone.io"
            )
        self.pc = Pinecone(api_key=api_key)
        self.index_name = os.getenv("PINECONE_INDEX", "stock-research-agent")
        self.embedding_dim = 768
        self._ensure_index_exists()
        self.index = self.pc.Index(self.index_name)
        print(f"Connected to Pinecone index: {self.index_name}")

    def _ensure_index_exists(self) -> None:
        """Create index if it doesn't exist."""
        existing = [i.name for i in self.pc.list_indexes()]
        if self.index_name not in existing:
            print(f"Creating Pinecone index: {self.index_name}")
            self.pc.create_index(
                name=self.index_name,
                dimension=self.embedding_dim,
                metric="cosine",
                spec=ServerlessSpec(cloud="aws", region="us-east-1"),
            )
            print("Index created successfully")
        else:
            print(f"Using existing Pinecone index: {self.index_name}")

    def upsert_chunks(
        self,
        chunks: List[Dict[str, Any]],
        ticker: str,
    ) -> int:
        """
        Store document chunks with FinBERT embeddings.
        Uses ticker as namespace for isolation.
        """
        if not chunks:
            return 0
        vectors = []
        for chunk in chunks:
            if "embedding" not in chunk:
                continue
            chunk_id = hashlib.md5(
                f"{ticker}_{chunk.get('chunk_idx', 0)}_{chunk.get('text', '')[:50]}".encode()
            ).hexdigest()
            vectors.append(
                {
                    "id": chunk_id,
                    "values": chunk["embedding"],
                    "metadata": {
                        "ticker": ticker,
                        "text": chunk.get("text", "")[:1000],
                        "section": chunk.get("section", "general"),
                        "chunk_idx": chunk.get("chunk_idx", 0),
                        "word_count": chunk.get("word_count", 0),
                    },
                }
            )
        if not vectors:
            return 0
        batch_size = 100
        total = 0
        for i in range(0, len(vectors), batch_size):
            batch = vectors[i : i + batch_size]
            self.index.upsert(vectors=batch, namespace=ticker.upper())
            total += len(batch)
        print(f"Upserted {total} vectors to Pinecone namespace: {ticker}")
        return total

    def search(
        self,
        query_embedding: List[float],
        ticker: str,
        top_k: int = 5,
    ) -> List[Dict[str, Any]]:
        """
        Semantic search over SEC filing chunks.
        Returns top-k most relevant passages.
        """
        results = self.index.query(
            vector=query_embedding,
            top_k=top_k,
            namespace=ticker.upper(),
            include_metadata=True,
        )
        passages = []
        for match in results.matches:
            meta = match.metadata or {}
            passages.append(
                {
                    "text": meta.get("text", ""),
                    "section": meta.get("section", ""),
                    "score": match.score or 0.0,
                    "ticker": ticker,
                }
            )
        return passages

    def ticker_exists(self, ticker: str) -> bool:
        """Check if we already have vectors for this ticker."""
        try:
            stats = self.index.describe_index_stats()
            namespaces = stats.namespaces or {}
            return ticker.upper() in namespaces
        except Exception:
            return False

    def delete_ticker(self, ticker: str) -> None:
        """Remove all vectors for a ticker."""
        self.index.delete(delete_all=True, namespace=ticker.upper())
        print(f"Deleted all vectors for {ticker}")


vector_store = PineconeVectorStore()
VectorStore = PineconeVectorStore
