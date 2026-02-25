from __future__ import annotations
from dataclasses import dataclass
from typing import Optional
import pandas as pd


@dataclass
class Signal:
    action: str  # "buy", "sell", "close"
    size: float = 1.0
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None


class BaseStrategy:
    """Base class all generated strategies must extend."""

    def __init__(self, params: dict):
        self.params = params

    def on_bar(self, bar: dict, history: pd.DataFrame) -> Optional[Signal]:
        """Called for each bar. Return a Signal or None."""
        raise NotImplementedError
