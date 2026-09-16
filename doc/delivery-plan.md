# Delivery plan — lanes, seams and milestones

Decided in discussion 2026-09-14/15. The team splits **horizontally**: each
member owns one layer across every feature. This file owns the split, the
seams between lanes, and the milestone order.

## The stack, as it already stands

The repository is `nomadwiz/kete`.

| Tier               | Built with                                                            |
| ------------------ | --------------------------------------------------------------------- |
| Client | **React with TypeScript** (Vite). Changed 2026-09-15; the report still says Angular in §7.5 — issue D1 |
| Backend            | Python, FastAPI, SQLAlchemy                                           |
| Database           | PostgreSQL on Amazon RDS (`backend/schema.sql`)                       |
| Object storage     | Amazon S3 — recipe photos, and static hosting for the compiled client |
| Compute            | Amazon EC2, for the backend                                           |
| Authentication     | JSON Web Tokens issued by the API                                     |
| Project management | **GitHub Projects** — board, issues, milestones. Changed 2026-09-15; the report still says Notion in §6.6 and §7.5 — issue D1 |

The backlog lives on GitHub; `issues.md` is a snapshot of it. What
the system is, and every scope boundary these issues are held against, is
[`product.md`](product.md).

**The API contract is the FastAPI schema**, generated from the request and
response models in `backend/main.py` and served at `/docs`. That generated
schema is what the client lane builds a mock from — there is no second,
hand-written contract document to drift from it.

## The lanes

| Lane | Member | Owns in code | Owns in the document |
| --- | --- | --- | --- |
| **Client** | Nicholas Shih Hao Ng (`@nomadwiz`) | Every page, the shell and routing, token storage, form validation, the week grid, the targets comparison view | User manual, presentation video |
| **Backend** | Sokhour Lay (`@laysokhour-computer`) | All endpoints, auth middleware, the nutrition computation, **database schema, migrations and queries**, seed data | RESTful API list, detailed design |
| **Cloud** | Kyle Wakos (`@kylewakos`) | **Database instance**, object storage, hosting for client and backend, CI/CD, environments, secrets, the two public URLs, monitoring, cost | Cloud implementation |

## The database seam

The brief requires three tiers — client, backend, database — and the team
named three lanes that do not include a database lane. The database is
therefore split by responsibility, not left unowned:

- **Backend owns the schema**, the migrations and the queries. These are code,
  they live in the repository, and they change with every endpoint.
- **Cloud owns the instance**: provisioning, network rules, credentials,
  backups and cost.

Stated explicitly because this is the seam both owners would otherwise assume
the other had covered.

## Why the marks are uneven, and what evens them

Cloud implementation and cloud engineering quality are 20 of the 40 technical
marks and both fall inside one lane. The client lane carries almost none
directly. The written sections in the lane table are the correction, and the
reflection section says so plainly rather than leaving the imbalance
unexplained — equitable contribution is itself marked.

## Milestone order

The milestones are the nine rows of the report's §6.3 schedule, so the board and
the document cannot disagree. Deadline 16 October 2026.

| Milestone | Dates | What completes | Issues |
| --- | --- | --- | --- |
| W5 Foundations | 10-16 Aug | Team, roles and stack settled; repository created | 5 |
| W6 Design | 17-23 Aug | API specification, database schema and diagrams complete | 6 |
| Break Buffer | 24 Aug - 6 Sep | Cloud infrastructure live, with a trivial application deployed | 7 |
| W7 Foundations in code | 7-13 Sep | Seventeen endpoints deployed at a public URL | 7 |
| W8 Backend | 14-20 Sep | Backend complete: real logic, nutrition engine, database wired | 14 |
| W9 Front end | 21-27 Sep | All eleven screens built and connected to the API | 14 |
| W10 Deploy | 28 Sep - 4 Oct | Client and backend live on public URLs, integration tested | 9 |
| W11 Harden and document | 5-11 Oct | Security pass and end-to-end testing; report written, video recorded | 16 |
| W12 Submit | 12-16 Oct | Final PDF submitted by Friday 16 October | 3 |

Horizontal splitting is serial by nature: without the three measures below, the
client lane idles early and is swamped late.

**The three measures:**

1. **Contract first.** Freeze every endpoint's request and response shape
   before the client lane starts (S1). A generated mock is no longer worth the
   cost — sixteen of the seventeen endpoints already run real queries, so the
   client builds against a locally-run backend instead (C3).
