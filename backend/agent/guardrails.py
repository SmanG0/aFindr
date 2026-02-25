"""Input/output validation guardrails for aFindr agent tool calls.

Validates tool inputs against their schemas and sanitizes outputs
to prevent oversized payloads or error propagation.
"""
from __future__ import annotations

import json
import logging
import sys
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger("afindr.guardrails")

MAX_OUTPUT_BYTES = 500_000  # 500 KB


def validate_tool_input(
    tool_name: str,
    tool_input: dict,
    tool_schemas: List[dict],
) -> Tuple[bool, Optional[str]]:
    """Validate tool input against its schema definition.

    Args:
        tool_name: Name of the tool being called.
        tool_input: The input dict provided by the model.
        tool_schemas: The TOOLS list (Anthropic tool_use schema format).

    Returns:
        (is_valid, error_message) — error_message is None when valid.
    """
    schema = None
    for t in tool_schemas:
        if t["name"] == tool_name:
            schema = t.get("input_schema", {})
            break

    if schema is None:
        return False, f"Unknown tool: {tool_name}"

    properties = schema.get("properties", {})
    required = schema.get("required", [])

    # Check required fields
    for field in required:
        if field not in tool_input:
            return False, f"Missing required field '{field}' for {tool_name}"

    # Validate types and enum values for provided fields
    for key, value in tool_input.items():
        if key not in properties:
            continue  # Allow extra fields — the API ignores them

        prop = properties[key]
        expected_type = prop.get("type")

        # Type checking
        if expected_type == "string" and not isinstance(value, str):
            return False, f"Field '{key}' must be a string, got {type(value).__name__}"
        elif expected_type == "number" and not isinstance(value, (int, float)):
            return False, f"Field '{key}' must be a number, got {type(value).__name__}"
        elif expected_type == "integer" and not isinstance(value, int):
            return False, f"Field '{key}' must be an integer, got {type(value).__name__}"
        elif expected_type == "boolean" and not isinstance(value, bool):
            return False, f"Field '{key}' must be a boolean, got {type(value).__name__}"
        elif expected_type == "array" and not isinstance(value, list):
            return False, f"Field '{key}' must be an array, got {type(value).__name__}"

        # Enum validation
        if "enum" in prop and value not in prop["enum"]:
            return False, (
                f"Field '{key}' value '{value}' not in allowed values: {prop['enum']}"
            )

    return True, None


def validate_tool_output(
    tool_name: str,
    result_data: Any,
) -> Tuple[Any, Optional[str]]:
    """Validate and sanitize tool output.

    Checks for oversized payloads and truncates with a warning.

    Args:
        tool_name: Name of the tool that produced the result.
        result_data: The parsed result data.

    Returns:
        (sanitized_data, warning_message) — warning is None if no issues.
    """
    # Check payload size
    try:
        serialized = json.dumps(result_data)
    except (TypeError, ValueError):
        serialized = str(result_data)

    size_bytes = sys.getsizeof(serialized)

    if size_bytes > MAX_OUTPUT_BYTES:
        warning = (
            f"Tool '{tool_name}' output truncated: {size_bytes} bytes > "
            f"{MAX_OUTPUT_BYTES} byte limit"
        )
        logger.warning(warning)

        # Truncate intelligently based on structure
        if isinstance(result_data, dict):
            truncated = _truncate_dict(result_data, MAX_OUTPUT_BYTES)
            truncated["_truncated"] = True
            truncated["_original_size_bytes"] = size_bytes
            return truncated, warning
        elif isinstance(result_data, list):
            truncated = result_data[:50]  # Keep first 50 items
            return {
                "items": truncated,
                "_truncated": True,
                "_original_count": len(result_data),
            }, warning

    return result_data, None


def _truncate_dict(data: dict, max_bytes: int) -> dict:
    """Truncate a dict by removing large nested arrays/strings."""
    result = {}
    for key, value in data.items():
        if isinstance(value, list) and len(value) > 50:
            result[key] = value[:50]
        elif isinstance(value, str) and len(value) > 5000:
            result[key] = value[:5000] + "... [truncated]"
        elif isinstance(value, dict):
            result[key] = _truncate_dict(value, max_bytes // 2)
        else:
            result[key] = value
    return result
