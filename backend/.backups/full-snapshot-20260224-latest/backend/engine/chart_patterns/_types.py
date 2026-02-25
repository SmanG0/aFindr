"""Shared dataclasses for chart pattern detection."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class SwingPoint:
    """A detected swing high or low."""
    index: int               # Bar index in the DataFrame
    price: float             # High (for swing high) or Low (for swing low)
    timestamp: int           # Unix seconds
    type: str                # "high" or "low"
    classification: str = "" # "HH", "HL", "LH", "LL" (set after sequence analysis)


@dataclass
class ChartElement:
    """A single visual element to render on the chart."""
    type: str                # "hline", "vline", "box", "marker", "label", "line"
    id: str
    props: dict = field(default_factory=dict)  # All visual properties


@dataclass
class ChartPatternResult:
    """Return type for all pattern detection functions."""
    pattern_type: str                           # e.g. "fvg", "order_blocks"
    elements: List[ChartElement] = field(default_factory=list)
    metadata: dict = field(default_factory=dict)  # counts, caps, params used

    def to_chart_script(self, name: str, script_id: str) -> dict:
        """Convert to the chart_script format the frontend expects."""
        raw_elements = []
        for el in self.elements:
            entry = {"type": el.type, "id": el.id}
            entry.update(el.props)
            raw_elements.append(entry)

        return {
            "id": script_id,
            "name": name,
            "visible": True,
            "elements": raw_elements,
            "generators": [],
        }
