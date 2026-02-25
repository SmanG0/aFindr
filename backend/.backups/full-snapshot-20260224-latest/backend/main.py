import json
import logging
import os
import time
import uuid
from collections import deque
from threading import Lock

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from dotenv import load_dotenv
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

load_dotenv(override=True)

# ---------------------------------------------------------------------------
# Structured request logger
# ---------------------------------------------------------------------------
logger = logging.getLogger("afindr.requests")
logger.setLevel(logging.INFO)

# In-memory ring buffer for the /api/admin/audit/recent endpoint
_AUDIT_BUFFER_SIZE = 1000
_audit_buffer: deque = deque(maxlen=_AUDIT_BUFFER_SIZE)
_audit_lock = Lock()


def get_audit_buffer() -> list:
    """Return a snapshot of the in-memory audit ring buffer (newest first)."""
    with _audit_lock:
        return list(reversed(_audit_buffer))


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Log every request with correlation ID, method, path, status, duration,
    and authenticated user_id.  Also maintains an in-memory ring buffer that
    the admin audit endpoint can read."""

    async def dispatch(self, request: Request, call_next):
        # Correlation / request ID -----------------------------------------
        request_id = request.headers.get("x-request-id") or str(uuid.uuid4())

        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = round((time.perf_counter() - start) * 1000, 2)

        # Authenticated user (set by JWTAuthMiddleware downstream) ----------
        user_id = getattr(request.state, "user_id", None)

        # Build structured log record --------------------------------------
        record = {
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "status_code": response.status_code,
            "duration_ms": duration_ms,
            "user_id": user_id,
            "timestamp": time.time(),
        }

        logger.info(json.dumps(record))

        # Append to ring buffer for admin audit endpoint --------------------
        with _audit_lock:
            _audit_buffer.append(record)

        # Propagate correlation ID to the client ----------------------------
        response.headers["X-Request-Id"] = request_id
        return response


from auth.jwt_validator import ConvexJWTValidator

app = FastAPI(title="aFindr Trading API", version="0.1.0")

# ---------------------------------------------------------------------------
# Rate limiting (slowapi)
# ---------------------------------------------------------------------------
from rate_limit import limiter  # noqa: E402

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ---------------------------------------------------------------------------
# CORS – honour CORS_ORIGINS env var (comma-separated), default to localhost
# ---------------------------------------------------------------------------
origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# JWT authentication middleware
# ---------------------------------------------------------------------------
_jwt_validator = ConvexJWTValidator()

# Paths that do not require authentication
_PUBLIC_PATHS = {"/health", "/docs", "/openapi.json"}

# Path prefixes that bypass JWT auth (admin uses its own API-key auth)
# /api/chat and /api/data are public in dev; auth enforced at Next.js middleware layer
_PUBLIC_PREFIXES = ("/api/admin", "/api/chat", "/api/data", "/api/ticks", "/api/strategies", "/api/trading")


class JWTAuthMiddleware(BaseHTTPMiddleware):
    """Extract and validate Bearer tokens on every request (except public paths)."""

    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        # Skip auth for public endpoints, admin routes, and OPTIONS (CORS preflight)
        if (
            path in _PUBLIC_PATHS
            or path.startswith(_PUBLIC_PREFIXES)
            or request.method == "OPTIONS"
        ):
            return await call_next(request)

        auth_header = request.headers.get("authorization", "")
        if not auth_header.startswith("Bearer "):
            return JSONResponse(
                status_code=401,
                content={"detail": "Missing or invalid Authorization header"},
            )

        token = auth_header[len("Bearer "):]
        try:
            user_id = await _jwt_validator.validate_token(token)
        except Exception as exc:
            return JSONResponse(
                status_code=401,
                content={"detail": f"Invalid token: {exc}"},
            )

        # Attach the authenticated user ID to the request state
        request.state.user_id = user_id
        return await call_next(request)


app.add_middleware(JWTAuthMiddleware)
app.add_middleware(RequestLoggingMiddleware)

# ---------------------------------------------------------------------------
# Initialize SQLite database on startup
# ---------------------------------------------------------------------------
from db.database import init_db

init_db()

# ---------------------------------------------------------------------------
# Initialize RAG store (ChromaDB) -- ingest docs if empty
# ---------------------------------------------------------------------------
try:
    from rag.store import get_store

    _rag = get_store()
    if _rag.is_available:
        stats = _rag.get_stats()
        if stats.get("vectorbt_docs", 0) == 0:
            from rag.ingest import ingest_docs

            ingest_docs()
except Exception:
    pass  # RAG is optional -- gracefully degrade

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
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

from routers.admin import router as admin_router

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
app.include_router(admin_router)


@app.get("/health")
async def health():
    return {"status": "ok"}
