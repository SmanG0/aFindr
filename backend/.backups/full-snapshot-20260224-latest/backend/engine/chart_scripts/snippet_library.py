"""Chart Script Snippet Library — pre-built overlays for common chart visuals.

Alphy can call apply_chart_snippet("ny_open") instead of generating
verbose JSON every time. This reduces token usage and ensures consistent styling.
"""
from __future__ import annotations

import copy
import uuid
from typing import Any

# ─── Snippet Catalog ───

SNIPPET_CATALOG: dict[str, dict[str, Any]] = {
    # ── Session Markers (generator-based) ──
    "ny_open": {
        "name": "NY Open",
        "category": "sessions",
        "description": "Vertical lines at NY market open (9:30 AM ET / 14:30 UTC)",
        "elements": [],
        "generators": [
            {
                "type": "session_vlines",
                "hour": 14,
                "minute": 30,
                "label": "NY Open",
                "color": "#ff5d00",
                "width": 1,
                "style": "dashed",
            }
        ],
    },
    "ny_close": {
        "name": "NY Close",
        "category": "sessions",
        "description": "Vertical lines at NY market close (4:00 PM ET / 21:00 UTC)",
        "elements": [],
        "generators": [
            {
                "type": "session_vlines",
                "hour": 21,
                "minute": 0,
                "label": "NY Close",
                "color": "#f23645",
                "width": 1,
                "style": "dashed",
            }
        ],
    },
    "london_open": {
        "name": "London Open",
        "category": "sessions",
        "description": "Vertical lines at London market open (8:00 AM GMT / 08:00 UTC)",
        "elements": [],
        "generators": [
            {
                "type": "session_vlines",
                "hour": 8,
                "minute": 0,
                "label": "London Open",
                "color": "#00bcd4",
                "width": 1,
                "style": "dashed",
            }
        ],
    },
    "asian_open": {
        "name": "Asian Open",
        "category": "sessions",
        "description": "Vertical lines at Asian session open (7:00 PM ET / 00:00 UTC)",
        "elements": [],
        "generators": [
            {
                "type": "session_vlines",
                "hour": 0,
                "minute": 0,
                "label": "Asian Open",
                "color": "#e91e63",
                "width": 1,
                "style": "dashed",
            }
        ],
    },
    "midnight_open": {
        "name": "Midnight Open",
        "category": "sessions",
        "description": "Vertical lines at Midnight ET (05:00 UTC)",
        "elements": [],
        "generators": [
            {
                "type": "session_vlines",
                "hour": 5,
                "minute": 0,
                "label": "Midnight Open",
                "color": "#7b1fa2",
                "width": 1,
                "style": "dashed",
            }
        ],
    },
    "prev_day_levels": {
        "name": "Previous Day Levels",
        "category": "levels",
        "description": "PDH / PDL / PDO / PDC rays from previous trading day",
        "elements": [],
        "generators": [
            {
                "type": "prev_day_levels",
                "color": "#f59e0b",
                "width": 1,
                "style": "dashed",
            }
        ],
    },

    # ── Combo Snippets (multiple generators) ──
    "all_sessions": {
        "name": "All Session Opens",
        "category": "sessions",
        "description": "NY + London + Asian session open lines combined",
        "elements": [],
        "generators": [
            {"type": "session_vlines", "hour": 14, "minute": 30, "label": "NY Open", "color": "#ff5d00", "width": 1, "style": "dashed"},
            {"type": "session_vlines", "hour": 8, "minute": 0, "label": "London Open", "color": "#00bcd4", "width": 1, "style": "dashed"},
            {"type": "session_vlines", "hour": 0, "minute": 0, "label": "Asian Open", "color": "#e91e63", "width": 1, "style": "dashed"},
        ],
    },
    "ict_time_framework": {
        "name": "ICT Time Framework",
        "category": "combo",
        "description": "All session opens + midnight open + previous day levels",
        "elements": [],
        "generators": [
            {"type": "session_vlines", "hour": 14, "minute": 30, "label": "NY Open", "color": "#ff5d00", "width": 1, "style": "dashed"},
            {"type": "session_vlines", "hour": 8, "minute": 0, "label": "London Open", "color": "#00bcd4", "width": 1, "style": "dashed"},
            {"type": "session_vlines", "hour": 0, "minute": 0, "label": "Asian Open", "color": "#e91e63", "width": 1, "style": "dashed"},
            {"type": "session_vlines", "hour": 5, "minute": 0, "label": "Midnight Open", "color": "#7b1fa2", "width": 1, "style": "dashed"},
            {"type": "prev_day_levels", "color": "#f59e0b", "width": 1, "style": "dashed"},
        ],
    },

    # ── Killzone Shading (new generator type) ──
    "kz_asian": {
        "name": "Asian Killzone",
        "category": "killzones",
        "description": "Asian killzone shading (01:00-05:00 UTC)",
        "elements": [],
        "generators": [
            {
                "type": "killzone_shades",
                "sessions": [
                    {"name": "Asian KZ", "utcStartHour": 1, "utcStartMinute": 0, "utcEndHour": 5, "utcEndMinute": 0, "color": "#e91e63", "opacity": 0.10},
                ],
            }
        ],
    },
    "kz_london": {
        "name": "London Killzone",
        "category": "killzones",
        "description": "London killzone shading (07:00-10:00 UTC)",
        "elements": [],
        "generators": [
            {
                "type": "killzone_shades",
                "sessions": [
                    {"name": "London KZ", "utcStartHour": 7, "utcStartMinute": 0, "utcEndHour": 10, "utcEndMinute": 0, "color": "#00bcd4", "opacity": 0.10},
                ],
            }
        ],
    },
    "kz_ny_am": {
        "name": "NY AM Killzone",
        "category": "killzones",
        "description": "NY AM killzone shading (13:30-16:00 UTC)",
        "elements": [],
        "generators": [
            {
                "type": "killzone_shades",
                "sessions": [
                    {"name": "NY AM KZ", "utcStartHour": 13, "utcStartMinute": 30, "utcEndHour": 16, "utcEndMinute": 0, "color": "#ff5d00", "opacity": 0.10},
                ],
            }
        ],
    },
    "kz_ny_pm": {
        "name": "NY PM Killzone",
        "category": "killzones",
        "description": "NY PM killzone shading (18:30-21:00 UTC)",
        "elements": [],
        "generators": [
            {
                "type": "killzone_shades",
                "sessions": [
                    {"name": "NY PM KZ", "utcStartHour": 18, "utcStartMinute": 30, "utcEndHour": 21, "utcEndMinute": 0, "color": "#2157f3", "opacity": 0.10},
                ],
            }
        ],
    },
    "kz_all": {
        "name": "All Killzones",
        "category": "killzones",
        "description": "Asian + London + NY AM + NY PM killzone shading",
        "elements": [],
        "generators": [
            {
                "type": "killzone_shades",
                "sessions": [
                    {"name": "Asian KZ", "utcStartHour": 1, "utcStartMinute": 0, "utcEndHour": 5, "utcEndMinute": 0, "color": "#e91e63", "opacity": 0.10},
                    {"name": "London KZ", "utcStartHour": 7, "utcStartMinute": 0, "utcEndHour": 10, "utcEndMinute": 0, "color": "#00bcd4", "opacity": 0.10},
                    {"name": "NY AM KZ", "utcStartHour": 13, "utcStartMinute": 30, "utcEndHour": 16, "utcEndMinute": 0, "color": "#ff5d00", "opacity": 0.10},
                    {"name": "NY PM KZ", "utcStartHour": 18, "utcStartMinute": 30, "utcEndHour": 21, "utcEndMinute": 0, "color": "#2157f3", "opacity": 0.10},
                ],
            }
        ],
    },

    # ── Style Presets (color configs for reference) ──
    "style_fvg": {
        "name": "FVG Style",
        "category": "styles",
        "description": "Fair Value Gap color preset — bull green / bear red boxes",
        "elements": [],
        "generators": [],
        "style_config": {
            "bull": {"color": "#4caf50", "opacity": 0.20},
            "bear": {"color": "#f23645", "opacity": 0.20},
        },
    },
    "style_order_blocks": {
        "name": "Order Block Style",
        "category": "styles",
        "description": "Order Block color preset — bull blue / bear orange boxes",
        "elements": [],
        "generators": [],
        "style_config": {
            "bull": {"color": "#2157f3", "opacity": 0.20},
            "bear": {"color": "#ff5d00", "opacity": 0.20},
        },
    },
    "style_structure": {
        "name": "Structure Style",
        "category": "styles",
        "description": "BOS/CHoCH line styles — bull teal / bear red dashed",
        "elements": [],
        "generators": [],
        "style_config": {
            "bull": {"color": "#26a69a", "width": 1, "style": "dashed"},
            "bear": {"color": "#ef5350", "width": 1, "style": "dashed"},
        },
    },
    "style_sweeps": {
        "name": "Sweep Style",
        "category": "styles",
        "description": "Liquidity sweep marker/line styles — yellow markers + dashed lines",
        "elements": [],
        "generators": [],
        "style_config": {
            "marker_color": "#ffeb3b",
            "line_color": "#ffeb3b80",
            "line_style": "dashed",
        },
    },
}


