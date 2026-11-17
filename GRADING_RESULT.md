# Static codebase grading result

**Repository:** `jordansiau/todo-app-workshop`  
**Reviewed revision:** `c369e8dbf780a20ce3cf37950fb124ee7ec3afc5`  
**Assessment date:** 17 November 2026  
**Method:** Static repository inspection only. No tests, builds, lint checks, benchmarks, application servers or browser sessions were started for this assessment. Existing implementation files were not changed.

**Provisional score: 118 / 200 (59%) — Incomplete.** This is a conservative static-evidence score, not a finding that the application fails to run. Substantial functionality and test code exist; execution-dependent credit is withheld as explained below.

## Rubric and scoring interpretation

The assessment uses the repository's unchanged `EVALUATION.md`, sourced from the lecturer's [`low-token-usage` branch](https://github.com/kenken64/AI-SDLC-Workshop-Day1n2/blob/low-token-usage/EVALUATION.md).

- `EVALUATION.md:819–845` allocates 110 feature points, 30 testing points, 30 deployment points, and 30 quality/performance points, totaling 200.
- Features use the explicit **10 implemented / 5 partial / 0 not started** rule (`EVALUATION.md:820–822`). Full feature credit below means the implementation is present on static inspection; operational correctness remains **UNVERIFIED**.
- The rubric **does not define how to score an unverified runtime criterion**, nor finer point allocations inside the quality categories. This review therefore states an assessor assumption rather than attributing an invented rule to the rubric: **withhold runtime-dependent category points until independently verified**, and assess code-quality/security points from visible source controls. A zero marked UNVERIFIED means withheld credit, not absent implementation or a demonstrated failure.
- Existing logs, screenshots, coverage summaries, CI configuration and `docs/VERIFICATION.md` are submitted artifacts. They are not treated as independently validated runtime outcomes in this static-only assessment. Tests are read for scope and omissions, without execution.
- No deduction is made merely for choosing `proxy.ts` instead of the rubric's older `middleware.ts` filename, or for consolidating handlers while preserving the specified API URLs.

## 1. Feature completeness — 95 / 110

| Criterion | Score | Static rationale and relevant evidence | Runtime status |
| --- | ---: | --- | --- |
| 01. Todo CRUD | **10 / 10** | Owned create/read/update/delete operations, trimmed title and future-date validation in `lib/db.ts:120`, `:212`, `:217`, `:222`, `:288`; authenticated dispatch in `app/api/[...path]/route.ts:20`; sections/sorting in `lib/logic.ts:38` and `:48`; mutation rollback in `app/page.tsx:439` and delete confirmation at `:1053`. Creation, editing and completion UI are present. | Actual operations and optimistic rollback behavior UNVERIFIED. |
| 02. Priority system | **10 / 10** | Enum/default/schema validation in `lib/db.ts:79` and `:97`; priority ordering/filtering in `lib/logic.ts:30` and `:38`; form selection in `app/page.tsx:130`; themed badges in `app/globals.css:423–450`. | Visual contrast and actual sorting/filtering UNVERIFIED. |
| 03. Recurring todos | **10 / 10** | Recurrence requires due date/pattern in `lib/db.ts:139`; completion transaction and successor marker at `:222–285`; inherited tags/reminders and reset subtasks are present. Date helper handles daily/weekly intervals and month/year clamping in `lib/timezone.ts:60`. | Successor creation and date boundary correctness UNVERIFIED by execution. |
| 04. Reminders and notifications | **5 / 10** | Seven choices in `lib/logic.ts:66`; due-date dependency in task form; permission handling and 30-second polling in `lib/hooks/useNotifications.ts:16–45`. **Partial:** `lib/db.ts:600–605` marks reminders sent before the browser attempts delivery (`lib/hooks/useNotifications.ts:30`). An unmount or Notification-constructor failure can consume a reminder permanently; the advertised retry will not select it again. | Real permission prompts, OS delivery, timing and cross-tab behavior UNVERIFIED. |
| 05. Subtasks and progress | **5 / 10** | Owned CRUD, stable positions and cascades in `lib/db.ts:82`, `:337–377`; expandable list and progress UI in `app/page.tsx:893–1025`. **Partial:** `lib/logic.ts:61–64` rounds the percentage; `app/page.tsx:904` treats rounded 100 as complete. With 200 of 201 subtasks complete, the displayed result rounds to 100 and selects green although one subtask remains. This contradicts accurate completion/progress for the rubric's unlimited-subtask case. | Interactive CRUD, rendering and cascade execution UNVERIFIED. |
| 06. Tag system | **10 / 10** | Per-user case-insensitive uniqueness and associations in `lib/db.ts:84–85`; validation and owned CRUD at `:292–335`; attachment/detachment dispatch in `app/api/[...path]/route.ts:81–98`; management, selection and filtering UI in `app/page.tsx:196`, `:608` and `:1085`. | Live propagation, custom-color rendering and filtering UNVERIFIED. |
| 07. Template system | **10 / 10** | Schema/serialization/relative dates in `lib/db.ts:378–481`; use operation inserts new tasks and reset subtasks transactionally. Save/edit/preview/category/use interfaces in `app/page.tsx:230` and `:1163`. Preserves subtasks and relative due offset while excluding original tags/absolute dates, consistent with the documented specification resolution. | Template CRUD and generated relationships UNVERIFIED. |
| 08. Search and filtering | **10 / 10** | Case-insensitive title/subtask/optional tag search and AND filters in `lib/logic.ts:21–36`; 300ms debounce in `app/page.tsx:415`; per-account saved presets at `:426` and `:470`; filter controls, clearing and empty state at `:578–758`. | Correct interactive results and latency thresholds UNVERIFIED. |
| 09. Export and import | **10 / 10** | Versioned export in `lib/db.ts:483`; whole-payload validation, new IDs, tag reuse and transaction in `:536–555`; CSV escaping/formula protection in `:558`; JSON upload/download UI in `app/page.tsx:478–535`. Size-bounded request parsing in `lib/http.ts:13`. | Download correctness, rollback and round-trip relationships UNVERIFIED by execution. |
| 10. Calendar | **5 / 10** | Grid/navigation/date helpers in `lib/timezone.ts:80`; month URL handling, day details and holiday/task rendering in `app/calendar/page.tsx:22–151`; idempotent 2026 holiday data in `lib/holidays.ts:5–30`. **Partial:** the rubric explicitly requests a todo count badge on days (`EVALUATION.md:342`); rendering at `app/calendar/page.tsx:127–135` shows only an overflow count for more than three tasks. For one to three tasks, the count exists in the accessible name but there is no visible count badge. Holiday coverage is explicitly limited to 2026. | Calendar interactions, holiday rendering and layout UNVERIFIED. |
| 11. WebAuthn authentication | **10 / 10** | Registration/login option and verification handlers in `app/api/auth/[action]/route.ts:42–240`; one-use expiring challenges in `lib/db.ts:608–634`; JWT/cookie lifecycle in `lib/auth.ts:18–56`; protected page redirects in `proxy.ts:3–11`; passkey UI in `app/login/page.tsx:18`. Ownership checks are present in feature handlers. | Real-device passkeys, session persistence, logout and production-origin behavior UNVERIFIED. |

**Calculation:** eight complete implementations × 10 + three partial implementations × 5 = **95 / 110**.

## 2. Testing coverage — 0 / 30 credited; execution unverified

| Criterion | Score | Static evidence and limitations |
| --- | ---: | --- |
| E2E tests | **0 / 15 — UNVERIFIED** | Twelve feature specs plus `tests/13-quality.spec.ts` are present. Helpers configure a virtual authenticator (`tests/helpers.ts:5`); SGT is set in `playwright.config.ts:14`. `.github/workflows/ci.yml:25–31` requests three runs. These are meaningful authored tests, but this review cannot establish passing results or three-run consistency (`EVALUATION.md:411–417`). The auth test named “forged session” (`tests/01-authentication.spec.ts:22`) does not actually install a forged JWT cookie; it tests absent authentication, invalid verification and cross-origin rejection. |
| Unit tests | **0 / 10 — UNVERIFIED** | `tests/unit/core.test.ts:46–355` covers dates, validation, ownership, recurrence, reminders, subtasks, templates, import and filtering. Passing results and achieved coverage are unverified. `vitest.config.ts:7–12` scopes coverage to four core modules, excluding auth, HTTP handlers and UI. The rubric's JWT creation/verification unit test (`EVALUATION.md:390`) is absent. The large-subtask rounding case identified above is not covered. |
| Manual testing | **0 / 5 — UNVERIFIED** | No real-browser/device/manual checks were performed for this assessment. Existing screenshots and narrative reports are not substituted for independent observation. Actual notifications, Firefox/Safari, mobile browsers and screen-reader behavior remain unverified. |

The test implementation is not classified as “not started.” This category's zero is solely the conservative runtime-credit policy described above.

## 3. Deployment — 10 / 30

| Criterion | Score | Static rationale and relevant evidence |
| --- | ---: | --- |
| Successful deployment | **0 / 15 — UNVERIFIED** | `Dockerfile:1–16` and `railway.json:1–10` provide build/start/readiness configuration, not evidence of a working deployed app. No deployed student-app URL and independently confirmed HTTPS functionality were established in this review. |
| Environment configuration | **5 / 5 — static setup credit** | `.env.example:1–7` documents required variables; `docs/DEPLOYMENT.md:11–20` explains production secret, RP hostname/origin, port and durable database path. Production secret validation exists in `lib/auth.ts:10–17`. Credit is for configuration artifacts and safeguards; actual hosting variables are UNVERIFIED. Placeholder secrets in an example file are appropriate, not evidence of a configured live service. |
| Production testing | **0 / 5 — UNVERIFIED** | Cloud passkeys, HTTPS behavior, volume permissions, restart/redeploy persistence and deployed performance were not inspected at runtime. The guide lists these checks at `docs/DEPLOYMENT.md:25–35`. |
| Documentation | **5 / 5** | `README.md` provides setup, features, commands and a project map; `docs/DEPLOYMENT.md` covers deployment/backup/rollback; `docs/DECISIONS.md` records specification conflicts and limits; `docs/REQUIREMENTS_TRACEABILITY.md` maps requirements to code/tests. These are directly inspectable artifacts. |

## 4. Quality and performance — 13 / 30

| Criterion | Score | Static rationale and relevant evidence |
| --- | ---: | --- |
| Code quality | **8 / 10** | Strict TypeScript (`tsconfig.json:7`), lint/format configuration, shared domain helpers, typed APIs, input validation, safe error responses and loading/error states are present. Deduct two points for production-readiness omissions: no application React error boundary/`app/error.tsx`, and no diagnostic logging of unexpected API exceptions (`lib/http.ts:49–54`). Default framework error/not-found pages may still be supplied by Next.js; this assessment does not incorrectly classify them as definitely absent. Build/lint/typecheck outcomes are UNVERIFIED in this assessment. |
| Performance | **0 / 10 — UNVERIFIED** | Parameterized statements, useful indexes and batched related-record reads are visible (`lib/db.ts:77–87`, `:178–209`). However, load/FCP/TTI, mutation/API/filter latency, database size and bundle thresholds require measurements. Static concerns also remain: `getTodo()` hydrates the user's entire collection (`lib/db.ts:212–214`), calendar rendering repeatedly filters the collection (`app/calendar/page.tsx:53`), and the task list maps all matches without pagination/virtualization (`app/page.tsx:759–1028`), despite the rubric's large-list lazy-loading item. Submitted timing JSON is not independently verified here. |
| Accessibility | **0 / 5 — UNVERIFIED** | Native labeled dialogs (`components/Modal.tsx:16–49`), control labels, focus styling (`app/globals.css:74`), themes and authored axe checks (`tests/13-quality.spec.ts:6–67`) are positive static evidence. Actual keyboard/focus behavior, screen-reader output, rendered AA contrast and the required Lighthouse accessibility score above 90 cannot be confirmed by source alone. |
| Security | **5 / 5 — static controls credit** | Owned SQL queries and parameter binding (`lib/db.ts:178–189`, `:237`); expiring one-use passkey challenges (`:608–634`); server-side WebAuthn origin/RP/signature verification (`app/api/auth/[action]/route.ts:140–237`); constrained JWT algorithm/issuer/audience and HTTP-only/Secure/SameSite cookies (`lib/auth.ts:24–52`); origin checks and bounded JSON bodies (`lib/http.ts:4–34`); React text rendering and CSV formula protection (`lib/db.ts:558–563`). Production enforcement and adversarial runtime testing remain UNVERIFIED. No penalty is imposed for optional controls the rubric only recommends. |

## Overall result

| Category | Awarded | Maximum |
| --- | ---: | ---: |
| Feature completeness | 95 | 110 |
| Testing coverage | 0 | 30 |
| Deployment | 10 | 30 |
| Quality and performance | 13 | 30 |
| **Total** | **118** | **200** |

**Overall grade: Incomplete**, using the rubric's **100–119** band (`EVALUATION.md:860`). The grade is provisional under the explicit conservative treatment of unverified runtime criteria. The rubric supplies no mandated static-only conversion, so a different institutional policy for submitted execution artifacts could change withheld points.

The project has substantial implementation and authored tests. It is not defensible to label it “production ready” from this review: actual deployment, runtime testing and performance/accessibility thresholds remain unverified. The MVP gate itself requires a deployed HTTPS app, working production passkeys and persistent data (`EVALUATION.md:787–794`).

## Highest-priority improvements for a later implementation pass

1. Separate claiming a reminder from acknowledging successful notification delivery; introduce retryable claims/leases or an equivalent recovery strategy while preserving deduplication.
2. Determine subtask completion from completed-count equality, independently of rounded display percentages; add a regression case with 200 of 201 complete.
3. Show an explicit task-count badge for each nonempty calendar day, including one to three tasks.
4. Add the missing JWT unit cases and an actual forged-session-cookie rejection case. Keep coverage claims explicitly scoped.
5. Add the rubric's production error boundary and server-side exception diagnostics without exposing secrets.
6. In a separately authorized runtime review, verify the unverified criteria and rescore them. No such execution was performed here.

**Change scope:** Only this new `GRADING_RESULT.md` was created for the grading request. Implementation, existing documentation, tests, configuration and submitted evidence were left unchanged.
