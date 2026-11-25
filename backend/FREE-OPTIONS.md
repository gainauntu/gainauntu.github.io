# Can the inquiry system run with no domain and no payment card?

Checked 25 Nov 2026 from the providers' public pages; terms change, so confirm at sign-up. Nothing was signed up for.

## Short answer
Yes, for everything except **sending email to visitors from a custom address**. The existing Cloudflare backend already
runs at $0 without a domain: submissions, private storage, the admin login and notifications to you. Visitor
confirmations and replies sent *from the dashboard* are what need a domain with Resend. Two free ways around that exist;
neither requires rewriting the backend.

## What each part needs
| need | existing design (Cloudflare + Resend) | card? | domain? |
|---|---|---|---|
| direct submissions | Worker + Turnstile | no | no |
| private storage | D1 | no | no |
| admin login | Cloudflare Access (Zero Trust Free) | Cloudflare's plan and trial pages say no card; earlier notes said one was required. Confirm at sign-up | no |
| notification to you | Resend free, `onboarding@resend.dev` sender to your own account address | no | no |
| confirmation / reply to visitors | Resend from your verified domain | no | **yes** (yearly cost) |

## Options compared
| | A. Existing design, no domain (recommended start) | B. Existing design + Gmail API sender | C. Google Apps Script + Google Sheets |
|---|---|---|---|
| cost | $0, no card | $0, no card | $0, no card |
| submissions, spam check | Worker + Turnstile (built, tested) | same | Apps Script web app; Turnstile check by hand-written code; CORS needs workarounds |
| storage | D1, private | same | a Sheet in your Google Drive |
| admin login | Cloudflare Access (built) | same | your Google account (the Sheet) |
| notifications to you | yes (Resend free) | yes | yes (MailApp) |
| replies to visitors | from your Gmail, then "Mark as replied" in the dashboard | **from the dashboard, sent through your Gmail** | from Gmail or a script |
| visitor confirmations | off | possible, from your Gmail | possible (MailApp) |
| limits | Resend 100/day | Gmail sending limits apply | MailApp: 100 recipients/day on a personal account |
| work needed | none (configuration only) | one sender module in the admin Worker, a Google Cloud OAuth client with the `gmail.send` scope, a stored refresh token. The OAuth app must be published: tokens of apps left in "Testing" expire after about 7 days | a new backend; the tested dashboard, board, rate limits and webhooks would be lost |
| verdict | launch with this | add later only if you want to reply from the dashboard | no practical advantage; not recommended |

## Recommendation
1. Launch with **A**: everything works at $0 without a domain; you answer from Gmail and mark the inquiry as replied.
2. If Cloudflare asks for a card for Access, the admin Worker can use a GitHub or Google sign-in restricted to your
   account instead. That is a small change to `src/admin.js` (the Access check is one function); only do it if needed.
3. Consider **B** or a domain later, only if replying from the dashboard matters to you.

Sources: [Cloudflare plans](https://developers.cloudflare.com/plans/), [Zero Trust plans](https://www.cloudflare.com/plans/sase-zero-trust.md),
[Zero Trust trial page](https://www.cloudflare.com/es-la/zero-trust/enterprise-trial/), [Cloudflare billing policy](https://developers.cloudflare.com/billing/understand/billing-policy/),
[Apps Script quotas](https://developers.google.com/apps-script/guides/services/quotas), [Gmail API sending](https://developers.google.com/workspace/gmail/api/guides/sending),
[Gmail API from Workers (community)](https://dev.to/roboword/implementing-gmail-api-with-cloudflare-workers-part-3-implementation-199f).
