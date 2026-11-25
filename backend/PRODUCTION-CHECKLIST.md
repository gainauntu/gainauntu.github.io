# Production checklist: direct inquiries

Status on 25 Nov 2026: **nothing is configured or deployed.** The code and tests are ready (23 local integration
tests and a browser end-to-end test, all with mocked Turnstile, Resend and Access). The website keeps the email hand-off
until every row below is done and item 14 has passed in production.

Cost classes: **Free** = no payment details needed. **Free, card required** = $0, but the provider asks for a payment
method. **Recurring** = a paid, renewing item. Prices are from the providers' pages checked 24–25 Nov 2026 (links in
README.md); confirm them when you sign up.

| # | item | who does it | cost class | what exactly | status |
|---|---|---|---|---|---|
| 1 | Cloudflare account | you | Free | sign up; on your computer `npm ci` in this folder, then `npx wrangler login` | not done |
| 2 | Public Worker `gainauntu-inquiry-api` | you, with `scripts/deploy.sh` | Free (100,000 requests/day) | `src/public.js`, `wrangler.public.toml` | code ready, not deployed |
| 3 | Admin Worker `gainauntu-inquiry-admin` | you, with `scripts/deploy.sh` | Free | `src/admin.js`, `wrangler.admin.toml`; separate Worker so Access can cover all of it | code ready, not deployed |
| 4 | D1 database + migration | you | Free (5 GB, 5 M reads, 100 k writes/day) | `npx wrangler d1 create gainauntu-inquiries`, copy `database_id` into both toml files; `deploy.sh` applies `migrations/0001_init.sql` | not done |
| 5 | Turnstile widget | you | Free | dashboard → Turnstile → Add widget, hostname `gainauntu.github.io`, Managed; site key → item 13, secret → item 9 | not done |
| 6 | Cloudflare Access on the admin Worker | you | Free (Zero Trust Free, up to 50 users; Cloudflare's pages say no card is needed; confirm at sign-up. If a card is asked for, use the card-free option in FREE-OPTIONS.md) | Workers & Pages → `gainauntu-inquiry-admin` → Settings → Domains & Routes → Enable Cloudflare Access; copy AUD tag and team domain into `wrangler.admin.toml`; never on the public Worker | not done |
| 7 | Resend account + API key | you | Free (3,000 emails/month, 100/day) | API key with sending access only; webhook to `<public URL>/v1/webhooks/resend` (delivered, bounced, delayed, complained, failed) | not done |
| 8 | Verified sending domain | you, optional | **Recurring** (yearly domain registration; price not checked) | needed only to email visitors (confirmations, replies from the dashboard). Without it: notifications reach your Resend account address; you reply from Gmail and press "Mark as replied" | not needed for launch |
| 9 | Secrets | you, `npx wrangler secret put <NAME> --config <file>` | Free | public: `TURNSTILE_SECRET`, `RESEND_API_KEY`, `IP_HASH_SECRET` (`openssl rand -hex 32`), `OWNER_EMAIL`, `RESEND_WEBHOOK_SECRET`; admin: `ADMIN_EMAILS`, `RESEND_API_KEY_ADMIN`. Never in chat, Git or the website | not done |
| 10 | Allowed origins | set | Free | `ALLOWED_ORIGINS = "https://gainauntu.github.io"`, `TURNSTILE_HOSTNAMES = "gainauntu.github.io"` | done in config |
| 11 | Retention period | **your decision** | Free | `RETENTION_DAYS` in `wrangler.public.toml` (e.g. 365). Archived inquiries older than this are deleted daily; IP hashes are cleared after 2 days. The privacy notice states no period until you choose | open |
| 12 | Deployment | you | Free | `bash scripts/preflight.sh` (reads secret names only), then `bash scripts/deploy.sh --yes`; rollback `npx wrangler rollback --config <file>` | scripts ready |
| 13 | Website configuration | PR to the site, after item 14 passes | Free | `content/site.json` → `inquiry.apiBase` = public Worker URL, `inquiry.turnstileSiteKey` = site key; rebuild. The form then submits directly, the privacy notice switches to its direct-mode text, the board appears. Leaving either value empty keeps the email hand-off | prepared, waiting |
| 14 | End-to-end verification | you | Free | (a) `node scripts/verify-production.mjs --api <public URL> --admin <admin URL>`: 12 non-destructive checks, stores nothing. (b) Build the site with the two values and serve it locally, or test on a preview, and submit one inquiry of each type to **your own** address; check the dashboard, your inbox, a reply, the board opt-in and approval, and deletion. Only then merge item 13 | not done |

## What "live" means
The backend is live only after items 1–9, 11 and 12 are done, item 14 passes in production, and item 13 is merged.
Until then the site says nothing about direct submission and loads no Turnstile script.

## If anything fails after launch
Set `inquiry.apiBase` back to `""` and rebuild (the email hand-off returns at once), or roll back the Worker. Inquiries
already stored stay in D1 and remain visible in the dashboard.
