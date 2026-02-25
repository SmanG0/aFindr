#!/usr/bin/env node
/**
 * Download headshots from Google Images - clicks first result, gets full-size image, downloads it.
 * Run: npx playwright install chromium && node scripts/screenshot_headshots.js
 */

const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const AUTHORS = [
  "Warren Buffett",
  "Charlie Munger",
  "Benjamin Graham",
  "John Maynard Keynes",
  "George Soros",
  "Ray Dalio",
  "Peter Lynch",
  "Howard Marks",
  "Paul Tudor Jones",
  "Mellody Hobson",
  "Edwin Lefevre",
  "Sir John Templeton",
  "Ed Seykota",
  "Alexander Elder",
  "William J. O'Neil",
  "Philip Fisher",
  "Robert Arnott",
  "Victor Sperandeo",
  "Robert Olstein",
  "Ken Fisher",
  "Larry Hite",
  "Nicolas Darvas",
  "Jesse Livermore",
  "Morgan Housel",
];

const OUTPUT = path.join(__dirname, "../public/headshots");

function slug(name) {
  return name
    .replace(/[.'']/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase();
}

function isRasterUrl(url) {
  if (!url || typeof url !== "string") return false;
  const u = url.toLowerCase();
  return (
    (u.includes(".png") || u.includes(".jpg") || u.includes(".jpeg") || u.includes(".webp")) &&
    !u.includes(".svg")
  );
}

async function getFirstImageUrl(page) {
  // Strategy 1: imgurl links (no click) - prefer raster
  const imgUrls = await page.$$eval(
    'a[href*="imgurl="]',
    (links) =>
      links
        .map((a) => {
          const m = a.href.match(/imgurl=([^&]+)/);
          return m ? decodeURIComponent(m[1]) : null;
        })
        .filter(Boolean)
  );
  const raster = imgUrls.find(isRasterUrl);
  if (raster) return raster;

  // Strategy 2: Click first image in mosaic grid, then get full-size URL from preview panel
  const mosaicImg = page.locator('[data-id="mosaic"] img').first();
  try {
    await mosaicImg.waitFor({ state: "visible", timeout: 5000 });
    await mosaicImg.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await mosaicImg.click({ force: true });
    await page.waitForTimeout(2500);
  } catch (_) {}

  // Get full-size image URLs from preview (exclude thumbnails, branding, fonts)
  const urls = await page.$$eval(
    'img[src^="http"]',
    (elements) =>
      elements
        .map((el) => el.src)
        .filter(
          (src) =>
            src &&
            !src.includes("encrypted-tbn") &&
            !src.includes("gstatic.com/images/branding") &&
            !src.includes("fonts.gstatic") &&
            !src.includes(".svg")
        )
  );
  return urls.find(isRasterUrl) || urls[0] || null;
}

async function main() {
  fs.mkdirSync(OUTPUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  for (let i = 0; i < AUTHORS.length; i++) {
    const name = AUTHORS[i];
    const file = path.join(OUTPUT, `${slug(name)}.png`);
    if (fs.existsSync(file) && fs.statSync(file).size > 5000) {
      console.log(`[${i + 1}/${AUTHORS.length}] ${name} (skip)`);
      continue;
    }
    console.log(`[${i + 1}/${AUTHORS.length}] ${name}`);
    try {
      const q = encodeURIComponent(`${name} photo`);
      await page.goto(`https://www.google.com/search?q=${q}&tbm=isch`, {
        waitUntil: "networkidle",
        timeout: 15000,
      });
      await page.waitForTimeout(2500);

      const imageUrl = await getFirstImageUrl(page);

      let saved = false;
      if (imageUrl) {
        try {
          const res = await fetch(imageUrl, {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
              Referer: "https://www.google.com/",
            },
          });
          if (res.ok) {
            const buf = Buffer.from(await res.arrayBuffer());
            const ct = (res.headers.get("content-type") || "").toLowerCase();
            const isImage =
              ct.includes("image/png") ||
              ct.includes("image/jpeg") ||
              ct.includes("image/jpg") ||
              ct.includes("image/webp");
            if (buf.length >= 3000 && (isImage || buf.length >= 10000)) {
              fs.writeFileSync(file, buf);
              console.log(`  -> saved ${(buf.length / 1024).toFixed(1)} KB`);
              saved = true;
            }
          }
        } catch (_) {}
      }
      if (!saved) {
        // Fallback: screenshot first mosaic thumbnail (single image, not whole page)
        try {
          const mosaicImg = page.locator('[data-id="mosaic"] img').first();
          await mosaicImg.waitFor({ state: "visible", timeout: 3000 });
          await mosaicImg.screenshot({ path: file });
          console.log(`  -> screenshot of first thumbnail`);
        } catch {
          await page.screenshot({ path: file });
          console.log(`  -> fallback page screenshot`);
        }
      }
    } catch (e) {
      console.log(`  err: ${e.message}`);
    }
    await page.waitForTimeout(800);
  }

  await browser.close();
  console.log("\nDone.");
}

main().catch(console.error);
