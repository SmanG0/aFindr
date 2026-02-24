"""Container-side strategy executor.

Receives strategy code via a mounted file, executes it against
provided OHLCV data, and writes JSON results to stdout.

This runs inside the Docker sandbox with no network access.
"""
import json
import sys
import traceback


def main():
    """Read input, execute strategy, write results."""
    try:
        # Read input from stdin
        input_data = json.loads(sys.stdin.read())
        code = input_data["code"]
        params = input_data.get("params", {})
        data_json = input_data["data"]  # Serialized OHLCV
        config = input_data.get("config", {})

        import pandas as pd
        import numpy as np

        # Reconstruct DataFrame
        df = pd.DataFrame(data_json)
        if "time" in df.columns:
            df.index = pd.to_datetime(df["time"], unit="s")
            df = df.drop(columns=["time"])

        # Execute strategy code
        namespace = {}
        exec(code, namespace)

        # Find strategy class
        strategy_class = None

        # Try VectorBTStrategy first
        try:
            from engine.vbt_strategy import VectorBTStrategy
            for val in namespace.values():
                if isinstance(val, type) and issubclass(val, VectorBTStrategy) and val is not VectorBTStrategy:
                    strategy_class = val
                    break
        except ImportError:
            pass

        if not strategy_class:
            # Try BaseStrategy
            try:
                from engine.strategy import BaseStrategy
                for val in namespace.values():
                    if isinstance(val, type) and issubclass(val, BaseStrategy) and val is not BaseStrategy:
                        strategy_class = val
                        break
            except ImportError:
                pass

        if not strategy_class:
            print(json.dumps({"error": "No strategy class found in code"}))
            return

        strategy = strategy_class(params)

        # Check if it's a VBT strategy
        is_vbt = hasattr(strategy, "generate_signals")

        if is_vbt:
            signals = strategy.generate_signals(df)
            print(json.dumps({
                "type": "vbt",
                "entries": signals.entries.tolist(),
                "exits": signals.exits.tolist(),
                "short_entries": signals.short_entries.tolist() if signals.short_entries is not None else None,
                "short_exits": signals.short_exits.tolist() if signals.short_exits is not None else None,
            }))
        else:
            # Bar-by-bar execution
            trades = []
            for i in range(len(df)):
                bar = {
                    "time": int(df.index[i].timestamp()) if hasattr(df.index[i], "timestamp") else i,
                    "open": float(df.iloc[i]["open"]),
                    "high": float(df.iloc[i]["high"]),
                    "low": float(df.iloc[i]["low"]),
                    "close": float(df.iloc[i]["close"]),
                    "volume": float(df.iloc[i]["volume"]),
                }
                history = df.iloc[:i + 1]
                signal = strategy.on_bar(bar, history)
                if signal:
                    trades.append({
                        "bar_index": i,
                        "action": signal.action,
                        "size": signal.size,
                        "stop_loss": signal.stop_loss,
                        "take_profit": signal.take_profit,
                    })

            print(json.dumps({"type": "classic", "signals": trades}))

    except Exception as e:
        print(json.dumps({
            "error": str(e),
            "traceback": traceback.format_exc(),
        }))


if __name__ == "__main__":
    main()
