const RESEND_API_KEY = process.env.RESEND_API_KEY;
const TWILIO_SID = process.env.TWILIO_SID;
const TWILIO_TOKEN = process.env.TWILIO_TOKEN;
const TWILIO_PHONE = process.env.TWILIO_PHONE;
const SITE_URL = 'https://barbe-a-ras.ca';

exports.handler = async (event) => {
  if(event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const { tel, email, prenom, date, service } = JSON.parse(event.body);

  const dateLabel = date && date !== 'prochainement'
    ? `le ${new Date(date+'T12:00:00').toLocaleDateString('fr-CA',{weekday:'long',day:'numeric',month:'long'})}`
    : 'prochainement';

  const results = [];

  // SMS via Twilio
  if(tel && TWILIO_SID && TWILIO_TOKEN) {
    try {
      const telClean = tel.replace(/\D/g,'').slice(-10);
      const smsBody = `Bonjour ${prenom}! 🟢 Une place s'est libérée chez Barbe-À-Ras ${dateLabel}. Réservez vite: ${SITE_URL}/booking`;
      const resp = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64'),
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            From: TWILIO_PHONE.replace(/\s/g,''),
            To: '+1' + telClean,
            Body: smsBody
          }).toString()
        }
      );
      const r = await resp.json();
      results.push({ type:'sms', sid: r.sid, error: r.message });
    } catch(e) {
      results.push({ type:'sms', error: e.message });
    }
  }

  // Email via Resend
  if(email && RESEND_API_KEY) {
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
          subject: `🟢 Une place s'est libérée ! | Barbe-À-Ras`,
          html: `
            <div style="font-family:Arial,sans-serif;background:#080808;color:#f5f0e8;padding:30px;max-width:500px;border-top:4px solid #C9A84C">
              <h2 style="color:#27ae60;letter-spacing:2px">🟢 PLACE DISPONIBLE !</h2>
              <p>Bonjour <strong>${prenom}</strong>,</p>
              <p>Bonne nouvelle ! Une place s'est libérée chez <strong style="color:#C9A84C">Barbe-À-Ras</strong> ${dateLabel}.</p>
              ${service ? `<p style="color:rgba(245,240,232,0.6)">Service : ${service}</p>` : ''}
              <p style="margin-top:1rem">⏰ <strong>Les places partent vite</strong> — réservez maintenant pour confirmer votre créneau.</p>
              <a href="${SITE_URL}/booking"
                style="display:inline-block;background:#C9A84C;color:#080808;padding:14px 35px;
                text-decoration:none;font-weight:700;letter-spacing:2px;margin-top:20px;font-size:14px">
                Réserver maintenant →
              </a>
              <p style="margin-top:30px;font-size:12px;color:rgba(245,240,232,0.4)">
                Barbe-À-Ras · 749 Rue d'Alma, Local 101, Chicoutimi · (418) 612-2007
              </p>
            </div>`
        })
      });
      results.push({ type:'email', to: email });
    } catch(e) {
      results.push({ type:'email', error: e.message });
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true, results })
  };
};
