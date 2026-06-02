// POST /api/webhooks/stripe
// Stripe subscription lifecycle -> updates vendor subscription state in Supabase.
//
// Verification: instead of signature-checking the raw body (fragile without a
// framework + raw-body access), we re-fetch the event from Stripe by id using
// the secret key. A forged/unknown event id 404s and is rejected. Updates are
// idempotent, so replays are harmless.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;

function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  return {};
}

async function stripeGet(path) {
  try {
    const r = await fetch('https://api.stripe.com/v1/' + path, {
      headers: { Authorization: 'Bearer ' + STRIPE_SECRET },
    });
    if (!r.ok) return null;
    return await r.json();
  } catch (e) {
    console.error('Stripe GET failed:', path, e);
    return null;
  }
}

async function upsertVendorByEmail(email, fields) {
  const headers = {
    'Content-Type': 'application/json',
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
  };
  // Try to update an existing waitlist row first.
  const patch = await fetch(
    `${SUPABASE_URL}/rest/v1/vendor_waitlist?email=eq.${encodeURIComponent(email)}`,
    { method: 'PATCH', headers: { ...headers, Prefer: 'return=representation' }, body: JSON.stringify(fields) }
  );
  const updated = await patch.json().catch(() => []);
  if (Array.isArray(updated) && updated.length > 0) return;
  // No existing row (vendor paid without joining the waitlist) -> insert one.
  await fetch(`${SUPABASE_URL}/rest/v1/vendor_waitlist`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=minimal' },
    body: JSON.stringify({ email, ...fields }),
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ received: false }); return; }

  const body = readBody(req);
  const eventId = body && body.id;
  if (!eventId || typeof eventId !== 'string' || eventId.indexOf('evt_') !== 0) {
    res.status(400).json({ received: false, error: 'bad_event_id' });
    return;
  }

  // Re-fetch the authoritative event from Stripe (this is the verification step).
  const event = await stripeGet('events/' + eventId);
  if (!event || !event.type) {
    res.status(400).json({ received: false, error: 'unverified' });
    return;
  }

  const obj = (event.data && event.data.object) || {};
  let email, customerId, subId, status, active;

  if (event.type === 'checkout.session.completed') {
    email = (obj.customer_details && obj.customer_details.email) || obj.customer_email;
    customerId = obj.customer;
    subId = obj.subscription;
    status = 'active';
    active = true;
  } else if (event.type.indexOf('customer.subscription.') === 0) {
    customerId = obj.customer;
    subId = obj.id;
    status = obj.status; // active | trialing | past_due | canceled | unpaid | incomplete
    active = status === 'active' || status === 'trialing';
    const cust = customerId ? await stripeGet('customers/' + customerId) : null;
    email = cust && cust.email;
  } else {
    res.status(200).json({ received: true, ignored: event.type });
    return;
  }

  if (!email) { res.status(200).json({ received: true, note: 'no_email' }); return; }

  try {
    await upsertVendorByEmail(email.toLowerCase(), {
      stripe_customer_id: customerId || null,
      stripe_subscription_id: subId || null,
      subscription_status: status || null,
      subscription_active: !!active,
      subscription_updated_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error('Supabase upsert failed (webhook):', e);
    res.status(500).json({ received: false, error: 'store_failed' });
    return;
  }

  res.status(200).json({ received: true, type: event.type, active: !!active });
};
