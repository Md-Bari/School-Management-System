# School Admission System

Online admission for a school that admits on a **first-come, first-served** basis.
Applying puts a seat on **hold** for the student for a limited time. Paying the admission fee
within that time **confirms** the admission. Otherwise the seat goes back to the pool by itself.

- **Backend:** C# / ASP.NET Core (.NET 10), PostgreSQL 16, Dapper + Npgsql
- **Frontend:** React 18 + TypeScript (Vite), served by nginx
- **Everything runs with Docker.** Nothing else needs to be installed.

## Run the app

```bash
docker compose up --build
```

| What | URL |
|---|---|
| Frontend (UI) | **http://localhost:3000** |
| Backend API | http://localhost:8080 |

The first build downloads the .NET, Node and PostgreSQL images and takes a few minutes.
Later starts are fast. Stop with `Ctrl+C` or `docker compose down`. Data is kept in the
`pgdata` volume and survives `down` + `up`. Use `docker compose down -v` to wipe it.

### Using the UI

1. **Class তৈরি (Admin)**: create a class. Every shift is its own class,
   e.g. `Class 6 - Morning Shift` with 120 seats.
2. Type the student's **17-digit birth registration number** in the box at the top and press
   **ব্যবহার করুন**. There is no login: this number is the student's identity. It is remembered
   in the browser, and Bangla digits are accepted.
3. **Class তালিকা**: total / held / confirmed / free seats, refreshed every 3 seconds.
   Press **আবেদন করুন** to apply.
4. **আবেদন** page: live countdown, **ভর্তি ফি দিন** (simulated successful payment) and **বাতিল**.
5. **আমার আবেদন**: all applications of this student and their status.

## Run the tests

Both test suites run inside Docker, so no SDK is needed:

```bash
# Backend: 33 xUnit integration tests against a real PostgreSQL
# (each run creates a throw-away database and drops it afterwards)
docker compose --profile test run --rm backend-tests

# Frontend: Vitest + Testing Library
docker compose --profile test run --rm frontend-tests
```

Backend tests include the required **concurrency test**: 150 simultaneous hold requests on
a 20-seat class must give exactly 20 holds. They also cover two API instances sharing one
database (bonus), one student firing 30 parallel requests, 20 parallel confirms of the same
hold, expiry with 2-second holds, ownership checks and 4xx on bad input.

<details>
<summary>Running tests without Docker (optional)</summary>

Needs the .NET 10 SDK / Node 20+ and a PostgreSQL you can reach.

```bash
# backend: point the tests at any PostgreSQL server (a database is created per run)
export TEST_DB_CONNECTION_STRING="Host=localhost;Port=5432;Username=postgres;Password=postgres;Database=postgres"
cd backend && dotnet test

# frontend
cd frontend && npm ci && npm test
```
</details>

## Configuration

| Variable | Service | Default | Meaning |
|---|---|---|---|
| `HOLD_DURATION_SECONDS` | backend | `600` | How long a seat stays on hold before it is released |
| `ConnectionStrings__Default` | backend | compose `db` service | PostgreSQL connection string |
| `DATABASE_CONNECTION_STRING` | backend | – | Alternative name; wins over the one above if set |
| `API_BASE_URL` | frontend | `http://localhost:8080` | Backend URL **as seen by the browser**; applied at container start, no rebuild |
| `VITE_API_BASE_URL` | frontend (dev) | `http://localhost:8080` | Backend URL for `npm run dev` |

Compose reads `HOLD_DURATION_SECONDS` and `API_BASE_URL` from your shell or an `.env` file.
For example, to watch a hold expire quickly:

```bash
HOLD_DURATION_SECONDS=30 docker compose up
```

## Bonus: two backend processes, one database

```bash
docker compose --profile multi up --build
```

This starts a second backend on **http://localhost:8081** against the same database. Both
processes can take holds for the same class at the same time without overselling, because the
seat check runs under a PostgreSQL row lock rather than an in-memory one. See
[ASSUMPTIONS.md](ASSUMPTIONS.md#concurrency) for the full explanation. The test
`TwoBackendProcessesSharingTheDatabase_NeverOversell` checks this automatically.
