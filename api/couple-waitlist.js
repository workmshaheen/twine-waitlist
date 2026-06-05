// POST /api/couple-waitlist  { email, source }
// Stores the signup in Supabase (couple_waitlist) and sends a Resend confirmation.
const { coupleConfirmation, adminNotification } = require('../lib/emails');
const { allow } = require('../lib/ratelimit');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM = 'Twine <brad@twine.wedding>';
const ADMIN = process.env.ADMIN_EMAIL || 'brad@twine.wedding';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sendEmail(payload) {
  return fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify(payload),
  });
}

function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  return {};
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('couple-waitlist misconfigured: missing Supabase env');
    res.status(500).json({ ok: false, error: 'server_misconfigured' });
    return;
  }
  if (!(await allow(req, 'couple-waitlist', 8, 60))) {
    res.status(429).json({ ok: false, error: 'rate_limited' });
    return;
  }
  const { email, source } = readBody(req);
  const clean = (email || '').toString().trim().toLowerCase();
  if (!clean || clean.length > 320 || !EMAIL_RE.test(clean)) {
    res.status(400).json({ ok: false, error: 'Invalid email' });
    return;
  }

  // 1) Store in Supabase. ignore-duplicates: a returning email is a no-op (no new
  //    row, no email re-send — anti-spam). Only a genuinely new row triggers emails.
  let isNew = false;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/couple_waitlist?on_conflict=email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        Prefer: 'resolution=ignore-duplicates,return=representation',
      },
      body: JSON.stringify({ email: clean, source: (source || 'waitlist').toString().slice(0, 64) }),
    });
    if (!r.ok) {
      const t = await r.text();
      console.error('Supabase insert failed (couple):', r.status, t);
      res.status(502).json({ ok: false, error: 'store_failed' });
      return;
    }
    const rows = await r.json().catch(() => []);
    isNew = Array.isArray(rows) && rows.length > 0;
  } catch (e) {
    console.error('Supabase error (couple):', e);
    res.status(502).json({ ok: false, error: 'store_failed' });
    return;
  }

  if (!isNew) { res.status(200).json({ ok: true, already: true }); return; }

  // 2) Send emails for new signups only (non-fatal — signup is already saved):
  //    a) branded confirmation to the couple
  //    b) admin notification to the Twine inbox (reply-to = the lead)
  try {
    const confirm = coupleConfirmation();
    const admin = adminNotification({ type: 'couple', email: clean, meta: { source: source || 'waitlist' } });
    await Promise.allSettled([
      sendEmail({ from: FROM, to: [clean], subject: confirm.subject, html: confirm.html }),
      sendEmail({ from: FROM, to: [ADMIN], reply_to: clean, subject: admin.subject, html: admin.html }),
    ]);
  } catch (e) {
    console.error('Resend error (couple):', e);
  }

  res.status(200).json({ ok: true });
};
