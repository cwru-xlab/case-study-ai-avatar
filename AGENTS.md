# AGENTS.md

## Cursor Cloud specific instructions

### Overview

This is a Next.js 16 (App Router, Turbopack) monolith — the CWRU Weatherhead AI Avatar Kiosk. 

**Data Storage Architecture:**
- **PostgreSQL** (via Prisma ORM) - Structured data: users, cohorts, cases, attempts, learning records
- **AWS S3** - Large files: interaction logs (JSON), images, documents

See `README.md` for standard commands (`npm install`, `npm run dev`, `npm run build`).

### Database Schema

The database uses Prisma with PostgreSQL. Key models:

| Model | Purpose |
|-------|---------|
| `User` | All users (admin, professor, student) with passwordHash, role (enum), auth provider |
| `Session` | Login session tracking |
| `Cohort` | Course sections created by professors |
| `CohortMember` | Student-cohort membership (many-to-many) |
| `Case` | AI conversation practice scenarios |
| `CaseAssignment` | Which cases are assigned to which students |
| `Attempt` | Learning records (scores, time, messages, evaluation) |
| `AuditLog` | Operation audit trail |

Role enum: `ADMIN`, `PROFESSOR`, `STUDENT`, `KIOSK`

Schema file: `prisma/schema.prisma`

### Database Commands (Prisma)

| Command | Purpose |
|---------|---------|
| `npx prisma db push` | Sync schema to database |
| `npx prisma db seed` | Fill test data |
| `npx prisma generate` | Regenerate Prisma Client after schema changes |
| `npx prisma studio` | Open database GUI in browser |
| `npx prisma db push --force-reset` | Reset database (⚠️ deletes all data) |

### Dev server

- `npm run dev` starts the Next.js dev server on port 3000 with Turbopack.
- Required env vars: `JWT_SECRET`, `DATABASE_URL` (set in `.env.local`).
- External service API keys (OpenAI, HeyGen, AWS S3, Pinecone) are required only for their respective features.

### Dev credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@example.com | admin123 |
| Professor | professor.smith@case.edu | prof123 |
| Professor | professor.chen@case.edu | prof123 |
| Student | student@case.edu | student123 |
| Student | alice.johnson@case.edu | student123 |

All test users are created by `prisma/seed.ts`.

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
