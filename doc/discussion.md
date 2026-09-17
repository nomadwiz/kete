# Open questions

## How this file works

Every entry is **a question with a cost**, not a task. It says what is undecided,
what each answer would cost, and what it is holding up. Where an issue already
exists to settle it, the entry names it.

**There are no checkboxes, no status column, no owner and no dates here.** The
board at <https://github.com/users/nomadwiz/projects/14> records what is being
done and who is doing it, and a second place to record that would disagree with
it inside a week. This file is allowed to exist for the same reason
`doc/rubric-coverage.md` is: it carries no boxes and no progress.

**The test: if an entry could be rewritten as "do X", it is an issue, not a
question — put it on the board.** An entry leaves this file only by being
answered. When it is, the answer moves into the document that owns it —
[`product.md`](product.md) for scope, [`implementation.md`](implementation.md)
for how it is built, [`report.md`](report.md) for design — and a line goes under
`## Settled` saying where it went.

---

## Open — the product

**Where the macronutrient proportions come from.** The targets split energy into
protein, carbohydrate and fat by a proportion that is currently the project's own
choice. Published acceptable ranges exist and the split should be checked against
them.
*Either answer costs:* adopting a published range may change every target the
system has ever computed; keeping our own means one invented number sits at the
centre of the thing the product exists to do.
*Blocks:* the report's §5 claim that every figure is traceable.

**The citation for Mifflin-St Jeor.** The equation is used and named, but the
source is not yet cited.
*Costs:* nothing but the time to verify it. Leaving it is a bare assertion in a
document that is marked on evidence.
*Blocks:* issue #206, the references pass.

**Per day, or across the week.** Targets are computed and stored as daily
figures, but a plan is a week.
*Either answer costs:* daily is stricter and will show a "miss" on any day a user
eats unevenly on purpose; weekly is more forgiving and hides a day of nothing
followed by a day of double.
*Blocks:* what the comparison view actually shows. Issue #142.

**How the gap is shown, and what counts as met.** No tolerance is defined, so
"met" has no meaning yet.
*Costs:* a tight tolerance makes the system feel punitive; a loose one makes it
meaningless. Neither is obviously right without a user.
*Blocks:* the client's comparison panel. Issue #141.

**Whether a household shares one plan.** One plan per account is what is built.
*Costs:* sharing means a second identity model and a permissions story the
product deliberately does not have; not sharing means two people in a house keep
two libraries of the same recipes.
*Blocks:* nothing today. Recorded so it is not discovered late.

**The competitive landscape is unwritten.** `product.md` §7 distinguishes
before-the-week from after-the-week tools but names no actual products.
*Costs:* the novelty claim is unsupported without it, and every claim needs a
check date.
*Blocks:* the report's introduction.

## Open — the API contract

**The week's plan carries no nutrition.** `GET /mealplan?week=` returns each slot
with a recipe that has only an id and a name, so the client cannot draw the
totals-against-targets panel without fetching every recipe separately — up to 21
extra calls per week view.
*Either answer costs:* putting the four per-serving figures inside a plan slot
makes the response bigger and duplicates data; returning the week's totals from
the server moves the arithmetic away from where the recipes live.
*Blocks:* the client lane's main screen. Issues #151, #202.

**Saved measurements cannot be read back.** `GET /profile` returns name, username
and email only, and `POST /profile/metrics` returns computed targets rather than
the metrics, so a returning user who wants to change one figure retypes all five.
*Either answer costs:* widening `GET /profile` changes a response three screens
already consume; a separate endpoint adds an eighteenth route to a list the
report has already published.
*Blocks:* the measurements screen. Issue #138.

## Open — repository and access

**Whether the repository goes public, and when.** It is private, so a marker
following the URL gets a 404.
*Costs:* going public exposes a published token fallback, a list of this system's
unfixed defects and two other members' names, and it cannot be undone because the
history is never rewritten. Staying private fails the brief's access expectation.
*Blocks:* the first-page URL actually working. Issue #222, scheduled at W12.

**Whether branch protection can exist while the repository is private.** Untested:
`rulesets` returns empty and `main` reports "Branch not protected", which is what
an unavailable setting and an untried one both look like.
*Costs:* if it cannot, the cross-lane review rule has no mechanical enforcement
for most of the build and rests on the team following it.
*Blocks:* closing S6 honestly. Issue #143.

## Open — the schedule

**S1 sits in a milestone it cannot happen in.** The contract freeze is scheduled
in W6 Design but depends on B2, B3 and B14, which are in W7.
*Either answer costs:* moving those three earlier compresses the backend lane;
moving the freeze later starts the client lane a week behind.
*Blocks:* when the client lane can begin. Issue #138.

## Settled

An answered question moves here, naming the date, the answer, and the document
that now holds it. Where the reason for the answer has no other owner — as with
the repository address, which is one value on a page and not a section of any
document — the reason stays here with it.

**2026-09-18 — the repository URL is `https://github.com/nomadwiz/kete`.** The
value lives on [`report.md`](report.md)'s first page and in §3, and no document
carries `kafesprout` any longer. Both addresses resolve: `kafesprout` is a former
owner name and GitHub serves an owner redirect from it, so on 2026-09-18
`git ls-remote` returned the same HEAD — `0ae3877` — for both. **The redirect is
not relied on**, because `kafesprout` is currently unclaimed and a GitHub owner
redirect stops working the moment someone else registers that name — and the
brief requires the first-page URL to resolve from submission until marking is
notified. The canonical owner path has no such dependency. This settles the
address only: the repository is still private, so following the corrected URL
shows a marker a 404, which is the question above at issue #222. Issue #140.
