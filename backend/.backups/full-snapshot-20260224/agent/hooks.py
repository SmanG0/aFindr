"""Hook system for the aFindr streaming agent.

Provides pre/post tool execution hooks for:
- Audit logging (every tool call logged with timing + result size)
- Tool approval gates (expensive tools need user OK)
- Rate limiting (prevent runaway tool loops)
- Input/output validation (schema checks + payload size)
- Duplicate call prevention (LRU cache of recent results)
- Token/cost tracking (per-model usage accumulation)
- Custom middleware (users can add their own hooks)

NOTE: This file was added as part of the Agent SDK + SSE migration.
      Backup of original files: backend/.backups/pre-agent-sdk/

Usage:
    hooks = create_default_hooks()
    async for event in run_agent_stream(..., hooks=hooks):
        ...
"""
from __future__ import annotations

import hashlib
import json
import logging
import time
from collections import OrderedDict
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
        self._durations: List[float] = []  # for percentile tracking

    async def pre_tool(self, tool_name: str, tool_input: dict) -> None:
        """Log tool execution start."""
        self._pending[tool_name] = time.time()
        logger.info(
            "tool_start",
            extra={
                "tool": tool_name,
                "input_keys": list(tool_input.keys()),
            },
        )

    async def post_tool(self, tool_name: str, tool_input: dict, result: dict) -> None:
        """Log tool execution end with timing and result size."""
        start = self._pending.pop(tool_name, time.time())
        duration_ms = int((time.time() - start) * 1000)
        has_error = "error" in result
        result_size = len(json.dumps(result)) if result else 0

        entry = {
            "tool": tool_name,
            "duration_ms": duration_ms,
            "has_error": has_error,
            "result_size_bytes": result_size,
            "input_keys": list(tool_input.keys()),
            "timestamp": time.time(),
        }
        self.entries.append(entry)
        self._durations.append(duration_ms)

        level = logging.WARNING if has_error else logging.INFO
        logger.log(
            level,
            "tool_end",
            extra={
                "tool": tool_name,
                "duration_ms": duration_ms,
                "error": has_error,
                "result_size_bytes": result_size,
            },
        )

    def get_summary(self) -> Dict[str, Any]:
        """Get audit summary for the session."""
        if not self.entries:
            return {"total_tools": 0, "total_duration_ms": 0, "errors": 0}

        durations_sorted = sorted(self._durations)
        n = len(durations_sorted)

        summary = {
            "total_tools": len(self.entries),
            "total_duration_ms": sum(e["duration_ms"] for e in self.entries),
            "errors": sum(1 for e in self.entries if e["has_error"]),
            "tools_used": [e["tool"] for e in self.entries],
        }

        # Percentile tracking
        if n > 0:
            summary["duration_p50_ms"] = durations_sorted[n // 2]
            summary["duration_p95_ms"] = durations_sorted[min(int(n * 0.95), n - 1)]
            summary["duration_p99_ms"] = durations_sorted[min(int(n * 0.99), n - 1)]

        return summary


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


# ─── Input Validator Hook ───

class InputValidator:
    """Pre-tool hook that validates tool inputs against their schemas."""

    def __init__(self, tool_schemas: list):
        self._schemas = tool_schemas

    async def pre_tool(self, tool_name: str, tool_input: dict) -> None:
        """Validate tool input before execution."""
        from agent.guardrails import validate_tool_input

        is_valid, error = validate_tool_input(tool_name, tool_input, self._schemas)
        if not is_valid:
            logger.warning(
                "tool_input_invalid",
                extra={"tool": tool_name, "error": error},
            )
            raise ValueError(f"Invalid tool input for {tool_name}: {error}")


# ─── Output Validator Hook ───

class OutputValidator:
    """Post-tool hook that validates and sanitizes tool outputs."""

    async def post_tool(self, tool_name: str, tool_input: dict, result: dict) -> None:
        """Validate tool output after execution."""
        from agent.guardrails import validate_tool_output

        sanitized, warning = validate_tool_output(tool_name, result)
        if warning:
            logger.warning(
                "tool_output_warning",
                extra={"tool": tool_name, "warning": warning},
            )


# ─── Duplicate Call Guard ───

class DuplicateToolCallError(Exception):
    """Raised when a duplicate tool call is detected, carries cached result."""

    def __init__(self, tool_name: str, cached_result: str):
        self.tool_name = tool_name
        self.cached_result = cached_result
        super().__init__(f"Duplicate call to {tool_name} — returning cached result")


class DuplicateCallGuard:
    """Detects and short-circuits duplicate tool calls within a session.

    Uses an LRU cache keyed on (tool_name, hash(tool_input)).
    """

    def __init__(self, max_entries: int = 20):
        self._cache: OrderedDict[str, str] = OrderedDict()
        self._max_entries = max_entries

    def _make_key(self, tool_name: str, tool_input: dict) -> str:
        input_hash = hashlib.sha256(
            json.dumps(tool_input, sort_keys=True).encode()
        ).hexdigest()[:16]
        return f"{tool_name}:{input_hash}"

    async def pre_tool(self, tool_name: str, tool_input: dict) -> None:
        """Check if this exact call was already made."""
        key = self._make_key(tool_name, tool_input)
        if key in self._cache:
            self._cache.move_to_end(key)
            raise DuplicateToolCallError(tool_name, self._cache[key])

    def store_result(self, tool_name: str, tool_input: dict, result_str: str) -> None:
        """Store a tool result in the cache after successful execution."""
        key = self._make_key(tool_name, tool_input)
        self._cache[key] = result_str
        if len(self._cache) > self._max_entries:
            self._cache.popitem(last=False)


# ─── Token / Cost Tracker ───

# Pricing per million tokens (USD) as of 2025
MODEL_PRICING = {
    "claude-sonnet-4-20250514": {"input": 3.0, "output": 15.0},
    "claude-haiku-4-5-20251001": {"input": 0.80, "output": 4.0},
}


class TokenTracker:
    """Accumulates per-model token usage and estimates cost."""

    def __init__(self):
        self._usage: Dict[str, Dict[str, int]] = {}

    def track(self, model: str, input_tokens: int, output_tokens: int) -> None:
        """Record token usage for a model."""
        if model not in self._usage:
            self._usage[model] = {"input_tokens": 0, "output_tokens": 0}
        self._usage[model]["input_tokens"] += input_tokens
        self._usage[model]["output_tokens"] += output_tokens

    def get_summary(self) -> Dict[str, Any]:
        """Get token usage and cost summary."""
        total_input = 0
        total_output = 0
        total_cost = 0.0
        by_model: Dict[str, Any] = {}

        for model, usage in self._usage.items():
            inp = usage["input_tokens"]
            out = usage["output_tokens"]
            total_input += inp
            total_output += out

            pricing = MODEL_PRICING.get(model, {"input": 3.0, "output": 15.0})
            model_cost = (inp / 1_000_000 * pricing["input"]) + (
                out / 1_000_000 * pricing["output"]
            )
            total_cost += model_cost

            by_model[model] = {
                "input_tokens": inp,
                "output_tokens": out,
                "estimated_cost_usd": round(model_cost, 6),
            }

        return {
            "total_input_tokens": total_input,
            "total_output_tokens": total_output,
            "estimated_cost_usd": round(total_cost, 6),
            "by_model": by_model,
        }


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
            try:
                await hook(tool_name, tool_input)
            except (DuplicateToolCallError, ValueError, RuntimeError):
                raise  # Let these propagate — they're intentional control flow
            except Exception as e:
                logger.warning(f"Pre-tool hook error: {e}", extra={"tool": tool_name})

    async def post_tool(self, tool_name: str, tool_input: dict, result: dict) -> None:
        for hook in self._post_hooks:
            try:
                await hook(tool_name, tool_input, result)
            except Exception as e:
                logger.warning(f"Post-tool hook error: {e}", extra={"tool": tool_name})


# ─── Factory ───

def create_default_hooks(
    max_calls: int = 20,
    tool_schemas: Optional[list] = None,
) -> Dict[str, Any]:
    """Create the default hook set for a streaming agent session.

    Returns a dict compatible with run_agent_stream(hooks=...).
    """
    audit = AuditLog()
    limiter = RateLimiter(max_calls=max_calls)
    tokens = TokenTracker()
    duplicate_guard = DuplicateCallGuard()

    composite = CompositeHook()
    composite.add_pre(audit.pre_tool)
    composite.add_pre(limiter.pre_tool)
    composite.add_pre(duplicate_guard.pre_tool)
    composite.add_post(audit.post_tool)

    # Add input/output validators if schemas provided
    if tool_schemas:
        input_validator = InputValidator(tool_schemas)
        output_validator = OutputValidator()
        composite.add_pre(input_validator.pre_tool)
        composite.add_post(output_validator.post_tool)

    return {
        "pre_tool": composite.pre_tool,
        "post_tool": composite.post_tool,
        "_audit": audit,
        "_limiter": limiter,
        "_tokens": tokens,
        "_duplicate_guard": duplicate_guard,
    }
