"""Document ingestion pipeline for RAG store.

Reads markdown docs from rag/docs/, chunks them, and upserts into ChromaDB.
Uses 500-token chunks with 50-token overlap for good retrieval granularity.
"""
from __future__ import annotations

import re
from pathlib import Path
from typing import List, Tuple

from rag.store import get_store

DOCS_DIR = Path(__file__).parent / "docs"
CHUNK_SIZE = 500  # tokens (approx 4 chars per token)
CHUNK_OVERLAP = 50


def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> List[str]:
    """Split text into overlapping chunks by approximate token count.

    Uses section headers (##, ###) as natural break points when possible.
    """
    # Split on section headers first
    sections = re.split(r'\n(?=##\s)', text)

    chunks = []
    for section in sections:
        # Approximate token count (4 chars per token)
        approx_tokens = len(section) // 4

        if approx_tokens <= chunk_size:
            if section.strip():
                chunks.append(section.strip())
        else:
            # Split into paragraphs
            paragraphs = section.split('\n\n')
            current_chunk = ""
            current_tokens = 0

            for para in paragraphs:
                para_tokens = len(para) // 4
                if current_tokens + para_tokens > chunk_size and current_chunk:
                    chunks.append(current_chunk.strip())
                    # Keep overlap from end of previous chunk
                    overlap_chars = overlap * 4
                    if len(current_chunk) > overlap_chars:
                        current_chunk = current_chunk[-overlap_chars:]
                        current_tokens = overlap
                    else:
                        current_chunk = ""
                        current_tokens = 0
                current_chunk += "\n\n" + para
                current_tokens += para_tokens

            if current_chunk.strip():
                chunks.append(current_chunk.strip())

    return [c for c in chunks if len(c) > 20]


def ingest_docs():
    """Ingest all docs from rag/docs/ into ChromaDB collections."""
    store = get_store()
    if not store.is_available:
        print("RAG store not available (ChromaDB not installed)")
        return

    # Map files to collections
    file_collection_map = {
        "vectorbt_api.md": "vectorbt_docs",
        "vectorbt_examples.md": "vectorbt_docs",
        "strategy_patterns.md": "strategy_patterns",
    }

    for filename, collection_name in file_collection_map.items():
        filepath = DOCS_DIR / filename
        if not filepath.exists():
            print(f"Skipping {filename} — file not found")
            continue

        text = filepath.read_text()
        chunks = chunk_text(text)

        if not chunks:
            continue

        ids = [f"{filename}_{i}" for i in range(len(chunks))]
        metadatas = [{"source": filename, "chunk_index": i} for i in range(len(chunks))]

        store.add_documents(
            collection_name=collection_name,
            documents=chunks,
            ids=ids,
            metadatas=metadatas,
        )
        print(f"Ingested {len(chunks)} chunks from {filename} -> {collection_name}")

    stats = store.get_stats()
    print(f"RAG store stats: {stats}")


if __name__ == "__main__":
    ingest_docs()
