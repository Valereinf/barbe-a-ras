const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;

exports.handler = async (event) => {
  const { token, id } = event.queryStringParameters || {};

  if (!token || !id) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Token ou ID manquant' }) };
  }

  // Fetch the reservation
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/reservations?id=eq.${id}&select=*,clients(prenom,nom,email)`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });
  const rows = await resp.json();

  if (!rows || rows.length === 0) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Réservation introuvable' }) };
  }

  const resa = rows[0];

  // Validate token
  if (resa.cancel_token !== token) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Lien invalide ou expiré' }) };
  }

  // Check if already cancelled
  if (resa.statut === 'annulé') {
    return { statusCode: 200, body: JSON.stringify({ already: true }) };
  }

  // Check 24h policy
  const rdvDate = new Date(`${resa.date_rdv}T${resa.heure_rdv}`);
  const now = new Date();
  const diffHours = (rdvDate - now) / (1000 * 60 * 60);

  if (diffHours < 24) {
    return {
      statusCode: 200,
      body: JSON.stringify({
        error: 'late',
        message: 'Annulation impossible — moins de 24h avant le rendez-vous. Appelez le (418) 612-2007.'
      })
    };
  }

  // Cancel the reservation
  await fetch(`${SUPABASE_URL}/rest/v1/reservations?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ statut: 'annulé' })
  });

  // Notify waitlist if someone is waiting for this slot
  const dateStr = resa.date_rdv;
  const { data: waiters } = await fetch(
    `${SUPABASE_URL}/rest/v1/liste_attente?date_souhaitee=eq.${dateStr}&statut=eq.en_attente&select=*,clients(prenom,email)`,
    { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
  ).then(r => r.json()).then(d => ({ data: d })).catch(() => ({ data: [] }));

  if (waiters && waiters.length > 0) {
    const waiter = waiters[0];
    const clientEmail = waiter.clients?.email;
    const clientPrenom = waiter.clients?.prenom;

    if (clientEmail) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'Barbe-À-Ras <reservations@barbe-a-ras.ca>',
          to: [clientEmail],
          subject: '🟢 Une place vient de se libérer ! | Barbe-À-Ras',
          html: `
            <div style="font-family:Arial,sans-serif;background:#080808;color:#f5f0e8;padding:30px;max-width:500px">
              <h2 style="color:#C9A84C;letter-spacing:2px">🟢 PLACE DISPONIBLE !</h2>
              <p>Bonjour <strong>${clientPrenom}</strong>,</p>
              <p>Une place s'est libérée le <strong style="color:#C9A84C">${dateStr}</strong> 
                 pour le service <strong>${waiter.service}</strong>.</p>
              <p>Réservez rapidement avant qu'elle soit prise !</p>
              <a href="${process.env.URL || 'https://jocular-squirrel-d29f32.netlify.app'}/booking.html"
                 style="display:inline-block;background:#C9A84C;color:#080808;padding:12px 30px;
                 text-decoration:none;font-weight:700;letter-spacing:2px;margin-top:15px">
                Réserver maintenant →
              </a>
              <p style="margin-top:20px;font-size:12px;color:rgba(245,240,232,0.4)">
                Barbe-À-Ras · (418) 612-2007 · 749 Rue d'Alma, Chicoutimi
              </p>
            </div>`
        })
      });

      // Update waitlist status
      await fetch(`${SUPABASE_URL}/rest/v1/liste_attente?id=eq.${waiter.id}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ statut: 'notifié' })
      });
    }
  }

  // Send cancellation confirmation to client
  const clientEmail = resa.clients?.email;
  const clientPrenom = resa.clients?.prenom;
  if (clientEmail) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Barbe-À-Ras <reservations@barbe-a-ras.ca>',
        to: [clientEmail],
        subject: '❌ Rendez-vous annulé | Barbe-À-Ras',
        html: `
          <div style="font-family:Arial,sans-serif;background:#080808;color:#f5f0e8;padding:30px;max-width:500px">
            <h2 style="color:#e74c3c;letter-spacing:2px">❌ RENDEZ-VOUS ANNULÉ</h2>
            <p>Bonjour <strong>${clientPrenom}</strong>,</p>
            <p>Votre rendez-vous du <strong>${resa.date_rdv}</strong> à <strong>${resa.heure_rdv}</strong> 
               a bien été annulé.</p>
            <p>Pour reprendre un rendez-vous :</p>
            <a href="${process.env.URL || 'https://jocular-squirrel-d29f32.netlify.app'}/booking.html"
               style="display:inline-block;background:#C9A84C;color:#080808;padding:12px 30px;
               text-decoration:none;font-weight:700;letter-spacing:2px;margin-top:10px">
              Nouveau rendez-vous →
            </a>
            <p style="margin-top:20px;font-size:12px;color:rgba(245,240,232,0.4)">
              Barbe-À-Ras · (418) 612-2007
            </p>
          </div>`
      })
    });
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true, cancelled: true })
  };
};
