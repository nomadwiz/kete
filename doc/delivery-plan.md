# Delivery plan — what we planned to build, and when

**Frozen 2026-09-17.** Decided in discussion on 14–15 September, before
implementation began. This file is not updated, and that is the point: a plan is
evidence that the outcome was planned, and a plan edited afterwards to match what
happened is evidence of nothing.

Where this file and the board disagree, **the board is right**. Where it and the
code disagree, the code is what exists. What was still undecided when this was
written is in [`discussion.md`](discussion.md), which does change; what a review
later found wrong is in [`open-findings.md`](open-findings.md), which is dated.

## The stack

The repository is `nomadwiz/kete`. What the team planned to build with is now
recorded, in the present tense and kept current, in
[`implementation.md`](implementation.md) — along with the API contract and what
is actually running. The backlog is the board.

## The lanes, and the seam between them

The team splits horizontally: one member per tier, with the database divided
between two of them because it is the seam each would otherwise assume the other
had covered. The table, the split and why the marks fall unevenly across the
lanes are in [`CONTRIBUTING.md`](../CONTRIBUTING.md) — they describe how the team
works now, not what was planned, so they are kept where they are used.

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

- **Cross-lane review is the default, and the author decides when a change needs
  it.** Merging your own is allowed inside your own lane and for documentation; a
  review is required for another lane's files, the contract, the schema, the
  scope, or the rules. The relaxation is deliberate — a blocking review on a typo
  stalls a three-person team — but review comments are the cloud lane's main
  contribution evidence in a history the markers read, so that record now has to
  be built on purpose.
- The photo upload crosses all three lanes — client control, backend
  presigned URL, cloud bucket and policy. It is a scheduled joint session,
  not a handoff chain. Backend drives.
- No Git history rewriting, ever. The history is contribution evidence.

## Contract gaps

Two were open when this plan was written, both changes to the shape of a
response. They are questions rather than plan items, so they live in
[`discussion.md`](discussion.md) under *Open — the API contract*.

## Where the rest of this went

A plan should hold what was planned. Four things that used to sit here describe
how the team works now, or what is still undecided, and both change — so they are
kept where they are used rather than in a frozen file:

| What | Where it lives now |
| --- | --- |
| The board, its columns, its labels and the roadmap date fields | [`../CONTRIBUTING.md`](../CONTRIBUTING.md) |
| Which document owns what, and which two are never edited | [`../CLAUDE.md`](../CLAUDE.md) |
| The repository URL, going public, and branch protection | [`discussion.md`](discussion.md) |
| What is actually built, and what must not be changed | [`implementation.md`](implementation.md) |
