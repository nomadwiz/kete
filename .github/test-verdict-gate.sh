#!/usr/bin/env bash
# Checks the verdict gate in claude-code-review.yml: which reviews satisfy the
# "Fail if no verdict was posted" guard, and which the merge job merges on. Run
# it after editing either filter: ./.github/test-verdict-gate.sh
#
# The gate decides whether a pull request merges unseen. Before S18
# (nomadwiz/kete#343) both filters selected by time, state and body but never
# by author, so a member's ordinary comment review posted during a run counted
# as a clean verdict and merged over the reviewer's blocker — rows 1 and 3
# below, found by @laysokhour-computer in review of nomadwiz/kete#346.
#
# Each step's own run: script is read out of the workflow and executed with gh
# stubbed, so this checks the shell and its quoting as the runner sees them,
# not a copy of the filter.
set -uo pipefail
cd "$(dirname "$0")/.."
F=.github/workflows/claude-code-review.yml

block() { awk -v n="$1" '$0 ~ "name: "n {f=1} f && /run: \|/ {p=1; next} p && /^ {0,9}[^ ]/ {exit} p {sub(/^          /,""); print}' "$F"; }
GUARD=$(block "Fail if no verdict"); MERGE=$(block "Merge what the review")
[ -n "$GUARD" ] && [ -n "$MERGE" ] || { echo "FAIL: a step was not found in the workflow"; exit 1; }

# Serves $FIX as the review list, reports no inline findings and no lag
# behind the base, and prints MERGED when the merge call is reached.
gh() { local q= path=; while [ $# -gt 0 ]; do case $1 in --jq) q=$2; shift 2;; -X|-f) shift 2;; api|--paginate|--silent) shift;; workflow) return;; *) path=$1; shift;; esac; done
  case $path in */reviews) jq -r "$q" <<<"$FIX";; */comments) echo 0;; */compare/*) echo 0;; */merge) echo MERGED;; */files) echo frontend/x;; esac; }
export -f gh
export REVIEW_SINCE=2026-10-02T00:00:00Z PR=1 REPO=o/r BASE=main HEAD=b

bot='"user":{"login":"github-actions[bot]"}'; mem='"user":{"login":"kylewakos"}'; old='"user":{"login":"claude[bot]"}'
r() { echo "{\"id\":$1,$2,\"state\":\"$3\",\"body\":\"$4\",\"submitted_at\":\"$5\"}"; }
fail=0
t() { export FIX=$2
  g=$(bash -c "$GUARD" >/dev/null 2>&1 && echo pass || echo fail)
  m=$(bash -c "$MERGE" 2>/dev/null | grep -q '^MERGED$' && echo merged || echo held)
  [ "$g/$m" = "$3/$4" ] && echo "ok:   $1" || { echo "FAIL: $1 — wanted guard $3, $4; got guard $g, $m"; fail=1; }; }

t "1 bot requests changes, then a member comments" "[$(r 1 "$bot" CHANGES_REQUESTED x 2026-10-02T00:01:00Z),$(r 2 "$mem" COMMENTED lgtm 2026-10-02T00:02:00Z)]" pass held
t "2 bot posts a clean verdict"                    "[$(r 3 "$bot" COMMENTED clean 2026-10-02T00:01:00Z)]" pass merged
t "3 only a member comments"                       "[$(r 4 "$mem" COMMENTED hi 2026-10-02T00:01:00Z)]" fail held
t "4 bot clean, then bot requests changes"         "[$(r 5 "$bot" COMMENTED ok 2026-10-02T00:01:00Z),$(r 6 "$bot" CHANGES_REQUESTED no 2026-10-02T00:02:00Z)]" pass held
t "5 bot empty-bodied comment (a thread reply)"    "[$(r 7 "$bot" COMMENTED '' 2026-10-02T00:01:00Z)]" fail held
t "6 claude[bot] clean, before this run"           "[$(r 8 "$old" COMMENTED ok 2026-10-01T00:01:00Z)]" fail held
t "7 no reviews"                                   "[]" fail held
exit $fail
