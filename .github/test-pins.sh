#!/usr/bin/env bash
# Checks that every action and review plugin the workflows run is fixed to a
# commit. Run it after editing anything under .github/workflows/:
# ./.github/test-pins.sh
#
# A tag or a branch can be moved to other code by whoever controls the
# repository it names, and the next run executes that code with the job's
# secrets (S29, nomadwiz/kete#390). So every uses: names a full commit SHA,
# with the tag it stood for in a trailing comment, and every plugin marketplace
# is a checkout the workflow made at a full commit SHA. agent-skills' own
# marketplace entry names a github source the installer would fetch from its
# default branch, so the step must also point that entry at the checkout.
set -euo pipefail
cd "$(dirname "$0")/.."
F=.github/workflows/claude-code-review.yml
fail=0

while IFS= read -r line; do
  grep -Eq 'uses: [^@ ]+@[0-9a-f]{40}( #.*)?$' <<<"$line" || { echo "FAIL: not pinned to a commit: $line"; fail=1; }
done < <(find .github/workflows \( -name '*.yml' -o -name '*.yaml' \) -exec grep -HnE '^[ -]*uses:' {} +)

markets=$(awk '/plugin_marketplaces: \|/ {f=1; next} f && /^ {0,11}[^ ]/ {exit} f {sub(/^ +/, ""); print}' "$F")
[ -n "$markets" ] || { echo "FAIL: no plugin_marketplaces found in $F"; fail=1; }
while IFS= read -r m; do
  name=${m##*/}
  # shellcheck disable=SC2016 # matches the literal ${{ runner.temp }} and $RUNNER_TEMP
  if [ "$m" != '${{ runner.temp }}/'"$name" ] ||
     ! grep -Eq 'git -C "\$RUNNER_TEMP/'"$name"'" checkout -q [0-9a-f]{40}$' "$F"; then
    echo "FAIL: marketplace is not a checkout fixed to a commit: $m"; fail=1
  fi
done <<<"$markets"
grep -Fq "(.plugins[] | select(.name == \"agent-skills\")).source = \"./\"" "$F" ||
  { echo "FAIL: agent-skills' marketplace entry still fetches its default branch"; fail=1; }

[ "$fail" = 0 ] && echo "ok: every action and plugin is fixed to a commit"
exit "$fail"
