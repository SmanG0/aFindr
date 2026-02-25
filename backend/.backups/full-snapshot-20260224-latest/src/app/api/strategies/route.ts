import { NextResponse } from "next/server";

const FASTAPI_URL = process.env.FASTAPI_URL || "http://127.0.0.1:8000";

interface BackendStrategy {
  filename: string;
  name: string;
  description: string;
  symbol: string;
  interval: string;
  created_at: string;
  has_backtest: boolean;
  has_monte_carlo: boolean;
  has_walk_forward?: boolean;
}

export async function GET() {
  try {
    const res = await fetch(`${FASTAPI_URL}/api/strategies`, {
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json({ strategies: [] }, { status: 200 });
    }
    const data = await res.json();
    // Map snake_case backend fields to camelCase frontend fields
    const strategies = (data.strategies || []).map((s: BackendStrategy) => ({
      filename: s.filename,
      name: s.name,
      description: s.description || "",
      symbol: s.symbol || "",
      interval: s.interval || "",
      date: s.created_at ? new Date(s.created_at).toLocaleDateString() : "",
      hasBacktest: s.has_backtest ?? false,
      hasMonteCarlo: s.has_monte_carlo ?? false,
      hasWalkForward: s.has_walk_forward ?? false,
    }));
    return NextResponse.json({ strategies });
  } catch {
    return NextResponse.json({ strategies: [] }, { status: 200 });
  }
}
