"""Integration pipeline tests: preset backtest + Monte Carlo, walk-forward."""

from engine.preset_strategies import PRESET_STRATEGIES
from engine.backtester import Backtester
from engine.monte_carlo import run_monte_carlo
from engine.walk_forward import run_walk_forward
from db import backtest_repo


def test_full_preset_pipeline(sample_ohlcv_data, backtest_config, temp_db):
    # Pick first preset (EMA Crossover)
    preset = PRESET_STRATEGIES[0]
    strategy = preset["class"](preset["default_params"])
    bt = Backtester(strategy, sample_ohlcv_data, backtest_config)
    result = bt.run()

    # Run Monte Carlo on trade PnLs
    pnls = [t["pnl"] for t in result.trades]
    assert len(pnls) > 0
    mc = run_monte_carlo(pnls, 50000, num_simulations=100, seed=42)
    assert mc.num_simulations == 100

    # Persist backtest run with Monte Carlo results
    run_id = backtest_repo.insert_backtest_run(
        strategy_name=preset["name"],
        symbol="NQ=F",
        interval="1d",
        trades=result.trades,
        metrics=result.metrics,
        equity_curve=result.equity_curve,
        monte_carlo=mc.to_dict(),
        initial_balance=50000,
        run_type="preset",
    )

    # Retrieve and verify
    stored = backtest_repo.get_backtest_run(run_id)
    assert stored is not None
    assert stored["strategy_name"] == preset["name"]
    assert stored["metrics"]["total_trades"] == result.metrics["total_trades"]

    stored_trades = backtest_repo.get_backtest_trades(run_id)
    assert len(stored_trades) == len(result.trades)


def test_walk_forward_pipeline(sample_ohlcv_data, backtest_config, temp_db):
    preset = PRESET_STRATEGIES[0]
    result = run_walk_forward(
        strategy_class=preset["class"],
        data=sample_ohlcv_data,
        config=backtest_config,
        param_grid={"fast_period": [5, 9], "slow_period": [20, 30]},
        num_windows=3,
    )
    assert result.num_windows > 0
    assert result.robustness_ratio >= 0

    # Persist the walk-forward run
    run_id = backtest_repo.insert_backtest_run(
        strategy_name="WF: EMA Crossover",
        symbol="NQ=F",
        interval="1d",
        trades=result.oos_trades,
        metrics=result.aggregate_oos_metrics,
        initial_balance=50000,
        run_type="walk_forward",
    )
    wf_id = backtest_repo.insert_walk_forward_result(
        backtest_run_id=run_id,
        num_windows=result.num_windows,
        is_ratio=result.is_ratio,
        robustness_ratio=result.robustness_ratio,
        windows=result.to_dict()["windows"],
        aggregate_oos_metrics=result.aggregate_oos_metrics,
    )

    # Retrieve and verify
    stored = backtest_repo.get_walk_forward_results(run_id)
    assert stored is not None
    assert stored["robustness_ratio"] == result.robustness_ratio
