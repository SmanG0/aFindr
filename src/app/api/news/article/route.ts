import { NextRequest, NextResponse } from "next/server";
import { extract } from "@extractus/article-extractor";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url");
    if (!url || !url.startsWith("http")) {
      return NextResponse.json({ error: "Valid url parameter required" }, { status: 400 });
    }

    const article = await extract(url, {}, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!article) {
      return NextResponse.json({ error: "Could not extract article" }, { status: 404 });
    }

    return NextResponse.json({
      title: article.title,
      description: article.description,
      content: article.content,
      image: article.image,
      author: article.author,
      published: article.published,
      source: article.source,
      url: article.url,
    });
  } catch (err) {
    console.warn("[news/article] Extract failed:", err);
    return NextResponse.json(
      { error: "Failed to fetch article", detail: String(err) },
      { status: 500 }
    );
  }
}
