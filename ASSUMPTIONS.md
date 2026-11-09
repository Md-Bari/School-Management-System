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
