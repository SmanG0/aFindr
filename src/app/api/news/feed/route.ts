import { NextRequest, NextResponse } from "next/server";

const FASTAPI_URL = process.env.FASTAPI_URL || "http://127.0.0.1:8000";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const params = new URLSearchParams();

    const category = searchParams.get("category");
    const ticker = searchParams.get("ticker");
    const source = searchParams.get("source");
    const limit = searchParams.get("limit");

    if (category) params.set("category", category);
    if (ticker) params.set("ticker", ticker);
    if (source) params.set("source", source);
    if (limit) params.set("limit", limit);

    const url = `${FASTAPI_URL}/api/news/feed?${params.toString()}`;
    const res = await fetch(url);

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `Backend error: ${res.status}`, detail: text },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to connect to backend", detail: String(err) },
      { status: 502 }
    );
  }
}
