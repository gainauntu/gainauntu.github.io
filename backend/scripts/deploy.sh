#!/usr/bin/env bash
# Deploys the database migrations and both Workers to YOUR Cloudflare account. Run on your own computer after
# `npx wrangler login` and the setup in README.md. Never pass secrets as arguments; set them with `wrangler secret put`.
set -euo pipefail
cd "$(dirname "$0")/.."
if [ "${1:-}" != "--yes" ]; then
  echo "This deploys to your Cloudflare account (free plan; see PRODUCTION-CHECKLIST.md for costs)."
  echo "Run again with --yes to continue: scripts/deploy.sh --yes"; exit 2
fi
bash scripts/preflight.sh
npm test
npm run db:migrate:remote
npm run deploy:public
npm run deploy:admin
cat <<'EOF'

Deployed. Next:
  1. Enable Cloudflare Access on gainauntu-inquiry-admin (only on the admin Worker), copy AUD and team domain into
     wrangler.admin.toml, then: npm run deploy:admin
  2. node scripts/verify-production.mjs --api <public URL> --admin <admin URL>
  3. Manual end-to-end test (README). Only then change the website config.
Roll back: npx wrangler rollback --config wrangler.public.toml   (and/or wrangler.admin.toml)
EOF
