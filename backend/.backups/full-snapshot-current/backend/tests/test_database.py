"""Tests for database repositories: backtest_repo and trades_repo."""

from db import backtest_repo, trades_repo


# ── backtest_repo ────────────────────────────────────────────────────────────


def test_insert_and_list_backtest_run(temp_db):
    run_id = backtest_repo.insert_backtest_run(
        strategy_name="Test Strategy",
        symbol="NQ=F",
        interval="1d",
        trades=[
            {
                "side": "long",
                "size": 1,
                "entry_price": 20000,
                "exit_price": 20100,
                "entry_time": 1000,
                "exit_time": 2000,
                "pnl": 2000,
                "pnl_points": 100,
                "commission": 5,
            }
        ],
        metrics={"total_trades": 1, "win_rate": 1.0},
        initial_balance=50000,
        run_type="backtest",
    )
    assert run_id is not None

    runs = backtest_repo.list_backtest_runs()
    assert len(runs) >= 1
    assert any(r["id"] == run_id for r in runs)


def test_get_backtest_run(temp_db):
    run_id = backtest_repo.insert_backtest_run(
        strategy_name="Test Strategy",
        symbol="NQ=F",
        interval="1d",
        trades=[
            {
                "side": "long",
                "size": 1,
                "entry_price": 20000,
                "exit_price": 20100,
                "entry_time": 1000,
                "exit_time": 2000,
                "pnl": 2000,
                "pnl_points": 100,
                "commission": 5,
            }
        ],
        metrics={"total_trades": 1, "win_rate": 1.0},
        initial_balance=50000,
        run_type="backtest",
    )

    result = backtest_repo.get_backtest_run(run_id)
    assert result is not None
    assert result["strategy_name"] == "Test Strategy"
    assert result["symbol"] == "NQ=F"
    assert result["metrics"]["total_trades"] == 1
    assert result["metrics"]["win_rate"] == 1.0


def test_get_backtest_trades(temp_db):
    trades_data = [
        {
            "side": "long",
            "size": 1,
            "entry_price": 20000,
            "exit_price": 20100,
            "entry_time": 1000,
            "exit_time": 2000,
            "pnl": 2000,
            "pnl_points": 100,
            "commission": 5,
        }
    ]
    run_id = backtest_repo.insert_backtest_run(
        strategy_name="Test Strategy",
        symbol="NQ=F",
        interval="1d",
        trades=trades_data,
        metrics={"total_trades": 1, "win_rate": 1.0},
        initial_balance=50000,
        run_type="backtest",
    )

    stored_trades = backtest_repo.get_backtest_trades(run_id)
    assert len(stored_trades) == 1
    assert stored_trades[0]["side"] == "long"
    assert stored_trades[0]["entry_price"] == 20000


def test_insert_walk_forward_result(temp_db):
    run_id = backtest_repo.insert_backtest_run(
        strategy_name="WF Strategy",
        symbol="NQ=F",
        interval="1d",
        trades=[
            {
                "side": "long",
                "size": 1,
                "entry_price": 20000,
                "exit_price": 20100,
                "entry_time": 1000,
                "exit_time": 2000,
                "pnl": 2000,
                "pnl_points": 100,
                "commission": 5,
            }
        ],
        metrics={"total_trades": 1, "win_rate": 1.0},
        initial_balance=50000,
        run_type="walk_forward",
    )

    wf_id = backtest_repo.insert_walk_forward_result(
        backtest_run_id=run_id,
        num_windows=3,
        is_ratio=0.85,
        robustness_ratio=0.72,
        windows=[{"window": 1, "is_pnl": 500, "oos_pnl": 360}],
        aggregate_oos_metrics={"total_trades": 1, "win_rate": 1.0},
    )
    assert wf_id is not None


def test_get_walk_forward_results(temp_db):
    run_id = backtest_repo.insert_backtest_run(
        strategy_name="WF Strategy",
        symbol="NQ=F",
        interval="1d",
        trades=[
            {
                "side": "long",
                "size": 1,
                "entry_price": 20000,
                "exit_price": 20100,
                "entry_time": 1000,
                "exit_time": 2000,
                "pnl": 2000,
                "pnl_points": 100,
                "commission": 5,
            }
        ],
        metrics={"total_trades": 1, "win_rate": 1.0},
        initial_balance=50000,
        run_type="walk_forward",
    )

    backtest_repo.insert_walk_forward_result(
        backtest_run_id=run_id,
        num_windows=3,
        is_ratio=0.85,
        robustness_ratio=0.72,
        windows=[{"window": 1, "is_pnl": 500, "oos_pnl": 360}],
        aggregate_oos_metrics={"total_trades": 1, "win_rate": 1.0},
    )

    result = backtest_repo.get_walk_forward_results(run_id)
    assert result is not None
    assert result["num_windows"] == 3
    assert result["robustness_ratio"] == 0.72


# ── trades_repo ──────────────────────────────────────────────────────────────


def test_insert_and_get_position(temp_db):
    trades_repo.insert_position(
        {
            "id": "pos_1",
            "symbol": "NQ=F",
            "side": "long",
            "size": 1,
            "entry_price": 20000,
            "entry_time": 1000,
            "source": "manual",
        }
    )

    positions = trades_repo.get_open_positions()
    assert len(positions) >= 1
    assert any(p["id"] == "pos_1" for p in positions)


def test_delete_position(temp_db):
    trades_repo.insert_position(
        {
            "id": "pos_1",
            "symbol": "NQ=F",
            "side": "long",
            "size": 1,
            "entry_price": 20000,
            "entry_time": 1000,
            "source": "manual",
        }
    )

    deleted = trades_repo.delete_position("pos_1")
    assert deleted is not None
    assert deleted["id"] == "pos_1"

    positions = trades_repo.get_open_positions()
    assert not any(p["id"] == "pos_1" for p in positions)


def test_trade_analytics(temp_db):
    trades_repo.insert_trade(
        {
            "id": "t1",
            "symbol": "NQ=F",
            "side": "long",
            "size": 1,
            "entry_price": 20000,
            "exit_price": 20100,
            "entry_time": 1000,
            "exit_time": 2000,
            "pnl": 100,
            "pnl_points": 5,
            "commission": 5,
            "source": "manual",
        }
    )

    analytics = trades_repo.get_trade_analytics()
    assert analytics is not None
    assert analytics["total_trades"] >= 1
