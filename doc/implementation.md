# How Kete is built

The technical picture: what the pieces are, what is actually running, and what
must not be changed. [`product.md`](product.md) says what Kete is and who it is
for, in plain words, and carries no technology at all. This file is where the
technology lives.

Edited here, by any member, through a branch and a reviewed pull request.

## 1. The three tiers

A browser client, a REST API, and a database. Nothing talks to the database
except the API.

| Tier | What it does |
| --- | --- |
| **Client** | Every page the user sees. Holds the sign-in token, validates forms, draws the week grid and the comparison against targets. Talks only to the API. |
| **Backend** | Every endpoint. Checks the token on each request, does the nutrition arithmetic, and owns every database query. |
| **Database** | Five tables: users, their body measurements, their computed targets, their recipes, and the twenty-one slots of a week. |

The split matters for one reason worth stating: **the client never computes a
nutrition figure.** Every number on screen came from the API, so there is one
implementation of the arithmetic and one place to correct it.

## 2. The stack, as built

| Piece | Built with |
| --- | --- |
| Client | React with TypeScript, on Vite |
| Backend | Python, FastAPI, SQLAlchemy |
| Database | PostgreSQL on Amazon RDS — schema in `backend/schema.sql` |
| Object storage | Amazon S3 — recipe photographs, and static hosting for the compiled client |
| Compute | Amazon EC2, for the backend |
| Sign-in | JSON Web Tokens issued by the API |

Two of these are recorded differently in the report, which still says Angular
and Notion in places. That is issue D1 (#204), not a disagreement about what is
built.

## 3. The API contract

**The contract is the FastAPI schema**, generated from the request and response
models in `backend/main.py` and served at `/docs` on the running API. There is no
second, hand-written contract document, deliberately — a written copy would
drift from the code within days and the client lane would build against the
wrong one.

## 4. What is real, and what is not

Read from the code on 15 September 2026. Update it when that stops being true.

**Real, and working against the database.** `database.py` builds the connection
from `.env` and applies SSL automatically for RDS. `models.py` and `schema.sql`
carry the five tables with their unique constraints and cascading deletes.
`security.py` hashes passwords and issues a twelve-hour token. Sixteen of the
seventeen endpoints run real queries, and every one of them scopes by the user id
taken from the token rather than from the request.

**Not real yet.** The photo upload is the only faked endpoint — it returns a
constructed S3 URL and stores nothing. `SAMPLE_RECIPES` is dead code no endpoint
reads. The application still calls itself a stub in its title, its version and
its health check. CORS allows every origin — `allow_origins=["*"]`, alongside
`allow_credentials`, which is finding #26 and has to be fixed before the API is
reachable in public. `JWT_SECRET` falls back to a published default instead of
refusing to start. Dependencies are minimum-version rather than pinned. There
are no tests of any kind.

**Where the risk actually is.** Not here. The cloud work has not started, and the
client is being written in a different framework from the one the report
describes.

## 5. Things that are already right — do not "improve" them

These were reviewed and found correct. Changing one breaks a claim the report
makes, and in three cases breaks the security argument it rests on.

- **Every query is scoped by the user id taken from the token**, never from the
  client: `current_user_id` as a dependency, `filter_by(user_id=user_id)` on
  every query, and `_owned_recipe` returning **404 rather than 403** so the
  endpoint does not confirm that someone else's record exists. Keep all three.
- **`security.py`**: PBKDF2-SHA256, per-password salt, 240,000 iterations,
  algorithm and iteration count stored in the hash string, `hmac.compare_digest`
  for the comparison. Do not lower the iteration count or swap the comparison.
- **`database.py`**: `quote_plus` on the password and automatic
  `sslmode=require` for RDS hosts.
- **The Mifflin-St Jeor arithmetic**, **the five activity factors**, and the
  4/4/9 gram conversion are the standard published values. Do not round or
  "tidy" them.

## 6. How this document is shaped, and why

This follows **arc42**, the lightweight architecture template, cut down to the
sections that earn their place here. Dropped on purpose: the runtime and
concurrency views, because nothing in this system runs concurrently in any way a
reader needs explained; and the quality-attribute scenarios, because
[`report.md`](report.md) §5.5 already owns them and saying it twice would mean
correcting it twice.

What is deliberately elsewhere: the architecture diagrams and their justification
are [`report.md`](report.md) §7, and the cloud services and how they were set up
are §8. Why a choice was made rather than its alternative is being pulled into a
`decisions.md` under issue #225 — until that exists, the reasoning sits in
[`report.md`](report.md) §5.8 and §7.5.