2. **Deploy before you build.** The cloud lane goes first, not last. Leaving
   cloud work to the end means meeting the environment problems with days to
   spare, and the brief requires both public URLs to stay up from submission
   until marking is notified.
3. **First milestone is a vertical slice.** Register and login, working end to
   end through all three tiers, deployed. It proves the pipeline while the
   stakes are low.

Finish a full day before the deadline.

## Cross-lane rules

- **Every pull request is reviewed by someone from a different lane.** This is
  what stops three silos, and the review comments are themselves contribution
  evidence in a history the markers read.
- The photo upload crosses all three lanes — client control, backend
  presigned URL, cloud bucket and policy. It is a scheduled joint session,
  not a handoff chain. Backend drives.
- No Git history rewriting, ever. The history is contribution evidence.

## Contract gaps to close before the freeze

Found 2026-09-15 by reading the `backend` branch. Both are changes to the
shape of a response, so they have to land before the client lane builds
against a mock of it.

1. **The week's plan carries no nutrition.** `GET /mealplan?week=` returns
   each slot with a recipe that has only an id and a name. The client
   therefore cannot draw the totals-against-targets panel — the thing the
   product exists to do — without fetching every recipe separately, up to 21
   extra calls per week view. Fix by adding the four per-serving figures to
   the recipe inside a plan slot, or by returning the week's totals from the
   server. Decide which; do not leave the client to fan out.
2. **Saved measurements cannot be read back.** `GET /profile` returns name,
   username and email only, and `POST /profile/metrics` returns the computed
   targets rather than the metrics. A returning user who wants to change one
   figure has to retype all five. Either `GET /profile` carries the metrics
   or a separate read endpoint exists.

## The board

**The board on GitHub is the tracker**, at
<https://github.com/users/nomadwiz/projects/14>. 81 issues across the nine
milestones, eight of them created closed to record work the repository already
shows. The lane labels are `lane:shared`, `lane:backend`, `lane:client`,
`lane:cloud` and `lane:docs`; each lane's issues are assigned to its owner, and
shared and documentation issues to all three members.

**Four columns: Todo / In progress / In review / Done.** The `In review` column
is what makes the cross-lane review rule visible on the board — an item sits
there from the moment its pull request opens until it merges. The rule itself,
the branch naming and the commit-identity check live in `CONTRIBUTING.md` at the
repository root; it was drafted in the project notes under `work/build/` as
`contributing-draft.md` and placed from there.

**The rule applies from the commit that added `CONTRIBUTING.md`, not
retrospectively.** PR #95 — the merge of `backend` into `main`, 2026-09-15 — was
merged by its own author with no review requested and none given. It is the only
pull request in the project's history so far, so the project's entire review
record is currently one breach of the rule. That is left standing rather than
papered over with a retrospective approval: §6.5 invites a marker to verify the
report's contribution claims against the timestamped history, and an approval
added weeks after the merge is visible to anyone who takes that invitation.

**Both the repository and the board are private** (`visibility=PRIVATE`;
the project reports `public: false`). This is not only S3's repository-URL
problem. It has two consequences that belong to other issues and are recorded
here so neither is discovered late:

- **S3** settles two visibility values, not one. Making the board public while
  the repository stays private shows a marker a board whose item details are
  hidden, because project items inherit the visibility of the repository they
  come from. The repository is the one that has to change.
- **S6** requires a branch protection rule to enforce the cross-lane review.
  Branch protection and rulesets are unavailable on private repositories on a
  free account, so if that is this account's tier, **S3 going public is a
  prerequisite for S6 rather than a tidy-up after it**. Verify by attempting the
  ruleset once the repository is public; `gh api repos/nomadwiz/kete/rulesets`
  currently returns an empty list and no protection is configured.

`issues.md` is a snapshot of that backlog, taken when the issues
were created on 2026-09-16. It is readable but **not live** — once the board
moves, GitHub is right and this file is history.

The scripts that built all of it were deleted on 2026-09-16, once the board and
the roadmap were in place. They had done their job and a generator with nothing
left to generate is a thing that rots. If the board ever has to be rebuilt from
scratch, it is rebuilt from `issues.md` and the milestone table above.

### Dates, and where they live

Each issue body opens with its planned range, for example
`**Planned: 2026-08-17 to 2026-08-23**`. That line is for a person reading the
issue.

**A roadmap view cannot read it.** GitHub positions items on a timeline using
date or iteration fields on the project item, and nothing else — milestones
appear only as vertical marker lines, not as the bars. The Start and Target
fields on the project are what draw the roadmap, and they are already set.

