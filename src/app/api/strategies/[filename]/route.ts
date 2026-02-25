import { NextRequest, NextResponse } from "next/server";

const FASTAPI_URL = process.env.FASTAPI_URL || "http://127.0.0.1:8000";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;
  try {
    const headers: Record<string, string> = {};

    // Forward Convex auth token to FastAPI
    const token = _req.cookies.get("__convexAuthJWT")?.value;
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(`${FASTAPI_URL}/api/strategies/${encodeURIComponent(filename)}`, {
      cache: "no-store",
      headers,
    });
    if (!res.ok) {
      return NextResponse.json({ error: "Strategy not found" }, { status: 404 });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Failed to fetch strategy" }, { status: 500 });
  }
}
