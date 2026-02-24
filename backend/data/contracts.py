CONTRACTS = {
    "NQ=F": {"symbol": "NQ=F", "name": "NQ (Nasdaq 100)", "point_value": 20, "tick_size": 0.25},
    "MNQ=F": {"symbol": "MNQ=F", "name": "MNQ (Micro Nasdaq)", "point_value": 2, "tick_size": 0.25},
    "ES=F": {"symbol": "ES=F", "name": "ES (S&P 500)", "point_value": 50, "tick_size": 0.25},
    "GC=F": {"symbol": "GC=F", "name": "GC (Gold)", "point_value": 100, "tick_size": 0.10},
    "CL=F": {"symbol": "CL=F", "name": "CL (Crude Oil)", "point_value": 1000, "tick_size": 0.01},
}

# Stock defaults: 1 share = 1 unit, $0.01 tick size
STOCK_DEFAULT = {"point_value": 1, "tick_size": 0.01}


def get_contract_config(symbol: str) -> dict:
    """Get contract config for futures or stocks.

    Known futures return their specific point_value and tick_size.
    Unknown symbols (stocks) return stock defaults (point_value=1, tick_size=0.01).
    """
    if symbol in CONTRACTS:
        return CONTRACTS[symbol]

    # Treat unknown symbols as stocks
    return {
        "symbol": symbol,
        "name": symbol,
        "point_value": STOCK_DEFAULT["point_value"],
        "tick_size": STOCK_DEFAULT["tick_size"],
    }
