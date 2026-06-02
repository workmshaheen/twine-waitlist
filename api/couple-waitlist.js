// POST /api/couple-waitlist  { email, source }
// Stores the signup in Supabase (couple_waitlist) and sends a Resend confirmation.
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
  const { email, source } = readBody(req);
  const clean = (email || '').toString().trim().toLowerCase();
  if (!clean || !clean.includes('@') || clean.length > 320) {
    res.status(400).json({ ok: false, error: 'Invalid email' });
    return;
  }

  // 1) Store in Supabase
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/couple_waitlist`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ email: clean, source: (source || 'waitlist').toString().slice(0, 64) }),
    });
    if (!r.ok) {
      const t = await r.text();
      console.error('Supabase insert failed (couple):', r.status, t);
      res.status(502).json({ ok: false, error: 'store_failed' });
      return;
    }
  } catch (e) {
    console.error('Supabase error (couple):', e);
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
        subject: "You're on the Twine waitlist — launching in 1–2 weeks",
        html: `<div style="font-family:Georgia,'Times New Roman',serif;max-width:520px;margin:0 auto;color:#2b2622;line-height:1.6;font-size:16px">
  <h1 style="font-size:24px;font-weight:400;letter-spacing:.5px;margin:0 0 16px">You're on the list.</h1>
  <p>Thank you for joining the Twine waitlist. Your spot is reserved.</p>
  <p>We're launching in <strong>1–2 weeks</strong>, and you'll be among the very first to know the moment we go live — early access, ahead of everyone else.</p>
  <p>We can't wait to help you plan something beautiful.</p>
  <p style="margin-top:28px">— The Twine team</p>
  <p style="margin-top:24px;font-size:13px;color:#9a8f86">Twine · The modern wedding platform · twine.wedding</p>
</div>`,
      }),
    });
  } catch (e) {
    console.error('Resend error (couple):', e);
  }

  res.status(200).json({ ok: true });
};
