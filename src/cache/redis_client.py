"""
Redis caching layer using Upstash serverless Redis.
Caches:
- Financial data: 24 hours (prices don't change much)
- LLM reports: 6 hours (research reports)
- News sentiment: 2 hours (news changes faster)
- Ticker resolution: 7 days (company->ticker mapping)
"""
from __future__ import annotations

from dotenv import load_dotenv

load_dotenv()

import json
import os
from typing import Any, Optional

from upstash_redis import Redis


class CacheClient:
    """
    Serverless Redis cache using Upstash.
    Free tier: 10,000 commands/day, 256MB storage.
    Used by Robinhood, Vercel, and major fintech apps.
    """

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if getattr(self, "_initialized", False):
            return

        url = os.getenv("UPSTASH_REDIS_REST_URL")
        token = os.getenv("UPSTASH_REDIS_REST_TOKEN")

        if not url or not token:
            print("WARNING: Upstash Redis not configured.")
            print("Get free credentials at upstash.com")
            print("Cache disabled - all requests will hit APIs directly")
            self.client = None
            self._initialized = True
            return

        try:
            self.client = Redis(url=url, token=token)
            self.client.ping()
            print("Redis cache connected via Upstash")
            self._initialized = True
        except Exception as e:
            print(f"Redis connection failed: {e}")
            print("Cache disabled - running without cache")
            self.client = None
            self._initialized = True

    @property
    def is_available(self) -> bool:
        return self.client is not None

    def get(self, key: str) -> Optional[Any]:
        """Get cached value. Returns None if not found."""
        if not self.is_available:
            return None
        try:
            value = self.client.get(key)
            if value:
                return json.loads(value)
            return None
        except Exception as e:
            print(f"Cache get error: {e}")
            return None

    def set(
        self,
        key: str,
        value: Any,
        ttl_seconds: int = 3600,
    ) -> bool:
        """Set cached value with TTL."""
        if not self.is_available:
            return False
        try:
            serialized = json.dumps(value, default=str)
            self.client.set(key, serialized, ex=ttl_seconds)
            return True
        except Exception as e:
            print(f"Cache set error: {e}")
            return False

    def delete(self, key: str) -> bool:
        """Delete cached value."""
        if not self.is_available:
            return False
        try:
            self.client.delete(key)
            return True
        except Exception as e:
            print(f"Cache delete error: {e}")
            return False

    def exists(self, key: str) -> bool:
        """Check if key exists in cache."""
        if not self.is_available:
            return False
        try:
            return bool(self.client.exists(key))
        except Exception:
            return False


class CacheTTL:
    """Cache TTL constants (seconds)."""

    FINANCIALS = 24 * 3600  # 24 hours
    REPORT = 6 * 3600  # 6 hours
    SENTIMENT = 2 * 3600  # 2 hours
    TICKER_RESOLUTION = 7 * 24 * 3600  # 7 days
    NEWS = 2 * 3600  # 2 hours
    COMPARISON = 6 * 3600  # 6 hours


class CacheKeys:
    """Cache key builders."""

    @staticmethod
    def financials(ticker: str) -> str:
        return f"financials:{ticker.upper()}"

    @staticmethod
    def report(ticker: str) -> str:
        return f"report:{ticker.upper()}"

    @staticmethod
    def sentiment(ticker: str) -> str:
        return f"sentiment:{ticker.upper()}"

    @staticmethod
    def ticker_resolution(query: str) -> str:
        normalized = query.lower().strip()
        return f"ticker:{normalized}"

    @staticmethod
    def news(ticker: str) -> str:
        return f"news:{ticker.upper()}"

    @staticmethod
    def comparison(ticker1: str, ticker2: str) -> str:
        tickers = sorted([ticker1.upper(), ticker2.upper()])
        return f"compare:{tickers[0]}:{tickers[1]}"


cache = CacheClient()
