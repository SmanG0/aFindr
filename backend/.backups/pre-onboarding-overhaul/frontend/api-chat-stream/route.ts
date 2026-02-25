import { NextRequest } from "next/server";

const FASTAPI_URL = process.env.FASTAPI_URL || "http://127.0.0.1:8000";

/**
 * SSE proxy — forwards the streaming chat request to the FastAPI backend
 * and pipes the SSE event stream directly to the client.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const res = await fetch(`${FASTAPI_URL}/api/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: body.message,
        symbol: body.symbol || "NQ=F",
        period: body.period || "1y",
        interval: body.interval || "1d",
        initial_balance: body.initial_balance || 25000.0,
        conversation_history: body.conversation_history || [],
        require_approval: body.require_approval || false,
        current_page: body.current_page || undefined,
        news_headlines: body.news_headlines || undefined,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return new Response(
        `event: error\ndata: ${JSON.stringify({ error: `Backend error: ${res.status}`, detail: text })}\n\n`,
        {
          status: 200,
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        }
      );
    }

    // Pipe the SSE stream from FastAPI directly to the client
    return new Response(res.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    return new Response(
      `event: error\ndata: ${JSON.stringify({ error: "Failed to connect to backend", detail: String(err) })}\n\n`,
      {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      }
    );
  }
}
