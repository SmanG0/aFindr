"""VectorBT strategy base class.

Provides a vectorized alternative to BaseStrategy's bar-by-bar approach.
Strategies generate boolean signal arrays over the entire DataFrame at once,
enabling massive parallelization via VectorBT's parameter sweep machinery.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any

import numpy as np
import pandas as pd


@dataclass
class StrategyConfig:
    """Configuration for a VectorBT strategy."""
    name: str = "Unnamed VBT Strategy"
    description: str = ""
    parameters: Dict[str, Any] = field(default_factory=dict)
    # Parameter grid for vectorized sweeps: {"fast_ema": [10, 20, 30], ...}
    param_grid: Optional[Dict[str, List]] = None


@dataclass
class TradeSignal:
    """Vectorized trade signals — boolean arrays over the full DataFrame."""
    entries: np.ndarray       # True where we enter long
    exits: np.ndarray         # True where we exit long
    short_entries: Optional[np.ndarray] = None  # True where we enter short
    short_exits: Optional[np.ndarray] = None    # True where we exit short


class VectorBTStrategy:
    """Base class for vectorized strategies.

    Unlike BaseStrategy (bar-by-bar), VectorBTStrategy operates on the entire
    DataFrame at once, returning boolean signal arrays. This makes it compatible
    with VectorBT's vectorized portfolio simulation and parameter sweeps.

    Subclasses must implement `generate_signals(df) -> TradeSignal`.
    """

    def __init__(self, params: dict):
        self.params = params

    def generate_signals(self, df: pd.DataFrame) -> TradeSignal:
        """Generate entry/exit signals for the entire DataFrame.

        Args:
            df: OHLCV DataFrame with columns: open, high, low, close, volume.

        Returns:
            TradeSignal with boolean arrays for entries and exits.
        """
        raise NotImplementedError("Subclasses must implement generate_signals()")

    @classmethod
    def param_grid(cls) -> Dict[str, List]:
        """Return the default parameter grid for sweeps.

        Override this in subclasses to define sweep ranges.
        """
        return {}
