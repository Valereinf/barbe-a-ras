const RESEND_API_KEY = process.env.RESEND_API_KEY;
const TWILIO_SID = process.env.TWILIO_SID;
const TWILIO_TOKEN = process.env.TWILIO_TOKEN;
const TWILIO_PHONE = process.env.TWILIO_PHONE;

exports.handler = async (event) => {
  if(event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const { tel, email, prenom, newDate, newHeure, barbier, service } = JSON.parse(event.body);

  const dt = new Date(newDate + 'T12:00:00');
  const dateFormatted = dt.toLocaleDateString('fr-CA', {
    weekday:'long', day:'numeric', month:'long', year:'numeric'
  });

  const results = [];

  // SMS via Twilio
  if(tel && TWILIO_SID && TWILIO_TOKEN) {
    try {
      const telClean = tel.replace(/\D/g,'').slice(-10);
      const smsBody = `Bonjour ${prenom}! 🔄 Votre RDV chez Barbe-À-Ras a été modifié: ${dateFormatted} à ${newHeure} avec ${barbier}. Questions: (418) 612-2007`;
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
      results.push({ type:'sms', sid: r.sid });
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
          subject: `🔄 Votre rendez-vous a été modifié | Barbe-À-Ras`,
          html: `
            <div style="font-family:Arial,sans-serif;background:#080808;color:#f5f0e8;padding:30px;max-width:500px;border-top:4px solid #C9A84C">
              <h2 style="color:#C9A84C;letter-spacing:2px">🔄 RENDEZ-VOUS MODIFIÉ</h2>
              <p>Bonjour <strong>${prenom}</strong>,</p>
              <p>Votre rendez-vous chez <strong style="color:#C9A84C">Barbe-À-Ras</strong> a été modifié :</p>
              <div style="border:1px solid rgba(201,168,76,0.3);padding:20px;margin:20px 0">
                <table style="width:100%;border-collapse:collapse;font-size:14px">
                  <tr><td style="color:rgba(245,240,232,0.5);padding:6px 4px;width:120px">Barbier·ère</td>
                      <td style="color:#f5f0e8;font-weight:600;padding-left:16px">${barbier}</td></tr>
                  <tr><td style="color:rgba(245,240,232,0.5);padding:6px 4px">Service</td>
                      <td style="color:#f5f0e8;font-weight:600;padding-left:16px">${service}</td></tr>
                  <tr><td style="color:rgba(245,240,232,0.5);padding:6px 4px">Nouvelle date</td>
                      <td style="color:#C9A84C;font-weight:700;padding-left:16px">${dateFormatted}</td></tr>
                  <tr><td style="color:rgba(245,240,232,0.5);padding:6px 4px">Nouvelle heure</td>
                      <td style="color:#C9A84C;font-weight:700;padding-left:16px">${newHeure}</td></tr>
                </table>
              </div>
              <p style="font-size:13px;color:rgba(245,240,232,0.6)">
                Questions ? Appelez-nous au 
                <a href="tel:4186122007" style="color:#C9A84C;text-decoration:none">(418) 612-2007</a>
              </p>
              <p style="margin-top:20px;font-size:12px;color:rgba(245,240,232,0.3)">
                Barbe-À-Ras · 749 Rue d'Alma, Local 101, Chicoutimi, QC
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
