# Twine — Early Access Landing Page

Editorial, magazine-style waitlist landing page for **Twine**, the modern wedding discovery platform. Single, self-contained `index.html` — no build step, no dependencies.

## Highlights

- **Two modes** — toggle between the *Couples* and *Vendors* experience (also auto-selected via `?vendor` / `?v=1` URL param).
- **Editorial design system** — Cormorant + Jost typography, paper/ink palette, film grain, custom cursor.
- **Comparison carousel** — swipe / drag / arrow-key navigable Twine vs. The Knot vs. WeddingWire vs. Zola.
- **AI feature teasers** — AI wedding website builder + the "Vera" planning concierge.
- **Fully responsive** — tuned breakpoints at 1100 / 768 / 480 / 380 px, with `prefers-reduced-motion` support.
- **Live countdown**, animated stats, scroll-reveal, and three waitlist capture points.

## Local preview

It's a static file — just open it:

```bash
open index.html
# or serve it
python3 -m http.server 8000   # then visit http://localhost:8000
```

## Deploy

Hosted on Vercel as a static site (zero config — `vercel.json` only adds clean URLs and security headers).

```bash
vercel        # preview
vercel --prod # production
```

## Backend (live)

Vercel serverless functions in `/api` (dependency-free Node, CommonJS, global `fetch`):

- `couple-waitlist.js` / `vendor-waitlist.js` — upsert the email into Supabase (`couple_waitlist` / `vendor_waitlist`, unique on `email`, ignore-duplicates) and send a branded Resend confirmation + an admin notification. Emails fire only for genuinely new signups.
- `vendor-count.js` — live founding-vendor count powering the homepage scarcity bar.
- `vera.js` — auth-gated proxy to the Claude API (server-held `ANTHROPIC_API_KEY`); verifies the Supabase session, enforces the free-message limit server-side, persists the conversation. Powers the in-app Vera concierge.
- `delete-account.js` — Apple-required in-app account deletion (admin-deletes the user; cascades all data).
- `webhooks/stripe.js` — vendor subscription lifecycle → `vendor_waitlist`.

Secrets live ONLY in Vercel env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `ANTHROPIC_API_KEY`, `VERA_MODEL`, `ADMIN_EMAIL`, `STRIPE_SECRET_KEY`. Table DDL is in `schema.sql`. Legal pages: `/privacy`, `/terms`.

---

© 2026 Twine · Scripps Labs LLC. All rights reserved.
