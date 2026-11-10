# Assumptions

Where the brief was not explicit, this is what I assumed and why.

## Identity

- **The student is identified only by `X-Student-Id`** (17-digit birth registration number).
  There is no login, as the brief says. It must be exactly 17 ASCII digits; anything else is
  `400`. The UI also accepts Bangla digits (`০-৯`) and spaces or dashes and normalises them
  before sending, because parents often type it that way.
- **The admin screen is not protected.** The brief says "no login", so anyone can create a
  class. In a real deployment this screen would sit behind authentication.

## Classes

- **Every shift is its own class** (`Class 6 - Morning Shift`, `Class 6 - Day Shift`), with its
  own seat count, as the brief describes. There is no separate "shift" entity.
- **Duplicate class names are allowed.** Two classes may share a name, and the id tells them
  apart. Rejecting duplicates could break automated tests that create the example class
  repeatedly.
- **Limits:** name 1–100 characters (trimmed); `totalSeats` a whole number from 1 to 10 000.
  Strings, fractions, negatives and missing fields are `400`.
- Classes cannot be edited or deleted. The brief has no endpoint for it, and changing seats
  under live holds would need its own rules.

## Holds and expiry

- **Expiry is lazy and exact.** A `HELD` hold whose `expires_at` has passed is treated as
  `EXPIRED` everywhere (counts, `GET /holds`, `/me/holds`) at that moment. No background job or
  API call is needed for the seat to come back (rule 2). A sweeper also rewrites such rows to
  `EXPIRED` every 30 s, but only to keep the stored column tidy; correctness does not depend on it.
- **One clock: the database's.** All times come from PostgreSQL `clock_timestamp()`, so several
  backend processes with slightly different clocks still agree on expiry.
- **`expiresAt` is whole seconds** (`2026-11-01T04:10:00Z`, like the brief). The stored expiry is
  truncated to the second, so a hold lasts between `HOLD_DURATION_SECONDS − 1` and
  `HOLD_DURATION_SECONDS` seconds.
- An invalid or non-positive `HOLD_DURATION_SECONDS` falls back to 600 with a warning.

## Concurrency

Rule 1 (held + confirmed ≤ totalSeats) is enforced **in PostgreSQL, not in application memory**.
That is why it also holds with several backend processes (the bonus):

1. Every write that can change seat usage for a class (new hold, confirm, cancel, expiring)
   starts with `SELECT … FROM classes WHERE id = $1 FOR UPDATE`. Only one transaction per class
   can hold that row lock, so the "count, then insert" check cannot interleave, whichever process
   the request lands on.
2. The current time is read **after** the lock is acquired (`clock_timestamp()`, not `now()`,
   which is frozen at transaction start). Otherwise a transaction that waited for the lock could
   judge expiry with a stale time and confirm a hold that another transaction already counted
   as expired.
3. All writers lock in the same order (class row, then hold row), so they cannot deadlock.
4. Rule 3 is backed by a partial unique index on `(class_id, student_id) WHERE status IN
   ('HELD','CONFIRMED')` as a database-level safety net.

Different classes do not block each other. Only requests for the *same* class are serialised,
which is the minimum needed for correctness. I chose a row lock over `SERIALIZABLE` isolation
because it needs no retry loop and blocked requests simply wait their turn. That fits a
"first come, first served" admission.

## Confirm, cancel and rule 3

- **Rule 3**: a student may have at most one `HELD` (not yet expired) **or** `CONFIRMED`
  application per class. A second attempt is `409 ALREADY_APPLIED` / `409 ALREADY_CONFIRMED`.
  After an application expires or is cancelled, the student may apply again.
- By default a student may apply to and be admitted to **several different classes**, because
  rule 3 limits it per class and the API tests may reuse one student ID across classes.
- **Optional stricter rule: `ONE_ADMISSION_PER_STUDENT=true`.** In real life a student attends
  one class and one shift, so with this switch the birth registration number may hold at most one
  `CONFIRMED` admission overall. It is off by default so the API behaves exactly as the brief;
  all backend processes must use the same value. `GET /settings` tells the UI whether it is on.
  - Pending applications (`HELD`) to several classes at the same time are still allowed, so a
    parent can try two shifts and pay for whichever they get. This also keeps `/me/holds`
    useful as a list.
  - When one application is confirmed, the student's other pending holds are cancelled
    automatically, so those seats go back to other students right away.
  - Once admitted, applying to or confirming any other class gives `409 ALREADY_ADMITTED`.
  - Concurrency: every hold/confirm/cancel first takes a per-student PostgreSQL advisory lock
    (`pg_advisory_xact_lock`), before the class lock. Lock order is always student → class →
    hold, so two confirms in different classes at the same instant cannot both succeed, even on
    different backend processes. A unique index on `student_id WHERE status = 'CONFIRMED'` is
    the database-level safety net; it exists only while the switch is on.
