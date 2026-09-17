# Contributing to Kete

Kete is built by three people for INFS803 Assignment 2. This file records how we
divide the work, how a change reaches `main`, and two rules we cannot repair
after the fact if we get them wrong.

These rules take effect from the first pull request opened after this file
reaches `main`. A rule cannot govern the act of its own creation: #218 added this
file and was merged by its author. Before that, #95 merged an entire tier into
`main` with no review requested and none given. Neither is corrected after the
fact — a record that matches what happened is worth more than one that does not,
and §6.5 of the report invites a marker to check that history for themselves.

## The lanes

Each member owns one tier across every feature, rather than one feature across
every tier.

| Lane | Owner | Owns |
| --- | --- | --- |
| **Client** | Nicholas Shih Hao Ng (`@nomadwiz`) | Every page, the application shell and routing, token storage, form validation, the week grid, the targets comparison view |
| **Backend** | Sokhour Lay (`@laysokhour-computer`) | All endpoints, authentication middleware, the nutrition computation, the database schema, migrations and queries, seed data |
| **Cloud** | Kyle Wakos (`@kylewakos`) | The database instance, object storage, hosting for the client and the backend, the deployment pipeline, environments, secrets, the two public URLs, monitoring and cost |

The database is split between two lanes on purpose, because it is the seam each
owner would otherwise assume the other had covered. **Backend owns the schema,
the migrations and the queries** — these are code, they live in this repository,
and they change with every endpoint. **Cloud owns the instance** — provisioning,
network rules, credentials, backups and cost.

Every issue carries exactly one lane label: `lane:client`, `lane:backend`,
`lane:cloud`, `lane:docs` or `lane:shared`.

## One branch per issue

Branch from `main`, named for the lane, the issue number and a short
description:

```
backend/151-plan-slot-nutrition
client/166-scaffold-react-client
cloud/186-aws-account-budget-alarm
```

The issue number in the branch name is what links the work to the board without
anyone maintaining that link by hand.

## Who reviews, and who decides

**Default: ask someone from another lane.** They are the only person who reads
the change without already knowing what it was supposed to do, which is how three
people working alone inside three tiers avoid building three systems that do not
meet.

**The author decides whether a given change needs it.** Waiting two days for a
reviewer on a typo is worse than merging it, and a rule nobody can follow gets
ignored rather than amended. You may open and merge your own pull request when
the change sits inside your own lane, or is documentation, and none of the cases
below applies.

**Always ask for a review, however small the change:**

- it touches files another lane owns
- it changes the API contract or the database schema
- it changes what the system does or does not do — the scope in
  `doc/product.md`
- it changes the rules: this file, `CLAUDE.md`, or
  `.github/copilot-instructions.md`

**Say which you chose, and why, in one line in the pull request.** "Self-merged —
documentation only, no contract change" is enough. The decision then sits in the
record, instead of a reader having to guess why a review is absent.

### Ask more often than the rule requires, for one specific reason

The markers read this repository to judge whether contribution was equitable, and
that is worth five marks. Commits are not the whole picture: the cloud lane's
work is largely console configuration that produces no commits at all, so for
that member, **review comments are the main contribution record this repository
holds**.

That is not hypothetical. On 17 September 2026 the cloud lane has no commits, no
reviews and no issue comments here — nothing a marker can see. Relaxing the gate
above does not change what the criterion asks for. It means the record now has to
be built deliberately rather than as a by-product of the rule.

So route reviews to the lane with least to show, even where this rule would let
you merge alone. A review that says "approved" and nothing else records nothing.
Say what you checked.

## How an issue moves across the board

The board is at <https://github.com/users/nomadwiz/projects/14>. An item moves
through four columns, and the column is changed by the person doing the work:

| Column | When |
| --- | --- |
| **Todo** | Not started |
| **In progress** | You have branched and begun |
| **In review** | The pull request is open and a reviewer has been requested. A change you are merging yourself skips this column |
| **Done** | Merged |

The board is the tracker, and now the only one. The readable snapshot that used
to sit in the project notes has been lost, along with the script that generated
it. If the board ever has to be rebuilt, it is rebuilt from the milestone table
in [`doc/delivery-plan.md`](doc/delivery-plan.md).

## Commit under your own identity

Before your next commit, check that the email Git uses matches the email on your
GitHub account:

```
git config user.email
```

If it does not match, GitHub cannot attribute the commit to you, and a marker
reading the contribution history may not count it as anyone's work. Set it for
this repository:

```
git config user.email "the-address-on-your-github-account"
```

Do this **before** committing. Commits already made under the wrong address can
only be corrected by rewriting history, which the next rule forbids.

## Never rewrite history

No `git rebase` on a pushed branch, no `git commit --amend` on a pushed commit,
no force pushes, no squashing that discards authorship. The assignment brief
forbids history-rewriting operations, and the history is the evidence of who did
what. Once it is rewritten, the evidence is gone and cannot be reconstructed.

If a commit is wrong, fix it with another commit.
