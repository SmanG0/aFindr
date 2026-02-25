"""Strategy and backtest result persistence.

Saves to JSON files in backend/data/strategies/ directory.
"""
from __future__ import annotations

import json
import os
from datetime import datetime
from typing import Optional, List, Dict

STRATEGIES_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "strategies")
os.makedirs(STRATEGIES_DIR, exist_ok=True)


def save_strategy(
    name: str,
    description: str,
    code: str,
    parameters: dict,
    backtest_metrics: Optional[dict] = None,
    monte_carlo: Optional[dict] = None,
    symbol: str = "NQ=F",
    interval: str = "1d",
) -> str:
    """Save strategy to JSON file. Returns the filename."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_name = "".join(c if c.isalnum() or c in "_-" else "_" for c in name)
    filename = f"{timestamp}_{safe_name}.json"

    data = {
        "name": name,
        "description": description,
        "code": code,
        "parameters": parameters,
        "symbol": symbol,
        "interval": interval,
        "created_at": datetime.now().isoformat(),
        "backtest_metrics": backtest_metrics,
        "monte_carlo": monte_carlo,
    }

    filepath = os.path.join(STRATEGIES_DIR, filename)
    with open(filepath, "w") as f:
        json.dump(data, f, indent=2, default=str)

    return filename


def list_strategies() -> List[Dict]:
    """List all saved strategies (newest first)."""
    strategies = []
    for f in sorted(os.listdir(STRATEGIES_DIR), reverse=True):
        if not f.endswith(".json"):
            continue
        filepath = os.path.join(STRATEGIES_DIR, f)
        try:
            with open(filepath) as fh:
                data = json.load(fh)
            strategies.append({
                "filename": f,
                "name": data.get("name", "Unknown"),
                "description": data.get("description", ""),
                "symbol": data.get("symbol", ""),
                "interval": data.get("interval", ""),
                "created_at": data.get("created_at", ""),
                "has_backtest": data.get("backtest_metrics") is not None,
                "has_monte_carlo": data.get("monte_carlo") is not None,
            })
        except Exception:
            continue
    return strategies


def load_strategy(filename: str) -> Optional[Dict]:
    """Load a saved strategy by filename."""
    # Sanitize filename to prevent directory traversal
    filename = os.path.basename(filename)
    filepath = os.path.join(STRATEGIES_DIR, filename)
    if not os.path.exists(filepath):
        return None
    with open(filepath) as f:
        return json.load(f)