- **Confirm** is idempotent: confirming an already-`CONFIRMED` hold returns `200` again and
  `confirmedSeats` does not change (rule 5). Expired → `409 HOLD_EXPIRED`; cancelled →
  `409 HOLD_CANCELLED`; someone else's hold → `403 NOT_YOUR_HOLD`.
- **Cancel** (`DELETE`) works only on a live `HELD` hold → `204`. Cancelling an already
  cancelled hold is also `204` (idempotent). A **confirmed admission cannot be cancelled** here
  (`409`), because the fee has been paid and refunds are outside this system. An expired hold
  gives `409 HOLD_EXPIRED`.
- `GET /holds/{holdId}` does not require `X-Student-Id`, because the brief lists no header for it.
  Hold ids are random 64-bit values, so they cannot be guessed.
- Payment is simulated: pressing "ভর্তি ফি দিন" counts as a successful payment.

## Errors

- Every error is JSON: `{ "error": "<CODE>", "message": "<English text>", "details": … }`.
  The UI turns the code into a Bangla sentence.
- Bad input → `400`, unknown id or route → `404`, wrong owner → `403`, business-rule
  conflicts → `409`. If the database is unreachable the API answers `503` (not `500`), so the
  UI can say "try again shortly". `500` is reserved for real bugs.
- Text the database cannot store (NUL, other control characters, broken UTF-8/UTF-16) is
  rejected with `400`; any PostgreSQL "data exception" (SQLSTATE class 22) is also mapped to
  `400` as a safety net. Request bodies over 64 KB get `413`.

## Security

- No login exists (by the brief), so there are no passwords or sessions to steal; the API sends
  no cookies, which is why CORS can allow any origin without risk.
- All SQL is parameterised (Dapper); ids from the URL are never concatenated into SQL.
- A hold can only be confirmed or cancelled with the owner's `X-Student-Id` (`403` otherwise).
- API responses: no `Server` header, `X-Content-Type-Options: nosniff`, `Cache-Control: no-store`.
- Frontend (nginx): Content-Security-Policy (scripts only from the site itself),
  `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer`, nginx version hidden.
- The backend container runs as a non-root user; PostgreSQL is not published to the host.
- `dotnet list package --vulnerable` and `npm audit`: no known vulnerabilities.
- Not done (outside the brief): authentication for the admin screen, rate limiting. A rate limit
  could also block the evaluators' own burst tests.

## Performance

- A request for a class that is already full is rejected before taking the class lock, so
  late applicants get their `409` without waiting in the queue. It can only reject, never grant,
  so rule 1 still depends only on the locked check.
- Load test (k6, Docker Desktop on a laptop): 1000 simultaneous applications for one 100-seat
  class → exactly 100 holds, 900 × `409`, 0 errors, slowest response 4.5 s; 1000 simultaneous
  `GET /classes` → all `200` within 0.5 s.

## Frontend

- **Live updates by polling**: class list every 3 s, application pages every 5 s. This is simple,
  needs no extra infrastructure, and is enough for "every few seconds" (rule 10).
- **Countdown runs in the browser**, so a hold turns `EXPIRED` and the pay button is disabled
  exactly at 0:00 without waiting for the next poll or a reload (rule 9). The backend sends
  `X-Server-Time` on every response and the UI corrects for a wrong device clock.
- **Persistence across refresh / browser restart** (rule 11): the student ID is stored in
  `localStorage`, and applications are always re-fetched from the server (`/me/holds`). The
  application page lives at a URL (`#/holds/<id>`), so a refresh stays on it.
- If a refresh fails, the last good data stays on screen with a warning instead of disappearing.
- **The UI is in Bangla by default** (with the English terms the brief itself uses: class, seat,
  hold), because the users are parents in Bangladesh. A button in the header switches the whole
  UI, including error messages, to English and back; the choice is remembered in the browser.
  Translations live in one file (`frontend/src/i18n/messages.ts`) and the build fails if an
  English text is missing.
- **The API URL is configured at container start** (`API_BASE_URL` → `/config.js`), not baked in
  at build time, so changing it needs no rebuild. It must be the URL as seen by the *browser*.

## Infrastructure

- **.NET 10** (LTS). The brief says ".NET 8 or newer".
- **Dapper + Npgsql instead of EF Core**, so the locking SQL is explicit and easy to review.
  The schema is created at startup (`CREATE … IF NOT EXISTS` under an advisory lock) instead of
  migrations; that is enough for two tables.
- **PostgreSQL is not published to the host**, to avoid clashing with a local PostgreSQL on
  5432. Tests run inside the compose network.
- **`max_connections=300`** on PostgreSQL, because two backend processes, each with Npgsql's
  default pool of 100, would otherwise be able to exhaust the default 100 under a burst.
- Ports: backend 8080 (required), frontend 3000, optional second backend 8081.
