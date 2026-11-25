#!/usr/bin/env bash
# Checks the configuration before a deploy. Reads only secret NAMES, never values. Run on your own computer.
set -uo pipefail
cd "$(dirname "$0")/.."
bad=0
say() { printf '%-5s %s\n' "$1" "$2"; if [ "$1" = FAIL ]; then bad=1; fi; return 0; }

for f in wrangler.public.toml wrangler.admin.toml; do
  if grep -nE '"<[^"]*>"' "$f" >/dev/null; then say FAIL "$f still has placeholders: $(grep -oE '"<[^"]*>"' "$f" | tr '\n' ' ')"; else say ok "$f has no placeholders"; fi
done
days=$(grep -E '^RETENTION_DAYS' wrangler.public.toml | grep -oE '"[^"]*"' | head -1 | tr -d '"')
[[ "$days" =~ ^[0-9]+$ ]] && say ok "RETENTION_DAYS = $days" || say FAIL "RETENTION_DAYS must be a number of days (your decision)"
grep -q 'ALLOWED_ORIGINS = "https://gainauntu.github.io"' wrangler.public.toml && say ok "ALLOWED_ORIGINS is the site only" || say WARN "ALLOWED_ORIGINS differs from https://gainauntu.github.io: check it"
if git ls-files --error-unmatch .dev.vars >/dev/null 2>&1; then say FAIL ".dev.vars is tracked by Git: remove it from Git and rotate every value in it"; else say ok ".dev.vars not tracked"; fi

who=$(npx --no-install wrangler whoami 2>&1 || true)
if echo "$who" | grep -qi 'not authenticated\|not logged in'; then say FAIL "run: npx wrangler login"; else say ok "wrangler is logged in"; fi
pub=$(npx --no-install wrangler secret list --config wrangler.public.toml 2>/dev/null || true)
for s in TURNSTILE_SECRET IP_HASH_SECRET OWNER_EMAIL GMAIL_CLIENT_ID GMAIL_CLIENT_SECRET GMAIL_REFRESH_TOKEN GMAIL_SENDER; do
  echo "$pub" | grep -q "\"$s\"" && say ok "public secret $s is set" || say WARN "public secret $s not found (set it with: npx wrangler secret put $s --config wrangler.public.toml)"
done
adm=$(npx --no-install wrangler secret list --config wrangler.admin.toml 2>/dev/null || true)
for s in ADMIN_EMAILS GMAIL_CLIENT_ID GMAIL_CLIENT_SECRET GMAIL_REFRESH_TOKEN GMAIL_SENDER; do
  echo "$adm" | grep -q "\"$s\"" && say ok "admin secret $s is set" || say WARN "admin secret $s not found (npx wrangler secret put $s --config wrangler.admin.toml)"
done
[ $bad = 0 ] && echo "preflight passed (warnings above are allowed before the first deploy)" || { echo "preflight failed"; exit 1; }
