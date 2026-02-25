"""Admin endpoints for platform health, analytics, and audit.

All endpoints are protected by the ADMIN_API_KEY env var, passed via the
``X-Admin-Key`` request header.  JWT authentication is *not* required.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Header, Query, Request

from rate_limit import limiter

router = APIRouter(prefix="/api/admin", tags=["admin"])

# ---------------------------------------------------------------------------
# Admin API-key dependency
# ---------------------------------------------------------------------------

async def verify_admin_key(x_admin_key: str = Header(...)):
    expected = os.getenv("ADMIN_API_KEY")
    if not expected or x_admin_key != expected:
        raise HTTPException(status_code=401, detail="Invalid admin key")


# ---------------------------------------------------------------------------
# 1. Deep health check
# ---------------------------------------------------------------------------

@router.get("/health/deep", dependencies=[Depends(verify_admin_key)])
@limiter.limit("10/minute")
async def deep_health(request: Request):
    """Check DB connectivity, RAG store status, and return combined health."""
    checks: dict = {}

    # --- SQLite DB ---
    try:
        from db.database import get_db

        with get_db() as conn:
            row = conn.execute("SELECT COUNT(*) FROM trades").fetchone()
            checks["db"] = {"status": "ok", "trades_count": row[0]}
    except Exception as exc:
        checks["db"] = {"status": "error", "detail": str(exc)}

    # --- RAG / ChromaDB ---
    try:
        from rag.store import get_store

        store = get_store()
        if store.is_available:
            stats = store.get_stats()
            checks["rag"] = {"status": "ok", **stats}
        else:
            checks["rag"] = {"status": "unavailable", "detail": "ChromaDB not installed"}
    except Exception as exc:
        checks["rag"] = {"status": "error", "detail": str(exc)}

    overall = "ok" if all(c.get("status") == "ok" for c in checks.values()) else "degraded"
    return {"status": overall, "checks": checks}


# ---------------------------------------------------------------------------
# 2. List users (placeholder -- data lives in Convex)
# ---------------------------------------------------------------------------

@router.get("/users", dependencies=[Depends(verify_admin_key)])
@limiter.limit("10/minute")
async def list_users(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
):
    """List all platform users (paginated).

    TODO: Integrate with Convex HTTP API via httpx to fetch real user data.
    """
    return {
        "status": "requires_convex_integration",
        "description": (
            "User data is stored in Convex.  This endpoint will query the "
            "Convex HTTP API (or a Convex action) to list users with pagination."
        ),
        "page": page,
        "page_size": page_size,
    }


# ---------------------------------------------------------------------------
# 3. Usage summary (placeholder)
# ---------------------------------------------------------------------------

@router.get("/usage/summary", dependencies=[Depends(verify_admin_key)])
@limiter.limit("10/minute")
async def usage_summary(request: Request):
    """Platform-wide token-usage aggregates.

    TODO: Query Convex ``tokenUsage`` table for aggregate stats.
    """
    return {
        "status": "requires_convex_integration",
        "description": (
            "Token usage records are stored in Convex.  This endpoint will "
            "aggregate total prompt tokens, completion tokens, and costs "
            "across all users."
        ),
    }


# ---------------------------------------------------------------------------
# 4. Top users by token consumption (placeholder)
# ---------------------------------------------------------------------------

@router.get("/usage/top", dependencies=[Depends(verify_admin_key)])
@limiter.limit("10/minute")
async def usage_top(request: Request, limit: int = Query(10, ge=1, le=100)):
    """Top users ranked by token consumption.

    TODO: Query Convex for per-user aggregated token usage.
    """
    return {
        "status": "requires_convex_integration",
        "description": (
            "Token usage is tracked per-user in Convex.  This endpoint will "
            "return the top N users by total token consumption."
        ),
        "limit": limit,
    }


# ---------------------------------------------------------------------------
# 5. Recent audit logs (from in-memory ring buffer)
# ---------------------------------------------------------------------------

@router.get("/audit/recent", dependencies=[Depends(verify_admin_key)])
@limiter.limit("10/minute")
async def audit_recent(request: Request, limit: int = Query(100, ge=1, le=1000)):
    """Return the most recent request log entries from the in-memory ring buffer."""
    from main import get_audit_buffer

    entries = get_audit_buffer()
    return {"count": len(entries[:limit]), "entries": entries[:limit]}


# ---------------------------------------------------------------------------
# 6. Strategy analytics -- reads local filesystem
# ---------------------------------------------------------------------------

STRATEGIES_DIR = Path(__file__).resolve().parent.parent / "data" / "strategies"


@router.get("/analytics/strategies", dependencies=[Depends(verify_admin_key)])
@limiter.limit("10/minute")
async def analytics_strategies(request: Request):
    """List all saved strategy files with basic metadata."""
    strategies = []
    if STRATEGIES_DIR.is_dir():
        for fp in sorted(STRATEGIES_DIR.glob("*.json"), reverse=True):
            try:
                data = json.loads(fp.read_text())
                strategies.append({
                    "filename": fp.name,
                    "strategy_name": data.get("strategy_name", fp.stem),
                    "symbol": data.get("symbol"),
                    "interval": data.get("interval"),
                    "created_at": data.get("created_at"),
                    "file_size_bytes": fp.stat().st_size,
                })
            except (json.JSONDecodeError, OSError):
                strategies.append({
                    "filename": fp.name,
                    "error": "Could not parse file",
                })

    return {"count": len(strategies), "strategies": strategies}


# ---------------------------------------------------------------------------
# 7. Backtest analytics (placeholder)
# ---------------------------------------------------------------------------

@router.get("/analytics/backtests", dependencies=[Depends(verify_admin_key)])
@limiter.limit("10/minute")
async def analytics_backtests(request: Request):
    """Backtest run analytics.

    TODO: Query Convex or local DB for backtest run summaries.
    """
    return {
        "status": "requires_convex_integration",
        "description": (
            "Backtest run metadata is stored in Convex and the local SQLite DB.  "
            "This endpoint will aggregate win rates, total runs, and strategy "
            "distribution across all users."
        ),
    }


# ---------------------------------------------------------------------------
# 8. Script analytics (placeholder)
# ---------------------------------------------------------------------------

@router.get("/analytics/scripts", dependencies=[Depends(verify_admin_key)])
@limiter.limit("10/minute")
async def analytics_scripts(request: Request):
    """Chart script / PineScript analytics.

    TODO: Query Convex for script usage data.
    """
    return {
        "status": "requires_convex_integration",
        "description": (
            "Chart scripts (PineScript overlays) are stored in Convex.  "
            "This endpoint will return script counts, most-used indicators, "
            "and authoring statistics."
        ),
    }


# ---------------------------------------------------------------------------
# 9. Conversation analytics (placeholder)
# ---------------------------------------------------------------------------

@router.get("/analytics/conversations", dependencies=[Depends(verify_admin_key)])
@limiter.limit("10/minute")
async def analytics_conversations(request: Request):
    """Agent conversation analytics.

    TODO: Query Convex for conversation metadata.
    """
    return {
        "status": "requires_convex_integration",
        "description": (
            "Conversation history is stored in Convex.  This endpoint will "
            "return total conversations, average message count, and tool-use "
            "frequency across all users."
        ),
    }


# ---------------------------------------------------------------------------
# 10. Token cost analytics (placeholder)
# ---------------------------------------------------------------------------

@router.get("/analytics/token-costs", dependencies=[Depends(verify_admin_key)])
@limiter.limit("10/minute")
async def analytics_token_costs(request: Request):
    """Token cost breakdown and projections.

    TODO: Query Convex tokenUsage table for cost analytics.
    """
    return {
        "status": "requires_convex_integration",
        "description": (
            "Token usage and cost data are stored in Convex.  This endpoint "
            "will compute daily/weekly/monthly cost breakdowns, per-model "
            "costs, and projected monthly spend."
        ),
    }
