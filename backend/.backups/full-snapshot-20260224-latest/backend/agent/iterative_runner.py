"""Iterative agent loop orchestrator.

Manages the Research -> Write -> Backtest -> Interpret -> Approve -> Iterate cycle.
Each session tracks strategy versions, results, and approval status.
"""
from __future__ import annotations

import asyncio
import json
import time
import uuid
from dataclasses import dataclass, field, asdict
from typing import Optional, List, Dict, Any

from engine.backtester import Backtester, BacktestConfig
from engine.monte_carlo import run_monte_carlo
from engine.vbt_backtester import run_vbt_backtest, HAS_VBT
from engine.vbt_strategy import VectorBTStrategy
from agent.sandbox import validate_strategy_code, execute_strategy_code
from agent.strategy_agent import generate_strategy, generate_vbt_strategy
from data.fetcher import fetch_ohlcv
from data.contracts import get_contract_config


@dataclass
class IterationResult:
    """Result of a single iteration."""
    iteration: int
    strategy_name: str
    strategy_description: str
    code: str
    parameters: Dict[str, Any]
    metrics: Dict
    monte_carlo: Optional[Dict] = None
    feedback: Optional[str] = None
    status: str = "pending"  # pending, approved, rejected
    timestamp: float = field(default_factory=time.time)


@dataclass
class IterationState:
    """State for an iterative agent session."""
    session_id: str
    user_prompt: str
    symbol: str = "NQ=F"
    period: str = "1y"
    interval: str = "1d"
    initial_balance: float = 50000.0
    max_iterations: int = 5
    target_metric: str = "sharpe_ratio"
    target_value: float = 1.5
    # State
    current_iteration: int = 0
    iterations: List[IterationResult] = field(default_factory=list)
    status: str = "running"  # running, awaiting_approval, completed, failed
    created_at: float = field(default_factory=time.time)


# Active sessions
_sessions: Dict[str, IterationState] = {}


def create_session(
    user_prompt: str,
    symbol: str = "NQ=F",
    period: str = "1y",
    interval: str = "1d",
    initial_balance: float = 50000.0,
    max_iterations: int = 5,
    target_metric: str = "sharpe_ratio",
    target_value: float = 1.5,
) -> IterationState:
    """Create a new iterative session."""
    session_id = f"iter_{uuid.uuid4().hex[:12]}"
    state = IterationState(
        session_id=session_id,
        user_prompt=user_prompt,
        symbol=symbol,
        period=period,
        interval=interval,
        initial_balance=initial_balance,
        max_iterations=max_iterations,
        target_metric=target_metric,
        target_value=target_value,
    )
    _sessions[session_id] = state
    return state


def get_session(session_id: str) -> Optional[IterationState]:
    """Get an existing session."""
    return _sessions.get(session_id)


