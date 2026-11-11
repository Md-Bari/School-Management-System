# AI Usage

## Tools

- **Claude Code** (Anthropic, model Claude Opus 5.5) in VS Code, used as a coding agent.

## What I did

I set the direction, made the main decisions and checked the result against the brief. The
AI wrote most of the code; these are the parts that were my call.

I went through the brief rule by rule with the AI's requirements checklist and asked it to
confirm every rule was covered before submitting. I chose to keep the API exactly as specified,
because the evaluators test it directly.

I asked for a separate admin login with roles. Then I realised the brief says "Login লাগবে না"
and that a login on `POST /classes` would fail their API tests, so I removed it.

I wanted one student (one birth registration number) to get admission in only one class,
because that is how real schools work. Reading rule 3 again, I saw it only limits applications
per class. If their tests reuse the same student ID across classes, my rule would return 409
and break them. So I kept it, but as a switch (`ONE_ADMISSION_PER_STUDENT`) that is off by
default.

I asked for a load test with 1000 requests at the same time. No seat was oversold, but the last
requests in line for a single class waited 4–5 seconds. I also asked about nginx and Redis and
decided not to add Redis: seat counts must come from the database under a lock, and a cache can
only make them wrong.

On the UI, I asked for the big countdown on the application page and the English/বাংলা button.
I removed the "last updated" refresh time from the class list because parents don't need it,
and showed the hold time limit there instead. I also tried a countdown card on the class list,
then took it out to keep that page simple.

One mistake was mine. I changed the second backend's port to 8080, the same port as the first
one, so the two-process bonus could not start. It is back on 8081 now.

## What the AI did

Following those decisions, the AI wrote most of the project:

- The requirements checklist and build plan (`BUILD_PLAN.md`)
- Backend code: API endpoints, the admission service with its locking SQL, middleware, schema
- Backend integration and concurrency tests
- Frontend: React components, hooks, API client, Bangla/English UI text, Vitest tests
- Dockerfiles, `docker-compose.yml`, nginx config
- Drafts of README, ASSUMPTIONS and this file

The design decisions (row lock instead of SERIALIZABLE, lazy expiry, database clock,
idempotent confirm, no cancelling a confirmed admission) were discussed and checked against
the brief's rules one by one before they were accepted.

## Where the AI was wrong, and how it was caught

1. **Frontend container crashed on start.** The generated startup script that writes
   `config.js` had a broken `sed` escaping expression (a backslash was lost), so busybox `sed`
   failed and nginx never started. It was caught by running `docker compose up` and checking
   with `curl` (connection refused on port 3000), then reading `docker compose logs frontend`
   ("sed: bad option in substitution expression"). Fixed by stripping `"` and `\` with `tr`
   instead of escaping them.
2. **A wrong test.** One generated integration test called `GET /me/holds` without the
   `X-Student-Id` header and expected 200. The API correctly answered 400. It was caught by
   running the test suite (32/33 passing); the test was wrong, not the API.
3. **Catching the error in the wrong place.** The first version caught the unique-index
   violation around `COMMIT`, but PostgreSQL raises it on the `INSERT` itself, so the catch
   would never have fired. Caught in code review and moved.
4. **Connection limit under the bonus scenario.** Two backend processes with Npgsql's default
   pool (100 each) could exceed PostgreSQL's default `max_connections = 100` during a burst,
   which would turn into errors exactly when the concurrency guarantee matters. Caught while
   reviewing the two-process test; fixed with `max_connections=300` in compose.
5. **Port clash.** The first compose file published PostgreSQL on host port 5433, which was
   already in use on the development machine and would also be a risk on the evaluators'
   machines. The port is no longer published; tests run inside the compose network.
6. **500 on unusual text.** The class-name validation only checked length, so a name containing
   a NUL character, a lone UTF-16 surrogate or invalid UTF-8 reached PostgreSQL (or the JSON
   reader) and returned **500**, breaking rule 7. Caught by sending hostile inputs with `curl`
   to the running container. Fixed by rejecting such text with 400, plus a safety net that maps
   every PostgreSQL "data exception" to 400; covered by new tests.
7. **A stricter rule that could fail the API tests.** On my request, the AI added "a student
   can be admitted to only one class", but it was applied unconditionally. Checking it against
   rule 3 (which is *per class*) showed that API tests reusing one student ID across classes
   would get 409. It is now an opt-in switch (`ONE_ADMISSION_PER_STUDENT`), off by default.

## How the output was verified

- All backend tests run against a real PostgreSQL in Docker (48 tests, including 150
  simultaneous requests on 20 seats and two API instances in parallel).
- All frontend tests run in a Node container.
- The whole stack was started with `docker compose up`, every endpoint was called with `curl`,
  and a headless browser walked through: create class → enter ID (in Bangla digits) → apply →
  countdown → reload (ID and application still there) → pay → my applications → re-apply
  (readable error).
- With `HOLD_DURATION_SECONDS=8`, a browser test confirmed the hold turns `EXPIRED`, the pay
  button is disabled without a reload, and the seat shows as free again on the class list.
- `docker compose down` + `up` was run to confirm data survives a restart, and a second backend
  (`--profile multi`, port 8081) was checked to see the same data.
- `npm audit` flagged advisories in the dev/test tooling (Vitest, esbuild). The tooling was
  upgraded (Vite 8, Vitest 5) and all tests and the build were re-run: 0 vulnerabilities.

## What I would do differently

I would write the checklist of rules from the brief first and test every idea against it
before building, not after. I would also make holding a seat a single SQL statement, so that a
popular class handles a big rush faster.
