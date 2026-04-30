const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const SITE_URL = process.env.URL || 'https://barbe-a-ras.ca';

exports.handler = async (event) => {
  const { token, id, action, new_date, new_time } = event.queryStringParameters || {};

  if (!token || !id) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Token ou ID manquant' }) };
  }

  // Fetch the reservation
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/reservations?id=eq.${id}&select=*,clients(prenom,nom,email,telephone)`,
    { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
  );
  const rows = await resp.json();

  if (!rows || rows.length === 0) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Réservation introuvable' }) };
  }

  const resa = rows[0];

  // Validate token
  if (resa.cancel_token !== token) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Lien invalide ou expiré' }) };
  }

  if (resa.statut === 'annulé') {
    return { statusCode: 200, body: JSON.stringify({ already: true }) };
  }

  // Check 3h policy (annulation & modification)
  const rdvDate = new Date(`${resa.date_rdv}T${resa.heure_rdv}`);
  const now = new Date();
  const diffHours = (rdvDate - now) / (1000 * 60 * 60);

  if (diffHours < 3) {
    return {
      statusCode: 200,
      body: JSON.stringify({
        error: 'late',
        message: 'Modification/annulation impossible — moins de 3h avant le rendez-vous. Appelez le (418) 612-2007.'
      })
    };
  }

  // ═══ MODIFICATION ═══
  if (action === 'modify' && new_date && new_time) {
    // Check new slot is not already taken
    const slotCheck = await fetch(
      `${SUPABASE_URL}/rest/v1/reservations?date_rdv=eq.${new_date}&heure_rdv=eq.${new_time}:00&barbier=eq.${encodeURIComponent(resa.barbier)}&statut=eq.confirmé`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
    );
    const existing = await slotCheck.json();
    if (existing && existing.length > 0) {
      return { statusCode: 200, body: JSON.stringify({ error: 'slot_taken', message: 'Ce créneau est déjà pris.' }) };
    }

    // Update reservation
    await fetch(`${SUPABASE_URL}/rest/v1/reservations?id=eq.${id}`, {
      method: 'PATCH',
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ date_rdv: new_date, heure_rdv: new_time + ':00', rappel_envoye: false })
    });

    const clientEmail = resa.clients?.email;
    const clientPrenom = resa.clients?.prenom;
    const clientNom = resa.clients?.nom;

    // Email to client if they have one
    if (clientEmail && RESEND_API_KEY) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Barbe-À-Ras <reservations@barbe-a-ras.ca>',
          to: [clientEmail],
          subject: `🔄 Rendez-vous modifié — ${new_date} à ${new_time} | Barbe-À-Ras`,
          html: `
            <div style="font-family:Arial,sans-serif;background:#080808;color:#f5f0e8;padding:30px;max-width:500px;border-top:4px solid #C9A84C">
              <h2 style="color:#C9A84C;letter-spacing:2px">🔄 RENDEZ-VOUS MODIFIÉ</h2>
              <p>Bonjour <strong>${clientPrenom}</strong>,</p>
              <p>Votre rendez-vous a bien été modifié :</p>
              <div style="border:1px solid rgba(201,168,76,0.3);padding:20px;margin:20px 0">
                <table style="width:100%;border-collapse:collapse;font-size:14px">
                  <tr><td style="color:rgba(245,240,232,0.5);padding:6px 4px;width:110px">Barbier·ère</td><td style="color:#f5f0e8;font-weight:600;padding-left:16px">${resa.barbier}</td></tr>
                  <tr><td style="color:rgba(245,240,232,0.5);padding:6px 4px">Service</td><td style="color:#f5f0e8;font-weight:600;padding-left:16px">${resa.service}</td></tr>
                  <tr><td style="color:rgba(245,240,232,0.5);padding:6px 4px">Nouvelle date</td><td style="color:#C9A84C;font-weight:700;padding-left:16px">${new_date}</td></tr>
                  <tr><td style="color:rgba(245,240,232,0.5);padding:6px 4px">Nouvelle heure</td><td style="color:#C9A84C;font-weight:700;padding-left:16px">${new_time}</td></tr>
                </table>
              </div>
              <p style="font-size:12px;color:rgba(245,240,232,0.4)">Barbe-À-Ras · 749 Rue d'Alma, Local 101, Chicoutimi · (418) 612-2007</p>
            </div>`
        })
      });
    }

    // Notify Barbara
    if (RESEND_API_KEY) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Barbe-À-Ras <reservations@barbe-a-ras.ca>',
          to: ['ngakambarbara@yahoo.fr'],
          subject: `🔄 Modification RDV — ${clientPrenom} ${clientNom} → ${new_date} à ${new_time}`,
          html: `
            <div style="font-family:Arial,sans-serif;background:#080808;color:#f5f0e8;padding:30px;max-width:500px;border-top:4px solid #C9A84C">
              <h2 style="color:#C9A84C">🔄 MODIFICATION DE RDV</h2>
              <p>Un client a modifié son rendez-vous :</p>
              <div style="border:1px solid rgba(201,168,76,0.3);padding:20px;margin:20px 0">
                <p><strong style="color:#C9A84C">Client :</strong> ${clientPrenom} ${clientNom}</p>
                <p><strong style="color:#C9A84C">Tél :</strong> ${resa.clients?.telephone||'—'}</p>
                <p><strong style="color:#C9A84C">Service :</strong> ${resa.service}</p>
                <p><strong style="color:#C9A84C">Barbier :</strong> ${resa.barbier}</p>
                <p style="margin-top:12px;border-top:1px solid rgba(201,168,76,0.2);padding-top:12px">
                  <strong style="color:#e74c3c">Ancien :</strong> ${resa.date_rdv} à ${resa.heure_rdv?.substring(0,5)}<br>
                  <strong style="color:#27ae60">Nouveau :</strong> ${new_date} à ${new_time}
                </p>
              </div>
              <a href="https://barbe-a-ras.ca/admin" style="display:inline-block;background:#C9A84C;color:#080808;padding:10px 25px;text-decoration:none;font-weight:700;margin-top:10px">Voir le panel admin</a>
            </div>`
        })
      });
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true, modified: true }) };
  }

  // ═══ ANNULATION ═══
  await fetch(`${SUPABASE_URL}/rest/v1/reservations?id=eq.${id}`, {
    method: 'PATCH',
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ statut: 'annulé' })
  });

  // Notify waitlist
  const waitersResp = await fetch(
    `${SUPABASE_URL}/rest/v1/liste_attente?date_souhaitee=eq.${resa.date_rdv}&statut=eq.en_attente&select=*,clients(prenom,nom,telephone,email)`,
    { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
  );
  const waiters = await waitersResp.json();

  if (waiters && waiters.length > 0) {
    const waiter = waiters[0];
    const wTel = waiter.clients?.telephone;
    const wPrenom = waiter.clients?.prenom;

    // SMS to waiter via Twilio if we have their phone
    // (email fallback)
    if (waiter.clients?.email && RESEND_API_KEY) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Barbe-À-Ras <reservations@barbe-a-ras.ca>',
          to: [waiter.clients.email],
          subject: '🟢 Une place vient de se libérer ! | Barbe-À-Ras',
          html: `
            <div style="font-family:Arial,sans-serif;background:#080808;color:#f5f0e8;padding:30px;max-width:500px">
              <h2 style="color:#C9A84C">🟢 PLACE DISPONIBLE !</h2>
              <p>Bonjour <strong>${wPrenom}</strong>,</p>
              <p>Une place s'est libérée le <strong style="color:#C9A84C">${resa.date_rdv}</strong>.</p>
              <a href="${SITE_URL}/booking" style="display:inline-block;background:#C9A84C;color:#080808;padding:12px 30px;text-decoration:none;font-weight:700;letter-spacing:2px;margin-top:15px">Réserver maintenant →</a>
            </div>`
        })
      });
    }

    await fetch(`${SUPABASE_URL}/rest/v1/liste_attente?id=eq.${waiter.id}`, {
      method: 'PATCH',
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ statut: 'notifié' })
    });
  }

  // Email to client
  const clientEmail = resa.clients?.email;
  const clientPrenom = resa.clients?.prenom;
  if (clientEmail && RESEND_API_KEY) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Barbe-À-Ras <reservations@barbe-a-ras.ca>',
        to: [clientEmail],
        subject: '❌ Rendez-vous annulé | Barbe-À-Ras',
        html: `
          <div style="font-family:Arial,sans-serif;background:#080808;color:#f5f0e8;padding:30px;max-width:500px">
            <h2 style="color:#e74c3c;letter-spacing:2px">❌ RENDEZ-VOUS ANNULÉ</h2>
            <p>Bonjour <strong>${clientPrenom}</strong>,</p>
            <p>Votre rendez-vous du <strong>${resa.date_rdv}</strong> à <strong>${resa.heure_rdv?.substring(0,5)}</strong> a bien été annulé.</p>
            <a href="${SITE_URL}/booking" style="display:inline-block;background:#C9A84C;color:#080808;padding:12px 30px;text-decoration:none;font-weight:700;letter-spacing:2px;margin-top:10px">Nouveau rendez-vous →</a>
            <p style="margin-top:20px;font-size:12px;color:rgba(245,240,232,0.4)">Barbe-À-Ras · (418) 612-2007</p>
          </div>`
      })
    });
  }

  // Notify Barbara
  if (RESEND_API_KEY) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Barbe-À-Ras <reservations@barbe-a-ras.ca>',
        to: ['ngakambarbara@yahoo.fr'],
        subject: `❌ Annulation — ${resa.clients?.prenom} ${resa.clients?.nom} — ${resa.date_rdv} à ${resa.heure_rdv?.substring(0,5)}`,
        html: `
          <div style="font-family:Arial,sans-serif;background:#080808;color:#f5f0e8;padding:30px;max-width:500px;border-top:4px solid #e74c3c">
            <h2 style="color:#e74c3c">❌ ANNULATION DE RDV</h2>
            <div style="border:1px solid rgba(231,76,60,0.3);padding:20px;margin:20px 0">
              <p><strong style="color:#C9A84C">Client :</strong> ${resa.clients?.prenom} ${resa.clients?.nom}</p>
              <p><strong style="color:#C9A84C">Tél :</strong> ${resa.clients?.telephone||'—'}</p>
              <p><strong style="color:#C9A84C">Date :</strong> ${resa.date_rdv}</p>
              <p><strong style="color:#C9A84C">Heure :</strong> ${resa.heure_rdv?.substring(0,5)}</p>
              <p><strong style="color:#C9A84C">Service :</strong> ${resa.service}</p>
              <p><strong style="color:#C9A84C">Barbier :</strong> ${resa.barbier}</p>
            </div>
            <p style="font-size:13px;color:rgba(245,240,232,0.5)">Ce créneau est maintenant disponible.</p>
            <a href="https://barbe-a-ras.ca/admin" style="display:inline-block;background:#C9A84C;color:#080808;padding:10px 25px;text-decoration:none;font-weight:700;margin-top:15px">Voir le panel admin</a>
          </div>`
      })
    });
  }

  return { statusCode: 200, body: JSON.stringify({ ok: true, cancelled: true }) };
};
