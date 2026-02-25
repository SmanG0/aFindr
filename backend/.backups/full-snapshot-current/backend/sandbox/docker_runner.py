"""Docker client wrapper for sandboxed strategy execution.

Runs strategy code inside an isolated Docker container with:
- No network access
- 2GB memory limit
- Read-only filesystem (except /tmp)
- 30-second timeout
- Auto-cleanup on completion
"""
from __future__ import annotations

import json
import os
import subprocess
import tempfile
from typing import Optional

DOCKER_IMAGE = "afindr-sandbox"
TIMEOUT_SECONDS = 30
MEMORY_LIMIT = "2g"


def is_docker_available() -> bool:
    """Check if Docker is available and the sandbox image exists."""
    try:
        result = subprocess.run(
            ["docker", "image", "inspect", DOCKER_IMAGE],
            capture_output=True,
            timeout=5,
        )
        return result.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


def build_sandbox_image() -> bool:
    """Build the sandbox Docker image."""
    sandbox_dir = os.path.dirname(os.path.abspath(__file__))
    try:
        result = subprocess.run(
            ["docker", "build", "-t", DOCKER_IMAGE, sandbox_dir],
            capture_output=True,
            text=True,
            timeout=300,
        )
        return result.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


def run_in_docker(
    code: str,
    params: dict,
    data: list,
    config: Optional[dict] = None,
    timeout: int = TIMEOUT_SECONDS,
) -> dict:
    """Execute strategy code inside a Docker sandbox.

    Args:
        code: Python strategy code.
        params: Strategy parameters.
        data: Serialized OHLCV data (list of dicts).
        config: Optional backtest configuration.
        timeout: Execution timeout in seconds.

    Returns:
        Dict with execution results or error.
    """
    input_data = json.dumps({
        "code": code,
        "params": params,
        "data": data,
        "config": config or {},
    })

    try:
        result = subprocess.run(
            [
                "docker", "run",
                "--rm",
                "--network", "none",
                "--memory", MEMORY_LIMIT,
                "--read-only",
                "--tmpfs", "/tmp:size=100m",
                "-i",
                DOCKER_IMAGE,
            ],
            input=input_data,
            capture_output=True,
            text=True,
            timeout=timeout,
        )

        if result.returncode != 0:
            return {"error": f"Container exited with code {result.returncode}: {result.stderr[:500]}"}

        try:
            return json.loads(result.stdout)
        except json.JSONDecodeError:
            return {"error": f"Invalid output from container: {result.stdout[:500]}"}

    except subprocess.TimeoutExpired:
        return {"error": f"Execution timed out after {timeout}s"}
    except FileNotFoundError:
        return {"error": "Docker is not installed or not in PATH"}
