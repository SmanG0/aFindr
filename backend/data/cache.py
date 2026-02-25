"""Simple in-memory TTL cache for market data fetchers.

Eliminates redundant external API calls within a conversation by caching
results with per-key TTL expiration. No external dependencies (no Redis).
"""
from __future__ import annotations

import time
from typing import Any, Optional


class TTLCache:
    """In-memory cache with per-key TTL expiration."""

    def __init__(self, default_ttl: float = 60.0, max_size: int = 500):
        self._store: dict[str, tuple[float, Any]] = {}
        self._default_ttl = default_ttl
        self._max_size = max_size

    def get(self, key: str) -> Optional[Any]:
        entry = self._store.get(key)
        if entry is None:
            return None
        expires_at, value = entry
        if time.time() > expires_at:
            del self._store[key]
            return None
        return value

    def set(self, key: str, value: Any, ttl: Optional[float] = None) -> None:
        if len(self._store) >= self._max_size:
            self._evict_expired()
            if len(self._store) >= self._max_size:
                # Evict oldest entry by insertion order
                oldest_key = next(iter(self._store))
                del self._store[oldest_key]
        self._store[key] = (time.time() + (ttl or self._default_ttl), value)

    def _evict_expired(self) -> None:
        now = time.time()
        self._store = {k: v for k, v in self._store.items() if v[0] > now}
