import ast
import os
import re
import threading

# SANDBOX_MODE: "docker" for production, "thread" for development
SANDBOX_MODE = os.getenv("SANDBOX_MODE", "thread")

ALLOWED_IMPORTS = {"pandas", "numpy", "ta", "pd", "np", "vectorbt", "vbt"}
FORBIDDEN_PATTERNS = [
    r"open\s*\(",
    r"__import__",
    r"exec\s*\(",
    r"eval\s*\(",
    r"os\.",
    r"sys\.",
    r"subprocess",
    r"import\s+os",
    r"import\s+sys",
    r"import\s+subprocess",
    r"import\s+socket",
    r"import\s+http",
    r"import\s+urllib",
    r"import\s+requests",
]


def validate_strategy_code(code: str) -> "tuple[bool, str]":
    """Validate that generated strategy code is safe to execute."""
    for pattern in FORBIDDEN_PATTERNS:
        if re.search(pattern, code):
            return False, f"Forbidden pattern found: {pattern}"
    try:
        tree = ast.parse(code)
    except SyntaxError as e:
        return False, f"Syntax error: {e}"
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                module = alias.name.split(".")[0]
                if module not in ALLOWED_IMPORTS and module != "engine":
                    return False, f"Forbidden import: {alias.name}"
        elif isinstance(node, ast.ImportFrom):
            if node.module:
                module = node.module.split(".")[0]
                if module not in ALLOWED_IMPORTS and module != "engine":
                    return False, f"Forbidden import from: {node.module}"
    return True, "OK"


class StrategyExecutionTimeout(Exception):
    pass


def execute_strategy_code(code: str, timeout_seconds: int = 10) -> type:
    """Execute validated strategy code and return the strategy class.

    Runs exec() in a daemon thread with a timeout to prevent infinite loops.
    """
    namespace = {}
    error: list = [None]

    def _run():
        try:
            exec(code, namespace)
        except Exception as e:
            error[0] = e

    thread = threading.Thread(target=_run, daemon=True)
    thread.start()
    thread.join(timeout=timeout_seconds)

    if thread.is_alive():
        raise StrategyExecutionTimeout(
            f"Strategy code execution timed out after {timeout_seconds}s"
        )
    if error[0]:
        raise error[0]

    from engine.strategy import BaseStrategy
    from engine.vbt_strategy import VectorBTStrategy
    # Check for VectorBTStrategy first (more specific), then BaseStrategy
    for value in namespace.values():
        if isinstance(value, type) and issubclass(value, VectorBTStrategy) and value is not VectorBTStrategy:
            return value
    for value in namespace.values():
        if isinstance(value, type) and issubclass(value, BaseStrategy) and value is not BaseStrategy:
            return value
    raise ValueError("No BaseStrategy or VectorBTStrategy subclass found in generated code")
