import { NextRequest, NextResponse } from "next/server";

const FASTAPI_URL = process.env.FASTAPI_URL || "http://127.0.0.1:8000";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Map frontend field names to backend field names
    const backendBody = {
      message: body.message,
      symbol: body.symbol || "NQ=F",
      period: "1y",
      interval: body.timeframe || "1d",
      initial_balance: body.initialBalance || 50000.0,
      conversation_history: (body.conversationHistory || []).map(
        (m: { role: string; content: string }) => ({
          role: m.role,
          content: m.content,
        })
      ),
    };

    const res = await fetch(`${FASTAPI_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(backendBody),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `Backend error: ${res.status}`, message: text },
        { status: res.status }
      );
    }

    const data = await res.json();

    // Map snake_case backend fields to camelCase frontend fields
    if (data.backtest_result && !data.backtestResult) {
      data.backtestResult = data.backtest_result;
    }
    if (data.chart_script && !data.chartScript) {
      data.chartScript = data.chart_script;
    }
    if (data.trade_analysis && !data.tradeAnalysis) {
      data.tradeAnalysis = data.trade_analysis;
    }
    if (data.walk_forward && !data.walkForward) {
      data.walkForward = data.walk_forward;
    }
    if (data.monte_carlo && !data.monteCarlo) {
      data.monteCarlo = data.monte_carlo;
    }

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to connect to backend", message: String(err) },
      { status: 502 }
    );
  }
}
