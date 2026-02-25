import { NextRequest, NextResponse } from "next/server";

const FASTAPI_URL = process.env.FASTAPI_URL || "http://127.0.0.1:8000";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;
  try {
    const res = await fetch(
      `${FASTAPI_URL}/api/strategies/${encodeURIComponent(filename)}/rerun`,
      { method: "POST", cache: "no-store" }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Rerun failed" }));
      return NextResponse.json(err, { status: res.status });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Failed to rerun strategy" }, { status: 500 });
  }
}
