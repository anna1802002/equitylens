"""Financial domain embeddings using FinBERT.

FinBERT is trained on financial text including SEC filings, earnings calls, and
financial news. This module exposes a domain-specific embedder suitable for
retrieving relevant sections from long financial documents.
"""

from __future__ import annotations

from typing import List

from sentence_transformers import SentenceTransformer


class FinancialEmbedder:
    """
    Domain-specific embedder using FinBERT.
    Model: ProsusAI/finbert
    Trained on: Financial PhraseBank, SEC filings, earnings call transcripts
    Embedding dimension: 768
    """

    _instance = None

    def __new__(cls):
        # Only load model once — it's large.
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self) -> None:
        if getattr(self, "_initialized", False):
            return

        print("Loading FinBERT financial embeddings model...")
        print("Model: ProsusAI/finbert")
        print("Domain: Financial text, SEC filings, earnings calls")

        self.model = SentenceTransformer("ProsusAI/finbert")
        self.model_name = "ProsusAI/finbert"
        self.embedding_dim = 768
        self._initialized = True

        print(
            f"FinBERT loaded successfully. Embedding dimension: {self.embedding_dim}"
        )

    def embed_texts(self, texts: List[str]) -> List[List[float]]:
        """Embed a list of financial texts using FinBERT."""
        if not texts:
            return []

        cleaned = [self._clean_financial_text(t) for t in texts]
        embeddings = self.model.encode(
            cleaned,
            batch_size=32,
            show_progress_bar=len(cleaned) > 10,
            convert_to_tensor=False,
            normalize_embeddings=True,
        )
        return [vec.tolist() for vec in embeddings]

    def embed_query(self, query: str) -> List[float]:
        """Embed a single financial search query."""
        cleaned = self._clean_financial_text(query)
        embedding = self.model.encode(
            cleaned,
            convert_to_tensor=False,
            normalize_embeddings=True,
        )
        return embedding.tolist()

    def _clean_financial_text(self, text: str) -> str:
        """Lightly clean SEC/financial text for better embeddings."""
        if not text:
            return ""
        words = text.split()
        if len(words) > 400:
            text = " ".join(words[:400])
        text = " ".join(text.split())
        return text.strip()

    def get_model_info(self) -> dict:
        """Return model metadata for logging/display."""
        return {
            "model_name": self.model_name,
            "embedding_dim": self.embedding_dim,
            "domain": "Financial text",
            "trained_on": [
                "Financial PhraseBank",
                "SEC filings",
                "Earnings call transcripts",
                "Financial news articles",
            ],
            "advantage_over_general": (
                "FinBERT understands financial terminology like P/E ratio, EBITDA, "
                "amortization, and revenue recognition — general models do not."
            ),
        }


embedder = FinancialEmbedder()


def chunk_and_embed(text: str, ticker: str) -> List[dict]:
    """
    Chunk SEC filing text and embed with FinBERT.
    Returns list of {text, chunk_idx, section, embedding, word_count}
    for Pinecone upsert_chunks.
    """
    if not text or not text.strip():
        return []
    words = text.split()
    chunk_size = 400
    chunks = []
    for i in range(0, len(words), chunk_size):
        chunk_words = words[i : i + chunk_size]
        chunk_text = " ".join(chunk_words)
        if not chunk_text.strip():
            continue
        chunks.append(chunk_text)
    if not chunks:
        return []
    embeddings = embedder.embed_texts(chunks)
    out = []
    for idx, (ctext, emb) in enumerate(zip(chunks, embeddings, strict=True)):
        out.append(
            {
                "text": ctext,
                "chunk_idx": idx,
                "section": "full_filing",
                "embedding": emb,
                "word_count": len(ctext.split()),
            }
        )
    return out

