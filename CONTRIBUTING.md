# Contributing to Susan AI

Thank you for contributing to Susan AI, a product of Sanket Pixel Technologies.

## Local setup

1. Install Node.js 22 or newer.
2. Install dependencies with `npm install`.
3. Copy `.env.example` to `.env.local` only when local environment overrides are needed. Never commit `.env.local` or real API keys.
4. Run `npm run dev` and open `http://localhost:3000`.

## Distributed rate limiting

Local development works without Redis and uses a bounded in-memory limiter. For a multi-instance deployment, create an [Upstash Redis](https://upstash.com/) database and set these environment variables in the hosting provider's secret settings:

```bash
RATE_LIMIT_BACKEND=upstash
UPSTASH_REDIS_REST_URL=https://your-database.upstash.io
UPSTASH_REDIS_REST_TOKEN=replace-me
TRUST_PROXY=true
RATE_LIMIT_MAX_REQUESTS=30
```

`TRUST_PROXY=true` should only be enabled when the deployment platform is a trusted reverse proxy that sets `x-forwarded-for` or `x-real-ip`. Without Redis variables, the app safely falls back to the bounded in-memory limiter for local use. If configured Redis becomes unavailable, public API routes fail closed with a temporary `503` instead of silently disabling protection.

## Validation

Before opening a pull request, run:

```bash
npm run lint
npm test
npm run build
```

Do not commit real provider keys, Redis tokens, Sentry credentials, `.env` files, build artifacts, or generated release files.
