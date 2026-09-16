# Contributing to Kete

Kete is built by three people for INFS803 Assignment 2. This file records how we
divide the work, how a change reaches `main`, and two rules we cannot repair
after the fact if we get them wrong.

These rules take effect from the commit that adds this file. Work merged before
it did not follow them — pull request #95 was merged without a review — and we
are not going back to make the history look otherwise. A record that matches what
happened is worth more than one that does not.

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

## Every pull request is reviewed by someone from a different lane

This is the rule that matters most, and it has two reasons.

The first is that three people each working alone inside one tier will build
three systems that do not meet. A reviewer from another lane is the only person
who reads the change without already knowing what it was supposed to do.

The second reason is evidence. The markers read this repository to judge whether
contribution was equitable. Commits are not the whole picture: the cloud lane's
work is largely console configuration that produces no commits at all, so for
that member, **review comments are the main contribution record this repository
holds**. A review that says "approved" and nothing else records nothing. Say what
you checked.

Request the review from whichever member does not own the lane the branch is
named for. Do not merge your own pull request.

## How an issue moves across the board

The board is at <https://github.com/users/nomadwiz/projects/14>. An item moves
through four columns, and the column is changed by the person doing the work:

| Column | When |
| --- | --- |
| **Todo** | Not started |
| **In progress** | You have branched and begun |
| **In review** | The pull request is open and a reviewer has been requested |
| **Done** | Merged |

The board is the tracker. `work/build/issues.md` in the notes is a snapshot of
the backlog as it stood on 16 September 2026 — readable, but not live. Where the
two disagree, the board is right.

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
