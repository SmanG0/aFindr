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
from typing import List, Dict, Optional

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from agent.agent_runner import run_agent_stream
from agent.hooks import create_default_hooks

router = APIRouter(prefix="/api/chat", tags=["chat-stream"])


class StreamChatRequest(BaseModel):
    """Request body for the streaming chat endpoint.

    Same shape as the existing ChatRequest in chat.py for compatibility.
    """
    message: str
    symbol: str = "NQ=F"
    period: str = "1y"
    interval: str = "1d"
    initial_balance: float = 25000.0
    conversation_history: List[Dict] = []
    require_approval: bool = False  # set True to enable approval gates
    current_page: Optional[str] = None
    news_headlines: Optional[List[str]] = None


@router.post("/stream")
async def chat_stream(req: StreamChatRequest):
    """Stream agent response via SSE.

    Returns a text/event-stream response. The frontend should use
    EventSource or fetch() with ReadableStream to consume events.

    Each event is formatted as:
        event: <event_type>
        data: <json_payload>

    The stream ends with a 'done' event containing the full result
    (same shape as the blocking /api/chat response for compatibility).
    """
    hooks = create_default_hooks()

    async def event_generator():
        try:
            async for sse_event in run_agent_stream(
                message=req.message,
                conversation_history=req.conversation_history,
                symbol=req.symbol,
                period=req.period,
                interval=req.interval,
                initial_balance=req.initial_balance,
                require_approval=req.require_approval,
                hooks=hooks,
                current_page=req.current_page,
                news_headlines=req.news_headlines,
            ):
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
