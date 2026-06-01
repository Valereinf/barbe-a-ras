// This function runs as a scheduled cron job
// Set in netlify.toml: schedule = "0 10 * * *" (every day at 10am UTC)

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const TWILIO_SID   = process.env.TWILIO_SID;
const TWILIO_TOKEN = process.env.TWILIO_TOKEN;
const TWILIO_PHONE = process.env.TWILIO_PHONE;
const RESEND_API_KEY = process.env.RESEND_API_KEY;

exports.handler = async () => {
  // Get tomorrow's date
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  // Fetch all confirmed reservations for tomorrow that haven't been reminded
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/reservations?date_rdv=eq.${tomorrowStr}&statut=eq.confirmé&rappel_envoye=eq.false&select=*,clients(prenom,nom,email,telephone)`,
    { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
  );
  const reservations = await resp.json();

  if (!reservations || reservations.length === 0) {
    return { statusCode: 200, body: JSON.stringify({ message: 'No reminders to send' }) };
  }

  const results = [];

  for (const resa of reservations) {
    const client = resa.clients;
    if (!client) continue;

    const prenom = client.prenom;
    const nom = client.nom;
    const tel = client.telephone?.replace(/\D/g,'');
    const email = client.email;
    const heure = resa.heure_rdv?.substring(0,5);
    const noteClient = resa.note_client || null;
    const dateFormatted = new Date(resa.date_rdv + 'T12:00:00')
      .toLocaleDateString('fr-CA', { weekday:'long', day:'numeric', month:'long' });

    // 1. Send SMS via Twilio
    if (tel && TWILIO_SID && TWILIO_TOKEN) {
      try {
        const noteStr = noteClient ? ` Note: "${noteClient}".` : '';
        const twilioResp = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
          {
            method: 'POST',
            headers: {
              'Authorization': 'Basic ' + Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64'),
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
              From: TWILIO_PHONE.replace(/\s/g,''),
              To: '+1' + tel.slice(-10),
              Body: `Rappel RDV Barbe-A-Ras: DEMAIN ${dateFormatted} a ${heure} avec ${resa.barbier}. Annulation: (418) 612-2007`
            }).toString()
          }
        );
        const smsResult = await twilioResp.json();
        results.push({ type:'sms', to:tel, sid: smsResult.sid });
      } catch(e) {
        results.push({ type:'sms', error: e.message });
      }
    }

    // 2. Send reminder email to CLIENT via Resend
    if (email && RESEND_API_KEY) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'Barbe-À-Ras <reservations@barbe-a-ras.ca>',
            to: [email],
            subject: `⏰ Rappel — Votre RDV demain à ${heure} | Barbe-À-Ras`,
            html: `
              <div style="font-family:Arial,sans-serif;background:#080808;color:#f5f0e8;padding:30px;max-width:500px;border-top:4px solid #C9A84C">
                <h2 style="color:#C9A84C;letter-spacing:2px">⏰ RAPPEL — DEMAIN</h2>
                <p>Bonjour <strong>${prenom}</strong>,</p>
                <p>Nous vous rappelons votre rendez-vous chez <strong style="color:#C9A84C">Barbe-À-Ras</strong> :</p>
                <div style="border:1px solid rgba(201,168,76,0.3);padding:20px;margin:20px 0">
                  <p style="margin:5px 0"><strong>📅 Date :</strong> ${dateFormatted}</p>
                  <p style="margin:5px 0"><strong>🕐 Heure :</strong> ${heure}</p>
                  <p style="margin:5px 0"><strong>✂ Service :</strong> ${resa.service}</p>
                  <p style="margin:5px 0"><strong>👤 Barbier·ère :</strong> ${resa.barbier}</p>
                  <p style="margin:5px 0"><strong>📍 Adresse :</strong> 749 Rue d'Alma, Local 101, Chicoutimi</p>
                  ${noteClient ? `<p style="margin:10px 0 0;padding-top:10px;border-top:1px solid rgba(201,168,76,0.2)"><strong style="color:#C9A84C">📝 Votre note :</strong> ${noteClient}</p>` : ''}
                </div>
                <div style="background:rgba(231,76,60,0.1);border-left:3px solid #e74c3c;padding:12px;font-size:13px;color:rgba(245,240,232,0.7)">
                  ⚠️ <strong style="color:#f5f0e8">Annulation :</strong> Passé ce délai de 24h, des frais de 50% s'appliquent.<br>
                  Pour annuler, appelez le <strong style="color:#C9A84C">(418) 612-2007</strong>
                </div>
                <p style="margin-top:20px;font-size:12px;color:rgba(245,240,232,0.3)">
                  Barbe-À-Ras · 749 Rue d'Alma, Local 101, Chicoutimi, QC · (418) 612-2007
                </p>
              </div>`
          })
        });
        results.push({ type:'email-client', to:email });
      } catch(e) {
        results.push({ type:'email-client', error: e.message });
      }
    }

    // 3. Send notification email to BARBARA (staff)
    const BARBARA_EMAIL = 'barbearas.pro@gmail.com';
    if (RESEND_API_KEY) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'Barbe-À-Ras <reservations@barbe-a-ras.ca>',
            to: [BARBARA_EMAIL],
            subject: `📅 RDV demain — ${prenom} ${nom} à ${heure}`,
            html: `
              <div style="font-family:Arial,sans-serif;background:#080808;color:#f5f0e8;padding:30px;max-width:500px;border-top:4px solid #C9A84C">
                <h2 style="color:#C9A84C;letter-spacing:2px">📅 RDV DEMAIN</h2>
                <p>Rappel automatique pour le rendez-vous suivant :</p>
                <div style="border:1px solid rgba(201,168,76,0.3);padding:20px;margin:20px 0">
                  <p style="margin:5px 0"><strong style="color:#C9A84C">👤 Client :</strong> ${prenom} ${nom}</p>
                  <p style="margin:5px 0"><strong style="color:#C9A84C">📞 Tél :</strong> ${client.telephone||'—'}</p>
                  <p style="margin:5px 0"><strong style="color:#C9A84C">📅 Date :</strong> ${dateFormatted}</p>
                  <p style="margin:5px 0"><strong style="color:#C9A84C">🕐 Heure :</strong> ${heure}</p>
                  <p style="margin:5px 0"><strong style="color:#C9A84C">✂ Service :</strong> ${resa.service}</p>
                  <p style="margin:5px 0"><strong style="color:#C9A84C">👤 Barbier·ère :</strong> ${resa.barbier}</p>
                  <p style="margin:5px 0"><strong style="color:#C9A84C">💰 Prix :</strong> ${resa.prix} + taxes</p>
                  ${noteClient
                    ? `<div style="margin-top:12px;padding:10px;background:rgba(201,168,76,0.08);border-left:3px solid #C9A84C">
                        <strong style="color:#C9A84C">📝 Note du client :</strong><br>
                        <span style="color:#f5f0e8">${noteClient}</span>
                       </div>`
                    : '<p style="margin:5px 0;color:rgba(245,240,232,0.4)"><em>Aucune note du client</em></p>'
                  }
                </div>
                <p style="font-size:12px;color:rgba(245,240,232,0.3)">
                  Barbe-À-Ras Admin · Ce message est envoyé automatiquement
                </p>
              </div>`
          })
        });
        results.push({ type:'email-staff', to: BARBARA_EMAIL });
      } catch(e) {
        results.push({ type:'email-staff', error: e.message });
      }
    }

    // 3. Mark reminder as sent
    await fetch(`${SUPABASE_URL}/rest/v1/reservations?id=eq.${resa.id}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ rappel_envoye: true })
    });
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ sent: results.length, details: results })
  };
};
