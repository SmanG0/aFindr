import ast
import re

ALLOWED_IMPORTS = {"pandas", "numpy", "ta", "pd", "np"}
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


def execute_strategy_code(code: str) -> type:
    """Execute validated strategy code and return the strategy class."""
    namespace = {}
    exec(code, namespace)
    from engine.strategy import BaseStrategy
    for value in namespace.values():
        if isinstance(value, type) and issubclass(value, BaseStrategy) and value is not BaseStrategy:
            return value
    raise ValueError("No BaseStrategy subclass found in generated code")