async def run_iteration(state: IterationState, feedback: str = "") -> IterationResult:
    """Run a single iteration of the agent loop.

    1. Build context from previous iterations + feedback
    2. Generate strategy code (VBT preferred, classic fallback)
    3. Backtest
    4. Run Monte Carlo
    5. Return result for approval
    """
    state.current_iteration += 1
    state.status = "running"

    # Build iteration context
    context_parts = [f"Original request: {state.user_prompt}"]
    context_parts.append(f"Target: {state.target_metric} >= {state.target_value}")
    context_parts.append(f"Iteration {state.current_iteration} of {state.max_iterations}")

    if state.iterations:
        prev = state.iterations[-1]
        context_parts.append(f"\nPrevious iteration ({prev.strategy_name}):")
        context_parts.append(f"  Sharpe: {prev.metrics.get('sharpe_ratio', 'N/A')}")
        context_parts.append(f"  Profit Factor: {prev.metrics.get('profit_factor', 'N/A')}")
        context_parts.append(f"  Max Drawdown: {prev.metrics.get('max_drawdown_pct', 'N/A')}%")
        context_parts.append(f"  Win Rate: {prev.metrics.get('win_rate', 'N/A')}")

        if prev.monte_carlo:
            context_parts.append(f"  Robustness Grade: {prev.monte_carlo.get('robustness_grade', 'N/A')}")
            context_parts.append(f"  P(Ruin): {prev.monte_carlo.get('probability_of_ruin', 'N/A')}%")

        if feedback:
            context_parts.append(f"\nUser feedback: {feedback}")
        elif prev.status == "rejected":
            context_parts.append("\nThe previous iteration was rejected. Improve the strategy.")

        context_parts.append("\nImprove upon the previous strategy. Focus on the weakest metrics.")

    prompt = "\n".join(context_parts)

    # Generate strategy
    try:
        if HAS_VBT:
            strategy_result = generate_vbt_strategy(prompt, [])
        else:
            strategy_result = generate_strategy(prompt, [])
    except Exception as e:
        return _error_iteration(state, f"Strategy generation failed: {e}")

    if "error" in strategy_result:
        return _error_iteration(state, strategy_result.get("raw_response", "Generation failed"))

    code = strategy_result.get("code", "")
    is_valid, msg = validate_strategy_code(code)
    if not is_valid:
        return _error_iteration(state, f"Validation failed: {msg}")

    try:
        strategy_class = execute_strategy_code(code)
        strategy_instance = strategy_class(strategy_result.get("parameters", {}))
    except Exception as e:
        return _error_iteration(state, f"Compilation failed: {e}")

    # Backtest
    try:
        df = await fetch_ohlcv(state.symbol, state.period, state.interval)
        contract = get_contract_config(state.symbol)
        config = BacktestConfig(
            initial_balance=state.initial_balance,
            point_value=contract["point_value"],
            tick_size=contract["tick_size"],
        )

        if isinstance(strategy_instance, VectorBTStrategy) and HAS_VBT:
            result = await asyncio.to_thread(run_vbt_backtest, strategy_instance, df, config)
        else:
            bt = Backtester(strategy_instance, df, config)
            result = await asyncio.to_thread(bt.run)
    except Exception as e:
        return _error_iteration(state, f"Backtest failed: {e}")

    # Monte Carlo (full suite)
    mc_data = None
    trade_pnls = [t["pnl"] for t in result.trades]
    if trade_pnls:
        try:
            mc = await asyncio.to_thread(
                run_monte_carlo, trade_pnls, state.initial_balance,
                method="full",
            )
            mc_data = mc.to_dict()
        except Exception:
            pass

    iteration_result = IterationResult(
        iteration=state.current_iteration,
        strategy_name=strategy_result.get("name", "Unnamed"),
        strategy_description=strategy_result.get("description", ""),
        code=code,
        parameters=strategy_result.get("parameters", {}),
        metrics=result.metrics,
        monte_carlo=mc_data,
        status="pending",
    )

    state.iterations.append(iteration_result)
    state.status = "awaiting_approval"

    return iteration_result


def approve_iteration(session_id: str) -> Optional[IterationResult]:
    """Approve the latest iteration. Marks session as completed."""
    state = _sessions.get(session_id)
    if not state or not state.iterations:
        return None

    latest = state.iterations[-1]
    latest.status = "approved"
    state.status = "completed"
    return latest


def reject_iteration(session_id: str, feedback: str = "") -> Optional[IterationResult]:
    """Reject the latest iteration with optional feedback."""
    state = _sessions.get(session_id)
    if not state or not state.iterations:
        return None

    latest = state.iterations[-1]
    latest.status = "rejected"
    latest.feedback = feedback

    if state.current_iteration >= state.max_iterations:
        state.status = "completed"
    else:
        state.status = "running"

    return latest


def _error_iteration(state: IterationState, error: str) -> IterationResult:
    """Create an error iteration result."""
    result = IterationResult(
        iteration=state.current_iteration,
        strategy_name="Error",
        strategy_description=error,
        code="",
        parameters={},
        metrics={},
        status="rejected",
    )
    state.iterations.append(result)
    return result


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


def session_to_dict(state: IterationState) -> dict:
    """Serialize session state for API response."""
    return _sanitize_floats({
        "session_id": state.session_id,
        "user_prompt": state.user_prompt,
        "symbol": state.symbol,
        "interval": state.interval,
        "current_iteration": state.current_iteration,
        "max_iterations": state.max_iterations,
        "status": state.status,
        "target_metric": state.target_metric,
        "target_value": state.target_value,
        "iterations": [asdict(it) for it in state.iterations],
        "created_at": state.created_at,
    })
