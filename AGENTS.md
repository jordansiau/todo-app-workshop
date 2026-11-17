# Todo App Workshop

Next.js 16 App Router, React 19, TypeScript strict, Tailwind 4, SQLite
(better-sqlite3), SimpleWebAuthn passkeys and seven-day JWT sessions.

- EVALUATION.md is the assessment checklist. PRPs/00-one-shot-implementation.md
  describes behavior; docs/DECISIONS.md records rubric-specific resolutions.
- Keep the primary task UI in app/page.tsx; database operations in lib/db.ts.
- User data must always be scoped to the authenticated user, including child resources.
- Use parameterized SQL and transactions. Never import database runtime into client code.
- Date parsing and Singapore calendar arithmetic belong in lib/timezone.ts.
- Use real passkey authentication; never add a production login bypass or fixed secret.
- Run npm run typecheck, npm run lint, npm run test:unit, npm run build and
  npm run test:e2e. Record actual results and remaining manual checks.
- Do not commit secrets, database files, generated builds or dependency directories.
