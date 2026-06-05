-- ============================================================
-- TWINE waitlist — Supabase schema (landing page)
-- Project ref: vjrithfwgwgyacyqrhyy (shared with the iOS app).
-- These tables back /api/couple-waitlist, /api/vendor-waitlist, /api/vendor-count,
-- and /api/webhooks/stripe. RLS is ENABLED with NO policies → only the service_role
-- key (used server-side by the Vercel functions) can read/write; the anon key cannot.
-- Reflects the live DB as of 2026-06-05.
-- ============================================================

create table if not exists couple_waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  source text,
  created_at timestamptz default now()
);
create unique index if not exists couple_waitlist_email_uk on couple_waitlist (email);

create table if not exists vendor_waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  tier_interest text default 'founding_29',
  -- Stripe subscription lifecycle (set by api/webhooks/stripe.js):
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text,
  subscription_active boolean,
  subscription_updated_at timestamptz,
  created_at timestamptz default now()
);
create unique index if not exists vendor_waitlist_email_uk on vendor_waitlist (email);

alter table couple_waitlist enable row level security;
alter table vendor_waitlist enable row level security;
-- No policies on purpose: service_role bypasses RLS; anon/authenticated have no access.
