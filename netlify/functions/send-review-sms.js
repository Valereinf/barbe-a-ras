// netlify/functions/send-review-sms.js
// Cron : toutes les 30 minutes — envoie les SMS d'avis 2h après chaque RDV terminé

const SUPABASE_URL  = process.env.SUPABASE_URL;
const SUPABASE_KEY  = process.env.SUPABASE_KEY;
const TWILIO_SID    = process.env.TWILIO_SID;
const TWILIO_TOKEN  = process.env.TWILIO_TOKEN;
const TWILIO_PHONE  = process.env.TWILIO_PHONE;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const SITE_URL      = process.env.URL || 'https://barbe-a-ras.ca';

exports.handler = async (event) => {
  const now = new Date();

  // Fenêtre : RDV dont l'heure + 2h est entre -15min et +15min de maintenant
  const windowStart = new Date(now.getTime() - 15 * 60 * 1000); // -15min
  const windowEnd   = new Date(now.getTime() + 15 * 60 * 1000); // +15min

  // Calculer la plage de dates/heures des RDV à notifier
  // RDV heure cible = maintenant - 2h
  const rdvTarget = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const rdvWindowStart = new Date(rdvTarget.getTime() - 15 * 60 * 1000);
  const rdvWindowEnd   = new Date(rdvTarget.getTime() + 15 * 60 * 1000);

  // Formater pour Supabase
  const today = rdvTarget.toISOString().split('T')[0];
  const timeStart = rdvWindowStart.toTimeString().substring(0,5); // HH:MM
  const timeEnd   = rdvWindowEnd.toTimeString().substring(0,5);

  console.log(`[send-review-sms] Cherche RDV du ${today} entre ${timeStart} et ${timeEnd}`);

  // Chercher les réservations confirmées, sans avis envoyé, dans la fenêtre
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/reservations?` +
    `statut=eq.confirmé&` +
    `date_rdv=eq.${today}&` +
    `avis_envoye=eq.false&` +
    `heure_rdv=gte.${timeStart}:00&` +
    `heure_rdv=lte.${timeEnd}:00&` +
    `select=id,heure_rdv,barbier,service,client_id,clients(prenom,nom,telephone,email)`,
    { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
  );

  const resas = await resp.json();
  if (!resas || resas.length === 0) {
    console.log('[send-review-sms] Aucun RDV à notifier');
    return { statusCode: 200, body: JSON.stringify({ sent: 0 }) };
  }

  console.log(`[send-review-sms] ${resas.length} RDV à notifier`);

  let sent = 0;
  for (const resa of resas) {
    const prenom = resa.clients?.prenom || 'Client';
    const tel    = resa.clients?.telephone || '';
    const email  = resa.clients?.email || '';

    if (!tel && !email) continue;

    // Générer un token unique pour cet avis
    const reviewToken = Buffer.from(`review:${resa.id}:${Date.now()}`).toString('base64url');
    const reviewUrl = `${SITE_URL}/review?token=${reviewToken}&id=${resa.id}`;

    // Sauvegarder le token
    await fetch(`${SUPABASE_URL}/rest/v1/reservations?id=eq.${resa.id}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ avis_envoye: true, avis_token: reviewToken })
    });

    // Envoyer SMS
    if (tel && TWILIO_SID && TWILIO_TOKEN && TWILIO_PHONE) {
      const telClean = tel.replace(/\D/g, '').slice(-10);
      await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64'),
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            From: TWILIO_PHONE,
            To: '+1' + telClean,
            Body: `Bonjour ${prenom}! Merci pour votre visite chez Barbe-A-Ras. Votre avis nous aide a grandir 🙏 ${reviewUrl}`
          }).toString()
        }
      ).catch(e => console.error('SMS error:', e));
    }

    // Envoyer email si pas de téléphone ou en complément
    if (email && RESEND_API_KEY) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'Barbe-À-Ras <reservations@barbe-a-ras.ca>',
          to: [email],
          subject: '⭐ Comment s\'est passée votre visite ? | Barbe-À-Ras',
          html: `
            <div style="font-family:Arial,sans-serif;background:#080808;color:#f5f0e8;
              padding:30px;max-width:500px;margin:auto;border-top:4px solid #C9A84C">
              <div style="text-align:center;margin-bottom:24px">
                <div style="font-family:Georgia,serif;font-size:26px;color:#C9A84C;letter-spacing:4px">BARBE-À-RAS</div>
                <div style="font-size:11px;letter-spacing:3px;color:rgba(245,240,232,0.35);margin-top:4px">BARBERSHOP · CHICOUTIMI</div>
              </div>
              <h2 style="color:#C9A84C;font-size:18px;letter-spacing:2px;margin-bottom:16px;text-align:center">
                ⭐ VOTRE AVIS COMPTE
              </h2>
              <p style="margin-bottom:12px">Bonjour <strong>${prenom}</strong>,</p>
              <p style="color:rgba(245,240,232,0.7);line-height:1.7;margin-bottom:24px">
                Merci d'avoir visité Barbe-À-Ras aujourd'hui. Votre satisfaction est notre priorité.
                Prenez 30 secondes pour nous dire comment s'est passée votre visite — ça nous aide vraiment à nous améliorer.
              </p>
              <div style="text-align:center;margin:24px 0">
                <a href="${reviewUrl}"
                  style="background:#C9A84C;color:#080808;padding:14px 32px;
                  text-decoration:none;font-weight:700;font-size:14px;
                  letter-spacing:2px;text-transform:uppercase;display:inline-block">
                  ★ Donner mon avis
                </a>
              </div>
              <p style="font-size:12px;color:rgba(245,240,232,0.3);text-align:center;margin-top:24px">
                Barbe-À-Ras · 749 Rue d'Alma, Local 101, Chicoutimi · (418) 612-2007
              </p>
            </div>`
        })
      }).catch(e => console.error('Email error:', e));
    }

    sent++;
    console.log(`[send-review-sms] SMS/email envoyé à ${prenom} pour RDV ${resa.id}`);
  }

  return { statusCode: 200, body: JSON.stringify({ sent }) };
};
