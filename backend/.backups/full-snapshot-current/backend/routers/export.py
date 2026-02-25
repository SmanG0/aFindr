"""Export endpoints — CSV/JSON export for trades, backtests, and strategies."""

import csv
import io
import json
from typing import Optional

from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse

from db import trades_repo, backtest_repo
from engine.persistence import load_strategy

router = APIRouter(prefix="/api/export", tags=["export"])


@router.get("/trades/csv")
async def export_trades_csv(
    symbol: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    backtest_run_id: Optional[str] = Query(None),
    limit: int = Query(10000, ge=1, le=100000),
):
    """Export trades as CSV. Supports symbol/source/backtest_run_id filters."""
    if backtest_run_id:
        trade_list = backtest_repo.get_backtest_trades(backtest_run_id)
    else:
        trade_list = trades_repo.get_trades(symbol=symbol, source=source, limit=limit)

    if not trade_list:
        return StreamingResponse(
            io.BytesIO(b"No trades found"),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=trades.csv"},
        )

    output = io.StringIO()
    fieldnames = [
        "id", "symbol", "side", "size", "entry_price", "exit_price",
        "entry_time", "exit_time", "pnl", "pnl_points", "commission",
        "source", "strategy_name", "backtest_run_id",
    ]
    writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction="ignore")
    writer.writeheader()
    for t in trade_list:
        writer.writerow(t)

    content = output.getvalue().encode("utf-8")
    return StreamingResponse(
        io.BytesIO(content),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=trades.csv"},
    )


@router.get("/backtest/{run_id}/json")
async def export_backtest_json(run_id: str):
    """Export full backtest as JSON (metrics, trades, equity curve, Monte Carlo)."""
    run = backtest_repo.get_backtest_run(run_id)
    if not run:
        return {"error": "Backtest run not found"}

    trades = backtest_repo.get_backtest_trades(run_id)
    wf = backtest_repo.get_walk_forward_results(run_id)

    export_data = {
        "backtest_run": run,
        "trades": trades,
        "walk_forward": wf,
    }

    content = json.dumps(export_data, indent=2, default=str).encode("utf-8")
    return StreamingResponse(
        io.BytesIO(content),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename=backtest_{run_id}.json"},
    )


@router.get("/strategy/{filename}/json")
async def export_strategy_json(filename: str):
    """Export a saved strategy as JSON."""
    data = load_strategy(filename)
    if not data:
        return {"error": "Strategy not found"}

    content = json.dumps(data, indent=2, default=str).encode("utf-8")
    return StreamingResponse(
        io.BytesIO(content),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
