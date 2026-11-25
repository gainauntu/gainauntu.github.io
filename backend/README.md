# Inquiry backend for gainauntu.github.io

Status: **implemented and tested locally (mocks); not deployed.** The website keeps its email hand-off until you finish the
setup below and a production end-to-end test passes. Nothing here is live.

Start with **`PRODUCTION-CHECKLIST.md`** (the 14 items, who does each, and what costs money). Scripts: `scripts/preflight.sh`
(configuration check, reads secret names only), `scripts/deploy.sh --yes` (migrations + both Workers),
`scripts/verify-production.mjs` (non-destructive production checks). Moving this folder to a private repository:
`MOVE-TO-PRIVATE-REPO.md`.

## What it is

| part | where it runs | who can reach it |
|---|---|---|
| Website (unchanged hosting) | GitHub Pages | everyone |
| `src/public.js` – inquiry API | Cloudflare Worker `gainauntu-inquiry-api` | anyone, but every submission needs a valid Turnstile token, passes validation and rate limits |
| `src/admin.js` + `src/admin/*` – your dashboard | Cloudflare Worker `gainauntu-inquiry-admin` | only identities Cloudflare Access lets through **and** that are on `ADMIN_EMAILS` (the Worker re-checks the signed Access token on every request) |
| `migrations/0001_init.sql` | Cloudflare D1 database `gainauntu-inquiries` | only the two Workers (binding); never the website, never GitHub |
| email | Resend (HTTP API) | — |

Flow: visitor submits → the API validates (allow-listed fields, lengths, one-line fields, email format, consent, honeypot) →
burst limit → **idempotency** (same attempt key returns the same inquiry) → Turnstile → same-content guard → daily limits →
**stored in D1** → owner notification (and, if enabled, a fixed-text confirmation to the visitor) → the response reports
storage and email outcome separately. No endpoint looks inquiries up by reference.

## Security and privacy model
- Secrets only in Cloudflare secret storage (`wrangler secret put`); `.dev.vars` is git-ignored; nothing secret in the website.
- Parameterized SQL everywhere; dashboard renders stored text with `textContent` only; strict CSP, `frame-ancestors 'none'`.
- Admin: Access JWT verified (RS256 signature, issuer, audience, expiry, not-before, email allow-list) on every route;
  state changes also need JSON, header `x-ag-admin: 1` and a same-origin `Origin` (CSRF). Placeholder config fails closed.
- Email: values go as JSON fields to the provider API; subjects/names are reduced to one line (no header injection).
  Visitor confirmations never echo the visitor's own text (the form cannot be used to send spam to third parties).
- CORS allows only the site's origin; CORS is not treated as authentication.
- IP addresses are stored only as an HMAC (`IP_HASH_SECRET`) for rate limiting and cleared after 2 days.
- Logs contain references and error codes only.
- Webhooks: Svix signature verified (HMAC-SHA256, 5-minute window), each delivery id processed once (replay-safe).
- Public board: returns only `{type, status, month}` for inquiries that the visitor opted into **and** you approved.
- Retention: archived inquiries older than `RETENTION_DAYS` are deleted daily; you can delete any inquiry at once in the
  dashboard (requires typing its reference). Choose `RETENTION_DAYS` yourself; the privacy notice does not state a period.

