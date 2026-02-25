"""Trading API — positions, trades, analytics, sync."""
from __future__ import annotations

from typing import Dict, List, Optional

from fastapi import APIRouter, Query, Request
from pydantic import BaseModel

from db import trades_repo
from rate_limit import limiter

router = APIRouter(prefix="/api/trading", tags=["trading"])


# ── Request Models ──

class PositionIn(BaseModel):
    id: str
    symbol: str
    side: str
    size: float
    entry_price: float
    entry_time: int
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    commission: float = 0
    source: str = "manual"


class ClosePositionIn(BaseModel):
    exit_price: float
    exit_time: int
    pnl: float
    pnl_points: float
    commission: float = 0


class SyncState(BaseModel):
    balance: float
    equity: float
    unrealized_pnl: float = 0
    positions: List[Dict]
    trade_history: List[Dict]


class SnapshotIn(BaseModel):
    timestamp: Optional[int] = None
    balance: float
    equity: float
    unrealized_pnl: float = 0
    position_count: int = 0


# ── Endpoints ──

@router.post("/positions")
@limiter.limit("60/minute")
async def create_position(request: Request, pos: PositionIn):
    trades_repo.insert_position(pos.model_dump())
    return {"ok": True}


@router.delete("/positions/{position_id}")
@limiter.limit("60/minute")
async def close_position(request: Request, position_id: str, body: ClosePositionIn):
    pos = trades_repo.delete_position(position_id)
    if not pos:
        return {"error": "Position not found"}

    trade = {
        **pos,
        "exit_price": body.exit_price,
        "exit_time": body.exit_time,
        "pnl": body.pnl,
        "pnl_points": body.pnl_points,
        "commission": body.commission,
    }
    trades_repo.insert_trade(trade)
    return {"ok": True, "trade_id": pos["id"]}


@router.post("/sync")
@limiter.limit("60/minute")
async def sync_state(request: Request, state: SyncState):
    """Full state sync from frontend."""
    # Sync positions
    positions = []
    for p in state.positions:
        positions.append({
            "id": p.get("id"),
            "symbol": p.get("symbol"),
            "side": p.get("side"),
            "size": p.get("size"),
            "entry_price": p.get("entryPrice", p.get("entry_price")),
            "entry_time": p.get("entryTime", p.get("entry_time")),
            "stop_loss": p.get("stopLoss", p.get("stop_loss")),
            "take_profit": p.get("takeProfit", p.get("take_profit")),
            "commission": p.get("commission", 0),
            "source": "manual",
        })
    trades_repo.bulk_sync_positions(positions)

    # Sync closed trades
    trade_list = []
    for t in state.trade_history:
        trade_list.append({
            "id": t.get("id"),
            "symbol": t.get("symbol"),
            "side": t.get("side"),
            "size": t.get("size"),
            "entry_price": t.get("entryPrice", t.get("entry_price")),
            "exit_price": t.get("exitPrice", t.get("exit_price")),
            "entry_time": t.get("entryTime", t.get("entry_time")),
            "exit_time": t.get("exitTime", t.get("exit_time")),
            "stop_loss": t.get("stopLoss", t.get("stop_loss")),
            "take_profit": t.get("takeProfit", t.get("take_profit")),
            "pnl": t.get("pnl", 0),
            "pnl_points": t.get("pnlPoints", t.get("pnl_points", 0)),
            "commission": t.get("commission", 0),
        })
    trades_repo.bulk_sync_trades(trade_list)

    # Take a snapshot
    trades_repo.insert_account_snapshot({
        "balance": state.balance,
        "equity": state.equity,
        "unrealized_pnl": state.unrealized_pnl,
        "position_count": len(state.positions),
    })

    return {"ok": True, "synced_positions": len(positions), "synced_trades": len(trade_list)}


@router.get("/positions")
@limiter.limit("60/minute")
async def list_positions(request: Request):
    return {"positions": trades_repo.get_open_positions()}


@router.get("/trades")
@limiter.limit("60/minute")
async def list_trades(
    request: Request,
    symbol: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    since: Optional[int] = Query(None),
    until: Optional[int] = Query(None),
):
    return {
        "trades": trades_repo.get_trades(
            symbol=symbol, source=source, limit=limit,
            offset=offset, since=since, until=until,
        )
    }


@router.get("/analytics")
@limiter.limit("60/minute")
async def trade_analytics(
    request: Request,
    symbol: Optional[str] = Query(None),
    since: Optional[int] = Query(None),
):
    return trades_repo.get_trade_analytics(symbol=symbol, since=since)


@router.get("/analytics/equity-curve")
@limiter.limit("60/minute")
async def equity_curve(request: Request, limit: int = Query(500, ge=1, le=5000)):
    snapshots = trades_repo.get_account_snapshots(limit=limit)
    return {"snapshots": snapshots}


@router.post("/snapshot")
@limiter.limit("60/minute")
async def take_snapshot(request: Request, snap: SnapshotIn):
    trades_repo.insert_account_snapshot(snap.model_dump())
    return {"ok": True}
