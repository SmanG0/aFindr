"""Resilience primitives for the aFindr agent system.

Provides retry with exponential backoff, circuit breakers, and timeout
wrappers for external API calls (Anthropic, yfinance, Finnhub, etc.).
"""
from __future__ import annotations

import asyncio
import logging
import random
import time
from enum import Enum
from typing import Any, Callable, Coroutine, TypeVar

from anthropic import APIStatusError, APIConnectionError, APITimeoutError

logger = logging.getLogger("afindr.resilience")

T = TypeVar("T")

# ─── Retry with Exponential Backoff ───

RETRYABLE_STATUS_CODES = {429, 500, 502, 503}


async def retry_api_call(
    coro_factory: Callable[[], Coroutine[Any, Any, T]],
    max_retries: int = 3,
    base_delay: float = 1.0,
) -> T:
    """Retry an async API call with exponential backoff + jitter.

    Args:
        coro_factory: A zero-arg callable that returns a new coroutine each call.
                      Must be a factory (not a bare coroutine) so we can retry.
        max_retries: Maximum number of retry attempts.
        base_delay: Base delay in seconds (doubles each retry).

    Returns:
        The result of the successful call.

    Raises:
        The last exception if all retries are exhausted.
    """
    last_exc: Exception | None = None

    for attempt in range(max_retries + 1):
        try:
            return await coro_factory()
        except APIStatusError as e:
            if e.status_code not in RETRYABLE_STATUS_CODES:
                raise  # Non-retryable (e.g. 400, 401) — fail immediately
            last_exc = e
        except (APIConnectionError, APITimeoutError) as e:
            last_exc = e
        except Exception:
            raise  # Unknown errors — don't retry

        if attempt < max_retries:
            delay = base_delay * (2 ** attempt) + random.uniform(0, 0.5)
            logger.warning(
                "Retrying API call",
                extra={
                    "attempt": attempt + 1,
                    "max_retries": max_retries,
                    "delay_s": round(delay, 2),
                    "error": str(last_exc),
                },
            )
            await asyncio.sleep(delay)

    raise last_exc  # type: ignore[misc]


# ─── Circuit Breaker ───

class CircuitState(Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


class CircuitOpenError(Exception):
    """Raised when the circuit breaker is open and calls are rejected."""

    def __init__(self, provider: str, recovery_in: float):
        self.provider = provider
        self.recovery_in = recovery_in
        super().__init__(
            f"{provider} circuit is OPEN — try again in {recovery_in:.0f}s"
        )


class CircuitBreaker:
    """Per-provider circuit breaker to avoid hammering failing services.

    States: CLOSED (normal) → OPEN (rejecting) → HALF_OPEN (testing).
    """

    def __init__(
        self,
        provider: str,
        failure_threshold: int = 5,
        recovery_timeout: float = 60.0,
        half_open_max: int = 2,
    ):
        self.provider = provider
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.half_open_max = half_open_max

        self._state = CircuitState.CLOSED
        self._failure_count = 0
        self._last_failure_time = 0.0
        self._half_open_calls = 0

    @property
    def state(self) -> CircuitState:
        if self._state == CircuitState.OPEN:
            elapsed = time.time() - self._last_failure_time
            if elapsed >= self.recovery_timeout:
                self._state = CircuitState.HALF_OPEN
                self._half_open_calls = 0
                logger.info(
                    "Circuit half-open",
                    extra={"provider": self.provider},
                )
        return self._state

    async def call(self, coro_factory: Callable[[], Coroutine[Any, Any, T]]) -> T:
        """Execute a call through the circuit breaker.

        Args:
            coro_factory: Zero-arg callable returning a coroutine.

        Returns:
            Result of the call.

        Raises:
            CircuitOpenError: If the circuit is open.
        """
        current_state = self.state

        if current_state == CircuitState.OPEN:
            recovery_in = self.recovery_timeout - (time.time() - self._last_failure_time)
            raise CircuitOpenError(self.provider, max(0, recovery_in))

        if current_state == CircuitState.HALF_OPEN:
            if self._half_open_calls >= self.half_open_max:
                raise CircuitOpenError(self.provider, self.recovery_timeout)
            self._half_open_calls += 1

        try:
            result = await coro_factory()
            self._on_success()
            return result
        except Exception as e:
            self._on_failure()
            raise

    def _on_success(self) -> None:
        if self._state in (CircuitState.HALF_OPEN, CircuitState.CLOSED):
            self._failure_count = 0
            self._state = CircuitState.CLOSED

    def _on_failure(self) -> None:
        self._failure_count += 1
        self._last_failure_time = time.time()
        if self._failure_count >= self.failure_threshold:
            self._state = CircuitState.OPEN
            logger.error(
                "Circuit opened",
                extra={
                    "provider": self.provider,
                    "failures": self._failure_count,
                    "recovery_timeout": self.recovery_timeout,
                },
            )


# ─── Timeout Wrapper ───

class ToolTimeoutError(Exception):
    """Raised when a tool call exceeds its timeout."""

    def __init__(self, label: str, seconds: float):
        self.label = label
        self.seconds = seconds
        super().__init__(f"{label} timed out after {seconds}s")


async def with_timeout(
    coro: Coroutine[Any, Any, T],
    seconds: float,
    label: str = "operation",
) -> T:
    """Wrap a coroutine with a timeout.

    Args:
        coro: The coroutine to execute.
        seconds: Maximum time in seconds.
        label: Human-readable label for error messages.

    Returns:
        The coroutine result.

    Raises:
        ToolTimeoutError: If the operation exceeds the timeout.
    """
    try:
        return await asyncio.wait_for(coro, timeout=seconds)
    except asyncio.TimeoutError:
        raise ToolTimeoutError(label, seconds)


# ─── Provider-Level Breaker Instances ───

anthropic_breaker = CircuitBreaker("anthropic", failure_threshold=5, recovery_timeout=60.0)
yfinance_breaker = CircuitBreaker("yfinance", failure_threshold=5, recovery_timeout=30.0)
finnhub_breaker = CircuitBreaker("finnhub", failure_threshold=5, recovery_timeout=30.0)
