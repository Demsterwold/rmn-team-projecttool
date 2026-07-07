// Verstuurt een eenmalige welkomstmail zodra een moderator een nieuw teamlid
// toevoegt, met uitleg dat ze via de "Inloggen"-knop (magic link) toegang hebben.
// Vereist environment variable RESEND_API_KEY in Netlify. Zonder key: no-op.

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.NOTIFY_FROM_EMAIL || 'RMN Team Projecttool <notificaties@resend.dev>';

export default async (req) => {
    if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
    if (!RESEND_API_KEY) return new Response(JSON.stringify({ skipped: true, reason: 'no RESEND_API_KEY set' }), { status: 200 });

    try {
          const { email, name, siteUrl } = await req.json();
          if (!email || !siteUrl) return new Response('Missing fields', { status: 400 });

      const html = `
            <p>Hoi ${escapeHtml(name || '')},</p>
                  <p>Je bent toegevoegd aan de RMN Team Projecttool. Je kunt inloggen via onderstaande link met je eigen e-mailadres (${escapeHtml(email)}) &mdash; er komt dan automatisch een eenmalige inloglink in je mailbox, geen wachtwoord nodig.</p>
                        <p><a href="${siteUrl}">${siteUrl}</a></p>
                            `;

      await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: { Authorization: 'Bearer ' + RESEND_API_KEY, 'Content-Type': 'application/json' },
              body: JSON.stringify({ from: FROM_EMAIL, to: email, subject: 'Toegang tot RMN Team Projecttool', html })
      });

      return new Response(JSON.stringify({ sent: true }), { status: 200 });
    } catch (err) {
          return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
};

function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
