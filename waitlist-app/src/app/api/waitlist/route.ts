import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
const MAX_EMAIL_LENGTH = 254;

export async function POST(request: Request) {
  if (!redis) {
    return NextResponse.json(
      { error: "Waitlist storage not configured" },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const raw = typeof body?.email === "string" ? body.email : "";
    const email = raw.trim().toLowerCase().slice(0, MAX_EMAIL_LENGTH);

    if (!email || !EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
      );
    }

    const existingPosition = await redis.hget<number>("waitlist:positions", email);
    if (existingPosition != null) {
      return NextResponse.json({
        success: true,
        alreadyJoined: true,
        position: existingPosition,
      });
    }

    const position = await redis.incr("waitlist:count");
    await redis.hset("waitlist:positions", { [email]: position });
    await redis.zadd("waitlist:emails", { score: Date.now(), member: email });

    return NextResponse.json({
      success: true,
      alreadyJoined: false,
      position,
    });
  } catch (err) {
    console.error("[waitlist] Error:", err);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
