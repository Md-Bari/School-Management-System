# AI Usage

## Tools

- **Claude Code** (Anthropic, model Claude Opus 5.5) in VS Code, used as a coding agent.

## What it was used for

AI was used heavily, across almost the whole project:

- Breaking the brief down into a requirements checklist and a build plan (`BUILD_PLAN.md`)
- Backend code: API endpoints, the admission service with its locking SQL, middleware, schema
- Backend integration and concurrency tests
- Frontend: React components, hooks, API client, Bangla UI text, Vitest tests
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

## How the output was verified

- All backend tests run against a real PostgreSQL in Docker (36 tests, including 150
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

## My own review

<!-- TODO (author): add, in your own words, what you personally reviewed or changed, and
     anything you would do differently. Remove this comment before submitting. -->
