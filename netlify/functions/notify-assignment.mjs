// Verstuurt een e-mail zodra iemand een taak toegewezen krijgt die niet bij
// hun eigen project hoort. Gebruikt Resend (resend.com) als mailprovider.
// Vereist environment variable RESEND_API_KEY in Netlify (Site configuration
// -> Environment variables). Zonder key doet deze functie niets (silent no-op),
// zodat de tool zelf nooit breekt op een ontbrekende sleutel.

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.NOTIFY_FROM_EMAIL || 'RMN Team Projecttool <notificaties@resend.dev>';
const SUPABASE_URL = 'https://fvgifjyjuqddqtdegdxm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_G1ZS3ahLvSf-p_tdCBbjww_t4jVwD8u';

export default async (req) => {
      if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
      if (!RESEND_API_KEY) return new Response(JSON.stringify({ skipped: true, reason: 'no RESEND_API_KEY set' }), { status: 200 });

      try {
              const { projectId, stepId, assigneeEmail, assignedByEmail, siteUrl } = await req.json();
              if (!projectId || !stepId || !assigneeEmail) return new Response('Missing fields', { status: 400 });

        const headers = { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY };
              const [projectRes, stepRes, membersRes] = await Promise.all([
                        fetch(`${SUPABASE_URL}/rest/v1/team_projects?id=eq.${projectId}&select=name`, { headers }),
                        fetch(`${SUPABASE_URL}/rest/v1/team_project_steps?id=eq.${stepId}&select=step_name,due_date,note`, { headers }),
                        fetch(`${SUPABASE_URL}/rest/v1/team_members?select=email,name`, { headers })
                      ]);
              const [project] = await projectRes.json();
              const [step] = await stepRes.json();
              const members = await membersRes.json();
              if (!project || !step) return new Response('Not found', { status: 404 });

        const nameFor = (email) => (members.find(m => m.email === email) || {}).name || email;
              const naam = nameFor(assigneeEmail);
              const assignerNaam = assignedByEmail ? nameFor(assignedByEmail) : null;
              const dueDateStr = step.due_date ? new Date(step.due_date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }) : null;
              const link = siteUrl ? `${siteUrl}?project=${encodeURIComponent(projectId)}` : null;

        const html = `
              <p>Hoi ${escapeHtml(naam)},</p>
                    <p>${assignerNaam ? escapeHtml(assignerNaam) + ' heeft je' : 'Je bent'} toegewezen aan een taak buiten je eigen project in de RMN Team Projecttool:</p>
                          <p><strong>${escapeHtml(step.step_name)}</strong><br>
                                Project: ${escapeHtml(project.name)}${dueDateStr ? `<br>Deadline: ${escapeHtml(dueDateStr)}` : ''}</p>
                                      ${step.note ? `<p>Notitie bij de taak:<br><em>${escapeHtml(step.note)}</em></p>` : ''}
                                            ${link ? `<p><a href="${link}">Bekijk de taak in de tool</a></p>` : '<p>Log in om de taak te bekijken.</p>'}
                                                `;

        await fetch('https://api.resend.com/emails', {
                  method: 'POST',
                  headers: { Authorization: 'Bearer ' + RESEND_API_KEY, 'Content-Type': 'application/json' },
                  body: JSON.stringify({ from: FROM_EMAIL, to: assigneeEmail, subject: `Nieuwe taak: ${step.step_name}`, html })
        });

        return new Response(JSON.stringify({ sent: true }), { status: 200 });
      } catch (err) {
              return new Response(JSON.stringify({ error: err.message }), { status: 500 });
      }
};

function escapeHtml(s) {
      return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
