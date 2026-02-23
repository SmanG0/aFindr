CONTRACTS = {
    "NQ=F": {"symbol": "NQ=F", "name": "NQ (Nasdaq 100)", "point_value": 20, "tick_size": 0.25},
    "MNQ=F": {"symbol": "MNQ=F", "name": "MNQ (Micro Nasdaq)", "point_value": 2, "tick_size": 0.25},
    "ES=F": {"symbol": "ES=F", "name": "ES (S&P 500)", "point_value": 50, "tick_size": 0.25},
    "GC=F": {"symbol": "GC=F", "name": "GC (Gold)", "point_value": 100, "tick_size": 0.10},
    "CL=F": {"symbol": "CL=F", "name": "CL (Crude Oil)", "point_value": 1000, "tick_size": 0.01},
}


def get_contract_config(symbol: str) -> dict:
    if symbol not in CONTRACTS:
        raise ValueError(f"Unknown contract: {symbol}. Available: {list(CONTRACTS.keys())}")
    return CONTRACTS[symbol]
