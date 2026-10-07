# Susan AI observability

## Correlation IDs

Every `/api/*` request receives an opaque `x-request-id` header. The ID is generated at the edge and is also passed into route handlers. It contains no user data and can be shared with support to match a server-side log or Sentry event.

The application never logs prompts, API keys, extracted document text, provider responses, or request bodies. Server error logs contain only the route, a bounded error message, an error taxonomy code, and the correlation ID.

## Sentry setup

Sentry is optional and disabled unless a DSN is configured. Set these variables in the deployment environment:

```text
SENTRY_DSN=your-server-dsn
NEXT_PUBLIC_SENTRY_DSN=your-browser-dsn
SENTRY_ENVIRONMENT=production
NEXT_PUBLIC_SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.05
NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=0.05
```

For release source maps, also provide `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT` during the build. These are not needed at runtime. `sendDefaultPii` is disabled and browser request bodies/cookies/headers are removed before events are sent.

## CI quality gates

Pull requests and pushes to `main`/`master` run lint, TypeScript, unit/runtime tests, mobile contract tests, Chromium mobile E2E tests, production build, and a production-only high-severity dependency audit. Failed Playwright runs upload the report and trace artifacts.
