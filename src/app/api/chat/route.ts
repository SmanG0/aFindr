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
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to connect to backend", message: String(err) },
      { status: 502 }
    );
  }
}
