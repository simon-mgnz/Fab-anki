/**
 * Fab'Anki — Firebase Cloud Functions
 * Notifications push : rappels quotidiens + nouveaux decks
 *
 * DÉPLOIEMENT :
 *   1. npm install            (dans ce dossier functions/)
 *   2. Remplis functions/.env avec tes clés (voir .env.example)
 *   3. firebase deploy --only functions
 *
 * GÉNÉRATION DES CLÉS VAPID (une seule fois) :
 *   npx web-push generate-vapid-keys
 */

const functions = require('firebase-functions');
const admin     = require('firebase-admin');
const webpush   = require('web-push');
const fetch     = require('node-fetch');

admin.initializeApp();
const db = admin.firestore();

// ── Configure web-push ────────────────────────────────────────────────────
// Les clés sont lues depuis les variables d'environnement (fichier .env)
function initWebPush() {
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const publicKey  = process.env.VAPID_PUBLIC_KEY;
  const email      = process.env.VAPID_EMAIL || 'mailto:lachainedenomis@gmail.com';

  if (!privateKey || !publicKey) {
    throw new Error('Clés VAPID non configurées. Remplis functions/.env avec VAPID_PRIVATE_KEY et VAPID_PUBLIC_KEY.');
  }
  webpush.setVapidDetails(email, publicKey, privateKey);
}

// ── Helpers ───────────────────────────────────────────────────────────────

async function getAllSubscriptions() {
  const snap = await db.collection('push_subscriptions').get();
  return snap.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
}

async function sendPush(subscriptionJson, payload) {
  try {
    await webpush.sendNotification(subscriptionJson, JSON.stringify(payload));
    return true;
  } catch (err) {
    if (err.statusCode === 410 || err.statusCode === 404) {
      // Subscription expired — clean up
      return 'expired';
    }
    console.error('Push send error:', err.statusCode, err.body);
    return false;
  }
}

function estimateTime(cardCount, avgSecondsPerCard = 120) {
  const totalSec = cardCount * avgSecondsPerCard;
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h > 0 && m > 0) return `~${h}h ${m.toString().padStart(2,'0')}min`;
  if (h > 0)           return `~${h}h`;
  return `~${m}min`;
}

// ── Cloud Function 1 : Rappel quotidien ──────────────────────────────────
// Tourne 2 fois par jour (9h et 18h Paris)
exports.sendDailyReviewReminders = functions
  .runWith({ timeoutSeconds: 300, memory: '256MB' })
  .pubsub.schedule('0 8,17 * * *')
  .timeZone('Europe/Paris')
  .onRun(async () => {
    initWebPush();
    const subs = await getAllSubscriptions();
    const now  = new Date();
    const currentHour = now.getHours();

    const expired = [];
    let sent = 0;

    for (const sub of subs) {
      try {
        const prefs = sub.preferences || {};
        if (prefs.dailyReminder === false) continue;

        const dueCount = sub.dueCount || 0;
        if (dueCount === 0) continue;

        // Vérifier l'heure préférée (±1h de tolérance)
        const prefHour = prefs.reminderHour != null ? prefs.reminderHour : 18;
        if (Math.abs(currentHour - prefHour) > 1) continue;

        const showTime  = prefs.showTimeEstimate !== false;
        const avgTime   = sub.avgSecondsPerCard || 120;
        const timeStr   = showTime ? ` (${estimateTime(dueCount, avgTime)})` : '';

        const payload = {
          title: 'Fab\'Anki — Cartes à réviser',
          body:  `Il te reste ${dueCount} carte${dueCount > 1 ? 's' : ''} à faire${timeStr} !`,
          icon:  '/fabankiapp.png',
          badge: '/fabankiapp.png',
          tag:   'fabanki-daily',
          renotify: true,
          url:   '/',
        };

        const result = await sendPush(sub.subscription, payload);
        if (result === 'expired') expired.push(sub.uid);
        else if (result) sent++;

      } catch (e) {
        console.error('Error for uid', sub.uid, e);
      }
    }

    await Promise.all(expired.map(uid =>
      db.collection('push_subscriptions').doc(uid).delete().catch(() => {})
    ));

    console.log(`Daily reminders: ${sent} sent, ${expired.length} expired cleaned`);
    return null;
  });

