"""aFindr Chart Palette — canonical colors and styles for chart overlays.

Single source of truth for all ICT/SMC visual properties.
Every detection function imports from here -- no hardcoded colors anywhere else.
"""

# ─── Core Directional Colors ───
BULL = "#089981"       # teal-green (general bullish)
BEAR = "#f23645"       # red (general bearish)

# ─── Fair Value Gaps ───
FVG = {
    "bull": {"color": "#4caf50", "opacity_active": 0.20, "opacity_filled": 0.06, "label": "FVG"},
    "bear": {"color": "#f23645", "opacity_active": 0.20, "opacity_filled": 0.06, "label": "FVG"},
}

# ─── Order Blocks ───
OB = {
    "bull":     {"color": "#2157f3", "opacity": 0.20, "label": "OB"},
    "bear":     {"color": "#ff5d00", "opacity": 0.20, "label": "OB"},
    "midline":  {"color": "#9598a1", "width": 1, "style": "dashed"},
}

# ─── Breaker Blocks (converted from mitigated OBs -- colors FLIP) ───
BB = {
    "bull": {"color": "#0cb51a", "opacity": 0.20, "label": "BB"},   # former bear OB
    "bear": {"color": "#ff1100", "opacity": 0.20, "label": "BB"},   # former bull OB
}

# ─── BOS / CHoCH (Structure) ───
STRUCTURE = {
    "bull": {"color": "#26a69a", "width": 1, "style": "dashed"},  # teal
    "bear": {"color": "#ef5350", "width": 1, "style": "dashed"},  # red
    "bos_label": "BOS",
    "choch_label": "CHoCH",
}

# ─── Liquidity Sweeps ───
SWEEP = {
    "marker_color": "#ffeb3b",       # yellow
    "line_color": "#ffeb3b80",       # yellow 50% alpha
    "line_style": "dashed",
    "line_width": 1,
    "marker_text": "Sweep",
}

# ─── Swing Points ───
SWING = {
    "HH": {"color": "#089981", "shape": "arrowDown", "position": "aboveBar"},
    "HL": {"color": "#089981", "shape": "arrowUp",   "position": "belowBar"},
    "LH": {"color": "#f23645", "shape": "arrowDown", "position": "aboveBar"},
    "LL": {"color": "#f23645", "shape": "arrowUp",   "position": "belowBar"},
    "unknown": {"color": "#9598a1"},
}

# ─── Killzone Sessions (ET -> UTC) ───
KILLZONE = {
    "asian":  {"color": "#e91e63", "opacity": 0.10, "label": "Asian",  "utc_start": (1, 0),  "utc_end": (5, 0)},
    "london": {"color": "#00bcd4", "opacity": 0.10, "label": "London", "utc_start": (7, 0),  "utc_end": (10, 0)},
    "ny_am":  {"color": "#ff5d00", "opacity": 0.10, "label": "NY AM",  "utc_start": (13, 30), "utc_end": (16, 0)},
    "ny_pm":  {"color": "#2157f3", "opacity": 0.10, "label": "NY PM",  "utc_start": (18, 30), "utc_end": (21, 0)},
}

# ─── Session Levels (PDH/PDL/PDO/PDC) ───
SESSION_LEVELS = {
    "prev_day":  {"color": "#f59e0b", "style": "dashed", "width": 1},  # amber
    "prev_week": {"color": "#f59e0b", "style": "dashed", "width": 1},
    "session":   {"color": "#00bcd4", "style": "dashed", "width": 1},  # cyan for session-specific
}

# ─── Support / Resistance ───
SR = {
    "support":    {"color": "#089981"},
    "resistance": {"color": "#f23645"},
}

# ─── Volume Profile ───
VOLUME_PROFILE = {
    "poc":       {"color": "#ff9800", "style": "solid", "width": 2},   # orange
    "vah_val":   {"color": "#ff980080", "style": "dashed", "width": 1},
    "area_box":  {"color": "#ff9800", "opacity": 0.06},
}

# ─── Divergences ───
DIVERGENCE = {
    "rsi_bull":    {"color": "#089981"},
    "rsi_bear":    {"color": "#f23645"},
    "hidden":      {"color": "#ff9800"},   # orange for hidden divs
    "macd":        {"color": "#7b1fa2"},   # purple
}

# ─── Volume Spikes ───
VOLUME_SPIKE = {
    "bull": {"color": "#089981"},
    "bear": {"color": "#f23645"},
}
