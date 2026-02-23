"""Chat router — Alphy AI copilot with native Anthropic tool_use.

Uses Claude's tool_use API to let the model call trading tools directly.
No fragile JSON parsing — Claude returns structured tool calls.
"""
from __future__ import annotations

import json
import os
import re
from typing import List, Dict

from fastapi import APIRouter
from pydantic import BaseModel
from anthropic import Anthropic

from agent.prompts import ALPHY_SYSTEM_PROMPT
from agent.tools import TOOLS, TOOL_HANDLERS, handle_run_backtest, handle_generate_pinescript
from agent.strategy_agent import generate_strategy, generate_pinescript

router = APIRouter(prefix="/api/chat", tags=["chat"])

client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY", ""))

MAX_TOOL_ROUNDS = 5  # Prevent infinite tool-calling loops


def strip_markdown(text: str) -> str:
    """Remove markdown formatting — Alphy speaks plain text only."""
    # Remove fenced code blocks but keep content
    text = re.sub(r"```[\w]*\n?", "", text)
    # Remove headings (# ## ### etc.)
    text = re.sub(r"^#{1,6}\s*", "", text, flags=re.MULTILINE)
    # Remove bold/italic (**text**, *text*, ***text***)
    text = re.sub(r"\*{1,3}(.+?)\*{1,3}", r"\1", text)
    # Remove underscore emphasis (__text__, _text_)
    text = re.sub(r"(?<!\w)_{1,3}(.+?)_{1,3}(?!\w)", r"\1", text)
    # Remove inline code (`text`)
    text = re.sub(r"`([^`]+)`", r"\1", text)
    # Replace bullet asterisks with dashes
    text = re.sub(r"^\s*\*\s+", "- ", text, flags=re.MULTILINE)
    return text


class ChatRequest(BaseModel):
    message: str
    symbol: str = "NQ=F"
    period: str = "1y"
    interval: str = "1d"
    initial_balance: float = 50000.0
    conversation_history: List[Dict] = []


@router.post("")
async def chat(req: ChatRequest):
    """Process chat message with tool-calling loop.

    1. Send user message + tools to Claude
    2. If Claude calls tools, execute them and send results back
    3. Repeat until Claude produces a text response (max MAX_TOOL_ROUNDS)
    """
    # Build messages from conversation history
    messages = []
    for msg in req.conversation_history:
        messages.append({"role": msg["role"], "content": msg["content"]})
    messages.append({"role": "user", "content": req.message})

    # Track tool results for the frontend
    backtest_result = None
    pinescript_result = None
    tool_data = []

    for _round in range(MAX_TOOL_ROUNDS):
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            system=ALPHY_SYSTEM_PROMPT,
            tools=TOOLS,
            messages=messages,
        )

        # Check if Claude wants to use tools
        tool_use_blocks = [b for b in response.content if b.type == "tool_use"]

        if not tool_use_blocks:
            # No tool calls — extract text response
            text_parts = [b.text for b in response.content if b.type == "text"]
            final_text = "\n".join(text_parts) if text_parts else "I couldn't generate a response."
            final_text = strip_markdown(final_text)

            return {
                "message": final_text,
                "strategy": backtest_result.get("strategy") if backtest_result else None,
                "backtest_result": _format_backtest_for_frontend(backtest_result) if backtest_result else None,
                "pinescript": pinescript_result,
                "tool_data": tool_data if tool_data else None,
            }

        # Execute tool calls and collect results
        # First, add Claude's response (with tool_use blocks) to messages
        messages.append({"role": "assistant", "content": response.content})

        tool_results = []
        for tool_block in tool_use_blocks:
            tool_name = tool_block.name
            tool_input = tool_block.input

            try:
                if tool_name == "run_backtest":
                    result_str = await handle_run_backtest(tool_input, generate_strategy)
                    result_data = json.loads(result_str)
                    if "error" not in result_data:
                        backtest_result = result_data
                elif tool_name == "generate_pinescript":
                    result_str = await handle_generate_pinescript(tool_input, generate_pinescript)
                    result_data = json.loads(result_str)
                    if "error" not in result_data:
                        pinescript_result = result_data
                elif tool_name in TOOL_HANDLERS:
                    result_str = await TOOL_HANDLERS[tool_name](tool_input)
                    result_data = json.loads(result_str)
                else:
                    result_str = json.dumps({"error": f"Unknown tool: {tool_name}"})
                    result_data = {"error": f"Unknown tool: {tool_name}"}

                tool_data.append({
                    "tool": tool_name,
                    "input": tool_input,
                    "data": result_data,
                })

            except Exception as e:
                result_str = json.dumps({"error": str(e)})

            tool_results.append({
                "type": "tool_result",
                "tool_use_id": tool_block.id,
                "content": result_str,
            })

        messages.append({"role": "user", "content": tool_results})

    # If we hit the max rounds, return what we have
    return {
        "message": "I gathered the data but hit my tool-calling limit. Here's what I found so far.",
        "strategy": backtest_result.get("strategy") if backtest_result else None,
        "backtest_result": _format_backtest_for_frontend(backtest_result) if backtest_result else None,
        "pinescript": pinescript_result,
        "tool_data": tool_data if tool_data else None,
    }


def _format_backtest_for_frontend(result: dict) -> dict | None:
    """Format backtest result to match frontend expectations."""
    if not result:
        return None

    strategy = result.get("strategy", {})
    metrics = result.get("metrics", {})
    trades = result.get("trades", [])

    return {
        "trades": trades,
        "equity_curve": [],  # Full equity curve not included in tool response
        "metrics": metrics,
        "strategy_name": strategy.get("name", ""),
        "strategy_description": strategy.get("description", ""),
    }