// ── Cloud Function 2 : Notification de nouveau deck ───────────────────────
// Tourne 1 fois par jour (7h Paris) et compare le manifest.json au précédent
exports.checkNewDecks = functions
  .runWith({ timeoutSeconds: 120, memory: '256MB' })
  .pubsub.schedule('0 7 * * *')
  .timeZone('Europe/Paris')
  .onRun(async () => {
    initWebPush();

    const manifestUrl = process.env.MANIFEST_URL ||
      'https://fabanki-classement.web.app/decks/manifest.json';

    let currentDecks = [];
    try {
      const resp = await fetch(manifestUrl, { timeout: 10000 });
      const data = await resp.json();
      currentDecks = (Array.isArray(data) ? data : (data.decks || [])).map(d => d.path || d.name || d.url || String(d));
    } catch (e) {
      console.error('Failed to fetch manifest:', e);
      return null;
    }

    const stateRef  = db.collection('app_state').doc('manifest');
    const stateSnap = await stateRef.get();
    const knownDecks = stateSnap.exists ? (stateSnap.data().knownDecks || []) : [];

    const newDecks = currentDecks.filter(d => !knownDecks.includes(d));

    if (newDecks.length === 0) {
      console.log('No new decks found.');
      await stateRef.set({ knownDecks: currentDecks, lastChecked: new Date().toISOString() }, { merge: true });
      return null;
    }

    console.log('New decks found:', newDecks);

    const deckNames = newDecks.map(path => {
      const parts = path.split('/');
      return parts[parts.length - 1].replace(/\.xml$/i, '').replace(/_/g, ' ');
    });
    const body = newDecks.length === 1
      ? `Nouveau deck : ${deckNames[0]}`
      : `${newDecks.length} nouveaux decks disponibles : ${deckNames.slice(0,2).join(', ')}${newDecks.length > 2 ? '…' : ''}`;

    const subs = await getAllSubscriptions();
    const expired = [];
    let sent = 0;

    for (const sub of subs) {
      if (sub.preferences?.newDecks === false) continue;

      const payload = {
        title:   'Fab\'Anki — Nouveau contenu disponible',
        body,
        icon:    '/fabankiapp.png',
        badge:   '/fabankiapp.png',
        tag:     'fabanki-new-deck',
        renotify: false,
        url:     '/',
        deckUrl: newDecks.length === 1 ? newDecks[0] : null,
      };

      const result = await sendPush(sub.subscription, payload);
      if (result === 'expired') expired.push(sub.uid);
      else if (result) sent++;
    }

    await Promise.all(expired.map(uid =>
      db.collection('push_subscriptions').doc(uid).delete().catch(() => {})
    ));

    await stateRef.set({ knownDecks: currentDecks, lastChecked: new Date().toISOString() }, { merge: true });
    console.log(`New deck notifications: ${sent} sent, ${expired.length} expired cleaned`);
    return null;
  });

// ── Cloud Function 3 : Alerte streak en danger ───────────────────────────
// Tourne à 20h Paris — alerte les utilisateurs qui n'ont pas révisé aujourd'hui
exports.sendStreakWarnings = functions
  .runWith({ timeoutSeconds: 120, memory: '256MB' })
  .pubsub.schedule('0 20 * * *')
  .timeZone('Europe/Paris')
  .onRun(async () => {
    initWebPush();
    const subs    = await getAllSubscriptions();
    const expired = [];
    let sent = 0;
    const now = Date.now();

    for (const sub of subs) {
      if (sub.preferences?.streakWarning === false) continue;

      const lastUpdate  = sub.updatedAt ? new Date(sub.updatedAt).getTime() : 0;
      const hoursSince  = (now - lastUpdate) / (1000 * 60 * 60);

      if (hoursSince < 20 || (sub.dueCount || 0) === 0) continue;

      const payload = {
        title: 'Fab\'Anki — Streak en danger ! 🔥',
        body:  `Tu n'as pas révisé depuis plus de ${Math.floor(hoursSince)}h. ${sub.dueCount} carte${sub.dueCount > 1 ? 's' : ''} t'attendent !`,
        icon:  '/fabankiapp.png',
        badge: '/fabankiapp.png',
        tag:   'fabanki-streak',
        renotify: false,
        url:   '/',
      };

      const result = await sendPush(sub.subscription, payload);
      if (result === 'expired') expired.push(sub.uid);
      else if (result) sent++;
    }

    await Promise.all(expired.map(uid =>
      db.collection('push_subscriptions').doc(uid).delete().catch(() => {})
    ));

    console.log(`Streak warnings: ${sent} sent`);
    return null;
  });

// ── Cloud Function 4 (HTTP) : Déclencher manuellement un nouveau deck ─────
// curl -X POST https://REGION-PROJECT.cloudfunctions.net/notifyDeckManually \
//   -H "Content-Type: application/json" \
//   -d '{"deckName":"Chapitre 22","deckUrl":"decks/Maths/Ch22.xml","secret":"TON_SECRET"}'
exports.notifyDeckManually = functions
  .runWith({ timeoutSeconds: 60 })
  .https.onRequest(async (req, res) => {
    const secret = process.env.NOTIFY_SECRET;
    if (secret && req.body.secret !== secret) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    initWebPush();
    const { deckName = 'Nouveau deck', deckUrl = null } = req.body;

    const subs    = await getAllSubscriptions();
    const expired = [];
    let sent = 0;

    for (const sub of subs) {
      if (sub.preferences?.newDecks === false) continue;

      const payload = {
        title:   'Fab\'Anki — Nouveau deck disponible',
        body:    `Nouveau deck : ${deckName}`,
        icon:    '/fabankiapp.png',
        badge:   '/fabankiapp.png',
        tag:     'fabanki-new-deck-manual',
        renotify: false,
        url:     '/',
        deckUrl: deckUrl,
      };

      const result = await sendPush(sub.subscription, payload);
      if (result === 'expired') expired.push(sub.uid);
      else if (result) sent++;
    }

    await Promise.all(expired.map(uid =>
      db.collection('push_subscriptions').doc(uid).delete().catch(() => {})
    ));

    res.json({ sent, expired: expired.length });
  });
