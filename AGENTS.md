# AGENTS.md

## Cursor Cloud specific instructions

### Overview

This is a Next.js 16 (App Router, Turbopack) monolith — the CWRU Weatherhead AI Avatar Kiosk. There are no Docker containers, databases, or microservices. All persistence is file-based via AWS S3 (JSON files). See `README.md` for standard commands (`npm install`, `npm run dev`, `npm run build`).

### Dev server

- `npm run dev` starts the Next.js dev server on port 3000 with Turbopack.
- The only env var required for the server to boot and auth to work is `JWT_SECRET` (set in `.env.local`).
- Dev credentials: `admin@example.com` / `admin123` (admin), `user@example.com` / `user123` (regular user).
- External service API keys (OpenAI, HeyGen, AWS S3, Pinecone) are required only for their respective features; the app starts and login works without them.

### Known issues

- **ESLint**: The `eslint.config.mjs` wraps `plugin:@next/next/recommended` with `FlatCompat`, but `eslint-config-next@16` exports native flat config format. Running `npm run lint` fails with `Unexpected top-level property "name"`. This is a pre-existing config incompatibility, not an environment issue.
- **Middleware deprecation**: Next.js 16 shows a warning that the `middleware` file convention is deprecated in favor of `proxy`. The app still works correctly.

### Testing

There are no automated test suites (no Jest, Vitest, or similar) configured in this project. Validation is done via manual testing (dev server + browser).

### Lint / Build / Run

| Task  | Command         |
|-------|-----------------|
| Lint  | `npm run lint` (see known issue above) |
| Build | `npm run build`  |
| Dev   | `npm run dev`    |
| Start | `npm run start`  |
