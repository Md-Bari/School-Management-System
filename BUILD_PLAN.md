# Build Plan — School Admission System

This document is the plan the project was built from: the architecture, the key design
decisions, and the order of work. The decisions and the reasons behind them are in
[ASSUMPTIONS.md](ASSUMPTIONS.md).

## 1. Requirements checklist

| # | Requirement (from the brief) | Where it is handled |
|---|---|---|
| 1 | held + confirmed never exceeds totalSeats, under any concurrency | `AdmissionService.CreateHoldAsync`: class row lock (`SELECT … FOR UPDATE`) |
| 2 | Hold duration from `HOLD_DURATION_SECONDS` (default 600); seat returns by itself | `AdmissionOptions`; lazy expiry in every count query |
| 3 | One active/confirmed application per student per class (optional stricter switch: one admission per student overall, `ONE_ADMISSION_PER_STUDENT`, off by default) | class lock + per-student advisory lock + partial unique index |
| 4 | Only own, unexpired HELD holds can be confirmed | `ConfirmHoldAsync` (403 / 409) |
| 5 | Repeated confirm counts once | confirm is idempotent under the row lock |
| 6 | No data loss on restart / `down` + `up` | PostgreSQL in named volume `pgdata` |
| 7 | Bad input → 4xx, never 500 | manual JSON parsing + `ErrorHandlingMiddleware` |
| 8 | Everything doable from the UI | 4 screens: class list, admin create, application, my applications |
| 9 | Expiry shows EXPIRED and disables pay button without reload | `HoldActions` + `useNow` (client-side countdown) |
| 10 | Seat counts refresh every few seconds | `usePolling` every 3 s on class list |
| 11 | Ongoing applications survive refresh / browser restart | student ID in `localStorage`, holds re-fetched from server |
| 12 | Every error readable by a parent | error code → Bangla message map, `ErrorBoundary`, stale-data banner |
| B1 | Two backend processes on one DB stay correct | DB row locks, not in-memory locks; `backend-2` compose profile + test |
| B2 | Frontend automated tests | Vitest + Testing Library |

## 2. Architecture

```
 Browser (React SPA)  ──HTTP/JSON──►  ASP.NET Core API (.NET 10)  ──Npgsql──►  PostgreSQL 16
   nginx :3000                          :8080 (1..n processes)                  volume: pgdata
```

- **Backend**: ASP.NET Core minimal API, Dapper + Npgsql, explicit SQL. No EF Core, so the
  locking SQL is plain to read.
- **Database**: two tables, `classes` and `holds`. The schema is created idempotently at
  startup, under an advisory lock so two processes can start together.
- **Frontend**: React 18 + TypeScript + Vite, no UI library, a small hash router. It is served by
  nginx; the API URL is injected at container start from `API_BASE_URL`.

### Data model

```
classes(id PK, name, total_seats > 0, created_at)
holds(id PK, class_id FK, student_id (17 digits), status, created_at, expires_at,
      confirmed_at, cancelled_at)
unique (class_id, student_id) where status in ('HELD','CONFIRMED')
```

### Concurrency design (the core of the assignment)

Every operation that changes seat usage for a class runs in one transaction:

1. `SELECT … FROM classes WHERE id = $1 FOR UPDATE`: this serialises all writers for that class,
   across all backend processes, because the lock lives in PostgreSQL.
2. `SELECT clock_timestamp()`: one clock (the database's), read *after* the lock is acquired.
3. Flip stale `HELD` rows to `EXPIRED`, check the rules, then insert or update.
4. Commit.

Reads never lock. They compute `held` as `status = 'HELD' AND expires_at > clock_timestamp()`,
so an expired hold stops counting the moment it expires. No job or API call is needed for that.

## 3. Work plan (order of implementation)

1. **Backend skeleton**: solution, API project, configuration (`ConnectionStrings__Default`,
   `HOLD_DURATION_SECONDS`), error model, JSON date format.
2. **Schema + initializer**: tables, indexes, retry until the DB is reachable.
3. **Admission service**: create/list/get class, create hold (lock → expire → rule 3 → rule 1 →
   insert), get hold, confirm, cancel, my holds, sweeper.
4. **Endpoints**: exactly the 8 routes and JSON shapes from the brief (extra fields only appended).
5. **Backend tests** (xUnit + WebApplicationFactory against real PostgreSQL):
   - 150 parallel holds on 20 seats → exactly 20 succeed
   - two API instances in parallel → no oversell (bonus)
   - same student × 30 parallel → exactly 1 hold
   - 20 parallel confirms → confirmedSeats = 1
   - expiry with 2-second holds, ownership, cancel, validation (14 bad bodies), 404s
6. **Docker**: multi-stage backend image (with a `test` target), compose with healthcheck,
   named volume, `multi` and `test` profiles.
7. **Frontend foundation**: config, typed API client, error → Bangla message map, server clock
   offset, hooks (`usePolling`, `useNow`, `useStudentId`, `useHashRoute`).
8. **Frontend UI**: student ID bar, class list, admin create, application page, my applications,
   `HoldActions` (countdown + pay/cancel), error boundary.
9. **Frontend tests**: Vitest + Testing Library (expiry without reload, polling, error messages,
   validation).
10. **Frontend Docker**: nginx image, runtime `config.js`, SPA fallback.
11. **End-to-end verification**: `docker compose up`, curl every endpoint, a headless browser
    walk-through, restart persistence.
12. **Docs**: README, ASSUMPTIONS, AI_USAGE.

## 4. Verification checklist before submitting

- [ ] `docker compose up --build` on a clean machine → http://localhost:3000 works
- [ ] `docker compose --profile test run --rm backend-tests` → all green
- [ ] `docker compose --profile test run --rm frontend-tests` → all green
- [ ] Create class → apply → pay → counts update in a second browser tab without reload
- [ ] `HOLD_DURATION_SECONDS=30 docker compose up` → hold turns EXPIRED on screen at 0:00
- [ ] `docker compose down && docker compose up` → data still there
- [ ] Stop the backend → UI shows "সার্ভারের সাথে সংযোগ করা যাচ্ছে না", no blank page
- [ ] Repository is public, history has many small commits
