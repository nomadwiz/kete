# Kete — start here

Kete is a nutrition-aware meal planner. A person records their body measurements
once; the system computes their daily energy and macronutrient targets from a
published equation, they write their own recipes, arrange them into a week, and
see the week's totals against those targets while the week is still editable.

**This file is a map.** Everything it points at is the authority on its own
subject, and where this file and one of them disagree, **the other file is
right**. That is what keeps it short: there is no second copy of any rule here to
drift out of step with the file that owns it.

University coursework: INFS803 Assignment 2, three people, due **16 October
2026**. It is a **cloud engineering** paper — thirty of the forty technical marks
are cloud architecture, cloud implementation and cloud engineering quality. The
application is the vehicle; the cloud work is the subject. A small correct system
with legible evidence beats a large impressive one.

## Where to look

| Your question | The file that answers it |
| --- | --- |
| What is Kete, who is it for, and what is deliberately out of scope? | [`../doc/design/product.md`](../doc/design/product.md) |
| How is it built, what is actually running, and what must I not break? | [`../doc/design/implementation.md`](../doc/design/implementation.md) |
| What is still undecided, and what does each answer cost? | [`../doc/design/discussion.md`](../doc/design/discussion.md) |
| What is being submitted, and what does it already claim? | [`../doc/output/report.md`](../doc/output/report.md) |
| What did we plan to deliver, and when? | [`../doc/plan/delivery-plan.md`](../doc/plan/delivery-plan.md) |
| What did a review find wrong, and when? | [`../doc/plan/open-findings.md`](../doc/plan/open-findings.md) |
| What does the paper require, and how is it marked? | [`../doc/overview.md`](../doc/overview.md) · [`../doc/rubric.md`](../doc/rubric.md) |
| How do I branch, get reviewed, and commit? | [`CONTRIBUTING.md`](CONTRIBUTING.md) |

**Before writing code, read [`../doc/design/product.md`](../doc/design/product.md) §5 and
[`../doc/design/implementation.md`](../doc/design/implementation.md) §5.** They are different lists
that share a number. The first is what Kete deliberately does not do — building
one of those items is the mistake an assistant makes fastest, and it makes the
report's scope section wrong. The second is what was reviewed, found correct, and
must not be "improved".

## Rules

### Which file wins

- **The board beats every file here.** The tracker is at
  <https://github.com/users/nomadwiz/projects/14>. There is no task-list file in
  this repository, deliberately — **do not create one.** A file three people tick
  on three branches conflicts constantly, and a box an assistant ticks proves only
  that it believed it was finished. An issue closes because a reviewed pull
  request merged. The one document allowed to resemble a list is
  `../doc/checklist.md` (issue #209), which maps each marking criterion to the
  issues that evidence it — no boxes, no progress.
- **The code beats every description of it.** Where a document describes an
  endpoint and the code disagrees, the code is what exists, and the difference is
  worth raising as an issue.
- **`../doc/overview.md` and `../doc/rubric.md` are never edited.** They are the brief
  and the marking criteria transcribed exactly as the paper issued them. Every
  claim this project makes is checked against them, so correcting one removes the
  only fixed point there is. If one reads oddly, that is what the paper says.
- **`../doc/plan/delivery-plan.md` is never edited either, for a different reason.** It is
  what was planned before building started. A plan is evidence that the outcome
  was planned; edited afterwards to match what happened, it evidences nothing.
- **`../doc/plan/open-findings.md` is dated, and never reworded.** Add findings, and mark
  one fixed by naming the commit or issue that fixed it — but do not rewrite a
  finding to match what is now true.
- **Everything else in `doc/` is edited here**, in a branch and a pull request, by
  any member. A document two of the three may not correct is one they stop
  trusting, and then stop reading.

### Working here

**One branch per issue**, named `lane/issue-number-short-description`. Branching,
review, commit identity and the never-rewrite-history rule are all in
[`CONTRIBUTING.md`](CONTRIBUTING.md).

**Each member owns one tier** — client, backend, cloud. If you are an assistant
working for one member, **stay in that member's lane.** Changing another lane's
files produces a merge conflict and takes that member's contribution evidence
away from them.

**Before disagreeing with a rule**, check whether it is already settled.
[`../doc/design/product.md`](../doc/design/product.md) §5 records what was decided and
[`../doc/design/discussion.md`](../doc/design/discussion.md) what is still open, each with its reason.
Raise an issue rather than reopening it in code, and never implement a rejected
alternative because it looks tidier.
