// POST /api/delete-account — permanently deletes the caller's account + all data.
// Apple App Store Guideline 5.1.1(v): apps with account creation must let users
// initiate account deletion from within the app.
//
// Auth: Authorization: Bearer <supabase access token>
// Deleting the auth user cascades couples (id references auth.users on delete cascade),
// which in turn cascades swipes, saved_vendors, tasks, vera_messages, guests,
// registry_items, and budget_items.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'method_not_allowed' }); return; }
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('delete-account misconfigured: missing Supabase env');
    res.status(500).json({ ok: false, error: 'server_misconfigured' }); return;
  }

  const auth = req.headers.authorization || req.headers.Authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) { res.status(401).json({ ok: false, error: 'no_session' }); return; }

  // 1) Resolve the caller's own user id from their token (never trust a client-supplied id).
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

  // 2) Admin-delete the user. Cascades all couple-owned rows via FK on delete cascade.
  try {
    const d = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${uid}`, {
      method: 'DELETE',
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
    if (!d.ok && d.status !== 404) {
      const t = await d.text();
      console.error('admin delete failed', d.status, t);
      res.status(502).json({ ok: false, error: 'delete_failed' }); return;
    }
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error('delete-account error', e);
    res.status(502).json({ ok: false, error: 'delete_failed' });
  }
};
