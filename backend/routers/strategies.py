"""Strategies API — list and load saved strategies, presets, and backtest runs."""
from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, Query, Request

from rate_limit import limiter
from engine.persistence import list_strategies, load_strategy
from engine.preset_strategies import PRESET_STRATEGIES
from engine.backtester import Backtester, BacktestConfig
from engine.monte_carlo import run_monte_carlo
from engine.vbt_backtester import run_vbt_backtest, run_signals_backtest, HAS_VBT
from agent.sandbox import validate_strategy_code, execute_strategy_code
from data.fetcher import fetch_ohlcv
from data.contracts import get_contract_config
from db import backtest_repo

router = APIRouter(prefix="/api/strategies", tags=["strategies"])


def _sanitize_floats(obj):
    """Replace NaN/Inf with JSON-safe values recursively."""
    if isinstance(obj, float):
        if obj != obj:  # NaN
            return None
        if obj == float("inf"):
            return 9999.99
        if obj == float("-inf"):
            return -9999.99
    elif isinstance(obj, dict):
        return {k: _sanitize_floats(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_sanitize_floats(v) for v in obj]
    return obj


@router.get("")
@limiter.limit("60/minute")
async def list_all(request: Request):
    """List all saved strategies (newest first)."""
    return {"strategies": list_strategies()}


@router.get("/presets")
@limiter.limit("60/minute")
async def list_presets(request: Request):
    """List all 10 preset strategies with metadata."""
    presets = []
    for p in PRESET_STRATEGIES:
        presets.append({
            "id": p["id"],
            "name": p["name"],
            "description": p["description"],
            "category": p["category"],
            "default_params": p["default_params"],
            "symbol": p["symbol"],
            "interval": p["interval"],
        })
    return {"presets": presets, "count": len(presets)}


@router.get("/presets/{preset_id}")
@limiter.limit("60/minute")
async def get_preset(request: Request, preset_id: int):
    """Get single preset strategy detail."""
    for p in PRESET_STRATEGIES:
        if p["id"] == preset_id:
            return {
                "id": p["id"],
                "name": p["name"],
                "description": p["description"],
                "category": p["category"],
                "default_params": p["default_params"],
                "walk_forward_grid": p["walk_forward_grid"],
                "symbol": p["symbol"],
                "interval": p["interval"],
            }
    return {"error": f"Preset {preset_id} not found"}


@router.post("/presets/{preset_id}/run")
@limiter.limit("30/minute")
async def run_preset(request: Request, preset_id: int):
    """Run a preset backtest: instantiate class, backtest, Monte Carlo, persist, return result."""
    preset = None
    for p in PRESET_STRATEGIES:
        if p["id"] == preset_id:
            preset = p
            break
    if not preset:
        return {"error": f"Preset {preset_id} not found"}

    symbol = preset["symbol"]
    interval = preset["interval"]
    initial_balance = 25000

    try:
        strategy_instance = preset["class"](preset["default_params"])
        df = await fetch_ohlcv(symbol, "1y", interval)
        contract = get_contract_config(symbol)
        config = BacktestConfig(
            initial_balance=initial_balance,
            point_value=contract["point_value"],
            tick_size=contract["tick_size"],
        )
        bt = Backtester(strategy_instance, df, config)
        result = await asyncio.to_thread(bt.run)
    except Exception as e:
        return {"error": f"Backtest failed: {str(e)}"}

    # Monte Carlo
    monte_carlo_data = None
    trade_pnls = [t["pnl"] for t in result.trades]
    if trade_pnls:
        try:
            mc = await asyncio.to_thread(run_monte_carlo, trade_pnls, initial_balance)
            monte_carlo_data = mc.to_dict()
        except Exception:
            pass

    # Persist
    backtest_run_id = None
    try:
        backtest_run_id = backtest_repo.insert_backtest_run(
            strategy_name=preset["name"],
            symbol=symbol,
            interval=interval,
            trades=result.trades,
            metrics=result.metrics,
            equity_curve=result.equity_curve,
            monte_carlo=monte_carlo_data,
            params=preset["default_params"],
            initial_balance=initial_balance,
            run_type="preset",
        )
    except Exception:
        pass

    return _sanitize_floats({
        "preset_id": preset_id,
        "preset_name": preset["name"],
        "metrics": result.metrics,
        "trade_count": len(result.trades),
        "trades": result.trades,
        "equity_curve": result.equity_curve,
        "monte_carlo": monte_carlo_data,
        "backtest_run_id": backtest_run_id,
    })


@router.get("/backtest-runs")
@limiter.limit("60/minute")
async def list_backtest_runs(request: Request, limit: int = Query(50, ge=1, le=200)):
    """List all backtest runs (newest first)."""
    return _sanitize_floats({"runs": backtest_repo.list_backtest_runs(limit=limit)})


@router.get("/backtest-runs/{run_id}")
@limiter.limit("60/minute")
async def get_backtest_run(request: Request, run_id: str):
    """Get full details of a backtest run."""
    result = backtest_repo.get_backtest_run(run_id)
    if not result:
        return {"error": "Backtest run not found"}
    return _sanitize_floats(result)


@router.get("/backtest-runs/{run_id}/trades")
@limiter.limit("60/minute")
async def get_backtest_trades(request: Request, run_id: str):
    """Get all trades from a specific backtest run."""
    return {"trades": backtest_repo.get_backtest_trades(run_id)}


@router.post("/{filename}/rerun")
@limiter.limit("30/minute")
async def rerun_strategy(request: Request, filename: str):
    """Re-run a saved strategy's backtest to produce trades and equity curve.

    Loads the saved code + params, fetches OHLCV data for the strategy's
    symbol/interval, runs the backtest, and returns the full result including
    individual trades with timestamps (for chart markers).
    """
    from fastapi.responses import JSONResponse

    strategy_data = load_strategy(filename)
    if not strategy_data:
        return JSONResponse({"error": "Strategy not found"}, status_code=404)

    code = strategy_data.get("code", "")
    params = strategy_data.get("parameters", {})
    symbol = strategy_data.get("symbol", "NQ=F")
    interval = strategy_data.get("interval", "1d")

    if not code:
        return JSONResponse({"error": "Strategy has no code to execute"}, status_code=400)

    # Validate and execute strategy code in sandbox
    valid, msg = validate_strategy_code(code)
    if not valid:
        return JSONResponse({"error": f"Strategy code validation failed: {msg}"}, status_code=400)

    try:
        strategy_class = execute_strategy_code(code)
    except Exception as e:
        return JSONResponse({"error": f"Failed to load strategy code: {e}"}, status_code=500)

    # Fetch OHLCV data and run backtest
    try:
        df = await fetch_ohlcv(symbol, "1y", interval)
        contract = get_contract_config(symbol)
        config = BacktestConfig(
            initial_balance=25000,
            point_value=contract["point_value"],
            tick_size=contract["tick_size"],
        )

        from engine.vbt_strategy import VectorBTStrategy
        strategy_instance = strategy_class(params)
        is_vbt = isinstance(strategy_instance, VectorBTStrategy)

        if is_vbt and HAS_VBT:
            result = await asyncio.to_thread(run_vbt_backtest, strategy_instance, df, config)
        elif is_vbt:
            # Fallback: run signals-based backtest without VBT
            result = await asyncio.to_thread(run_signals_backtest, strategy_instance, df, config)
        else:
            bt = Backtester(strategy_instance, df, config)
            result = await asyncio.to_thread(bt.run)
    except Exception as e:
        return JSONResponse({"error": f"Backtest failed: {e}"}, status_code=500)

    return _sanitize_floats({
        "name": strategy_data.get("name", ""),
        "description": strategy_data.get("description", ""),
        "symbol": symbol,
        "interval": interval,
        "metrics": result.metrics,
        "trades": result.trades,
        "equity_curve": result.equity_curve,
        "trade_count": len(result.trades),
    })


@router.get("/{filename}")
@limiter.limit("60/minute")
async def get_strategy(request: Request, filename: str):
    """Load a specific saved strategy by filename."""
    from fastapi.responses import JSONResponse
    result = load_strategy(filename)
    if not result:
        return JSONResponse({"error": "Strategy not found"}, status_code=404)
    return result
