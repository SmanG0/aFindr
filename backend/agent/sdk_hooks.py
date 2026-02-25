"""SDK Hook Mapping — bridges existing Alphy hooks to Claude Agent SDK HookMatcher format.

Maps:
  AuditLog.pre_tool/post_tool  → PreToolUse / PostToolUse HookMatcher
  RateLimiter.pre_tool          → PreToolUse HookMatcher (deny if exceeded)
  DuplicateCallGuard            → Checked inside MCP tool wrappers (not a hook)
  OutputValidator               → Inside MCP tool wrappers (truncation)
  InputValidator                → Dropped (SDK validates against @tool schema)
  TokenTracker                  → Tracked from ResultMessage in the runner
"""
from __future__ import annotations

import logging
import time
from typing import Any, Dict, Optional

from claude_agent_sdk import HookMatcher

from agent.mcp_tools import bare_tool_name

logger = logging.getLogger("afindr.sdk_hooks")

# Type aliases matching SDK hook signatures
HookInput = Dict[str, Any]
HookContext = Dict[str, Any]
HookJSONOutput = Dict[str, Any]


# ─── Audit Hook ───

class SDKAuditLog:
    """Audit logging via SDK hooks — tracks tool timing and result sizes."""

    def __init__(self):
        self._pending: Dict[str, float] = {}  # tool_use_id → start_time
        self.entries: list = []

    async def pre_tool(
        self,
        input_data: HookInput,
        tool_use_id: Optional[str],
        context: HookContext,
    ) -> HookJSONOutput:
        """Log tool execution start."""
        tool_name = bare_tool_name(input_data.get("tool_name", ""))
        # Key on tool_use_id if available, fall back to tool_name
        key = tool_use_id or tool_name
        self._pending[key] = time.time()

        logger.info(
            "sdk_tool_start",
            extra={
                "tool": tool_name,
                "tool_use_id": tool_use_id,
            },
        )
        return {}

    async def post_tool(
        self,
        input_data: HookInput,
        tool_use_id: Optional[str],
        context: HookContext,
    ) -> HookJSONOutput:
        """Log tool execution end with timing."""
        tool_name = bare_tool_name(input_data.get("tool_name", ""))
        # Match the key used in pre_tool
        key = tool_use_id or tool_name
        start = self._pending.pop(key, time.time())
        duration_ms = int((time.time() - start) * 1000)

        tool_response = str(input_data.get("tool_response", ""))
        has_error = "error" in tool_response.lower()

        self.entries.append({
            "tool": tool_name,
            "duration_ms": duration_ms,
            "has_error": has_error,
            "result_size_bytes": len(tool_response),
        })

        level = logging.WARNING if has_error else logging.INFO
        logger.log(
            level,
            "sdk_tool_end",
            extra={
                "tool": tool_name,
                "duration_ms": duration_ms,
                "error": has_error,
                "result_size_bytes": len(tool_response),
            },
        )

        # If error detected, add context for the agent
        if has_error:
            return {
                "hookSpecificOutput": {
                    "hookEventName": "PostToolUse",
                    "additionalContext": "Tool execution returned an error. Consider alternative approach.",
                }
            }
        return {}


# ─── Rate Limiter Hook ───

class SDKRateLimiter:
    """Rate limiting via SDK PreToolUse hook — denies if exceeded max calls."""

    def __init__(self, max_calls: int = 20):
        self.max_calls = max_calls
        self.call_count = 0

    async def pre_tool(
        self,
        input_data: HookInput,
        tool_use_id: Optional[str],
        context: HookContext,
    ) -> HookJSONOutput:
        """Check rate limit before tool execution."""
        self.call_count += 1
        if self.call_count > self.max_calls:
            tool_name = bare_tool_name(input_data.get("tool_name", ""))
            logger.warning(
                "sdk_rate_limit_exceeded",
                extra={"tool": tool_name, "count": self.call_count, "max": self.max_calls},
            )
            return {
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": "deny",
                    "permissionDecisionReason": (
                        f"Rate limit exceeded: {self.call_count}/{self.max_calls} tool calls. "
                        "The agent may be in a loop."
                    ),
                }
            }
        return {}


# ─── Factory ───

def create_sdk_hooks(max_calls: int = 20) -> tuple[Dict[str, list], SDKAuditLog, SDKRateLimiter]:
    """Create SDK hook configuration for ClaudeAgentOptions.

    Returns:
        (hooks_dict, audit_log, rate_limiter) — the hooks dict goes directly into
        ClaudeAgentOptions(hooks=...), and the audit/limiter instances are kept
        for post-session summary.
    """
    audit = SDKAuditLog()
    limiter = SDKRateLimiter(max_calls=max_calls)

    hooks = {
        "PreToolUse": [
            # Match all tools (matcher=None)
            HookMatcher(matcher="*", hooks=[audit.pre_tool, limiter.pre_tool]),
        ],
        "PostToolUse": [
            HookMatcher(matcher="*", hooks=[audit.post_tool]),
        ],
    }

    return hooks, audit, limiter