## Costs (official pages, checked 24–25 Nov 2026; confirm before signing up)
| service | plan that is enough | cost | notes |
|---|---|---|---|
| Cloudflare Workers | Free: 100,000 requests/day | $0 | [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) |
| Cloudflare D1 | Free: 5 M rows read/day, 100 k rows written/day, 5 GB | $0 | [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) |
| Cloudflare Turnstile | Free: up to 20 widgets | $0 | [Turnstile plans](https://developers.cloudflare.com/turnstile/plans/) |
| Cloudflare Access (Zero Trust) | Free: up to 50 users | $0, **but Cloudflare requires a payment card on file for the free plan** | [Zero Trust free plan](https://www.cloudflare.com/zero-trust/trial), [one-click Access for Workers](https://developers.cloudflare.com/workers/configuration/cloudflare-access/) |
| Resend | Free: 3,000 emails/month, 100/day | $0 | [Resend pricing](https://resend.com/pricing), [quotas](https://resend.com/docs/knowledge-base/account-quotas-and-limits) |
| A domain you own | needed to email visitors (confirmations, replies from the dashboard) | about $10–15/year at most registrars (not checked) | without it Resend only delivers to your own account address ([403 on resend.dev](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain)) |

Without a domain: notifications to you work (`onboarding@resend.dev` → your Resend account address); visitor confirmations
stay off; you reply from Gmail and press "Mark as replied" in the dashboard. `DAILY_LIMIT_TOTAL = 80` keeps you inside
Resend's 100/day.

## Setup (your actions; nothing below has been done)
1. **Cloudflare account** (free). `npm ci` here, then `npx wrangler login` on your computer.
2. **Database**: `npx wrangler d1 create gainauntu-inquiries` → copy the `database_id` into both `wrangler.*.toml`.
   Then `npm run db:migrate:remote`.
3. **Turnstile**: dashboard → Turnstile → Add widget, hostname `gainauntu.github.io`, mode Managed. Keep the site key for
   step 8; the secret key goes in step 4.
4. **Secrets for the public Worker** (each command asks for the value; never paste them into chat or Git):
   ```
   npx wrangler secret put TURNSTILE_SECRET      --config wrangler.public.toml
   npx wrangler secret put RESEND_API_KEY        --config wrangler.public.toml
   npx wrangler secret put IP_HASH_SECRET        --config wrangler.public.toml   # e.g. output of: openssl rand -hex 32
   npx wrangler secret put OWNER_EMAIL           --config wrangler.public.toml
   npx wrangler secret put RESEND_WEBHOOK_SECRET --config wrangler.public.toml   # after step 7
   ```
   Set `RETENTION_DAYS` in `wrangler.public.toml` (your decision).
5. **Deploy the public Worker**: `npm run deploy:public` → note its URL (`https://gainauntu-inquiry-api.<subdomain>.workers.dev`).
6. **Admin Worker**: `npx wrangler secret put ADMIN_EMAILS --config wrangler.admin.toml` (your login email) and
   `RESEND_API_KEY_ADMIN`; `npm run deploy:admin`; then dashboard → Workers & Pages → `gainauntu-inquiry-admin` → Settings →
   Domains & Routes → **Enable Cloudflare Access** (this is where the card-on-file requirement applies). Copy the Access
   application's **AUD tag** and your **team domain** into `wrangler.admin.toml`, deploy again. Never enable Access on the
   public Worker (it would block visitors).
7. **Resend**: create an API key (sending access). Optional but recommended: add and verify your domain, then set
   `CONFIRM_FROM`, `SEND_CONFIRMATION = "true"` (public) and `REPLY_FROM` (admin). Add a webhook to
   `<public URL>/v1/webhooks/resend` for delivered/bounced/delayed/complained/failed and store its signing secret (step 4).
8. **Website**: in the site source set `content/site.json` → `inquiry.apiBase` = the public URL from step 5 and
   `inquiry.turnstileSiteKey` = the site key from step 3; rebuild. The form then submits directly, the privacy notice switches
   to its direct-submission text, and the board appears. Review the privacy text first (it names Cloudflare, Resend, Turnstile).

## Verify in production before announcing it
0. `node scripts/verify-production.mjs --api <public URL> --admin <admin URL>` (12 checks; stores nothing, sends nothing).
1. Submit one inquiry of each type from the live site, to **your own** address only; check the dashboard and your inbox.
2. Check the API refuses another origin: `curl -i -X POST <public URL>/v1/inquiries -H 'origin: https://example.com'` → 403.
3. Open the dashboard in a private window without logging in → Access login page; with a non-listed account → 403.
4. If any step fails: set `inquiry.apiBase` back to `""` and rebuild (the email hand-off returns), or
   `npx wrangler rollback --config wrangler.public.toml`.

## Local development and tests
```
npm ci
npm test                                   # 23 integration tests against the real Worker code (local workerd, mocked email/Turnstile/Access)
node test/e2e-site.mjs <site build with AG_INQUIRY_API=http://127.0.0.1:8799> <screenshot dir>   # browser end-to-end
npm run check:public && npm run check:admin   # bundle both Workers without deploying
```

## Known limits
- Cloudflare's rate-limit binding is approximate per location; the D1 daily caps are the firm limit.
- Gmail replies are not synchronised; use "Mark as replied" after answering outside the dashboard.
- Delivery states depend on Resend webhooks; "accepted" means accepted by the provider, not delivered.
- This directory is published by GitHub Pages if merged into the site repository (it contains no secrets). A private
  repository for the backend is cleaner; moving it is your decision.
