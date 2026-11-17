# Todo Workshop

A passkey-secured, personal task manager built for the NUS AI-augmented SDLC workshop. The deliverable implements all eleven feature areas from the lecturer's specification. See [verification evidence](docs/VERIFICATION.md) for what has actually been tested and what still needs manual or cloud verification.

**Stack:** Next.js 16, React 19, strict TypeScript, Tailwind CSS 4, SQLite (`better-sqlite3`), SimpleWebAuthn 13, HTTP-only JWT sessions, Vitest, and Playwright.

## Run locally

Requires Node.js 22.19 or newer and npm. Use **localhost**, rather than a LAN IP, for local passkeys.

```sh
npm ci
```

Copy `.env.example` to `.env.local`. Generate a secret and replace the placeholder `JWT_SECRET`:

```sh
node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))"
```

Keep the other development values as supplied. Seed the holiday data and start:

```sh
npm run seed:holidays
npm run dev
```

Open [localhost:3000](http://localhost:3000), select **Register**, choose a username, and create a passkey using your device PIN, fingerprint, face, or security key. There are no shared demo credentials or password fallback. Sign in again using the same username and an accessible copy of that passkey. Losing every copy of a passkey currently means losing access to that account; account recovery is outside this workshop's scope.

The default database is `data/todos.db`. That folder is ignored by Git. `npm run seed:holidays` uses `DATABASE_PATH` from the shell, or that default; Next.js reads `.env.local` for its server. If you customize the database path locally, set it in the shell when seeding as well.

## Features

1. Create, edit, complete, delete with confirmation, and automatically section/sort tasks.
2. High, medium, and low priorities, with theme-aware badges.
3. Daily, weekly, monthly, and yearly recurrence; month-end and leap-year clamping.
4. Seven reminder offsets, permission request, 30-second polling, and duplicate suppression.
5. Ordered subtasks, completion, renaming, and progress bars.
6. Per-user colored tags, assignment, live editing, and filtering.
7. Reusable templates with subtasks, category, metadata, and relative due dates.
8. Debounced title/subtask search, optional tag-name search, combined filters, saved presets.
9. JSON export/import with validation and transactions; CSV export with formula protection.
10. Calendar with fixed 42-day grid, navigation, day details, and 2026 Singapore public holidays.
11. Real WebAuthn registration/login, one-use expiring challenges, and seven-day sessions.

All display and local date entry use **Asia/Singapore**; database timestamps store UTC instants. Reminders work while the app is open, with notification permission granted. They are not background push notifications.

## Verification

```sh
npm run format:check
npm run lint
npm run test:coverage
npm run build
npm run typecheck
npx playwright install chromium
npm run test:e2e
npm audit --audit-level=moderate
```

The browser suite uses a separate `data/e2e.db`, localhost port 3210, and a virtual Chromium authenticator. It exercises the real cryptographic verification routes; there is no test login endpoint. Every test registers a fresh account. Tests intentionally use an isolated, hard-coded test secret, never your production secret. GitHub Actions repeats the complete browser suite three times and retains reports for fourteen days.

## Project map

| Location                                      | Purpose                                                                               |
| --------------------------------------------- | ------------------------------------------------------------------------------------- |
| `app/page.tsx`                                | Main task workspace, forms, filters, tag/template dialogs, import/export UI           |
| `app/calendar/page.tsx`                       | Calendar and day-detail dialog                                                        |
| `app/login/page.tsx`                          | Browser passkey flow and registration/sign-in interface                               |
| `app/api/auth/[action]/route.ts`              | Passkey challenges, verification, session profile and logout                          |
| `app/api/[...path]/route.ts`                  | Authenticated feature API surface and public readiness endpoint                       |
| `lib/db.ts`                                   | Types, schema, validation, ownership checks, transactions and all feature persistence |
| `lib/auth.ts`, `lib/http.ts`                  | JWT cookies, origin checking, request validation and safe error responses             |
| `lib/timezone.ts`, `lib/logic.ts`             | Date arithmetic, Singapore formatting, filtering, sorting and progress                |
| `lib/hooks/useNotifications.ts`               | Permission handling and reminder polling                                              |
| `lib/holidays.ts`, `scripts/seed-holidays.ts` | Sourced, idempotent holiday seeding                                                   |
| `components/`                                 | Shared navigation and accessible native-dialog shell                                  |
| `proxy.ts`                                    | Next.js 16 page authentication/redirect boundary                                      |
| `tests/`                                      | Twelve feature browser specs, quality spec, unit tests and helpers                    |
| `EVALUATION.md`                               | Unmodified lecturer rubric; not a claim that every checkbox is verified               |
| `docs/`                                       | Decisions, rubric mapping, deployment instructions and actual evidence                |

## Deployment

Use [the Railway deployment guide](docs/DEPLOYMENT.md). SQLite needs a **persistent volume and one application replica**. This implementation is not configured for Vercel's ephemeral/serverless filesystem. Docker and Railway configuration are provided; see verification notes for live-deployment status.

## Specification and attribution

Based on Ken Phang's [AI-SDLC-Workshop-Day1n2](https://github.com/kenken64/AI-SDLC-Workshop-Day1n2/tree/low-token-usage), branch `low-token-usage`, commit `e6b9c33`. The original rubric and [one-shot specification](docs/reference/00-one-shot-implementation.md) are preserved for assessment context. This application's source code was written for this deliverable. [Decisions](docs/DECISIONS.md) records conflict resolutions and deviations.
