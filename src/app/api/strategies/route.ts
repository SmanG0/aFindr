import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://127.0.0.1:8000";

export async function GET() {
  try {
    const res = await fetch(`${BACKEND_URL}/strategies`, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json({ strategies: [] }, { status: 200 });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ strategies: [] }, { status: 200 });
  }
}
