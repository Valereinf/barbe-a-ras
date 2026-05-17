const RESEND_API_KEY = process.env.RESEND_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const data = JSON.parse(event.body);

  // ── CAS SPÉCIAL : notification d'absence / pénalité ──
  if (data.type === 'absence-penalty') {
    const { prenom, email, tel, barbier, service, prix, date, heure, nbAbsences } = data;
    const TWILIO_SID = process.env.TWILIO_SID;
    const TWILIO_TOKEN = process.env.TWILIO_TOKEN;
    const TWILIO_PHONE = process.env.TWILIO_PHONE;

    if (email && RESEND_API_KEY) {
      const penaltyHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="font-family:Arial,sans-serif;background:#080808;color:#f5f0e8;padding:30px">
        <div style="max-width:600px;margin:0 auto;border-top:4px solid #e74c3c">
          <div style="background:#e74c3c;padding:20px;text-align:center"><h1 style="color:#fff;margin:0;font-size:22px">⚠ ABSENCE NON HONORÉE</h1></div>
          <div style="padding:25px">
            <p>Bonjour <strong>${prenom}</strong>,</p>
            <p>Vous n'avez pas honoré votre rendez-vous du <strong>${date}</strong> à <strong>${heure}</strong> avec <strong>${barbier}</strong>.</p>
            <div style="background:rgba(231,76,60,0.1);border-left:4px solid #e74c3c;padding:15px;margin:20px 0">
              <p style="color:#e74c3c;font-weight:700;margin:0">💸 Frais applicables : <strong>${prix}</strong></p>
              <p style="font-size:13px;margin:8px 0 0">Ces frais seront exigibles lors de votre prochain rendez-vous.</p>
            </div>
            ${nbAbsences > 1 ? `<p style="color:rgba(231,76,60,0.8);font-size:13px">⚠ Ceci est votre ${nbAbsences}e absence.</p>` : ''}
            <p style="font-size:13px;color:rgba(245,240,232,0.6)">Questions : <a href="tel:4186122007" style="color:#C9A84C">(418) 612-2007</a></p>
          </div>
        </div>
      </body></html>`;
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: 'Barbe-À-Ras <reservations@barbe-a-ras.ca>', to: [email], subject: `⚠ Absence non honorée — ${prix} applicables | Barbe-À-Ras`, html: penaltyHtml })
      }).catch(()=>{});
    }

    if (tel && TWILIO_SID && TWILIO_TOKEN && TWILIO_PHONE) {
      const telClean = tel.replace(/\D/g,'').slice(-10);
      await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
        method: 'POST',
        headers: { 'Authorization': 'Basic ' + Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ From: TWILIO_PHONE, To: '+1' + telClean, Body: `Bonjour ${prenom}, vous n'avez pas honoré votre RDV du ${date} chez Barbe-À-Ras. Frais : ${prix} au prochain RDV. Info: (418) 612-2007` }).toString()
      }).catch(()=>{});
    }
    return { statusCode: 200, body: JSON.stringify({ ok: true, type: 'penalty-sent' }) };
  }

  // ── CAS ADMIN : annulation par Barbara ──
  if (data.type === 'admin-cancel') {
    const { prenom, nom, email, tel, barbier, service, prix, date, heure } = data;
    const TWILIO_SID = process.env.TWILIO_SID;
    const TWILIO_TOKEN = process.env.TWILIO_TOKEN;
    const TWILIO_PHONE = process.env.TWILIO_PHONE;

    // SMS au client
    if (tel && TWILIO_SID && TWILIO_TOKEN && TWILIO_PHONE) {
      const telClean = tel.replace(/\D/g,'').slice(-10);
      await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
        method: 'POST',
        headers: { 'Authorization': 'Basic ' + Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ From: TWILIO_PHONE, To: '+1' + telClean,
          Body: `Bonjour ${prenom}, votre RDV du ${date} à ${heure} chez Barbe-À-Ras a été annulé. Pour reprendre un RDV: barbe-a-ras.ca/booking. Info: (418) 612-2007`
        }).toString()
      }).catch(()=>{});
    }

    // Email au client
    if (email && RESEND_API_KEY) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Barbe-À-Ras <reservations@barbe-a-ras.ca>',
          to: [email],
          subject: `❌ Rendez-vous annulé — ${date} à ${heure} | Barbe-À-Ras`,
          html: `
            <div style="font-family:Arial,sans-serif;background:#080808;color:#f5f0e8;padding:30px;max-width:500px;border-top:4px solid #e74c3c">
              <h2 style="color:#e74c3c;letter-spacing:2px">❌ RENDEZ-VOUS ANNULÉ</h2>
              <p>Bonjour <strong>${prenom}</strong>,</p>
              <p>Votre rendez-vous chez <strong style="color:#C9A84C">Barbe-À-Ras</strong> a été annulé :</p>
              <div style="border:1px solid rgba(231,76,60,0.3);padding:20px;margin:20px 0">
                <p style="margin:5px 0"><strong style="color:#C9A84C">📅 Date :</strong> ${date}</p>
                <p style="margin:5px 0"><strong style="color:#C9A84C">🕐 Heure :</strong> ${heure}</p>
                <p style="margin:5px 0"><strong style="color:#C9A84C">✂ Service :</strong> ${service}</p>
                <p style="margin:5px 0"><strong style="color:#C9A84C">👤 Barbier·ère :</strong> ${barbier}</p>
              </div>
              <p style="font-size:13px;color:rgba(245,240,232,0.6)">Pour reprendre un rendez-vous :</p>
              <a href="https://barbe-a-ras.ca/booking" style="display:inline-block;background:#C9A84C;color:#080808;padding:12px 30px;text-decoration:none;font-weight:700;letter-spacing:2px;margin-top:10px">Nouveau rendez-vous →</a>
              <p style="margin-top:20px;font-size:12px;color:rgba(245,240,232,0.4)">Questions : (418) 612-2007 · Barbe-À-Ras · 749 Rue d'Alma, Local 101, Chicoutimi</p>
            </div>`
        })
      }).catch(()=>{});
    }

    // Notifier Barbara aussi
    if (RESEND_API_KEY) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Barbe-À-Ras <reservations@barbe-a-ras.ca>',
          to: ['barbearas.pro@gmail.com'],
          subject: `❌ Annulation confirmée — ${prenom} ${nom} · ${date} à ${heure}`,
          html: `<div style="font-family:Arial,sans-serif;background:#080808;color:#f5f0e8;padding:30px;max-width:500px;border-top:4px solid #e74c3c">
            <h2 style="color:#e74c3c">❌ ANNULATION EFFECTUÉE</h2>
            <p>Client <strong>${prenom} ${nom}</strong> — RDV du <strong>${date}</strong> à <strong>${heure}</strong> (${service}) annulé depuis la console admin.</p>
            <a href="https://barbe-a-ras.ca/admin" style="display:inline-block;background:#C9A84C;color:#080808;padding:10px 25px;text-decoration:none;font-weight:700;margin-top:10px">Voir le panel admin</a>
          </div>`
        })
      }).catch(()=>{});
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true, type: 'admin-cancel-sent' }) };
  }

  // ── CAS NORMAL : confirmation de réservation ──
  const { reservationId, prenom, email, tel, barbier, service, prix, date, heure, note } = data;

  const cancelToken = Buffer.from(`${reservationId}:${Date.now()}`).toString('base64url');

  await fetch(`${SUPABASE_URL}/rest/v1/reservations?id=eq.${reservationId}`, {
    method: 'PATCH',
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ cancel_token: cancelToken })
  }).catch(()=>{});

  const siteUrl = 'https://barbe-a-ras.ca';
  const cancelUrl = `${siteUrl}/cancel?token=${cancelToken}&id=${reservationId}`;

  // SMS
  const TWILIO_SID = process.env.TWILIO_SID;
  const TWILIO_TOKEN = process.env.TWILIO_TOKEN;
  const TWILIO_PHONE = process.env.TWILIO_PHONE;

  if (tel && TWILIO_SID && TWILIO_TOKEN && TWILIO_PHONE) {
    const telClean = tel.replace(/\D/g,'').slice(-10);
    await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
      method: 'POST',
      headers: { 'Authorization': 'Basic ' + Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ From: TWILIO_PHONE, To: '+1' + telClean, Body: `Bonjour ${prenom}! ✅ RDV confirmé chez Barbe-À-Ras le ${date} à ${heure} avec ${barbier}. Annuler: ${cancelUrl}` }).toString()
    }).catch(()=>{});
  }

  if (!email) {
    // Pas d'email client, mais on notifie quand même Barbara
    if (RESEND_API_KEY) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Barbe-À-Ras <reservations@barbe-a-ras.ca>',
          to: ['barbearas.pro@gmail.com'],
          subject: `📅 Nouveau RDV — ${prenom} · ${date} à ${heure}`,
          html: `
            <div style="font-family:Arial,sans-serif;background:#080808;color:#f5f0e8;padding:30px;max-width:500px;border-top:4px solid #C9A84C">
              <h2 style="color:#C9A84C;letter-spacing:2px">📅 NOUVEAU RENDEZ-VOUS</h2>
              <div style="border:1px solid rgba(201,168,76,0.3);padding:20px;margin:20px 0">
                <p style="margin:5px 0"><strong style="color:#C9A84C">👤 Client :</strong> ${prenom}</p>
                <p style="margin:5px 0"><strong style="color:#C9A84C">📞 Tél :</strong> ${tel || '—'}</p>
                <p style="margin:5px 0"><strong style="color:#C9A84C">📅 Date :</strong> ${date}</p>
                <p style="margin:5px 0"><strong style="color:#C9A84C">🕐 Heure :</strong> ${heure}</p>
                <p style="margin:5px 0"><strong style="color:#C9A84C">✂ Service :</strong> ${service}</p>
                <p style="margin:5px 0"><strong style="color:#C9A84C">👤 Barbier·ère :</strong> ${barbier}</p>
                <p style="margin:5px 0"><strong style="color:#C9A84C">💰 Prix :</strong> ${prix} + taxes</p>
                ${note ? `<div style="margin-top:12px;padding:10px;background:rgba(201,168,76,0.08);border-left:3px solid #C9A84C"><strong style="color:#C9A84C">📝 Note :</strong> ${note}</div>` : ''}
              </div>
              <a href="https://barbe-a-ras.ca/admin" style="display:inline-block;background:#C9A84C;color:#080808;padding:10px 25px;text-decoration:none;font-weight:700">Voir le panel admin</a>
            </div>`
        })
      }).catch(() => {});
    }
    return { statusCode: 200, body: JSON.stringify({ ok: true, smsOnly: true }) };
  }

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="font-family:Arial,sans-serif;background:#f5f0e8;padding:20px">
    <div style="max-width:600px;margin:0 auto;background:#080808;color:#f5f0e8;border-top:4px solid #C9A84C">
      <div style="background:#C9A84C;padding:25px;text-align:center"><h1 style="color:#080808;margin:0;font-size:26px;font-family:Georgia,serif">BARBE-À-RAS</h1><p style="color:#2a1f00;margin:4px 0 0;font-size:12px">BARBERSHOP · SAGUENAY</p></div>
      <div style="padding:30px">
        <h2 style="color:#C9A84C;font-size:18px;letter-spacing:2px">✅ RENDEZ-VOUS CONFIRMÉ</h2>
        <p>Bonjour <strong>${prenom}</strong>, votre rendez-vous est confirmé.</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;margin:20px 0">
          <tr style="border-bottom:1px solid rgba(201,168,76,0.1)"><td style="padding:8px;color:rgba(245,240,232,0.5)">Barbier·ère</td><td style="padding:8px;font-weight:600">${barbier}</td></tr>
          <tr style="border-bottom:1px solid rgba(201,168,76,0.1)"><td style="padding:8px;color:rgba(245,240,232,0.5)">Service</td><td style="padding:8px;font-weight:600">${service}</td></tr>
          <tr style="border-bottom:1px solid rgba(201,168,76,0.1)"><td style="padding:8px;color:rgba(245,240,232,0.5)">Date</td><td style="padding:8px;font-weight:600">${date}</td></tr>
          <tr style="border-bottom:1px solid rgba(201,168,76,0.1)"><td style="padding:8px;color:rgba(245,240,232,0.5)">Heure</td><td style="padding:8px;font-weight:600">${heure}</td></tr>
          <tr style="border-bottom:1px solid rgba(201,168,76,0.1)"><td style="padding:8px;color:rgba(245,240,232,0.5)">Prix</td><td style="padding:8px;color:#C9A84C;font-weight:600">${prix} + taxes</td></tr>
          <tr><td style="padding:8px;color:rgba(245,240,232,0.5)">Réf.</td><td style="padding:8px;font-size:12px">#${reservationId.substring(0,8).toUpperCase()}</td></tr>
        </table>
        <p style="font-size:13px;color:rgba(245,240,232,0.6)">📍 749 Rue d'Alma, Local 101, Chicoutimi · 📞 (418) 612-2007</p>
        <div style="text-align:center;margin:25px 0;padding:15px;border:1px solid rgba(231,76,60,0.3)">
          <p style="font-size:13px;color:rgba(245,240,232,0.55);margin-bottom:10px">Annuler ce rendez-vous :</p>
          <a href="${cancelUrl}" style="color:#e74c3c;border:1px solid #e74c3c;padding:8px 20px;text-decoration:none;font-size:13px">Annuler mon rendez-vous</a>
        </div>
      </div>
      <div style="padding:15px;border-top:1px solid rgba(201,168,76,0.2);text-align:center;font-size:11px;color:rgba(245,240,232,0.3)">© 2025–2026 Barbe-À-Ras · Chicoutimi, QC</div>
    </div>
  </body></html>`;

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'Barbe-À-Ras <reservations@barbe-a-ras.ca>', to: [email], subject: `✅ RDV confirmé — ${date} à ${heure} | Barbe-À-Ras`, html })
  });

  const result = await resp.json();

  // Notification à Barbara
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Barbe-À-Ras <reservations@barbe-a-ras.ca>',
      to: ['barbearas.pro@gmail.com'],
      subject: `📅 Nouveau RDV — ${prenom} ${data.nom || ''} · ${date} à ${heure}`,
      html: `
        <div style="font-family:Arial,sans-serif;background:#080808;color:#f5f0e8;padding:30px;max-width:500px;border-top:4px solid #C9A84C">
          <h2 style="color:#C9A84C;letter-spacing:2px">📅 NOUVEAU RENDEZ-VOUS</h2>
          <p>Une nouvelle réservation vient d'être confirmée :</p>
          <div style="border:1px solid rgba(201,168,76,0.3);padding:20px;margin:20px 0">
            <p style="margin:5px 0"><strong style="color:#C9A84C">👤 Client :</strong> ${prenom} ${data.nom || ''}</p>
            <p style="margin:5px 0"><strong style="color:#C9A84C">📞 Tél :</strong> ${tel || '—'}</p>
            <p style="margin:5px 0"><strong style="color:#C9A84C">📅 Date :</strong> ${date}</p>
            <p style="margin:5px 0"><strong style="color:#C9A84C">🕐 Heure :</strong> ${heure}</p>
            <p style="margin:5px 0"><strong style="color:#C9A84C">✂ Service :</strong> ${service}</p>
            <p style="margin:5px 0"><strong style="color:#C9A84C">👤 Barbier·ère :</strong> ${barbier}</p>
            <p style="margin:5px 0"><strong style="color:#C9A84C">💰 Prix :</strong> ${prix} + taxes</p>
            ${note ? `<div style="margin-top:12px;padding:10px;background:rgba(201,168,76,0.08);border-left:3px solid #C9A84C">
              <strong style="color:#C9A84C">📝 Note du client :</strong><br>
              <span style="color:#f5f0e8">${note}</span>
            </div>` : ''}
          </div>
          <a href="https://barbe-a-ras.ca/admin" style="display:inline-block;background:#C9A84C;color:#080808;padding:10px 25px;text-decoration:none;font-weight:700;margin-top:10px">Voir le panel admin</a>
          <p style="font-size:12px;color:rgba(245,240,232,0.3);margin-top:20px">Barbe-À-Ras Admin · Ce message est envoyé automatiquement</p>
        </div>`
    })
  }).catch(() => {});

  return { statusCode: 200, body: JSON.stringify({ ok: true, emailId: result.id }) };
};
