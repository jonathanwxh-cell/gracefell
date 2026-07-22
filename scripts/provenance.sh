#!/usr/bin/env bash
# Rebuild the provenance ledger from git trailers.
#
# PROVENANCE.md is the human-facing record, but it can drift if an agent forgets
# to update it. The Agent-Pass commit trailers can't drift — they're in the object
# store. This prints what git actually knows, so you can reconcile.
#
#   ./scripts/provenance.sh          # every commit, tagged or not
#   ./scripts/provenance.sh --gaps   # only commits MISSING a trailer
#
# Note: fields are separated with \x1f (unit separator), not tab — tab is an IFS
# whitespace character, so bash collapses consecutive tabs and empty fields vanish.
set -euo pipefail
cd "$(dirname "$0")/.."

FMT='%h%x1f%ad%x1f%(trailers:key=Agent-Pass,valueonly,separator=%x2C )%x1f%s'

if [[ "${1:-}" == "--gaps" ]]; then
  found=0
  while IFS=$'\x1f' read -r sha date pass subj; do
    if [[ -z "${pass// /}" ]]; then
      [[ $found -eq 0 ]] && echo "Commits with no Agent-Pass trailer:"
      found=1
      printf '  %-10s %-12s %s\n' "$sha" "$date" "$subj"
    fi
  done < <(git log --reverse --format="$FMT" --date=short)
  [[ $found -eq 0 ]] && echo "All commits tagged. Clean."
  exit 0
fi

printf '%-9s  %-11s  %-32s  %s\n' 'COMMIT' 'DATE' 'AGENT-PASS' 'SUBJECT'
while IFS=$'\x1f' read -r sha date pass subj; do
  printf '%-9s  %-11s  %-32s  %s\n' "$sha" "$date" "${pass:-— untagged —}" "$subj"
done < <(git log --reverse --format="$FMT" --date=short)
