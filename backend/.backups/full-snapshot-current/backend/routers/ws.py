"""WebSocket router for real-time backtest progress streaming.

Provides a WebSocket endpoint at /ws/backtest/{run_id} that streams
progress updates during long-running backtests and parameter sweeps.
"""
from __future__ import annotations

import asyncio
import json
import uuid
from typing import Dict

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter(tags=["websocket"])

# Active connections: run_id -> WebSocket
_connections: Dict[str, WebSocket] = {}

# Progress state: run_id -> {phase, progress, message}
_progress: Dict[str, dict] = {}


@router.websocket("/ws/backtest/{run_id}")
async def backtest_progress(websocket: WebSocket, run_id: str):
    """WebSocket endpoint for streaming backtest progress."""
    await websocket.accept()
    _connections[run_id] = websocket

    try:
        # Send initial state if exists
        if run_id in _progress:
            await websocket.send_json(_progress[run_id])

        # Keep connection alive and relay progress updates
        while True:
            try:
                # Wait for client messages (keepalive pings)
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
                if data == "ping":
                    await websocket.send_text("pong")
            except asyncio.TimeoutError:
                # Send keepalive
                try:
                    await websocket.send_json({"type": "keepalive"})
                except Exception:
                    break
    except WebSocketDisconnect:
        pass
    finally:
        _connections.pop(run_id, None)
        _progress.pop(run_id, None)


async def send_progress(run_id: str, phase: str, progress: float, message: str = "", data: dict = None):
    """Send a progress update to the WebSocket client.

    Args:
        run_id: The backtest run ID.
        phase: Current phase (e.g., "generating", "backtesting", "monte_carlo", "complete").
        progress: Progress percentage (0-100).
        message: Human-readable status message.
        data: Optional data payload (e.g., partial results).
    """
    update = {
        "type": "progress",
        "run_id": run_id,
        "phase": phase,
        "progress": round(progress, 1),
        "message": message,
    }
    if data:
        update["data"] = data

    _progress[run_id] = update

    ws = _connections.get(run_id)
    if ws:
        try:
            await ws.send_json(update)
        except Exception:
            _connections.pop(run_id, None)


async def send_complete(run_id: str, result: dict):
    """Send completion message with full results."""
    update = {
        "type": "complete",
        "run_id": run_id,
        "phase": "complete",
        "progress": 100,
        "result": result,
    }

    ws = _connections.get(run_id)
    if ws:
        try:
            await ws.send_json(update)
        except Exception:
            pass

    _progress.pop(run_id, None)


async def send_error(run_id: str, error: str):
    """Send error message."""
    update = {
        "type": "error",
        "run_id": run_id,
        "error": error,
    }

    ws = _connections.get(run_id)
    if ws:
        try:
            await ws.send_json(update)
        except Exception:
            pass

    _progress.pop(run_id, None)


def generate_run_id() -> str:
    """Generate a unique run ID."""
    return f"run_{uuid.uuid4().hex[:12]}"
