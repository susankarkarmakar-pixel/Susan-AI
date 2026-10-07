# Document search and deployment

## Local document search

Susan AI stores documents and their bounded search index in the browser's IndexedDB. Search never uploads document contents to the server. Plain text, Markdown, CSV, JSON and PDF text are indexed locally when a file is added; the UI also records the extraction source, status, language and character count. DOCX files are parsed with Mammoth and XLSX workbooks with ExcelJS, including worksheet names and bounded cell values.

The index is schema-versioned and older documents remain readable. Search results rank exact filename matches above token matches in extracted text and include a short local snippet without exposing the full stored document. Office parsing is bounded to 120,000 indexed characters, 20 worksheets, 500 rows per worksheet, and 2,000 characters per cell.

## Vercel

`vercel.json` is valid for the Next.js app: it uses `npm ci` and `npm run build`. `next.config.ts` uses `output: "standalone"`, which is compatible with Vercel and is also used by the Docker image. Configure Sentry DSN variables and Upstash variables in the Vercel project settings; never commit them.

For public multi-instance deployments, set `RATE_LIMIT_BACKEND=upstash`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, and the trusted proxy setting documented in `docs/PRODUCTION-SECURITY.md`.

## Docker

Build the standalone output first, then build and run the image:

```bash
npm ci
npm run build
docker build -t susan-ai .
docker run --rm -p 3000:3000 --env-file .env.local susan-ai
```

The image runs as a non-root user, binds Next.js to `0.0.0.0`, and copies only `public`, `.next/standalone`, and `.next/static`. Browser-local documents are not included in the image and remain on each user's device.
