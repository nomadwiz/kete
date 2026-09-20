# Kete — Meetings record

**Schedule:** weekly, Mondays 14:00–16:00.
**Members:** Nicholas Shih Hao Ng (client), Sokhour Lay (backend), Kyle Wakos (cloud).

> **Backfilled 2026-09-17.** Entries M1–M6 were reconstructed on 17 September
> 2026 from the repository history, the issue timestamps and the dated decisions
> already recorded in `doc/delivery-plan.md`. They were **not** written at the
> time of the meeting. Every entry carries an **Evidence** line naming what it
> was reconstructed from. Where the reconstruction had no evidence behind it,
> the entry was marked `[to confirm]` and put to the members in review of
> PR #219. @nomadwiz confirmed attendance and the milestone plan the entries
> below record as settled; @laysokhour-computer confirmed that **no meeting was
> held on 24 or 31 August**, both inside the mid-semester break, and supplied M5
> from recall. Where an entry rests on recall rather than on something a marker
> can check, its Evidence line says so.
> From M7 (2026-09-21) onward this record is kept live, in the meeting.

> **This file is not a mirrored snapshot.** Every other document in `doc/` is
> copied in from the project notes, which remain the source of truth. This one
> was authored here, from evidence in this repository. That makes it the
> exception to the rule in [`README.md`](README.md), and it has a consequence:
> the mirror is one-way, so **a refresh that does not know about this file will
> drop it.** It needs a counterpart upstream. Until it has one, edit it here.

---

## M1 — Monday 2026-08-10, 14:00–16:00
**Milestone:** W5 Foundations · **Attendees:** @laysokhour-computer, @nomadwiz, @kylewakos

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
**Milestone:** W6 Design · **Attendees:** @laysokhour-computer, @nomadwiz, @kylewakos

**Decisions**
- W6 Design scoped as "API specification, database schema and diagrams complete", carrying six issues: S1 (#138), S4 (#141), S5 (#142), Z3 (#145), D10 (#202), D11 (#203).
- **Database schema settled** at five tables, with their constraints and cascades — Z3 (#145).
- **The API contract is frozen before the client builds against it**, and the OpenAPI schema published — S1 (#138).
- **Two presentation questions left with the client lane**: how the gap against targets is shown — S4 (#141) — and whether the comparison is judged per day or across the week — S5 (#142).
- FR-16, the comparison against targets, to be added to the report — D10 (#202); the diagrams move into `design/` with the figure syntax fixed — D11 (#203).

**Actions**
- Sokhour — implement the schema and the endpoint shapes. *(Landed 2026-08-25 in `40ba03f`.)*
- Nicholas — the diagrams and the report's design figures (D10, D11).

**Evidence:** milestone W6 Design (17–23 Aug) and its six issues — #138, #141, #142, #145, #202, #203; `doc/delivery-plan.md` line 68; the schema and the seventeen endpoint shapes that land in `40ba03f` on 2026-08-25. The meeting's attendance and the plan it settled were confirmed by @nomadwiz in review of PR #219.

---

## M3 — Monday 2026-08-24 — *not held*
**Milestone:** Break Buffer · **Not held:** mid-semester break.

Listed because the standing schedule says it fell due. No meeting took place and no decisions were made. The backend scaffold, schema and database wiring landed the following day regardless — that work is in [`worklog.md`](worklog.md), not here, because no meeting handed it off.

**Evidence:** confirmed by @laysokhour-computer in review of PR #219, 2026-09-20. Consistent with the repository, which records no activity between 2026-08-25 and 2026-09-15.

---

## M4 — Monday 2026-08-31 — *not held*
**Milestone:** Break Buffer · **Not held:** mid-semester break.

Listed because the standing schedule says it fell due. No meeting took place and no decisions were made.

**Evidence:** confirmed by @laysokhour-computer in review of PR #219, 2026-09-20. The repository records no activity in this week.

---

## M5 — Monday 2026-09-07, 14:00–16:00
**Milestone:** W7 Foundations in code · **Attendees:** @laysokhour-computer, @nomadwiz, @kylewakos

**Decisions**
- First meeting back after the mid-semester break (M3 and M4 were not held). Each lane reported what it had done over the break.
- Suggestions put to the cloud lane on the infrastructure build. The specific suggestions were not written down at the time.

**Actions**
- Kyle — carry the cloud infrastructure suggestions into the Break Buffer build (K1–K7).

**Note:** the repository records no activity in this week; the meeting produced discussion, not commits.

**Evidence:** no contemporaneous minutes. Recalled by @laysokhour-computer in review of PR #219, 2026-09-20.

---

## M6 — Monday 2026-09-14, 14:00–16:00
**Milestone:** W8 Backend · **Attendees:** @laysokhour-computer, @nomadwiz, @kylewakos

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
- S3 (#140) — closed 2026-09-17, the repository URL settled. The repository is still private; it goes public when the report cites it.
- S7 (#144) — this record and [`worklog.md`](worklog.md) need a GitHub Projects home with citable URLs.
- The cloud lane has no committed work in the repository (see [`worklog.md`](worklog.md)). Cloud implementation and cloud engineering quality are 20 of the 40 technical marks.
