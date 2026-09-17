# Project documents

What Kete is, what it is marked against, and how the team is building it. These
are here so that everyone works from the same facts instead of asking one person
for them.

| File | What it is | Use it when |
| --- | --- | --- |
| [`product.md`](product.md) | The product definition — the problem, the mechanism, and the scope boundary | You are about to build something and want to know whether it is in scope |
| [`delivery-plan.md`](delivery-plan.md) | The lanes, the database seam, the milestone order, and the known gaps in the API contract | You are picking up work, or you are about to touch another lane |
| [`report.md`](report.md) | The document being submitted, in progress | You are writing a section, or you want to check what the report already claims |
| [`overview.md`](overview.md) | The assignment brief | You want the actual requirement wording |
| [`rubric.md`](rubric.md) | The marking rubric | You are deciding what is worth your time |
| [`open-findings.md`](open-findings.md) | Findings from a cold review of the whole project, with the issue that fixes each | You want to know what is already known to be wrong |
| [`diagrams.drawio`](diagrams.drawio) | The draw.io source for the report's figures — architecture, ERD, user journey, user flow and the AWS deployment | You are producing or updating a figure the report references. It moves to `design/` under #203 |

## Who edits these

**Edited here, through a branch and a reviewed pull request.**
`product.md`, `delivery-plan.md`, `report.md` and
`open-findings.md` are maintained in this repository. This is the copy the team
works from, so a correction belongs here rather than in a message to one person.
If something is wrong, fix it, and say what you changed in the pull request.

**Never edited.** `overview.md` is the assignment brief and `rubric.md` is the
marking criteria, transcribed word for word as the paper issued them. They are
what every claim in the report is checked against, so correcting them would
remove the only fixed point there is. If one reads oddly, that is what the paper
says — take it up with the paper, not with the file.

**`open-findings.md` is dated evidence.** Add findings, and mark one fixed by
naming the commit or issue that fixed it. Do not reword a finding to match what
is now true; the file is worth something because it records what was known on a
particular day.

Two files deserve particular care:

- **`product.md`** is the one to trust most for scope, and it is also the one
  most likely to move — the open items at its §6 are genuinely open.
- **`report.md`** is a **draft**. It carries `[CITE]` markers
  where a citation is still owed, and some sections are not written yet. Do not
  read an unfinished section as a decision.

## Where a document is not the last word

The board at <https://github.com/users/nomadwiz/projects/14> is the tracker, and
it is live — where it and any file here disagree, **the board is right**. The
same goes for the code: where a document describes an endpoint and the code
disagrees, the code is what exists, and the difference is worth raising as an
issue.
