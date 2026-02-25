"""ChromaDB vector store for RAG-grounded code generation.

Maintains two persistent collections:
- vectorbt_docs: VectorBT API reference and examples
- strategy_patterns: Common quantitative trading strategy patterns

Uses all-MiniLM-L6-v2 for fast, accurate code retrieval embeddings.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import List, Optional

try:
    import chromadb
    from chromadb.config import Settings
    HAS_CHROMADB = True
except ImportError:
    HAS_CHROMADB = False

RAG_DIR = Path(__file__).parent
PERSIST_DIR = RAG_DIR / "chromadb_data"
EMBEDDING_MODEL = "all-MiniLM-L6-v2"


class RAGStore:
    """ChromaDB-backed vector store for strategy generation context."""

    def __init__(self):
        if not HAS_CHROMADB:
            self.client = None
            self.vbt_collection = None
            self.patterns_collection = None
            return

        self.client = chromadb.PersistentClient(
            path=str(PERSIST_DIR),
        )

        # Create or get collections
        self.vbt_collection = self.client.get_or_create_collection(
            name="vectorbt_docs",
            metadata={"description": "VectorBT API reference and examples"},
        )
        self.patterns_collection = self.client.get_or_create_collection(
            name="strategy_patterns",
            metadata={"description": "Quantitative trading strategy patterns"},
        )

    @property
    def is_available(self) -> bool:
        return self.client is not None

    def query_vbt_docs(self, query: str, n_results: int = 5) -> List[str]:
        """Query VectorBT documentation for relevant context."""
        if not self.is_available or self.vbt_collection.count() == 0:
            return []

        results = self.vbt_collection.query(
            query_texts=[query],
            n_results=min(n_results, self.vbt_collection.count()),
        )
        return results["documents"][0] if results["documents"] else []

    def query_patterns(self, query: str, n_results: int = 5) -> List[str]:
        """Query strategy patterns for relevant context."""
        if not self.is_available or self.patterns_collection.count() == 0:
            return []

        results = self.patterns_collection.query(
            query_texts=[query],
            n_results=min(n_results, self.patterns_collection.count()),
        )
        return results["documents"][0] if results["documents"] else []

    def query_all(self, query: str, n_results: int = 5) -> str:
        """Query both collections and return combined context string."""
        vbt_docs = self.query_vbt_docs(query, n_results)
        patterns = self.query_patterns(query, n_results)

        context_parts = []
        if vbt_docs:
            context_parts.append("--- VectorBT API Reference ---")
            context_parts.extend(vbt_docs)
        if patterns:
            context_parts.append("--- Strategy Patterns ---")
            context_parts.extend(patterns)

        return "\n\n".join(context_parts)

    def add_documents(
        self,
        collection_name: str,
        documents: List[str],
        ids: List[str],
        metadatas: Optional[List[dict]] = None,
    ):
        """Add documents to a collection."""
        if not self.is_available:
            return

        collection = (
            self.vbt_collection
            if collection_name == "vectorbt_docs"
            else self.patterns_collection
        )
        collection.upsert(
            documents=documents,
            ids=ids,
            metadatas=metadatas,
        )

    def get_stats(self) -> dict:
        """Get collection statistics."""
        if not self.is_available:
            return {"available": False}

        return {
            "available": True,
            "vectorbt_docs": self.vbt_collection.count(),
            "strategy_patterns": self.patterns_collection.count(),
        }


# Singleton instance
_store: Optional[RAGStore] = None


def get_store() -> RAGStore:
    """Get or create the singleton RAG store."""
    global _store
    if _store is None:
        _store = RAGStore()
    return _store
