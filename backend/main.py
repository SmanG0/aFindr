from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv(override=True)

app = FastAPI(title="aFindr Trading API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize SQLite database on startup
from db.database import init_db
init_db()

# Initialize RAG store (ChromaDB) — ingest docs if empty
try:
    from rag.store import get_store
    _rag = get_store()
    if _rag.is_available:
        stats = _rag.get_stats()
        if stats.get("vectorbt_docs", 0) == 0:
            from rag.ingest import ingest_docs
            ingest_docs()
except Exception:
    pass  # RAG is optional — gracefully degrade

from routers.data import router as data_router
from routers.chat import router as chat_router
from routers.news import router as news_router
from routers.strategies import router as strategies_router
from routers.trading import router as trading_router
from routers.export import router as export_router
from routers.ws import router as ws_router
from routers.iterations import router as iterations_router
from routers.optimize import router as optimize_router
# NOTE: SSE streaming chat endpoint added as part of Agent SDK migration.
#       Original blocking chat_router (POST /api/chat) is preserved unchanged.
#       Backup: backend/.backups/pre-agent-sdk/
from routers.chat_stream import router as chat_stream_router

app.include_router(data_router)
app.include_router(chat_router)
app.include_router(chat_stream_router)  # SSE streaming: POST /api/chat/stream
app.include_router(news_router)
app.include_router(strategies_router)
app.include_router(trading_router)
app.include_router(export_router)
app.include_router(ws_router)
app.include_router(iterations_router)
app.include_router(optimize_router)


@app.get("/health")
async def health():
    return {"status": "ok"}
