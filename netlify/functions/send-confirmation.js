const RESEND_API_KEY = process.env.RESEND_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const data = JSON.parse(event.body);
  const { reservationId, prenom, nom, email, tel, barbier, service, prix, date, heure, note } = data;

  // Generate cancellation token (simple but unique)
  const cancelToken = Buffer.from(`${reservationId}:${Date.now()}`).toString('base64url');

  // Save cancel token to Supabase
  await fetch(`${SUPABASE_URL}/rest/v1/reservations?id=eq.${reservationId}`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ cancel_token: cancelToken })
  });

  const siteUrl = 'https://barbe-a-ras.ca';
  const cancelUrl = `${siteUrl}/cancel?token=${cancelToken}&id=${reservationId}`;
  const modifyUrl = `${siteUrl}/modify?token=${cancelToken}&id=${reservationId}`;

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><style>
body{font-family:Arial,sans-serif;background:#f5f0e8;margin:0;padding:20px}
.wrap{max-width:600px;margin:0 auto;background:#080808;color:#f5f0e8;border-top:4px solid #C9A84C}
.head{background:#C9A84C;padding:30px;text-align:center}
.head h1{font-family:Georgia,serif;color:#080808;margin:0;font-size:28px;letter-spacing:3px}
.head p{color:#2a1f00;margin:5px 0 0;font-size:13px;letter-spacing:2px}
.body{padding:35px}
.body h2{color:#C9A84C;font-size:20px;letter-spacing:2px;margin-bottom:20px}
.detail-box{border:1px solid rgba(201,168,76,0.3);padding:20px;margin:20px 0;width:100%}
.detail-table{width:100%;border-collapse:collapse;font-size:14px}
.detail-table tr{border-bottom:1px solid rgba(201,168,76,0.1)}
.detail-table tr:last-child{border-bottom:none}
.detail-table td{padding:8px 4px;vertical-align:top}
.detail-table td.lbl{color:rgba(245,240,232,0.5);width:110px;white-space:nowrap}
.detail-table td.val{color:#f5f0e8;font-weight:600;padding-left:16px}
.policy{background:rgba(201,168,76,0.06);border-left:3px solid #C9A84C;
  padding:15px;margin:20px 0;font-size:13px;color:rgba(245,240,232,0.7);line-height:1.7}
.policy h3{color:#C9A84C;font-size:13px;letter-spacing:2px;margin:0 0 10px;text-transform:uppercase}
.policy ul{padding-left:18px;margin:0}
.policy ul li{margin-bottom:6px}
.cancel-box{text-align:center;margin:25px 0;padding:20px;border:1px solid rgba(231,76,60,0.3)}
.cancel-box p{font-size:13px;color:rgba(245,240,232,0.55);margin-bottom:12px}
.cancel-btn{display:inline-block;background:transparent;color:#e74c3c;
  border:1px solid #e74c3c;padding:10px 25px;text-decoration:none;
  font-size:13px;letter-spacing:2px;text-transform:uppercase}
.cta{text-align:center;margin:25px 0}
.cta a{display:inline-block;background:#C9A84C;color:#080808;padding:14px 35px;
  text-decoration:none;font-weight:700;letter-spacing:2px;font-size:14px;text-transform:uppercase}
.footer{padding:20px 35px;border-top:1px solid rgba(201,168,76,0.2);
  text-align:center;font-size:12px;color:rgba(245,240,232,0.3)}
</style></head>
<body>
<div class="wrap">
  <div class="head">
    <h1>BARBE-À-RAS</h1>
    <p>BARBERSHOP · SAGUENAY</p>
  </div>
  <div class="body">
    <h2>✅ RENDEZ-VOUS CONFIRMÉ</h2>
    <p>Bonjour <strong>${prenom}</strong>, votre rendez-vous est bien enregistré.</p>

    <div class="detail-box">
      <table class="detail-table">
        <tr><td class="lbl">Barbier·ère</td><td class="val">${barbier}</td></tr>
        <tr><td class="lbl">Service</td><td class="val">${service}</td></tr>
        <tr><td class="lbl">Date</td><td class="val">${date}</td></tr>
        <tr><td class="lbl">Heure</td><td class="val">${heure}</td></tr>
        <tr><td class="lbl">Prix</td><td class="val">${prix} + taxes</td></tr>
        ${note ? `<tr><td class="lbl">Note</td><td class="val">${note}</td></tr>` : ''}
        <tr><td class="lbl">Réf.</td><td class="val">#${reservationId.substring(0,8).toUpperCase()}</td></tr>
      </table>
    </div>

    <p style="font-size:13px;color:rgba(245,240,232,0.6)">
      📍 749 Rue d'Alma, Local 101, Chicoutimi (Saguenay), QC G7H 4E7<br>
      📞 (418) 612-2007
    </p>

    <div class="policy">
      <h3>📋 Politique du salon</h3>
      <ul>
        <li><strong style="color:#f5f0e8">Annulation :</strong> Minimum 24h à l'avance, sans frais.</li>
        <li><strong style="color:#f5f0e8">Non-présentation :</strong> Frais de 50% du service facturé.</li>
        <li><strong style="color:#f5f0e8">Retard :</strong> Plus de 10 min = rendez-vous annulé.</li>
        <li><strong style="color:#f5f0e8">Paiement :</strong> Comptant · Débit · Visa · Mastercard</li>
      </ul>
    </div>

    <div class="cancel-box">
      <p>Vous souhaitez annuler ou modifier ce rendez-vous ? Utilisez le lien ci-dessous.<br>
      <strong style="color:#e74c3c">Ce lien n'est valide que 24h avant votre rendez-vous.</strong></p>
      <a href="${cancelUrl}" class="cancel-btn">Annuler mon rendez-vous</a>
    </div>

    <div class="cta">
      <p style="font-size:13px;color:rgba(245,240,232,0.5);margin-bottom:12px">
        Un rappel automatique vous sera envoyé 24h avant votre rendez-vous.
      </p>
      <a href="tel:4186122007">(418) 612-2007</a>
    </div>
  </div>
  <div class="footer">
    © 2023–2025 Barbe-À-Ras · 749 Rue d'Alma, Local 101, Chicoutimi, QC<br>
    Cet email a été envoyé suite à votre réservation en ligne.
  </div>
</div>
</body></html>`;

  // Send SMS via Twilio
  const TWILIO_SID = process.env.TWILIO_SID;
  const TWILIO_TOKEN = process.env.TWILIO_TOKEN;
  const TWILIO_PHONE = process.env.TWILIO_PHONE;

  if (tel && TWILIO_SID && TWILIO_TOKEN) {
    try {
      const telClean = tel.replace(/\D/g,'');
      const smsBody = `Bonjour ${prenom}! ✅ RDV confirmé chez Barbe-À-Ras le ${date} à ${heure} avec ${barbier}. Modifier: ${modifyUrl} Annuler: ${cancelUrl}`;
      await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64'),
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            From: TWILIO_PHONE.replace(/\s/g,''),
            To: '+1' + telClean.slice(-10),
            Body: smsBody
          }).toString()
        }
      );
    } catch(e) { /* SMS error non-blocking */ }
  }

  // Send email via Resend (only if email provided)
  if (!email) {
    return { statusCode: 200, body: JSON.stringify({ ok: true, smsOnly: true }) };
  }

  // Send via Resend
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'Barbe-À-Ras <reservations@barbe-a-ras.ca>',
      to: [email],
      subject: `✅ Rendez-vous confirmé — ${date} à ${heure} | Barbe-À-Ras`,
      html
    })
  });

  const result = await resp.json();
  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true, emailId: result.id })
  };
};
