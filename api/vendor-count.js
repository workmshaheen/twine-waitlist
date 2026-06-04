// GET /api/vendor-count — real founding-vendor scarcity for the landing page.
// Returns { ok, taken, cap, left } from the live vendor_waitlist count (cap 100).
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CAP = 100;

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60');
  if (!SUPABASE_URL || !SERVICE_KEY) { res.status(200).json({ ok: false, taken: 0, cap: CAP, left: CAP }); return; }
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/vendor_waitlist?select=id`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Prefer: 'count=exact', Range: '0-0' },
    });
    const range = r.headers.get('content-range') || '';
    const taken = Math.max(0, Math.min(CAP, parseInt((range.split('/')[1] || '0'), 10) || 0));
    res.status(200).json({ ok: true, taken, cap: CAP, left: CAP - taken });
  } catch (e) {
    res.status(200).json({ ok: false, taken: 0, cap: CAP, left: CAP });
  }
};
