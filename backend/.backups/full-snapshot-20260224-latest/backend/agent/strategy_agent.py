from __future__ import annotations

import json
import logging
import os
from typing import Optional, List, Dict

from anthropic import Anthropic, APIStatusError, APIConnectionError, APITimeoutError
from agent.prompts import STRATEGY_SYSTEM_PROMPT, PINESCRIPT_SYSTEM_PROMPT, VBT_STRATEGY_SYSTEM_PROMPT

logger = logging.getLogger("afindr.strategy_agent")

client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY", ""))

# Retry config for synchronous calls
MAX_RETRIES = 3
BASE_DELAY = 1.0
RETRYABLE_STATUS_CODES = {429, 500, 502, 503}

# Max self-correction attempts on JSON parse / validation failure
MAX_CORRECTION_RETRIES = 2

# Required fields for strategy validation
REQUIRED_STRATEGY_FIELDS = {"name", "entry_conditions", "exit_conditions"}


def _retry_sync_api_call(fn, *args, **kwargs):
    """Retry a synchronous Anthropic API call with exponential backoff.

    Args:
        fn: The API method to call (e.g. client.messages.create).
        *args, **kwargs: Passed through to fn.

    Returns:
        The API response.
    """
    import time
    import random

    last_exc = None
    for attempt in range(MAX_RETRIES + 1):
        try:
            return fn(*args, **kwargs)
        except APIStatusError as e:
            if e.status_code not in RETRYABLE_STATUS_CODES:
                raise
            last_exc = e
        except (APIConnectionError, APITimeoutError) as e:
            last_exc = e

        if attempt < MAX_RETRIES:
            delay = BASE_DELAY * (2 ** attempt) + random.uniform(0, 0.5)
            logger.warning(
                "Retrying strategy API call",
                extra={
                    "attempt": attempt + 1,
                    "max_retries": MAX_RETRIES,
                    "delay_s": round(delay, 2),
                    "error": str(last_exc),
                },
            )
            time.sleep(delay)

    raise last_exc  # type: ignore[misc]


def _extract_json(response_text: str) -> dict:
    """Extract JSON from a response that may contain markdown code blocks.

    Raises json.JSONDecodeError or ValueError on failure.
    """
    json_match = response_text
    if "```json" in response_text:
        start = response_text.index("```json") + 7
        end = response_text.index("```", start)
        json_match = response_text[start:end].strip()
    elif "```" in response_text:
        start = response_text.index("```") + 3
        end = response_text.index("```", start)
        json_match = response_text[start:end].strip()

    return json.loads(json_match)


def _validate_strategy(data: dict) -> Optional[str]:
    """Return error message if strategy is invalid, None if valid."""
    missing = REQUIRED_STRATEGY_FIELDS - set(data.keys())
    if missing:
        return f"Missing required fields: {', '.join(sorted(missing))}"
    return None


def _get_rag_context(query: str) -> str:
    """Query RAG store for relevant context. Returns empty string if unavailable."""
    try:
        from rag.store import get_store
        store = get_store()
        if store.is_available:
            return store.query_all(query, n_results=3)
    except Exception:
        pass
    return ""


def generate_strategy(
    user_message: str,
    conversation_history: Optional[List[Dict]] = None,
) -> dict:
    """Use Claude to generate a trading strategy from natural language.

    Self-corrects on JSON parse errors or missing fields (up to 2 retries).
    """
    messages = []
    if conversation_history:
        for msg in conversation_history:
            messages.append({"role": msg["role"], "content": msg["content"]})
    messages.append({"role": "user", "content": user_message})

    for attempt in range(MAX_CORRECTION_RETRIES + 1):
        response = _retry_sync_api_call(
            client.messages.create,
            model="claude-haiku-4-5-20251001",
            max_tokens=4096,
            system=STRATEGY_SYSTEM_PROMPT,
            messages=messages,
        )

        response_text = response.content[0].text

        try:
            result = _extract_json(response_text)
        except (json.JSONDecodeError, ValueError) as e:
            if attempt < MAX_CORRECTION_RETRIES:
                logger.warning(
                    "strategy_json_error_retrying",
                    extra={"attempt": attempt + 1, "error": str(e)},
                )
                messages.append({"role": "assistant", "content": response_text})
                messages.append({
                    "role": "user",
                    "content": f"Your response had a JSON error: {e}. Please fix and return ONLY valid JSON.",
                })
                continue
            return {"error": f"Strategy generation failed after {attempt + 1} attempts", "raw_response": response_text}

        # Validate required fields
        validation_error = _validate_strategy(result)
        if validation_error:
            if attempt < MAX_CORRECTION_RETRIES:
                logger.warning(
                    "strategy_validation_error_retrying",
                    extra={"attempt": attempt + 1, "error": validation_error},
                )
                messages.append({"role": "assistant", "content": response_text})
                messages.append({
                    "role": "user",
                    "content": f"Your strategy JSON is missing required fields: {validation_error}. Please fix and return the complete JSON.",
                })
                continue
            return {"error": f"Strategy validation failed: {validation_error}", "raw_response": response_text}

        return result

    return {"error": "Strategy generation failed", "raw_response": ""}


