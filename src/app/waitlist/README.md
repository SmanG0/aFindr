# Waitlist (Isolated)

The `/waitlist` route is fully isolated from the rest of the app:

- **No Convex** – uses `/api/waitlist` (Upstash Redis) for email collection
- **No dev panel** – removed
- **No navigation** – no links to landing, login, onboarding, or other app routes
- **Public only** – randos can only access this page and the email API

## Deploy to Vercel

1. Add **Upstash Redis** from [Vercel Marketplace](https://vercel.com/marketplace?category=storage&search=redis)
2. Set env vars in Vercel: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
3. Deploy: `vercel --prod`

## Local dev

```bash
# Add to .env.local
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
```
