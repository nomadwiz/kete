# Project documents

What Kete is, what it is marked against, and how the team is building it. These
are here so that everyone works from the same facts instead of asking one person
for them.

| File | What it is | Use it when |
| --- | --- | --- |
| [`product.md`](product.md) | The product definition — the problem, the mechanism, and the scope boundary | You are about to build something and want to know whether it is in scope |
| [`delivery-plan.md`](delivery-plan.md) | The lanes, the database seam, the milestone order, and the known gaps in the API contract | You are picking up work, or you are about to touch another lane |
| [`A02_ResearchReport_draft.md`](A02_ResearchReport_draft.md) | The document being submitted, in progress | You are writing a section, or you want to check what the report already claims |
| [`overview.md`](overview.md) | The assignment brief | You want the actual requirement wording |
| [`rubric.md`](rubric.md) | The marking rubric | You are deciding what is worth your time |
| [`checklist.md`](checklist.md) | The pre-submission gate | Before a hand-round, and before submission |
| [`open-findings.md`](open-findings.md) | Findings from a cold review of the whole project, with the issue that fixes each | You want to know what is already known to be wrong |

## Status of these copies

**Read-only.** They are a snapshot. These documents are written and maintained
outside this repository, and that copy remains the source of truth. **Editing a
file here changes nothing upstream and creates a disagreement nobody will
notice.**

If something in here is wrong or out of date, say so on the issue or in the pull
request rather than correcting the file — the correction has to be made upstream
or it will be overwritten by the next refresh.

Two files deserve particular care:

- **`product.md`** is the one to trust most for scope, and it is also the one
  most likely to move — the open items at its §6 are genuinely open.
- **`A02_ResearchReport_draft.md`** is a **draft**. It carries `[CITE]` markers
  where a citation is still owed, and some sections are not written yet. Do not
  read an unfinished section as a decision.

## Where the live versions are

The board at <https://github.com/users/nomadwiz/projects/14> is the tracker, and
it is live — where it and any file here disagree, **the board is right**. The
same goes for the code: where a document describes an endpoint and the code
disagrees, the code is what exists, and the difference is worth raising as an
issue.
