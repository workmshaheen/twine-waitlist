// POST /api/vera  — Vera, Twine's AI wedding concierge (server-side proxy to Claude).
// Holds ANTHROPIC_API_KEY server-side (never ships in the app bundle), verifies the
// caller's Supabase session, enforces the free-message limit via RLS, then calls Claude.
//
// Body: { messages: [{role:'user'|'assistant', content:string}], couple?: {...} }
// Auth: Authorization: Bearer <supabase access token>  (from the app's session)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.VERA_MODEL || 'claude-haiku-4-5';
const { allow } = require('../lib/ratelimit');
const FREE_LIMIT = 5; // free user messages before the $10 unlock

function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  return {};
}

const PERSONA = `You are Vera, the warm, sharp wedding-planning concierge inside Twine — an app that helps couples plan their wedding and discover vendors.

Voice: encouraging, calm, and genuinely helpful, like a friend who has planned a hundred weddings. Concise and concrete. No corporate filler, no excessive emoji (one at most, rarely), no markdown headings.

What you do:
- Answer planning questions: timelines, budgets, what to book and when, etiquette, guest/RSVP/seating, vendor outreach, day-of logistics.
- Use the couple's context (names, date, location, vibe, budget) to make advice specific.
- Keep replies short and skimmable — a tight paragraph or a short list (max ~5 bullets). Lead with the answer.
- When they should meet vendors, point them to Discover (swipe) in the app rather than naming specific businesses you can't verify.
- If you write a vendor inquiry or message for them, make it ready to send.

Boundaries: don't invent specific vendor names, prices, or availability. Don't give legal, medical, or financial-advice-grade guidance — keep it to wedding planning. If asked something outside weddings, gently steer back.`;

function coupleContext(c) {
  if (!c || typeof c !== 'object') return 'No couple details on file yet.';
  const s = (v) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, 120); // cap untrusted client text
  const names = [c.p1, c.p2].map(s).filter(Boolean).join(' & ');
  const budget = Number(c.budget);
  const lines = [
    names && `Couple: ${names}`,
    c.date && `Wedding date: ${s(c.date)}`,
    c.location && `Location: ${s(c.location)}`,
    c.vibe && `Vibe: ${s(c.vibe)}`,
    Number.isFinite(budget) && budget > 0 && `Budget: $${budget.toLocaleString()}`,
  ].filter(Boolean);
  return lines.length ? `Here is what you know about this couple:\n${lines.join('\n')}` : 'No couple details on file yet.';
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'method_not_allowed' }); return; }
  if (!SUPABASE_URL || !SERVICE_KEY || !ANTHROPIC_API_KEY) {
    console.error('vera misconfigured: missing env');
    res.status(500).json({ ok: false, error: 'server_misconfigured' }); return;
  }
  if (!(await allow(req, 'vera', 30, 60))) {
    res.status(429).json({ ok: false, error: 'rate_limited' }); return;
  }

  // 1) Authenticate the caller via their Supabase session token.
  const auth = req.headers.authorization || req.headers.Authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) { res.status(401).json({ ok: false, error: 'no_session' }); return; }

  let uid;
  try {
    const u = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${token}` },
    });
    if (!u.ok) { res.status(401).json({ ok: false, error: 'invalid_session' }); return; }
    uid = (await u.json()).id;
  } catch (e) {
    res.status(502).json({ ok: false, error: 'auth_check_failed' }); return;
  }
  if (!uid) { res.status(401).json({ ok: false, error: 'invalid_session' }); return; }

  const sbHeaders = { apikey: SERVICE_KEY, Authorization: `Bearer ${token}` };

  // Ensure a couples row exists (service role) so the vera_messages FK and the
  // free-limit count work for any valid session — don't rely on the client having
  // completed onboarding. ignore-duplicates won't overwrite an existing row.
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/couples?on_conflict=id`, {
      method: 'POST',
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify({ id: uid }),
    });
  } catch (e) { console.error('vera ensure-couple failed', e); }

  const persistMsg = (role, content) =>
    fetch(`${SUPABASE_URL}/rest/v1/vera_messages`, {
      method: 'POST',
      headers: { ...sbHeaders, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ couple_id: uid, role, content }),
    }).catch((e) => console.error('vera persist failed', e));

  // 2) Read entitlement (fail closed below if we can't establish the limit).
  let unlocked = false;
  try {
    const c = await fetch(`${SUPABASE_URL}/rest/v1/couples?id=eq.${uid}&select=vera_unlocked`, { headers: sbHeaders });
    const rows = c.ok ? await c.json() : [];
    unlocked = !!(rows[0] && rows[0].vera_unlocked);
  } catch { /* treat as not unlocked; count gate below decides */ }

  // 3) Enforce the free-message limit. `used` counts prior user turns (the client no
  //    longer pre-persists), so the gate is exact and race-free.
  if (!unlocked) {
    let used = null;
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/vera_messages?couple_id=eq.${uid}&role=eq.user&select=id`,
        { headers: { ...sbHeaders, Prefer: 'count=exact', Range: '0-0' } });
      const range = r.headers.get('content-range') || '';
      const n = parseInt((range.split('/')[1] || ''), 10);
      used = Number.isNaN(n) ? null : n;
    } catch { used = null; }
    if (used === null) { res.status(503).json({ ok: false, error: 'limit_check_failed' }); return; } // fail closed — don't burn credits
    if (used >= FREE_LIMIT) { res.status(402).json({ ok: false, error: 'limit_reached' }); return; }
  }

  // 4) Build the request.
  const { messages, couple } = readBody(req);
  const history = Array.isArray(messages) ? messages : [];
  const turns = history
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-12)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
  if (!turns.length || turns[turns.length - 1].role !== 'user') {
    res.status(400).json({ ok: false, error: 'no_user_message' }); return;
  }

  // Persist the user's message now (authoritative history + drives the limit count).
  await persistMsg('user', turns[turns.length - 1].content);

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1000,
        system: [
          { type: 'text', text: PERSONA, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: coupleContext(couple) },
        ],
        messages: turns,
      }),
    });
    if (!r.ok) {
      const t = await r.text();
      console.error('Anthropic error', r.status, t);
      res.status(502).json({ ok: false, error: 'ai_failed' }); return;
    }
    const data = await r.json();
    const reply = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
    if (reply) await persistMsg('assistant', reply);
    res.status(200).json({ ok: true, reply });
  } catch (e) {
    console.error('Vera proxy error', e);
    res.status(502).json({ ok: false, error: 'ai_failed' });
  }
};
