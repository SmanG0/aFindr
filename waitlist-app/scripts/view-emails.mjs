#!/usr/bin/env node
/**
 * View waitlist emails from Upstash Redis.
 * Run: node scripts/view-emails.mjs
 * Requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in .env.local
 */
import { Redis } from "@upstash/redis";

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!url || !token) {
  console.error("Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN");
  console.error("Copy from .env.local or set in environment");
  process.exit(1);
}

const redis = new Redis({ url, token });

async function main() {
  const emails = await redis.zrange("waitlist:emails", 0, -1, { withScores: true });
  const positions = await redis.hgetall("waitlist:positions");
  const count = await redis.get("waitlist:count");

  console.log("\n📧 Waitlist Emails\n");
  console.log(`Total signups: ${count ?? 0}\n`);

  if (emails.length === 0) {
    console.log("No emails collected yet.");
    return;
  }

  const rows = emails.map(([email, timestamp]) => {
    const pos = positions?.[email] ?? "—";
    const date = new Date(Number(timestamp)).toISOString();
    return { pos, email, date };
  });

  console.log("Position | Email                          | Signed up");
  console.log("---------|--------------------------------|---------------------------");
  rows.forEach(({ pos, email, date }) => {
    console.log(`#${String(pos).padEnd(6)} | ${email.padEnd(30)} | ${date}`);
  });
  console.log("");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