def generate_vbt_strategy(
    user_message: str,
    conversation_history: Optional[List[Dict]] = None,
    rag_context: str = "",
) -> dict:
    """Use Claude to generate a VectorBT-style strategy from natural language.

    Self-corrects on JSON parse errors (up to 2 retries).
    RAG context is automatically injected from ChromaDB if available.
    """
    messages = []
    if conversation_history:
        for msg in conversation_history:
            messages.append({"role": msg["role"], "content": msg["content"]})

    # Auto-fetch RAG context if not provided
    if not rag_context:
        rag_context = _get_rag_context(user_message)

    # Inject RAG context if available
    prompt = user_message
    if rag_context:
        prompt = f"Reference context from documentation:\n{rag_context}\n\nUser request: {user_message}"

    messages.append({"role": "user", "content": prompt})

    for attempt in range(MAX_CORRECTION_RETRIES + 1):
        response = _retry_sync_api_call(
            client.messages.create,
            model="claude-haiku-4-5-20251001",
            max_tokens=4096,
            system=VBT_STRATEGY_SYSTEM_PROMPT,
            messages=messages,
        )

        response_text = response.content[0].text

        try:
            result = _extract_json(response_text)
        except (json.JSONDecodeError, ValueError) as e:
            if attempt < MAX_CORRECTION_RETRIES:
                logger.warning(
                    "vbt_strategy_json_error_retrying",
                    extra={"attempt": attempt + 1, "error": str(e)},
                )
                messages.append({"role": "assistant", "content": response_text})
                messages.append({
                    "role": "user",
                    "content": f"Your response had a JSON error: {e}. Please fix and return ONLY valid JSON.",
                })
                continue
            return {"error": f"VBT strategy generation failed after {attempt + 1} attempts", "raw_response": response_text}

        return result

    return {"error": "VBT strategy generation failed", "raw_response": ""}


def generate_pinescript(
    user_message: str,
    conversation_history: Optional[List[Dict]] = None,
) -> dict:
    """Use Claude to generate PineScript v5 code from natural language.

    Self-corrects on JSON parse errors (up to 2 retries).
    """
    messages = []
    if conversation_history:
        for msg in conversation_history:
            messages.append({"role": msg["role"], "content": msg["content"]})
    messages.append({"role": "user", "content": user_message})

    for attempt in range(MAX_CORRECTION_RETRIES + 1):
        response = _retry_sync_api_call(
            client.messages.create,
            model="claude-haiku-4-5-20251001",
            max_tokens=4096,
            system=PINESCRIPT_SYSTEM_PROMPT,
            messages=messages,
        )

        response_text = response.content[0].text

        try:
            result = _extract_json(response_text)
        except (json.JSONDecodeError, ValueError) as e:
            if attempt < MAX_CORRECTION_RETRIES:
                logger.warning(
                    "pinescript_json_error_retrying",
                    extra={"attempt": attempt + 1, "error": str(e)},
                )
                messages.append({"role": "assistant", "content": response_text})
                messages.append({
                    "role": "user",
                    "content": f"Your response had a JSON error: {e}. Please fix and return ONLY valid JSON.",
                })
                continue
            return {"error": f"PineScript generation failed after {attempt + 1} attempts", "raw_response": response_text}

        return result

    return {"error": "PineScript generation failed", "raw_response": ""}
