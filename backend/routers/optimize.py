"""Optimization router — parameter sweep endpoints.

POST /api/optimize/sweep — Run a VectorBT vectorized parameter sweep
"""
from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, Request
from pydantic import BaseModel
from typing import Dict, List, Optional

from rate_limit import limiter

from data.fetcher import fetch_ohlcv
from data.contracts import get_contract_config, CONTRACTS
from engine.backtester import BacktestConfig
from engine.vbt_backtester import run_vbt_sweep, HAS_VBT
from agent.sandbox import validate_strategy_code, execute_strategy_code
from agent.strategy_agent import generate_vbt_strategy

router = APIRouter(prefix="/api/optimize", tags=["optimize"])


class SweepRequest(BaseModel):
    strategy_description: str
    param_grid: Dict[str, List]
    symbol: str = "NQ=F"
    period: str = "1y"
    interval: str = "1d"
    optimization_metric: str = "sharpe_ratio"
    initial_balance: float = 50000.0


@router.post("/sweep")
@limiter.limit("10/minute")
async def run_sweep(request: Request, req: SweepRequest):
    """Run a vectorized parameter sweep using VectorBT."""
    if not HAS_VBT:
        return {"error": "VectorBT is not installed. Cannot run parameter sweep."}

    # Generate strategy
    strategy_result = generate_vbt_strategy(req.strategy_description, [])
    if "error" in strategy_result:
        return {"error": strategy_result.get("raw_response", "Failed to generate strategy")}

    code = strategy_result.get("code", "")
    is_valid, msg = validate_strategy_code(code)
    if not is_valid:
        return {"error": f"Strategy validation failed: {msg}"}

    try:
        strategy_class = execute_strategy_code(code)
    except Exception as e:
        return {"error": f"Strategy compilation failed: {str(e)}"}

    try:
        df = await fetch_ohlcv(req.symbol, req.period, req.interval)
        contract = get_contract_config(req.symbol)
        config = BacktestConfig(
            initial_balance=req.initial_balance,
            point_value=contract["point_value"],
            tick_size=contract["tick_size"],
        )

        result = await asyncio.to_thread(
            run_vbt_sweep,
            strategy_class=strategy_class,
            data=df,
            config=config,
            param_grid=req.param_grid,
            optimization_metric=req.optimization_metric,
        )

        return {
            "total_combos": result.total_combos,
            "param_names": result.param_names,
            "best_params": result.best_params,
            "best_metrics": result.best_metrics,
            "heatmap_data": result.heatmap_data,
            "all_results": result.metrics[:100],  # Cap for response size
            "strategy": {
                "name": strategy_result.get("name"),
                "description": strategy_result.get("description"),
            },
        }
    except Exception as e:
        return {"error": f"Parameter sweep failed: {str(e)}"}
