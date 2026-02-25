"""SSE Streaming Chat Router — real-time agent responses via Server-Sent Events.

This is the NEW streaming alternative to the blocking POST /api/chat endpoint.
Both endpoints coexist — the frontend can choose which to use.

Endpoint: POST /api/chat/stream
Response: text/event-stream (SSE)

Event types pushed to the client:
  text_delta       — partial text token from Claude (stream as-you-type)
  tool_start       — Claude is calling a tool (show spinner/card)
  tool_result      — tool execution completed (show result)
  approval_req     — expensive tool needs user approval
  error            — something went wrong
  done             — agent finished, final structured results attached

NOTE: This file was added as part of the Agent SDK + SSE migration.
      The original blocking endpoint (routers/chat.py) is preserved unchanged.
      Backup of original files: backend/.backups/pre-agent-sdk/
"""
from __future__ import annotations

import json
import os
from typing import List, Dict, Optional

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from rate_limit import limiter

from agent.hooks import create_default_hooks
from agent.tools import TOOLS

# ─── Feature Flag: SDK Runner ───
# Set AFINDR_USE_SDK_RUNNER=true to use the new Claude Agent SDK runner.
# Default: false (use the original hand-rolled agent loop).
USE_SDK = os.getenv("AFINDR_USE_SDK_RUNNER", "false").lower() == "true"

if USE_SDK:
    from agent.sdk_runner import run_sdk_agent_stream as _run_agent
else:
    from agent.agent_runner import run_agent_stream as _run_agent

router = APIRouter(prefix="/api/chat", tags=["chat-stream"])


class StreamChatRequest(BaseModel):
    """Request body for the streaming chat endpoint.

    Same shape as the existing ChatRequest in chat.py for compatibility.
    """
    message: str = Field(..., max_length=10000)
    symbol: str = Field(default="NQ=F", pattern=r"^[A-Z0-9=.\-\/\^]+$")
    period: str = "1y"
    interval: str = "1d"
    initial_balance: float = 25000.0
    conversation_history: List[Dict] = Field(default=[], max_length=50)
    require_approval: bool = False  # set True to enable approval gates
    current_page: Optional[str] = None
    news_headlines: Optional[List[str]] = None
    active_scripts: Optional[List[str]] = None
    user_profile: Optional[Dict] = None
    active_alerts: Optional[List[Dict]] = None
    # ─── Full App Awareness (Phase 1) ───
    portfolio_holdings: Optional[List[Dict]] = None
    open_positions: Optional[List[Dict]] = None
    account_state: Optional[Dict] = None
    recent_journal: Optional[List[Dict]] = None
    watchlist_symbols: Optional[List[str]] = None
    chart_drawings: Optional[List[Dict]] = None
    active_indicators: Optional[List[Dict]] = None
    app_settings: Optional[Dict] = None


@router.post("/stream")
@limiter.limit("30/minute")
async def chat_stream(request: Request, req: StreamChatRequest):
    """Stream agent response via SSE.

    Returns a text/event-stream response. The frontend should use
    EventSource or fetch() with ReadableStream to consume events.

    Each event is formatted as:
        event: <event_type>
        data: <json_payload>

    The stream ends with a 'done' event containing the full result
    (same shape as the blocking /api/chat response for compatibility).
    """
    # Old runner uses hooks dict; SDK runner manages its own hooks internally.
    hooks = create_default_hooks(tool_schemas=TOOLS) if not USE_SDK else None

    async def event_generator():
        try:
            runner_kwargs = dict(
                message=req.message,
                conversation_history=req.conversation_history,
                symbol=req.symbol,
                period=req.period,
                interval=req.interval,
                initial_balance=req.initial_balance,
                require_approval=req.require_approval,
                current_page=req.current_page,
                news_headlines=req.news_headlines,
                active_scripts=req.active_scripts,
                user_profile=req.user_profile,
                active_alerts=req.active_alerts,
                portfolio_holdings=req.portfolio_holdings,
                open_positions=req.open_positions,
                account_state=req.account_state,
                recent_journal=req.recent_journal,
                watchlist_symbols=req.watchlist_symbols,
                chart_drawings=req.chart_drawings,
                active_indicators=req.active_indicators,
                app_settings=req.app_settings,
            )
            if not USE_SDK:
                runner_kwargs["hooks"] = hooks

            async for sse_event in _run_agent(**runner_kwargs):
                yield sse_event.to_sse()
        except Exception as e:
            # Yield error event if the generator itself throws
            error_event = f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"
            yield error_event

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        },
    )
