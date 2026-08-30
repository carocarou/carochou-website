#!/bin/bash
set -e
cd "$(dirname "$0")"

git add -A

if git diff --cached --quiet; then
  echo "No changes to deploy."
  exit 0
fi

git commit -m "Update site $(date '+%Y-%m-%d %H:%M')"
git push

echo ""
echo "Deployed. Live at https://carochou.com within about a minute."
