#!/usr/bin/env bash
# Deploys docs/ (the static marketing site — nothing else lives there) to
# Cloudflare Pages. `wrangler pages deploy` uploads every file in the given
# directory regardless of .gitignore, so docs/ being a dedicated folder
# (not the repo root) is what keeps a-function/, backups, and any local
# secrets off Cloudflare.
set -euo pipefail
cd "$(dirname "$0")/.."

npx wrangler pages deploy docs \
  --project-name=pipsandpartners \
  --branch=main \
  --commit-dirty=true
