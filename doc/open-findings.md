# Open findings

A cold review was run against this project on **15 September 2026** by an
assistant that had not seen the drafting — against the brief, the rubric, the
product definition, all 764 lines of the report draft, the delivery plan and the
`backend` branch. It found 26 defects. Twenty-three are listed here, each with
the issue that fixes it.

**This file is a snapshot and the board has moved since.** The review ran against
a 58-issue board with milestones named M1 to M4; the board now carries 81 issues
across nine week-named milestones. Where this file and
<https://github.com/users/nomadwiz/projects/14> disagree, **the board is right**.

Read this before starting work in your lane. Most of these are already someone's
issue — the value of the list is seeing which defects cluster.

**Why twenty-three and not twenty-six.** The review was written to the project's
own notes as `work/cold-review.md` and published here redacted. Three findings
are not carried across: the per-member contribution audit, and two whose
technical point is wrapped in a judgement about the team's conduct. Their
actionable content survives elsewhere — the commit-identity instruction in
`CONTRIBUTING.md`, the report's claim-sweep as issue D9, and the client tier's
state as twenty open issues on the board. Nothing technical was dropped.

**The unredacted review no longer exists**, so this summary is the whole
surviving record of it. That is also why nothing here is reworded: add findings,
and mark one fixed by naming the commit or issue that fixed it, but do not
rewrite a finding to match what is now true. The file is worth something because
it records what was known on a particular day.

## The three most serious

| # | Finding | Issue |
| --- | --- | --- |
| 1 | **No CI/CD pipeline exists and nothing is deployed.** No `.github/workflows` on any branch. The brief requires a pipeline, plus a client and an API reachable at public URLs from submission until marking. Criterion C is scored on deployment evidence and is currently unscorable | #187, #194, #195 |
| 12 | **The architecture has no availability or scalability story.** One EC2 instance, one RDS instance, one region, one availability zone, no load balancer, no auto-scaling, no health checks. Criterion B names "excellent scalability, availability" and "cloud-native design principles" | #207 |
| 13 | **Cloud engineering quality has nothing written and no home.** Every issue that would produce it sits at the final milestone | #208 |

## Security and correctness

| # | Finding | Issue |
| --- | --- | --- |
| 4 | **`POST /recipes/{id}/photo` has no ownership check**, and the object key is the recipe id — so keys are guessable and reused. This is a cross-user data path, and it contradicts the report's central security claim | #156 |
| 6 | **Body measurements are not validated.** A negative weight produces a plausible-looking but wrong target set; an out-of-range age produces a 500 | #153 |
| 19 | **A user can never change their password and no account can be deleted** — both contradict what the report says | #158 |
| 20 | **`/register` and `PUT /profile` confirm whether an account exists**, inside a report that argues non-disclosure as a principle. Keep the behaviour, but argue it and address rate limiting | #208 |
| 22 | **The 409 on an occupied slot comes from application code, not the database constraint** the report credits — and the constraint itself produces a 500 | #157 |

## The API contract

| # | Finding | Issue |
| --- | --- | --- |
| 7 | **The comparison against targets — the reason the product exists — is in no functional requirement and no endpoint** | #202, #151 |
| 17 | **S1 and B2/B3 are circularly dependent**, so the contract cannot freeze. Invert it: the contract depends on the endpoint changes, not the reverse | #138, #151, #152 |
| 18 | **`week` has no defined format**, so two tiers can silently disagree about which week they mean. Pick ISO `YYYY-Www`, enforce it, and add a matching database check | #138 |
| 25 | **`GET /mealplan` returns too little to draw the panel it exists for**, and fans out to up to 21 extra queries per week view | #151 |
| 21 | **§7.2 misdescribes PlanSlot**, and the model carries a key the database does not constrain | #157 |
| 23 | **Rounding**: grams are rounded independently and will occasionally not re-sum, against a success metric that demands hand-checkable figures | #160 |
| 24 | **The macronutrient split names the wrong nutrient in its issue**, and the report never mentions the split at all | #154, #155 |

## The document

| # | Finding | Issue |
| --- | --- | --- |
| 5 | **Zero citations and no reference list in 764 lines**, with the sources already in hand | #206 |
| 8 | **Angular and Notion appear in the report in twenty-plus places.** The client is React with TypeScript and project management is GitHub Projects. §6.4–§6.6 argue *for* Notion specifically, so they need re-arguing, not renaming | #204 |
| 9 | **`checklist.md` is an unfilled template**, and nothing maps the issues to the marks | #209 |
| 10 | **Two different repository URLs are on record**, one of them on the report's marked first page. Also confirm the repository is public — a private one fails the brief silently | #140 — the URL half settled 2026-09-18, in `discussion.md` `## Settled`; #222 |
| 14 | **Every figure the report references is missing**, and the figures use a syntax that will not survive PDF export | #203 |
| 15 | **Meeting minutes and a timestamped worklog are explicit brief requirements** and neither exists. Four report snapshot placeholders are waiting on them. Backfill honestly, dated as backfilled, then run it weekly | #144 |
| 16 | **There is no HTTPS story**, and S3 static website hosting cannot serve one — a client on a secure page will not be able to call the API | #193 |
| 26 | **Eleven smaller report defects**, each checkable: a week range that contradicts its own table, a commit count that has moved, an undocumented eighteenth route (`GET /health`), section order against the brief, no table of contents or page numbers, §10 listing paths but not access URLs, an unstated binary-`sex` assumption, an overclaiming comment on `generate_week`, `allow_credentials` alongside a wildcard CORS origin, a bearer-token scheme returning 403 where 401 is meant, and an unescaped `%` in recipe search | #204, #212, #215, #216 |

## What the review found sound — do not change these

Listed because a well-meaning refactor is the likely way they get broken:

- **The token-scoping pattern**: `current_user_id` as a dependency,
  `_owned_recipe` returning 404 rather than 403, `filter_by(user_id=...)` on
  every query, applied consistently across 16 of 17 endpoints.
- **`security.py`** — PBKDF2-SHA256 at 240,000 iterations, per-password salt,
  parameters stored in the hash so it can be migrated, constant-time comparison.
  The `JWT_SECRET` fallback is the one thing wrong with the file (#162).
- **The Mifflin-St Jeor arithmetic** — equation, activity factors and the 4/4/9
  conversion all verified against the published values.
- **`database.py`'s URL construction**, `save_metrics` writing both tables in one
  transaction, and the `.env.example` / `.gitignore` secrets handling.
- **Report §5, and §5.8 especially** — the strongest passage in the document. It
  needs citations, not restructuring.
