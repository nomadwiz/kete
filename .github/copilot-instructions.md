# Kete — repository instructions

Two files sit behind this one and they are the authority:

- **[`../CLAUDE.md`](../CLAUDE.md)** — the full brief. Where this file and it
  disagree, **it is right**
- **[`../doc/product.md`](../doc/product.md)** — what the system is, and the
  scope boundary every feature is held against

Kete is a nutrition-aware meal planner, built for INFS803 Assignment 2 by three
people, due 16 October 2026. It is a **cloud engineering** paper: 30 of the 40
technical marks are for cloud architecture, implementation and engineering
quality. Read the brief before writing code.

## Rules that override anything else

**Do not build any of the following.** Each is a recorded decision with a
reason, and building one makes the report's scope section wrong:

- deriving nutrition from ingredients, or any per-ingredient nutrition database
  — the user supplies nutrition per recipe, per serving
- anything that chooses, swaps, suggests or ranks recipes **to hit the targets**
  (filling an empty week from the user's own library is fine — it deals recipes
  out without reading the targets; choosing them to meet the targets is not)
- sharing recipes between accounts, or any social or public library
- buying food: shops, stock, prices, orders, delivery, payment
- cooking instructions
- anything concerning allergies, intolerances, declared exclusions or
  condition-driven diets
- any nutrient beyond energy, protein, carbohydrate and fat
- any prediction, model, ranking or recommendation — the whole system is
  deterministic and every figure must be reproducible with a calculator

**Do not weaken any of these.** They were reviewed and found correct:

- every query is scoped by the user id **from the token, never from the
  client**: `current_user_id` as a dependency, `filter_by(user_id=user_id)` on
  every query, `_owned_recipe` returning **404 not 403**
- `security.py`: PBKDF2-SHA256, salted, **240,000 iterations**,
  `hmac.compare_digest` for the comparison
- `database.py`: `quote_plus` on the password, `sslmode=require` for RDS
- the Mifflin-St Jeor equation, the five activity factors, and the 4/4/9
  gram conversion — standard published values, not to be rounded or tidied

**Never rewrite Git history.** No rebase on a pushed branch, no amend of a
pushed commit, no force push, no squash that discards authorship. The brief
forbids it and the history is the evidence of who contributed what.

**Never edit anything in `doc/`.** It is a read-only snapshot of documents
maintained outside this repository; an edit there changes nothing upstream.

## Picking up work

**The GitHub issues are the checklist**, on the board at
<https://github.com/users/nomadwiz/projects/14>. There is no task-list file in
this repository, deliberately — **do not create one**. Branch per issue as
`lane/issue-number-short-description`. Every pull request is reviewed by someone
from a different lane; do not merge your own. The full workflow is in
[`../CONTRIBUTING.md`](../CONTRIBUTING.md).

## Before disagreeing with a rule

Check whether it is already settled. `doc/product.md` §5 and §6 record what was
decided and what is still open, each with its reason. If you think a decision is
wrong, raise it on an issue rather than reopening it in code — and never
implement a rejected alternative because it looks tidier.
