// Shared Twine-branded email templates (Resend HTML).
// Design mirrors twine.wedding: Cormorant wordmark, Jost body, paper/ink/rose/sage/gold palette.
// Email-client-safe: table layout, inline styles, web-safe fallbacks (Cormorant→Georgia, Jost→Helvetica).

const C = {
  paper: '#F7F4EE',
  paper2: '#F0ECE3',
  paper3: '#E8E2D6',
  ink: '#0D0B09',
  ink2: '#1E1A15',
  ash: '#5A5048',
  linen: '#9A9088',
  rule: '#E2DCCF',
  rose: '#B8756C',
  sage: '#607A5C',
  gold: '#C4913A',
  white: '#FFFFFF',
};

const SERIF = "'Cormorant Garamond','Cormorant',Georgia,'Times New Roman',serif";
const SANS = "'Jost','Helvetica Neue',Arial,sans-serif";

function esc(s) {
  return (s || '').toString().replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

// Branded shell. `accent` tints the rule + small caps label.
function shell({ preheader = '', label, labelColor = C.rose, body, accent = C.rose }) {
  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>Twine</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cormorant:ital,wght@0,400;0,500;1,400&family=Cormorant+Garamond:wght@400;500&family=Jost:wght@300;400;500&display=swap');
  body{margin:0;padding:0;background:${C.paper};}
  a{color:${accent};}
  @media (max-width:600px){ .card{width:100% !important;border-radius:0 !important;} .pad{padding:32px 24px !important;} }
</style>
</head>
<body style="margin:0;padding:0;background:${C.paper};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.paper};font-size:1px;line-height:1px;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.paper};">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" class="card" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:560px;background:${C.white};border:1px solid ${C.rule};border-radius:14px;overflow:hidden;">
      <!-- header -->
      <tr><td align="center" style="padding:40px 40px 22px;border-bottom:1px solid ${C.rule};">
        <div style="font-family:${SERIF};font-size:30px;font-weight:400;letter-spacing:.28em;text-transform:uppercase;color:${C.ink};line-height:1;">Twine</div>
        <div style="font-family:${SANS};font-size:8px;font-weight:400;letter-spacing:.42em;text-transform:uppercase;color:${C.linen};margin-top:8px;">Wedding Discovery</div>
      </td></tr>
      <!-- body -->
      <tr><td class="pad" style="padding:40px 40px 36px;">
        ${label ? `<div style="font-family:${SANS};font-size:10px;font-weight:500;letter-spacing:.26em;text-transform:uppercase;color:${labelColor};margin:0 0 18px;">${esc(label)}</div>` : ''}
        ${body}
      </td></tr>
      <!-- footer -->
      <tr><td align="center" style="padding:24px 40px 34px;border-top:1px solid ${C.rule};">
        <div style="font-family:${SANS};font-size:11px;font-weight:300;letter-spacing:.06em;color:${C.linen};line-height:1.7;">
          Twine &middot; The Modern Wedding Platform<br>
          <a href="https://twine.wedding" style="color:${C.ash};text-decoration:none;">twine.wedding</a>
        </div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

const h1 = (t) =>
  `<h1 style="font-family:${SERIF};font-size:30px;font-weight:400;letter-spacing:.005em;color:${C.ink};margin:0 0 18px;line-height:1.2;">${t}</h1>`;
const p = (t) =>
  `<p style="font-family:${SANS};font-size:15px;font-weight:300;line-height:1.7;color:${C.ink2};margin:0 0 16px;">${t}</p>`;
const small = (t) =>
  `<p style="font-family:${SANS};font-size:13px;font-weight:300;line-height:1.7;color:${C.ash};margin:14px 0 0;">${t}</p>`;
const signoff = () =>
  `<p style="font-family:${SERIF};font-size:17px;font-style:italic;color:${C.ash};margin:30px 0 0;">— The Twine team</p>`;

/* ---------------------------- COUPLE confirmation ---------------------------- */
function coupleConfirmation() {
  const body =
    h1("You're on the list.") +
    p('Thank you for joining the Twine waitlist — your spot is reserved.') +
    p("We're launching in <strong style=\"font-weight:500;\">1–2 weeks</strong>, and you'll be among the very first to know the moment we go live, with early access ahead of everyone else.") +
    p('We can&rsquo;t wait to help you plan something beautiful.') +
    signoff();
  return {
    subject: "You're on the Twine waitlist — launching in 1–2 weeks",
    html: shell({
      preheader: 'Your spot is reserved. Early access when we launch in 1–2 weeks.',
      label: 'Waitlist confirmed',
      labelColor: C.rose,
      accent: C.rose,
      body,
    }),
  };
}

/* ---------------------------- VENDOR confirmation ---------------------------- */
function vendorConfirmation() {
  const li = (t) =>
    `<tr><td valign="top" style="padding:0 10px 12px 0;font-family:${SANS};color:${C.gold};font-size:15px;line-height:1.6;">&#10022;</td><td valign="top" style="padding:0 0 12px;font-family:${SANS};font-size:15px;font-weight:300;line-height:1.6;color:${C.ink2};">${t}</td></tr>`;
  const body =
    h1('Your founding spot is reserved.') +
    p('Welcome to Twine. Your <strong style="font-weight:500;">$29/month founding rate is locked in — forever</strong>. It will never increase for as long as you stay with us.') +
    `<p style="font-family:${SANS};font-size:11px;font-weight:500;letter-spacing:.2em;text-transform:uppercase;color:${C.ash};margin:26px 0 12px;">What happens next</p>` +
    `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">${li(
      'Your secure payment link arrives <strong style="font-weight:500;">within 48 hours</strong> to activate your subscription.'
    )}${li(
      'Your vendor profile goes <strong style="font-weight:500;">live on launch day</strong>, in front of newly engaged couples in your area.'
    )}</table>` +
    p('You&rsquo;re one of the first vendors on the platform — thank you for building this with us.') +
    signoff();
  return {
    subject: 'Your Twine founding spot is reserved',
    html: shell({
      preheader: 'Your $29/mo founding rate is locked in forever. Payment link within 48 hours.',
      label: 'Founding vendor',
      labelColor: C.gold,
      accent: C.gold,
      body,
    }),
  };
}

/* ---------------------------- ADMIN notification ---------------------------- */
// type: 'couple' | 'vendor'. meta: { source } or { tier_interest }.
function adminNotification({ type, email, meta = {} }) {
  const isVendor = type === 'vendor';
  const accent = isVendor ? C.gold : C.rose;
  const detailRows = [
    ['Email', esc(email)],
    ['Type', isVendor ? 'Vendor (founding)' : 'Couple'],
    isVendor ? ['Tier', esc(meta.tier_interest || 'founding_29')] : ['Source', esc(meta.source || 'waitlist')],
    ['Received', new Date().toUTCString()],
  ]
    .map(
      ([k, v]) =>
        `<tr><td style="padding:9px 0;border-bottom:1px solid ${C.rule};font-family:${SANS};font-size:11px;font-weight:500;letter-spacing:.14em;text-transform:uppercase;color:${C.linen};width:120px;">${k}</td><td style="padding:9px 0;border-bottom:1px solid ${C.rule};font-family:${SANS};font-size:14px;font-weight:400;color:${C.ink2};">${v}</td></tr>`
    )
    .join('');
  const body =
    h1(isVendor ? 'New founding vendor' : 'New couple signup') +
    p(`A new ${isVendor ? 'vendor' : 'couple'} just joined the Twine waitlist.`) +
    `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:8px 0 4px;">${detailRows}</table>` +
    `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0 0;"><tr><td style="border-radius:10px;background:${C.ink};"><a href="mailto:${esc(email)}" style="display:inline-block;padding:13px 26px;font-family:${SANS};font-size:11px;font-weight:500;letter-spacing:.18em;text-transform:uppercase;color:${C.white};text-decoration:none;">Reply to lead</a></td></tr></table>` +
    small('You can also just hit reply — this email&rsquo;s reply-to is set to the signup.');
  return {
    subject: `${isVendor ? '🔔 New vendor' : '🔔 New couple'} — ${email}`,
    html: shell({
      preheader: `${isVendor ? 'New founding vendor' : 'New couple'}: ${email}`,
      label: 'Waitlist signup',
      labelColor: accent,
      accent,
      body,
    }),
  };
}

module.exports = { coupleConfirmation, vendorConfirmation, adminNotification };
