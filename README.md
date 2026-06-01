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

## Note

The three email forms currently confirm client-side only. To capture real signups, wire the `submitCouple()` / `submitVendor()` / `submitFinal()` handlers in `index.html` to a backend (Formspree, a Vercel Function, Firebase, etc.).

---

© 2026 Twine. All rights reserved.
