# Kete — repository instructions

**Read [`../CLAUDE.md`](../CLAUDE.md).** It is the brief for anyone working in
this repository, including AI assistants, and it points at everything else.

This file exists only because GitHub Copilot reads it automatically. It
deliberately repeats nothing. It used to carry its own copy of the rules, and the
copies drifted: it protected a value that `CLAUDE.md` had stopped protecting, so
the file meant to be the shorter summary was the stricter one. A rule stated
twice is a rule to correct twice.

Where this file and [`../CLAUDE.md`](../CLAUDE.md) disagree, **`../CLAUDE.md` is
right.**

Two things to read before you touch anything:

- [`../doc/product.md`](../doc/product.md) — what Kete is, and the scope boundary
  every feature is held against. §5 records what was decided and why, and §6 what
  is still open.
- [`../doc/implementation.md`](../doc/implementation.md) §5 — the things that were
  reviewed, found correct, and **must not be "improved"**. Read it before
  changing anything in `backend/`.

The workflow — branching, review and commit identity — is in
[`../CONTRIBUTING.md`](../CONTRIBUTING.md).
