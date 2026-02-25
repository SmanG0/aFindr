from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from data.fetcher import fetch_ohlcv, fetch_ticks
from data.contracts import CONTRACTS, get_contract_config

from rate_limit import limiter

router = APIRouter(prefix="/api/data", tags=["data"])


class DataRequest(BaseModel):
    symbol: str
    period: str = "1y"
    interval: str = "1d"


class TickRequest(BaseModel):
    symbol: str
    date: Optional[str] = None
    limit: int = 50000


@router.get("/contracts")
@limiter.limit("60/minute")
async def list_contracts(request: Request):
    return CONTRACTS


@router.post("/ohlcv")
@limiter.limit("60/minute")
async def get_ohlcv(request: Request, req: DataRequest):
    try:
        get_contract_config(req.symbol)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    try:
        df = await fetch_ohlcv(req.symbol, req.period, req.interval)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    candles = []
    for ts, row in df.iterrows():
        candles.append({
            "time": int(ts.timestamp()),
            "open": round(row["open"], 2),
            "high": round(row["high"], 2),
            "low": round(row["low"], 2),
            "close": round(row["close"], 2),
            "volume": int(row["volume"]),
        })
    return {"symbol": req.symbol, "candles": candles, "count": len(candles)}


@router.post("/ticks")
@limiter.limit("60/minute")
async def get_ticks(request: Request, req: TickRequest):
    try:
        get_contract_config(req.symbol)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    try:
        ticks = await fetch_ticks(req.symbol, req.date, req.limit)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return {"symbol": req.symbol, "ticks": ticks, "count": len(ticks)}