def get_snippet(template: str) -> dict[str, Any] | None:
    """Look up a snippet by template name (case-insensitive)."""
    return SNIPPET_CATALOG.get(template.lower())


def build_chart_script(
    template: str,
    color: str | None = None,
    style: str | None = None,
    visible: bool = True,
) -> dict[str, Any] | None:
    """Build a ready-to-render ChartScript from a snippet template.

    Optionally override default color and line style.
    """
    snippet = get_snippet(template)
    if snippet is None:
        return None

    script_id = f"snip_{uuid.uuid4().hex[:8]}"
    elements = copy.deepcopy(snippet.get("elements", []))
    generators = copy.deepcopy(snippet.get("generators", []))

    # Apply color/style overrides
    if color:
        for el in elements:
            el["color"] = color
        for gen in generators:
            if gen.get("type") == "killzone_shades":
                for sess in gen.get("sessions", []):
                    sess["color"] = color
            else:
                gen["color"] = color

    if style and style in ("solid", "dashed", "dotted"):
        for el in elements:
            if "style" in el:
                el["style"] = style
        for gen in generators:
            if "style" in gen:
                gen["style"] = style

    return {
        "id": script_id,
        "name": snippet["name"],
        "visible": visible,
        "elements": elements,
        "generators": generators,
    }


def list_snippets() -> list[dict[str, str]]:
    """Return catalog metadata (no elements/generators — just names and descriptions)."""
    result = []
    for key, snippet in SNIPPET_CATALOG.items():
        result.append({
            "template": key,
            "name": snippet["name"],
            "category": snippet["category"],
            "description": snippet["description"],
        })
    return result
