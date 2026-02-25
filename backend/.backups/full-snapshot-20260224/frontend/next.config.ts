import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/ws/:path*",
        destination: "http://localhost:8000/ws/:path*",
      },
      // SSE streaming endpoint — bypass Next.js API route to avoid buffering
      {
        source: "/api/chat/stream",
        destination: "http://localhost:8000/api/chat/stream",
      },
    ];
  },
};

export default nextConfig;
