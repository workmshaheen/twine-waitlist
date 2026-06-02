// POST /api/vendor-waitlist  { email, tier_interest }
// Stores the signup in Supabase (vendor_waitlist) and sends a Resend confirmation.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM = 'Twine <brad@twine.wedding>';

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
  const { email, tier_interest } = readBody(req);
  const clean = (email || '').toString().trim().toLowerCase();
  if (!clean || !clean.includes('@') || clean.length > 320) {
    res.status(400).json({ ok: false, error: 'Invalid email' });
    return;
  }

  // 1) Store in Supabase
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/vendor_waitlist`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ email: clean, tier_interest: (tier_interest || 'founding_29').toString().slice(0, 64) }),
    });
    if (!r.ok) {
      const t = await r.text();
      console.error('Supabase insert failed (vendor):', r.status, t);
      res.status(502).json({ ok: false, error: 'store_failed' });
      return;
    }
  } catch (e) {
    console.error('Supabase error (vendor):', e);
    res.status(502).json({ ok: false, error: 'store_failed' });
    return;
  }

  // 2) Send confirmation email (non-fatal — signup is already saved)
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: FROM,
        to: [clean],
        subject: 'Your Twine founding spot is reserved',
        html: `<div style="font-family:Georgia,'Times New Roman',serif;max-width:520px;margin:0 auto;color:#2b2622;line-height:1.6;font-size:16px">
  <h1 style="font-size:24px;font-weight:400;letter-spacing:.5px;margin:0 0 16px">Your founding spot is reserved.</h1>
  <p>Welcome to Twine. Your <strong>$29/month founding rate is locked in — forever</strong>. It will never increase for as long as you stay with us.</p>
  <p>Here's what happens next:</p>
  <ul style="padding-left:20px">
    <li>Your secure payment link arrives <strong>within 48 hours</strong> to activate your subscription.</li>
    <li>Your vendor profile goes <strong>live on launch day</strong>, in front of newly engaged couples in your area.</li>
  </ul>
  <p>You're one of the first vendors on the platform — thank you for building this with us.</p>
  <p style="margin-top:28px">— The Twine team</p>
  <p style="margin-top:24px;font-size:13px;color:#9a8f86">Twine · The modern wedding platform · twine.wedding</p>
</div>`,
      }),
    });
  } catch (e) {
    console.error('Resend error (vendor):', e);
  }

  res.status(200).json({ ok: true });
};
