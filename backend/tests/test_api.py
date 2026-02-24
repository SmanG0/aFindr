"""Tests for FastAPI endpoints using httpx AsyncClient."""

import pytest
import pytest_asyncio
import httpx
from main import app


@pytest_asyncio.fixture
async def client(temp_db):
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


# ── Health & Strategies ──────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_health(client):
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_strategies_list(client):
    resp = await client.get("/api/strategies")
    assert resp.status_code == 200
    data = resp.json()
    assert "strategies" in data
    assert isinstance(data["strategies"], list)


@pytest.mark.asyncio
async def test_presets_list(client):
    resp = await client.get("/api/strategies/presets")
    assert resp.status_code == 200
    data = resp.json()
    assert "presets" in data
    assert isinstance(data["presets"], list)
    assert data["count"] == 10


@pytest.mark.asyncio
async def test_presets_get(client):
    resp = await client.get("/api/strategies/presets/1")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == 1


@pytest.mark.asyncio
async def test_presets_get_not_found(client):
    resp = await client.get("/api/strategies/presets/99")
    assert resp.status_code == 200
    data = resp.json()
    assert "error" in data


# ── Trading ──────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_trading_positions(client):
    resp = await client.get("/api/trading/positions")
    assert resp.status_code == 200
    data = resp.json()
    assert "positions" in data
    assert isinstance(data["positions"], list)


# ── Export ───────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_export_trades_csv(client):
    resp = await client.get("/api/export/trades/csv")
    assert resp.status_code == 200
    assert "text/csv" in resp.headers.get("content-type", "")


# ── Backtest Runs ────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_backtest_runs_list(client):
    resp = await client.get("/api/strategies/backtest-runs")
    assert resp.status_code == 200
    data = resp.json()
    assert "runs" in data
    assert isinstance(data["runs"], list)
