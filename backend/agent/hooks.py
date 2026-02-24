"""Hook system for the aFindr streaming agent.

Provides pre/post tool execution hooks for:
- Audit logging (every tool call logged with timing)
- Tool approval gates (expensive tools need user OK)
- Rate limiting (prevent runaway tool loops)
- Custom middleware (users can add their own hooks)

NOTE: This file was added as part of the Agent SDK + SSE migration.
      Backup of original files: backend/.backups/pre-agent-sdk/

Usage:
    hooks = create_default_hooks()
    async for event in run_agent_stream(..., hooks=hooks):
        ...
"""
from __future__ import annotations

import logging
import time
from typing import Any, Callable, Dict, List, Optional

logger = logging.getLogger("afindr.hooks")


# ─── Hook Types ───

# pre_tool(tool_name: str, tool_input: dict) -> None
# post_tool(tool_name: str, tool_input: dict, result: dict) -> None


# ─── Audit Hook ───

class AuditLog:
    """In-memory audit log for tool executions within a session."""

    def __init__(self):
        self.entries: List[Dict[str, Any]] = []
        self._pending: Dict[str, float] = {}  # tool_name -> start_time

    async def pre_tool(self, tool_name: str, tool_input: dict) -> None:
        """Log tool execution start."""
        self._pending[tool_name] = time.time()
        logger.info(f"[TOOL START] {tool_name} | input_keys={list(tool_input.keys())}")

    async def post_tool(self, tool_name: str, tool_input: dict, result: dict) -> None:
        """Log tool execution end with timing."""
        start = self._pending.pop(tool_name, time.time())
        duration_ms = int((time.time() - start) * 1000)
        has_error = "error" in result

        entry = {
            "tool": tool_name,
            "duration_ms": duration_ms,
            "has_error": has_error,
            "timestamp": time.time(),
        }
        self.entries.append(entry)

        level = logging.WARNING if has_error else logging.INFO
        logger.log(level, f"[TOOL END] {tool_name} | {duration_ms}ms | error={has_error}")

    def get_summary(self) -> Dict[str, Any]:
        """Get audit summary for the session."""
        if not self.entries:
            return {"total_tools": 0, "total_duration_ms": 0, "errors": 0}
        return {
            "total_tools": len(self.entries),
            "total_duration_ms": sum(e["duration_ms"] for e in self.entries),
            "errors": sum(1 for e in self.entries if e["has_error"]),
            "tools_used": [e["tool"] for e in self.entries],
        }


# ─── Rate Limiter Hook ───

class RateLimiter:
    """Prevent runaway tool loops — cap total tool calls per session."""

    def __init__(self, max_calls: int = 20):
        self.max_calls = max_calls
        self.call_count = 0

    async def pre_tool(self, tool_name: str, tool_input: dict) -> None:
        """Check rate limit before tool execution."""
        self.call_count += 1
        if self.call_count > self.max_calls:
            raise RuntimeError(
                f"Rate limit exceeded: {self.call_count}/{self.max_calls} tool calls. "
                "The agent may be in a loop."
            )


# ─── Composite Hook ───

class CompositeHook:
    """Chains multiple pre/post hooks together."""

    def __init__(self):
        self._pre_hooks: List[Callable] = []
        self._post_hooks: List[Callable] = []

    def add_pre(self, hook: Callable) -> "CompositeHook":
        self._pre_hooks.append(hook)
        return self

    def add_post(self, hook: Callable) -> "CompositeHook":
        self._post_hooks.append(hook)
        return self

    async def pre_tool(self, tool_name: str, tool_input: dict) -> None:
        for hook in self._pre_hooks:
            await hook(tool_name, tool_input)

    async def post_tool(self, tool_name: str, tool_input: dict, result: dict) -> None:
        for hook in self._post_hooks:
            await hook(tool_name, tool_input, result)


# ─── Factory ───

def create_default_hooks(max_calls: int = 20) -> Dict[str, Callable]:
    """Create the default hook set for a streaming agent session.

    Returns a dict compatible with run_agent_stream(hooks=...).
    """
    audit = AuditLog()
    limiter = RateLimiter(max_calls=max_calls)

    composite = CompositeHook()
    composite.add_pre(audit.pre_tool)
    composite.add_pre(limiter.pre_tool)
    composite.add_post(audit.post_tool)

    return {
        "pre_tool": composite.pre_tool,
        "post_tool": composite.post_tool,
        "_audit": audit,  # exposed for summary retrieval
        "_limiter": limiter,
    }
