// Lightweight DB-backed per-IP rate limiter (Supabase `rl_hit` RPC, service-role).
// Protects unauthenticated / cost-sensitive endpoints from abuse (email-bombing,
// Anthropic cost exhaustion, account-deletion spam) without extra infra.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function clientIp(req) {
  const xff = req.headers['x-forwarded-for'] || req.headers['X-Forwarded-For'];
  if (xff) return String(xff).split(',')[0].trim();
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
}

// Returns true if allowed, false if the IP exceeded `max` hits in `ttlSeconds`.
// Fails OPEN on infra error so a transient DB blip never blocks legitimate users
// (cost endpoints have their own per-account caps as a second layer).
async function allow(req, name, max, ttlSeconds) {
  if (!SUPABASE_URL || !SERVICE_KEY) return true;
  const bucket = `${name}:${clientIp(req)}`;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/rl_hit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({ p_bucket: bucket, p_max: max, p_ttl: ttlSeconds }),
    });
    if (!r.ok) return true;
    return (await r.json()) === true;
  } catch {
    return true;
  }
}

module.exports = { allow, clientIp };
