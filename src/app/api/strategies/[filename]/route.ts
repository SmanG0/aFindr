import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://127.0.0.1:8000";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;
  try {
    const res = await fetch(`${BACKEND_URL}/strategies/${encodeURIComponent(filename)}`, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json({ error: "Strategy not found" }, { status: 404 });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Failed to fetch strategy" }, { status: 500 });
  }
}
