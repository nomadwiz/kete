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
| What is Kete, who is it for, and what is deliberately out of scope? | [`doc/product.md`](doc/product.md) |
| How is it built, what is actually running, and what must I not break? | [`doc/implementation.md`](doc/implementation.md) |
| What is still undecided, and what does each answer cost? | [`doc/discussion.md`](doc/discussion.md) |
| What is being submitted, and what does it already claim? | [`doc/report.md`](doc/report.md) |
| What did we plan to deliver, and when? | [`doc/delivery-plan.md`](doc/delivery-plan.md) |
| What did a review find wrong, and when? | [`doc/open-findings.md`](doc/open-findings.md) |
| What does the paper require, and how is it marked? | [`doc/overview.md`](doc/overview.md) · [`doc/rubric.md`](doc/rubric.md) |
| How do I branch, get reviewed, and commit? | [`CONTRIBUTING.md`](CONTRIBUTING.md) |

**Before writing code, read [`doc/product.md`](doc/product.md) and
[`doc/implementation.md`](doc/implementation.md) §5** — the second lists what was
reviewed, found correct, and must not be "improved".

## Which file wins

- **The board beats every file here.** The tracker is at
  <https://github.com/users/nomadwiz/projects/14>. There is no task-list file in
  this repository, deliberately — **do not create one.** A file three people tick
  on three branches conflicts constantly, and a box an assistant ticks proves only
  that it believed it was finished. An issue closes because a reviewed pull
  request merged. The one document allowed to resemble a list is
  `doc/rubric-coverage.md` (issue #209), which maps each marking criterion to the
  issues that evidence it — no boxes, no progress.
- **The code beats every description of it.** Where a document describes an
  endpoint and the code disagrees, the code is what exists, and the difference is
  worth raising as an issue.
- **`doc/overview.md` and `doc/rubric.md` are never edited.** They are the brief
  and the marking criteria transcribed exactly as the paper issued them. Every
  claim this project makes is checked against them, so correcting one removes the
  only fixed point there is. If one reads oddly, that is what the paper says.
- **`doc/delivery-plan.md` is never edited either, for a different reason.** It is
  what was planned before building started. A plan is evidence that the outcome
  was planned; edited afterwards to match what happened, it evidences nothing.
- **`doc/open-findings.md` is dated, and never reworded.** Add findings, and mark
  one fixed by naming the commit or issue that fixed it — but do not rewrite a
  finding to match what is now true.
- **Everything else in `doc/` is edited here**, in a branch and a pull request, by
  any member. A document two of the three may not correct is one they stop
  trusting, and then stop reading.

## Do not build any of these

Each is a decision with a reason, and [`doc/product.md`](doc/product.md) §5 holds
the reasoning. They are listed rather than linked because building one is the
mistake an assistant makes fastest, and it makes the report's scope section wrong.

- **No per-ingredient nutrition database.** The user supplies nutrition per
  recipe, per serving. The system never derives it from ingredients.
- **No automatic correction.** Nothing swaps an ingredient, suggests a recipe or
  adjusts a plan to close a gap. Note the boundary: filling an empty week from the
  user's own library **is** in scope, because it deals recipes out without reading
  the targets. Choosing recipes **to hit** the targets is out.
- **No shared or social recipe library.** Every recipe belongs to one account.
- **No buying food** — no shops, stock, prices, orders, delivery or payment.
- **No cooking assistance.**
- **Nothing about what a user cannot eat** — allergies, intolerances and
  condition-driven diets are all outside the system, which makes no claim about
  the safety of any ingredient for any person.
- **Four nutrients and no others**: energy, protein, carbohydrate, fat.
- **Nothing that predicts, ranks or recommends.** Targets come from an equation,
  totals are a sum, and every number on screen must be reproducible with a
  calculator — which is what makes the system testable.

## Working here

**One branch per issue**, named `lane/issue-number-short-description`. Branching,
review, commit identity and the never-rewrite-history rule are all in
[`CONTRIBUTING.md`](CONTRIBUTING.md).

**Each member owns one tier** — client, backend, cloud. If you are an assistant
working for one member, **stay in that member's lane.** Changing another lane's
files produces a merge conflict and takes that member's contribution evidence
away from them.

**Before disagreeing with a rule**, check whether it is already settled.
[`doc/product.md`](doc/product.md) §5 records what was decided and
[`doc/discussion.md`](doc/discussion.md) what is still open, each with its reason.
Raise an issue rather than reopening it in code, and never implement a rejected
alternative because it looks tidier.
