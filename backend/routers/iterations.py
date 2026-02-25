"""Iterations router — REST endpoints for the iterative agent loop.

POST /api/iterations/start — Start a new iterative session
POST /api/iterations/{session_id}/approve — Approve current iteration
POST /api/iterations/{session_id}/reject — Reject with feedback
GET /api/iterations/{session_id} — Get session state
POST /api/iterations/{session_id}/next — Run next iteration
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional

from rate_limit import limiter

from agent.iterative_runner import (
    create_session,
    get_session,
    run_iteration,
    approve_iteration,
    reject_iteration,
    session_to_dict,
)

router = APIRouter(prefix="/api/iterations", tags=["iterations"])


class StartRequest(BaseModel):
    prompt: str
    symbol: str = "NQ=F"
    period: str = "1y"
    interval: str = "1d"
    initial_balance: float = 50000.0
    max_iterations: int = 5
    target_metric: str = "sharpe_ratio"
    target_value: float = 1.5


class RejectRequest(BaseModel):
    feedback: str = ""


@router.post("/start")
@limiter.limit("30/minute")
async def start_session(request: Request, req: StartRequest):
    """Start a new iterative agent session and run the first iteration."""
    state = create_session(
        user_prompt=req.prompt,
        symbol=req.symbol,
        period=req.period,
        interval=req.interval,
        initial_balance=req.initial_balance,
        max_iterations=req.max_iterations,
        target_metric=req.target_metric,
        target_value=req.target_value,
    )

    # Run the first iteration
    await run_iteration(state)

    return session_to_dict(state)


@router.get("/{session_id}")
@limiter.limit("60/minute")
async def get_session_state(request: Request, session_id: str):
    """Get the current state of an iterative session."""
    state = get_session(session_id)
    if not state:
        raise HTTPException(status_code=404, detail="Session not found")
    return session_to_dict(state)


@router.post("/{session_id}/approve")
@limiter.limit("60/minute")
async def approve(request: Request, session_id: str):
    """Approve the current iteration."""
    result = approve_iteration(session_id)
    if not result:
        raise HTTPException(status_code=404, detail="Session not found or no iteration to approve")

    state = get_session(session_id)
    return session_to_dict(state)


@router.post("/{session_id}/reject")
@limiter.limit("60/minute")
async def reject(request: Request, session_id: str, req: RejectRequest):
    """Reject the current iteration with feedback and auto-run next if available."""
    result = reject_iteration(session_id, req.feedback)
    if not result:
        raise HTTPException(status_code=404, detail="Session not found or no iteration to reject")

    state = get_session(session_id)
    if not state:
        raise HTTPException(status_code=404, detail="Session not found")

    # Auto-run next iteration if not at max
    if state.status == "running":
        await run_iteration(state, feedback=req.feedback)

    return session_to_dict(state)


@router.post("/{session_id}/next")
@limiter.limit("30/minute")
async def next_iteration(request: Request, session_id: str):
    """Manually trigger the next iteration."""
    state = get_session(session_id)
    if not state:
        raise HTTPException(status_code=404, detail="Session not found")

    if state.status == "completed":
        raise HTTPException(status_code=400, detail="Session is already completed")

    if state.current_iteration >= state.max_iterations:
        raise HTTPException(status_code=400, detail="Maximum iterations reached")

    await run_iteration(state)
    return session_to_dict(state)
