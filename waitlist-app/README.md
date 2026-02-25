# aFindr Waitlist — Standalone

**Email-only waitlist.** No app, no dev panel, no other routes. Deploy to afindr.com.

## Deploy to Vercel

### Option A: Deploy as separate project

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your repo: `SmanG0/aFindr`
3. Set **Root Directory** to `waitlist-app`
4. Add Upstash Redis from [Vercel Marketplace](https://vercel.com/marketplace?category=storage&search=redis)
5. Deploy

### Option B: Deploy from CLI

```bash
cd waitlist-app
npm install
vercel --prod
```

Add env vars in Vercel dashboard:
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

## Custom domain (afindr.com)

In Vercel dashboard → Settings → Domains → Add `afindr.com` and `www.afindr.com`
Then configure DNS in Namecheap as Vercel instructs.

## Local dev

```bash
cd waitlist-app
cp .env.example .env.local
# Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
npm install
npm run dev
```

Opens at http://localhost:3001
