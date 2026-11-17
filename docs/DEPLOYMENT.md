# Railway deployment and verification

This guide is executable setup guidance. It does not assert that a deployment has already happened. See `VERIFICATION.md` for observed results.

## Provision

1. In Railway, create a project and choose **Deploy from GitHub repo** → `jordansiau/todo-app-workshop`. Use the default `main` branch. Railway reads `railway.json` and the Dockerfile. A Railway account, GitHub repository access, and available hosting quota are required.
2. Add a **persistent volume** mounted at `/data`. Run **one replica**. Ensure the volume permits writes by the container's `node` user (UID 1000); a root-owned mounted volume can override Dockerfile permissions. If needed, configure the volume ownership before serving traffic.
3. Generate a public HTTPS domain. Set these service variables before registering any passkeys:

| Variable        | Value                                                                                                                                                 |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `JWT_SECRET`    | Random secret generated with `node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))"`; keep in Railway variables only |
| `RP_ID`         | Public hostname only, e.g. `your-service.up.railway.app` (no scheme/path/port)                                                                        |
| `RP_NAME`       | `Todo Workshop`                                                                                                                                       |
| `RP_ORIGIN`     | Exact HTTPS origin, e.g. `https://your-service.up.railway.app` (no trailing slash)                                                                    |
| `DATABASE_PATH` | `/data/todos.db`                                                                                                                                      |
| `NODE_ENV`      | `production` (also set by Dockerfile)                                                                                                                 |

Railway supplies `PORT`; the container binds `0.0.0.0:$PORT`. Never expose `JWT_SECRET` with a `NEXT_PUBLIC_` variable. Changing RP domain makes passkeys registered for the old domain unusable at the new one; decide the final domain first.

4. Deploy. The startup command idempotently seeds 2026 public holidays, then starts Next.js. Readiness is `GET /api/health` and checks SQLite connectivity.
5. Review build/start logs. Verify the HTTPS URL manually, then complete the checks below before claiming deployment points.

## Production acceptance checks

- Register a real device passkey on the final HTTPS origin, sign out, sign in again, refresh and navigate Calendar.
- Create a task, subtask, tag and template. Export JSON, import it, and inspect relationships.
- Verify a second account cannot access the first account's records. API requests without a session must return 401.
- Enable notifications explicitly; create a task due ten minutes ahead with a fifteen-minute reminder. With the app open and permission granted, verify the actual OS notification appears once. This scenario is already within its reminder window.
- Restart/redeploy the service. Verify the original account can sign in and all data persists. This is the decisive persistent-volume check.
- Confirm `Secure`, `HttpOnly`, `SameSite=Lax` on the session cookie, no secrets in browser bundles/logs, and a stable strong server secret.
- Test Chrome, Firefox and Safari, keyboard navigation, screen readers, narrow mobile layouts and both themes. Chromium virtual-authenticator results do not prove Safari support.
- Measure Lighthouse accessibility/performance on the deployed URL, page load/FCP/TTI, authenticated API and mutation latency. Local warm timings are not cloud evidence.
- Record date, deployment URL, revision, browser/device, outcome and any failures in `docs/VERIFICATION.md`.

## Backup and rollback

Use SQLite's online backup API or stop the service and copy the database together with its WAL state safely. Do not copy only a live `.db` file while ignoring an active WAL. Store backups outside Git, restrict access, and rehearse restoring them to a separate volume. JSON export backs up tasks and relationships only; it does not back up passkey accounts or templates.

Keep the previous successful Railway deployment available for rollback. Schema is initialized with `CREATE TABLE IF NOT EXISTS`; future schema changes need explicit versioned migrations before upgrading existing installations.

## Local production mode

```sh
npm run build
npm run start
```

The server needs the configured secret and RP values in `.env.local` or the environment. HTTPS cookies are Secure in production; localhost is treated as a trustworthy development origin by supported browsers. Do not use an insecure LAN-IP deployment for passkeys.

## Hosting constraint

Do not deploy this SQLite implementation directly to Vercel serverless functions or an ephemeral filesystem and claim persistent storage. Migrate to a supported durable database first if choosing that host. The Dockerfile has not been locally container-tested when Docker Desktop's daemon is unavailable; CI still validates the Node production build and browser workflows on Linux.