Dates are derived rather than estimated: a lane's issues spread across their
week in order, then get pushed later if a dependency lands after they were due
to start. **S1 is the one issue whose dates fall outside its own milestone** —
it sits in W6 Design but depends on B2, B3 and B14 in W7, so it cannot happen
when the schedule says it does. Either those three move earlier or the contract
freeze moves later, and the client lane starts a week behind.

### Issues that are already done

`Z1` to `Z8` record work the repository already shows — the schema, the
connection layer, password hashing and tokens, the seventeen endpoint shapes,
the nutrition engine, and the drafted report sections. They are closed, so the
board reads as the project's history rather than only as a list of what is left.
Contribution is a marked criterion and the markers are told to check the
repository, so work that happened needs to be visible there.

## The document mirror

Decided 2026-09-16. The project's documents are written and maintained in the
project notes, and **published into the repository** at `kete/doc/`, so that
every member can read the scope they are building to, and so that the work
appears in the history the markers are told to inspect. Before this, one
member's entire output — the report, the product definition, this file, the 81
issues — was invisible in a repository showing him two commits.

**Direction is one way.** This side is written and edited; `kete/doc/` is a
snapshot of it. A change here is carried into the copy; a change made in the
copy is lost at the next refresh. `kete/doc/README.md` says so in the repository
itself, and `doc/product.md` now says it in its own header, so a reader of
either copy is told which one they are holding.

**Refreshed on change, in the same turn.** Not batched, not at milestones. The
comp842 precedent skipped this rule and its two copies now contradict each other
about which is authoritative.

| Published | Withheld |
| --- | --- |
| `doc/product.md`, `doc/A02_ResearchReport_draft.md`, `doc/overview.md`, `doc/rubric.md`, `doc/checklist.md`, and this file | `work/cold-review.md` — published instead as `doc/open-findings.md`, a redacted summary: 23 of its 26 findings, each pointing at the issue that fixes it |
| | `work/build/issues.md` — it declares itself a dead snapshot and the board is the tracker. Committing a stale tracker invites someone to work from it |

Three findings are not carried into `open-findings.md`: the per-member
contribution audit, and two whose technical point is wrapped in a judgement
about the team's conduct. Their actionable content survives elsewhere — the
commit-identity instruction in `CONTRIBUTING.md`, the report's claim-sweep as
issue D9, and the client tier's state as twenty open issues on the board.
Nothing technical was dropped.

**The repository also carries a brief for assistants**: `CLAUDE.md` at the root
is the full copy, and `.github/copilot-instructions.md` repeats the hard
prohibitions for Copilot users. A rule changed in one is checked against the
other in the same commit. All four repository-side files were drafted in the
project notes under `work/build/` as `kete-claude-draft.md`,
`kete-doc-readme-draft.md`, `kete-copilot-draft.md` and `kete-findings-draft.md`,
and placed from there.

## Repository URL — two different values on record

`A02_ResearchReport_draft.md` §3 gives the repository as
`github.com/kafesprout/kete`. The clone in `kete/` has its origin set to
`github.com/nomadwiz/kete`. One of the two is wrong, and the report's first
page carries the repository URL as a marked requirement, so this is settled
before submission, not after.

## State of the backend, read 2026-09-15

The `backend` branch is further along than its own README says. The README
claims all 17 endpoints return sample data; that stopped being true when the
SQLAlchemy work landed.

**Real, and working against a database.** `database.py` builds the connection
from `.env` and handles RDS SSL. `models.py` and `schema.sql` carry the five
entities with their unique constraints and cascading deletes. `security.py`
hashes passwords with PBKDF2-SHA256, salted, 240,000 iterations, and compares
in constant time; it issues and reads a 12-hour JWT. Sixteen of the seventeen
endpoints run real queries, and every one of them scopes by the user id taken
from the token rather than from the client. `init_db.py` and `check_db.py`
exist so nobody needs psql.

**Not real yet.** The photo upload is the only faked endpoint: it returns a
constructed S3 URL and stores nothing. `SAMPLE_RECIPES` is dead code no
endpoint reads. The application still calls itself a stub in its title, its
version and its health check. CORS is `allow_origins=["*"]`. `JWT_SECRET`
falls back to a published default instead of refusing to start. Dependencies
are minimum-version rather than pinned, with `passlib` and `boto3` commented
out. There are no tests of any kind.

**Judgement.** The backend is not the risk in this project. The risks are the
cloud work, which has not started, and the client, which is being rewritten in
a different framework from the one the report describes.
