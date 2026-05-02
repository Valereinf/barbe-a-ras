# ✂ Barbe-À-Ras — Système de réservation en ligne

> Salon de barbiers à Chicoutimi (Saguenay), QC  
> 749 Rue d'Alma, Local 101 · (418) 612-2007 · [barbe-a-ras.ca](https://barbe-a-ras.ca)

---

## 🗂 Structure du projet

```
barbe-a-ras/
├── index.html                  — Site principal (noir & or, Google Maps)
├── booking.html                — Réservation 5 étapes, créneaux dynamiques 15 min
├── admin.html                  — Panel Barbara (mot de passe requis)
├── cancel.html                 — Annulation par lien sécurisé (délai 3h)
├── modify.html                 — Modification de RDV par lien sécurisé (délai 3h)
├── netlify.toml                — Config build + cron rappel 24h (6h EST)
└── netlify/functions/
    ├── send-confirmation.js    — Email + SMS à la confirmation de RDV
    ├── cancel-booking.js       — Annulation et modification de RDV
    ├── reminder-24h.js         — Rappel automatique 24h avant (cron)
    ├── notify-waitlist.js      — Notification liste d'attente
    └── notify-modif.js         — Notification modification admin
```

---

## 🛠 Stack technique

| Composant | Service |
|---|---|
| Hébergement | [Netlify](https://netlify.com) — projet `jocular-squirrel-d29f32` |
| Domaine | `barbe-a-ras.ca` (Namecheap → DNS Netlify) |
| Base de données | [Supabase](https://supabase.com) |
| Emails | [Resend](https://resend.com) — `reservations@barbe-a-ras.ca` |
| SMS | [Twilio](https://twilio.com) — compte Trial |
| Cartographie | Google Maps API |

---

## 🗄 Base de données Supabase

### Tables

**`clients`**
```
id, prenom, nom, email, telephone, est_bloque, raison_blocage, note_client
```

**`reservations`**
```
id, client_id, barbier, service, prix, date_rdv, heure_rdv, statut,
note_client, note_staff, cancel_token, rappel_envoye
```

**`liste_attente`**
```
id, client_id, service, barbier, date_souhaitee, heure_souhaitee, statut
```

**`indisponibilites`**
```
id, barbier, date_debut, date_fin, heure_debut, heure_fin, raison
```

---

## ⚙️ Variables d'environnement

À configurer dans **Netlify → Site configuration → Environment variables** :

```env
SUPABASE_URL=https://uqohxkpxcamrqlmuxaae.supabase.co
SUPABASE_KEY=<clé anon Supabase>
RESEND_API_KEY=<clé API Resend>
TWILIO_SID=<Account SID Twilio>
TWILIO_TOKEN=<Auth Token Twilio>
TWILIO_PHONE=<numéro Twilio E.164>
GOOGLE_MAPS_KEY=<clé API Google Maps>
```

> ⚠️ Ne jamais committer les clés réelles dans le dépôt.

---

## 🕐 Horaires du salon

| Jour | Heures |
|---|---|
| Mardi | 09:00 – 17:00 |
| Mercredi | 09:00 – 17:00 |
| Jeudi | 09:00 – 20:00 |
| Vendredi | 09:00 – 20:00 |
| Samedi | 08:00 – 12:00 |
| Dimanche | Fermé |
| Lundi | Fermé |

---

## 💈 Services & tarifs

| Service | Durée | Prix |
|---|---|---|
| Coupe de cheveux adulte | 30 min | 29,50 $ + taxes |
| Coupe enfant (0–15 ans) | 30 min | 27,00 $ + taxes |
| Cheveux + barbe à la lame serviette chaude | 1 h | 56,00 $ + taxes |
| Coupe de cheveux long à court | 45 min | 47,00 $ + taxes |
| Coupe + barbe au clipper | 45 min | 47,00 $ + taxes |
| Coupe + shampoing | 30 min | 31,50 $ + taxes |
| Barbe à la lame + serviettes chaudes | 30 min | 29,50 $ + taxes |
| Cheveux + barbe lame + shampoing | 1 h | 59,00 $ + taxes |
| Coupe adulte hors heures | 30 min | 55,00 $ + taxes |
| Coupe + barbe lame hors heures | 1 h | 105,00 $ + taxes |

---

## 📋 Politique d'annulation

- Annulation ou modification : au moins **3 heures** avant le RDV
- Frais de non-présentation — coupe : **19,50 $ + taxes**
- Frais de non-présentation — coupe + barbe : **35,00 $ + taxes**
- Paiement accepté : **débit ou comptant** — pas de carte étrangère

---

## ✅ Fonctionnalités

- Réservations multi-services avec total automatique
- Créneaux dynamiques par tranches de 15 min selon la durée du service
- Créneaux séparés par barbier (Barbara Sandra / Michael)
- "Sans préférence" → Michael d'abord, puis Barbara
- Créneaux déjà pris visibles en lecture seule dans le calendrier de réservation
- Email et SMS de confirmation (liens annulation + modification inclus)
- Rappel automatique 24h avant (SMS client + email client + email Barbara)
- Notification d'annulation → Barbara
- Lien d'annulation sécurisé (`cancel.html`)
- Lien de modification sécurisé (`modify.html`)
- Panel admin (`/admin`) — calendrier côte-à-côte Barbara/Michael
- Navigation jour précédent/suivant dans le calendrier admin
- Création de RDV depuis le panel admin (clients téléphoniques)
- Modification de RDV depuis l'admin (date, heure, barbier, service) + notification optionnelle
- Modification de fiche client
- Liste d'attente avec modification et notification manuelle
- Gestion des indisponibilités (congés) par barbier avec plages horaires
- Indisponibilités appliquées dans le booking
- Blocage / déblocage de clients
- Ligne "Durée" dans le détail du rendez-vous (admin)

---

## 💰 Coûts mensuels

| Service | Coût |
|---|---|
| Netlify Personal | ~9 $/mois |
| Domaine barbe-a-ras.ca | ~1,37 $/mois |
| Twilio SMS | ~2,73 $/mois |
| Resend | 0 $ |
| Supabase | 0 $ |
| **Total** | **~13 $/mois** |

---

## 🚀 Déploiement

Le projet est déployé automatiquement via **Netlify** à chaque push sur la branche `main`.

```bash
# Cloner le dépôt
git clone https://github.com/Valereinf/barbe-a-ras.git
cd barbe-a-ras

# Pousser une modification
git add .
git commit -m "Description du changement"
git push origin main
```

La fonction `reminder-24h` s'exécute chaque jour à **10h00 UTC (6h00 EST)** via le cron configuré dans `netlify.toml`.

---

## 📌 Points en cours

- [ ] Barbara doit compléter la vérification d'identité Twilio pour activer les SMS
- [ ] Mettre à jour le lien "Site Web" sur Google Business Profile → `barbe-a-ras.ca`
- [ ] Tester les créneaux dynamiques 15 min en production
- [ ] Tester la modification de RDV avec notification optionnelle

---

*Barbe-À-Ras — Fondé le 8 mars 2023 · Chicoutimi, Saguenay, QC*
