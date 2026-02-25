#!/usr/bin/env node
/**
 * Download headshots for quote authors from Wikimedia Commons and other sources.
 * Saves to public/headshots/ for use in the app.
 */

const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");

const OUTPUT_DIR = path.join(__dirname, "../public/headshots");

// All headshot URLs - Wikimedia Commons (free to use) + any other verified sources
const HEADSHOTS = {
  "Warren Buffett":
    "https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/Warren_Buffett_KU_Visit.jpg/440px-Warren_Buffett_KU_Visit.jpg",
  "Charlie Munger":
    "https://upload.wikimedia.org/wikipedia/commons/thumb/5/56/Charlie_Munger_%28cropped%29.jpg/440px-Charlie_Munger_%28cropped%29.jpg",
  "Benjamin Graham":
    "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Benjamin_Graham_%281894-1976%29_portrait_on_23_March_1950.jpg/440px-Benjamin_Graham_%281894-1976%29_portrait_on_23_March_1950.jpg",
  "John Maynard Keynes":
    "https://upload.wikimedia.org/wikipedia/commons/thumb/6/66/John_Maynard_Keynes.jpg/440px-John_Maynard_Keynes.jpg",
  "George Soros":
    "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/George_Soros_-_Festival_Economia_2012.JPG/440px-George_Soros_-_Festival_Economia_2012.JPG",
  "Ray Dalio":
    "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Ray_Dalio_2017_%28cropped%29.jpg/440px-Ray_Dalio_2017_%28cropped%29.jpg",
  "Peter Lynch":
    "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Peter_Lynch_%28cropped%29.jpg/440px-Peter_Lynch_%28cropped%29.jpg",
  "Howard Marks":
    "https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/Howard_Marks_%28investor%29.jpg/440px-Howard_Marks_%28investor%29.jpg",
  "Paul Tudor Jones":
    "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Paul_Tudor_Jones_at_the_Robin_Hood_Foundation.jpg/440px-Paul_Tudor_Jones_at_the_Robin_Hood_Foundation.jpg",
  "Mellody Hobson":
    "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7d/Mellody_Hobson.jpg/440px-Mellody_Hobson.jpg",
  "Edwin Lefevre":
    "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/Edwin_Lef%C3%A8vre.jpg/440px-Edwin_Lef%C3%A8vre.jpg",
  "Robert Arnott":
    "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2d/Rob_Arnott.jpg/440px-Rob_Arnott.jpg",
  "Nicolas Darvas":
    "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/Nicolas_Darvas.jpg/440px-Nicolas_Darvas.jpg",
  "Jesse Livermore":
    "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0a/Press_photo_of_Jesse_Livermore_in_1940_%28cropped%29.jpg/440px-Press_photo_of_Jesse_Livermore_in_1940_%28cropped%29.jpg",
};

function slug(name) {
  return name
    .replace(/[.'']/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase();
}

function download(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;
    protocol
      .get(
        url,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          },
        },
        (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          return download(res.headers.location).then(resolve).catch(reject);
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks)));
      })
      .on("error", reject);
  });
}

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const results = [];
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));
  for (const [name, url] of Object.entries(HEADSHOTS)) {
    const filename = `${slug(name)}.jpg`;
    const filepath = path.join(OUTPUT_DIR, filename);
    try {
      const data = await download(url);
      fs.writeFileSync(filepath, data);
      results.push({ name, status: "ok", file: filename });
      console.log(`✓ ${name}`);
    } catch (err) {
      results.push({ name, status: "fail", error: err.message });
      console.log(`✗ ${name}: ${err.message}`);
    }
    await delay(1500); // Avoid rate limiting
  }

  const ok = results.filter((r) => r.status === "ok").length;
  const fail = results.filter((r) => r.status === "fail").length;
  console.log(`\nDone: ${ok} downloaded, ${fail} failed.`);
  console.log(`Saved to: ${OUTPUT_DIR}`);
}

main().catch(console.error);
