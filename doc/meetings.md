# Kete — Meetings record

**Schedule:** weekly, Mondays 14:00–16:00.
**Members:** Nicholas Shih Hao Ng (client), Sokhour Lay (backend), Kyle Wakos (cloud).

> **Backfilled 2026-09-17.** Entries M1–M6 were reconstructed on 17 September
> 2026 from the repository history, the issue timestamps and the dated decisions
> already recorded in `doc/delivery-plan.md`. They were **not** written at the
> time of the meeting. Every entry carries an **Evidence** line naming what it
> was reconstructed from. Fields marked `[to confirm]` had no evidence behind
> them and are left for a member who was present to complete — they are not
> guesses. From M7 (2026-09-21) onward this record is kept live, in the meeting.

> **This file is not a mirrored snapshot.** Every other document in `doc/` is
> copied in from the project notes, which remain the source of truth. This one
> was authored here, from evidence in this repository. That makes it the
> exception to the rule in [`README.md`](README.md), and it has a consequence:
> the mirror is one-way, so **a refresh that does not know about this file will
> drop it.** It needs a counterpart upstream. Until it has one, edit it here.

---

## M1 — Monday 2026-08-10, 14:00–16:00
**Milestone:** W5 Foundations · **Attendees:** `[to confirm — assumed all three]`

**Decisions**
- Team formed; each member owns one tier across every feature rather than one feature across every tier.
- Lanes assigned: Nicholas → client, Sokhour → backend, Kyle → cloud.
- Stack settled: React + TypeScript client, Python/FastAPI backend, PostgreSQL on RDS, S3, EC2, JWT auth.
- Repository `nomadwiz/kete` created as a monorepo, with licence and ignore rules.

**Actions**
- Sokhour — begin the FastAPI endpoint scaffold and the schema.
- Kyle — begin AWS account and environment setup.

**Evidence:** commit `ccbe440` "Initial commit", 2026-08-10 12:41. Issues Z1 (#136) and Z2 (#137), both closed against W5 Foundations.

---

## M2 — Monday 2026-08-17, 14:00–16:00
**Milestone:** W6 Design · **Attendees:** `[to confirm]`

**Decisions** — `[to confirm]`. The milestone this week is "API specification, database schema and diagrams complete", and the schema and the seventeen endpoint shapes appear in the history eight days later, so the design was settled somewhere in this window. The specific decisions are not recorded.

**Actions** — `[to confirm]`

**Evidence:** milestone W6 Design (17–23 Aug) and its six issues; the schema and endpoints that land in `40ba03f` on 2026-08-25. Inferred from the milestone, not from a record of the meeting itself.

---

## M3 — Monday 2026-08-24, 14:00–16:00
**Milestone:** Break Buffer · **Attendees:** `[to confirm]`

**Decisions** — `[to confirm]`. The backend scaffold and the full database wiring landed the following day across four commits, so the build was handed off at or before this meeting.

**Actions**
- Sokhour — implement the endpoint scaffold, schema and database wiring. *(Completed 2026-08-25.)*

**Evidence:** commits `40ba03f`, `2d14b27`, `e231bb5`, `bf3a735`, all 2026-08-25 between 15:45 and 17:39.

---

## M4 — Monday 2026-08-31, 14:00–16:00
**Milestone:** Break Buffer · **Attendees:** `[to confirm]`

**Decisions** — `[to confirm]`

**Note:** the repository records no activity between 2026-08-25 and 2026-09-15 — a three-week gap spanning the mid-semester break. Whether this meeting was held is `[to confirm]`. It is listed because the schedule says it fell due; it is not claimed to have happened.

**Evidence:** none. Listed from the standing schedule only.

---

## M5 — Monday 2026-09-07, 14:00–16:00
**Milestone:** W7 Foundations in code · **Attendees:** `[to confirm]`

**Decisions** — `[to confirm]`

**Note:** as M4 — no repository activity in this week. Held or not held is `[to confirm]`.

**Evidence:** none. Listed from the standing schedule only.

---

## M6 — Monday 2026-09-14, 14:00–16:00
**Milestone:** W8 Backend · **Attendees:** `[to confirm — all three implied by the lane split]`

**Decisions** *(this meeting and the day after it are the best-evidenced in the project)*
- **Horizontal split confirmed** — one member per tier, across every feature.
- **The database seam named explicitly** — backend owns the schema, migrations and queries; cloud owns the instance, network rules, credentials, backups and cost. Recorded as the seam both owners would otherwise assume the other had covered.
- **Client framework changed to React with TypeScript (Vite)**, replacing Angular. The report's §7.5 still says Angular — raised as issue D1 (#204).
- **Project management moved to GitHub Projects**, replacing Notion. The report's §6.6 and §7.5 still say Notion — same issue D1.
- **Three delivery measures adopted:** contract first; deploy before you build; first milestone is a vertical slice.
- **Two contract gaps identified** in the backend branch, both response-shape changes that must land before the client builds against them: the week's plan carries no nutrition (→ B2, #151), and saved measurements cannot be read back (→ B3, #152).

**Actions**
- Sokhour — close B2 and B3 before the contract freeze.
- Nicholas — build the board and the issue backlog. *(Completed 2026-09-16: 82 issues, 05:01–10:33 UTC.)*
- All — adopt the cross-lane review rule from the commit that adds `CONTRIBUTING.md`, not retrospectively.

**Evidence:** `doc/delivery-plan.md` line 3 ("Decided in discussion 2026-09-14/15"), lines 13 and 19 (both changes dated 2026-09-15), line 108 (contract gaps, "Found 2026-09-15"), line 249 ("State of the backend, read 2026-09-15"). Commits `8e06fb1` (2026-09-15 18:39) and the 82 issues created 2026-09-16.

---

## M7 — Monday 2026-09-21, 14:00–16:00 — *scheduled*
**Milestone:** W9 Front end

**Standing agenda from here on:** last week's actions; each lane's state; anything crossing a seam; next week's actions with an owner and a due date. Minutes written **in** the meeting, not reconstructed after it.

**Carried in:**
- S3 (#140) — repository URL, and the repository is still private. Needs @nomadwiz; see the issue.
- S7 (#144) — this record and [`worklog.md`](worklog.md) need a GitHub Projects home with citable URLs.
- The cloud lane has no committed work in the repository (see [`worklog.md`](worklog.md)). Cloud implementation and cloud engineering quality are 20 of the 40 technical marks.
