# Kete — Worklog

> **Backfilled 2026-09-17.** Every row below was reconstructed on 17 September
> 2026 from `git log` and the GitHub issue timestamps. **No row is an assertion**
> — each carries the commit SHA or issue range it came from, and a marker can
> verify any of them against the repository directly. Rows are dated by the
> evidence, not by when this file was written. From 2026-09-17 onward the
> worklog is kept live, and rows are added as work happens.
>
> Times are the author timestamps as recorded in the repository (local).

> **This file is not a mirrored snapshot.** Every other document in `doc/` is
> copied in from the project notes, which remain the source of truth. This one
> and [`meetings.md`](meetings.md) were authored here, from evidence in this
> repository. The mirror is one-way, so **a refresh that does not know about
> these two files will drop them.** They need counterparts upstream. Until they
> have them, edit them here.

## Entries

| When | Who | Lane | What | Evidence |
| --- | --- | --- | --- | --- |
| 2026-08-10 12:41 | Nicholas Ng | shared | Repository created — monorepo with `frontend/` and `backend/`, licence and ignore rules | `ccbe440` |
| 2026-08-10 14:00 | All | shared | M1: team, roles, lanes and stack settled | Meeting M1; issues Z1 (#136), Z2 (#137) |
| 2026-08-25 15:45 | Sokhour Lay | backend | FastAPI backend scaffold — seventeen endpoints with their request and response shapes, plus the RDS schema | `40ba03f` |
| 2026-08-25 17:30 | Sokhour Lay | backend | Auth and profile endpoints wired to PostgreSQL — password hashing, JWT issue and read | `2d14b27` |
| 2026-08-25 17:35 | Sokhour Lay | backend | Recipe CRUD wired to the database, every query scoped by the user id from the token | `e231bb5` |
| 2026-08-25 17:39 | Sokhour Lay | backend | Meal plan endpoints wired to the database | `bf3a735` |
| 2026-09-15 18:39 | Sokhour Lay | backend | Week 8 backend update | `8e06fb1` |
| 2026-09-16 00:10 | Sokhour Lay | backend | S3 bucket work on the photo upload path | `e63e9f4` |
| 2026-09-16 00:14 | Sokhour Lay | backend | Merged `backend` from origin | `b518caa` |
| 2026-09-16 05:01–10:33 | Nicholas Ng | shared | Built the project board and backlog — 82 issues across nine milestones, lane-labelled and assigned, with Start/Target fields set for the roadmap | GitHub issues, created 2026-09-16T05:01:13Z – 2026-09-16T10:33:48Z |
| 2026-09-16 11:28 | Nicholas Ng | shared | Merged PR #95, `backend` into `main` | `a68704b` |
| 2026-09-16 22:51 | Nicholas Ng | docs | Added `CLAUDE.md`, the repository brief for people and their agents | `c137cb1` |
| 2026-09-16 22:54 | Nicholas Ng | docs | Published the project documents into `doc/` as a read-only snapshot | `5b3592a` |
| 2026-09-16 22:54 | Nicholas Ng | shared | Added `CONTRIBUTING.md` with the cross-lane review rule | `791c4a8` |
| 2026-09-16 22:54 | Nicholas Ng | docs | Added `doc/open-findings.md`, the redacted cold-review summary | `ce36ae9` |
| 2026-09-17 08:29 | Nicholas Ng | shared | Merged PR #218, the published documents and brief | `ad7aa01` |

## Contribution as the repository currently records it

Commits by author email, whole history, read 2026-09-17:

| Member | Lane | Commits | Identities |
| --- | --- | --- | --- |
| Sokhour Lay | backend | 7 | `laysokhour.computer@gmail.com` |
| Nicholas Ng | client / docs | 7 | `nicholasngshihhao@gmail.com` (4), `60332249+nomadwiz@…` (2), `60332249+curiouskorokke@…` (1) |
| **Kyle Wakos** | **cloud** | **0** | — |

**Two things this table says, which are why the worklog exists:**

1. **The cloud lane has no committed work.** Cloud implementation and cloud
   engineering quality are 20 of the 40 technical marks. If cloud work has been
   done in the AWS console it produces no commit by nature — that is exactly the
   work the worklog is meant to capture, and it is currently capturing none of
   it. Kyle's console work needs rows here, with dates, or the contribution
   section of the report has nothing to cite. **This is the single most
   important gap in the project's evidence.**

2. **Nicholas commits under three identities**, one of them a former username
   (`curiouskorokke`, the initial commit). A marker counting commits per account
   will undercount him. `CONTRIBUTING.md` requires `git config user.email` to
   match the GitHub account email; worth each member checking before their next
   commit, since it cannot be corrected afterwards without rewriting history,
   which the brief forbids.

## Rows still owed

Work known to have happened that produces no commit, and so is not above:

- Kyle — all AWS work to date: account, RDS instance, S3 buckets, EC2, any IAM or network configuration. Dates and durations needed.
- Nicholas — the report drafting, the product definition and the delivery plan. These are authored outside the repository and published into `doc/`, so the commit above records the publication, not the writing.
- All — meetings M1–M6, two hours each (see the meetings record).
