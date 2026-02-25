import { NextRequest } from "next/server";

const FASTAPI_URL = process.env.FASTAPI_URL || "http://127.0.0.1:8000";

// Force Node.js runtime for proper streaming support
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * SSE proxy — forwards the streaming chat request to the FastAPI backend
 * and pipes the SSE event stream directly to the client.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const backendRes = await fetch(`${FASTAPI_URL}/api/chat/stream`, {
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
        active_scripts: body.active_scripts || undefined,
        user_profile: body.user_profile || undefined,
      }),
      cache: "no-store",
    });

    if (!backendRes.ok) {
      const text = await backendRes.text();
      return new Response(
        `event: error\ndata: ${JSON.stringify({ error: `Backend error: ${backendRes.status}`, detail: text })}\n\n`,
        {
          status: 200,
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
          },
        }
      );
    }

    // Manually pipe the backend SSE stream to avoid Next.js buffering
    const backendBody = backendRes.body;
    if (!backendBody) {
      return new Response(
        `event: error\ndata: ${JSON.stringify({ error: "No response body from backend" })}\n\n`,
        { status: 200, headers: { "Content-Type": "text/event-stream" } }
      );
    }

    const stream = new ReadableStream({
      async start(controller) {
        const reader = backendBody.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
        } catch {
          // Stream closed or errored
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
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
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      }
    );
  }
}
