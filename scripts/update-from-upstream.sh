#!/usr/bin/env bash
# Brings this copy of the app up to date with the upstream repository.
# Used by .github/workflows/update.yml; you can also run it by hand.
#
# - Upstream changes win where they conflict with local edits.
# - wrangler.jsonc is never changed: it holds this deployment's database ID.
# - Workflow files are never changed: the Actions token is not allowed to.
set -euo pipefail

UPSTREAM="${UPSTREAM:-eyueldk-labs/cloudflare-inventory}"
BRANCH="${UPSTREAM_BRANCH:-main}"
KEEP=(wrangler.jsonc .github/workflows)

git remote remove upstream 2>/dev/null || true
git remote add upstream "${UPSTREAM_URL:-https://github.com/${UPSTREAM}.git}"
git fetch --no-tags --quiet upstream "$BRANCH"

if git merge-base --is-ancestor "upstream/$BRANCH" HEAD 2>/dev/null; then
  echo "Already up to date with ${UPSTREAM}."
  exit 0
fi

BEFORE=$(git rev-parse HEAD)
FIRST_SYNC=false
git merge-base HEAD "upstream/$BRANCH" >/dev/null 2>&1 || FIRST_SYNC=true
# --allow-unrelated-histories: a copy made by the Deploy button may start with fresh history.
git merge "upstream/$BRANCH" --no-commit --no-ff --allow-unrelated-histories -X theirs >/dev/null 2>&1 || true

# Settle anything -X theirs could not (for example, a file deleted on one side): take upstream's side.
while IFS= read -r file; do
  [ -z "$file" ] && continue
  if git cat-file -e "upstream/$BRANCH:$file" 2>/dev/null; then
    git checkout "upstream/$BRANCH" -- "$file"
  else
    git rm -q --force -- "$file"
  fi
done < <(git diff --name-only --diff-filter=U)
git add -A

# First sync of a fresh copy: git cannot tell an upstream deletion from a local addition.
# Files from the copy's first commit that upstream no longer has were deleted upstream.
if [ "$FIRST_SYNC" = true ]; then
  ROOT=$(git rev-list --max-parents=0 "$BEFORE" | tail -1)
  while IFS= read -r file; do
    if ! git cat-file -e "upstream/$BRANCH:$file" 2>/dev/null && [ -e "$file" ]; then
      git rm -q --force -- "$file"
    fi
  done < <(git ls-tree -r --name-only "$ROOT")
fi

# Keep this deployment's own settings and workflows exactly as they were.
for path in "${KEEP[@]}"; do
  git rm -r -q --cached --ignore-unmatch -- "$path"
  rm -rf -- "$path"
  if git cat-file -e "$BEFORE:$path" 2>/dev/null; then
    git checkout "$BEFORE" -- "$path"
  fi
done

git commit --quiet --no-verify -m "Update from ${UPSTREAM}" -m "Upstream: $(git rev-parse --short "upstream/$BRANCH")"
echo "Updated to ${UPSTREAM}@$(git rev-parse --short "upstream/$BRANCH")."
