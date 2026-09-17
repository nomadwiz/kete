# Kete — working agreement for people and their agents

Kete is a nutrition-aware meal planner. A person records their body
measurements once; the system computes their daily energy and macronutrient
targets from a published equation, they write their own recipes, arrange them
into a week, and see the week's totals against those targets while the week is
still editable.

This file is the standing brief for anyone working in this repository,
**including AI assistants**. Read it and [`doc/product.md`](doc/product.md)
before writing code.

**This file is the brief, and the only full copy.**
`.github/copilot-instructions.md` is a short pointer to it so that a teammate
using GitHub Copilot starts from the same facts; it repeats only the hard
prohibitions. If a rule changes here, check that list in the same commit.

This is university coursework: INFS803 Assignment 2, three people, due
**16 October 2026**. It is a **cloud engineering** paper. Thirty of the forty
technical marks sit on cloud architecture, cloud implementation and cloud
engineering quality. The application is the vehicle; the cloud work is the
subject. A small correct system with legible evidence beats a large impressive
one.

## The lanes

Each member owns one tier across every feature, not one feature across every
tier.

| Lane | Owner | Owns |
| --- | --- | --- |
| **Client** | Nicholas Shih Hao Ng (`@nomadwiz`) | Every page, the shell and routing, token storage, form validation, the week grid, the targets comparison view |
| **Backend** | Sokhour Lay (`@laysokhour-computer`) | All endpoints, auth middleware, the nutrition computation, the database schema, migrations and queries, seed data |
| **Cloud** | Kyle Wakos (`@kylewakos`) | The database instance, object storage, hosting, the deployment pipeline, environments, secrets, the two public URLs, monitoring and cost |

**The database is split on purpose**, because it is the seam each owner would
otherwise assume the other had covered. Backend owns the schema, the migrations
and the queries — these are code and they live here. Cloud owns the instance:
provisioning, network rules, credentials, backups and cost.

If you are an assistant working for one member, **stay in that member's lane**.
Changing another lane's files produces a merge conflict and takes that member's
contribution evidence away from them.

## Scope — what this system deliberately does not do

[`doc/product.md`](doc/product.md) §5 is the authority. The exclusions below are
decisions with reasons, not gaps. **Do not build one because it looks like an
obvious improvement.** Building one makes the report's scope section wrong.

- **No per-ingredient nutrition database.** The user supplies nutrition per
  recipe, per serving. The system never derives nutrition from ingredients.
- **No automatic correction.** Nothing swaps an ingredient, suggests a recipe,
  or adjusts a plan to close a gap against the targets. Note the boundary:
  filling an empty week from the user's own library **is** in scope, because it
  deals recipes out without reading the targets. Choosing recipes **to hit** the
  targets is out.
- **No shared or social recipe library.** Every recipe belongs to one account
  and is invisible to every other.
- **No buying food** — no shops, stock, prices, orders, delivery or payment.
- **No cooking assistance.**
- **Nothing about what a user cannot eat** — allergies, intolerances, declared
  exclusions and condition-driven diets are all outside the system. It makes no
  claim about the safety of any ingredient for any person.

**The system carries four nutrients and no others**: energy, protein,
carbohydrate, fat.

**Everything is deterministic.** Targets come from an equation, not a model.
Weekly totals are a sum. There is no prediction, no ranking and no
recommendation anywhere in the system, and none is to be added — every number on
screen must be reproducible with a calculator, which is what makes it testable.

## Things that are already right — do not "improve" them

These were reviewed and found correct. Changing them will break a claim the
report makes:

- **Every query is scoped by the user id taken from the token**, never from the
  client: `current_user_id` as a dependency, `filter_by(user_id=user_id)` on
  every query, and `_owned_recipe` returning **404 rather than 403** so the
  endpoint does not confirm that someone else's record exists. Keep all three.
- **`security.py`**: PBKDF2-SHA256, per-password salt, 240,000 iterations,
  algorithm and iteration count stored in the hash string, `hmac.compare_digest`
  for the comparison. Do not lower the iteration count or swap the comparison.
- **`database.py`**: `quote_plus` on the password and automatic
  `sslmode=require` for RDS hosts.
- **The Mifflin-St Jeor arithmetic** and the 4/4/9 gram conversion are the
  standard published values. Do not round or "tidy" them.

## Working here

- **The GitHub issues are the checklist**, on the board at
  <https://github.com/users/nomadwiz/projects/14>. There is no task-list file in
  this repository, deliberately — **do not create one.** A file three people tick
  on three branches conflicts constantly, and a box an assistant ticks proves
  only that it believed it was finished. An issue closes because a reviewed pull
  request merged.
  The one document allowed to resemble a list is `doc/rubric-coverage.md`
  (issue #209): it maps each marking criterion to the issues that produce its
  evidence and the report section that presents it. It carries no boxes and no
  progress, because the board already records what is done. What the board
  cannot answer, being organised by lane, is whether a ten-mark criterion has
  anything behind it at all.
- **One branch per issue**, named `lane/issue-number-short-description`.
- **Ask someone from another lane to review, and decide when it is needed.**
  Merging your own is fine for work inside your own lane or for documentation. A
  review is required for another lane's files, the API contract, the database
  schema, the scope in `doc/product.md`, or these rules. Say which you chose in
  the pull request. The full reasoning, and the contribution-evidence cost of
  merging alone, is in [`CONTRIBUTING.md`](CONTRIBUTING.md).
- **Never rewrite history.** No rebase on a pushed branch, no amend of a pushed
  commit, no force push, no squashing that discards authorship. The brief
  forbids it and the history is the evidence of who did what.
- **Commit under your own identity** — `git config user.email` must match the
  email on your GitHub account. Check before your next commit; it cannot be
  corrected afterwards without rewriting history.
- **No claim about completed work goes in the report unless a commit, a
  screenshot or a board item evidences it.**

## `doc/` holds the documents this project is built from

[`doc/`](doc/README.md) holds what defines the work: the product definition, the
delivery plan, the report being submitted, and the brief and marking criteria the
whole thing is assessed against. They are here so that three people building three
tiers work from the same facts instead of asking one person for them.

**Most of them are edited here.** If `product.md`, `delivery-plan.md`,
`A02_ResearchReport_draft.md` or `open-findings.md` is wrong or has been
overtaken, correct it in a branch and a pull request, the same way code is
corrected. Any member may. A document only one person can fix is one the other
two stop reading, and then it is not shared understanding, only paperwork.

**Two are never edited.** `doc/overview.md` is the assignment brief and
`doc/rubric.md` is the marking criteria, both transcribed exactly as the paper
issued them. Every claim this project makes is checked against those two files,
so a correction written into either one removes the only fixed point there is —
a misremembered requirement stops being falsifiable. If one of them reads oddly,
that is what the paper actually says.

One restriction inside the editable set: `open-findings.md` records what a review
found on a stated date. Add to it, and mark a finding fixed by naming the commit
or issue that fixed it. Do not reword a finding so that it matches what is now
true — the file is useful because it is dated.

Read `doc/README.md` first; it says which file is which and who edits it.
