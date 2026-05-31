/**
 * Fab'Anki — Firebase Cloud Functions
 * Push notifications, auto-publish decks, admin moderation, email alerts
 */
require('dotenv').config();

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const webpush = require('web-push');
const fetch = require('node-fetch');

const { publishDeckToGitHub, removeDeckFromGitHub } = require('./deckPublisher');
const { sendAdminEmail, buildDeckPublishedEmail, buildDeckFailedEmail } = require('./emailNotify');
const { getAdminUserRecord, assertAdminContext } = require('./adminAuth');
const { buildAdminHttpExports } = require('./adminHttp');

admin.initializeApp();
const db = admin.firestore();

const REGION = 'europe-west1';
const fn = () => functions.region(REGION);

// ── Configure web-push ────────────────────────────────────────────────────
function initWebPush() {
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const email = process.env.VAPID_EMAIL || 'mailto:lachainedenomis@gmail.com';

  if (!privateKey || !publicKey) {
    throw new Error('Clés VAPID non configurées (VAPID_PRIVATE_KEY / VAPID_PUBLIC_KEY).');
  }
  webpush.setVapidDetails(email, publicKey, privateKey);
}

// ── Helpers ───────────────────────────────────────────────────────────────

async function getAllSubscriptions() {
  const snap = await db.collection('push_subscriptions').get();
  return snap.docs.map((doc) => ({ uid: doc.id, ...doc.data() }));
}

async function sendPush(subscriptionJson, payload) {
  try {
    await webpush.sendNotification(subscriptionJson, JSON.stringify(payload));
    return true;
  } catch (err) {
    if (err.statusCode === 410 || err.statusCode === 404) return 'expired';
    console.error('Push send error:', err.statusCode, err.body || err.message);
    return false;
  }
}

function estimateTime(cardCount, avgSecondsPerCard = 120) {
  const totalSec = cardCount * avgSecondsPerCard;
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h > 0 && m > 0) return `~${h}h ${m.toString().padStart(2, '0')}min`;
  if (h > 0) return `~${h}h`;
  return `~${m}min`;
}

function normalizeSubmissionFromModificationRequest(data) {
  return {
    title: data.deckTitle || 'Sans titre',
    path: data.deckURL || '/',
    cost: 0,
    level: 0,
    modes: ['anki'],
    xmlContent: data.suggestedContent || data.currentContent || '',
    cardCount: 0,
    submittedBy: data.submittedBy || 'Anonymous',
    status: 'pending',
  };
}

async function notifyUsersNewDeck(deckName, deckUrl) {
  try {
    initWebPush();
    const subs = await getAllSubscriptions();
    const expired = [];
    let sent = 0;

    for (const sub of subs) {
      if (sub.preferences?.newDecks === false) continue;
      const payload = {
        title: 'Fab\'Anki — Nouveau deck disponible',
        body: `Nouveau deck : ${deckName}`,
        icon: '/fabankiapp.png',
        badge: '/fabankiapp.png',
        tag: 'fabanki-new-deck-auto',
        renotify: false,
        url: '/',
        deckUrl: deckUrl || null,
      };
      const result = await sendPush(sub.subscription, payload);
      if (result === 'expired') expired.push(sub.uid);
      else if (result) sent += 1;
    }

    await Promise.all(expired.map((uid) =>
      db.collection('push_subscriptions').doc(uid).delete().catch(() => {})
    ));
    console.log(`[auto-publish] Push new deck: ${sent} sent`);
  } catch (e) {
    console.warn('[auto-publish] Push notification skipped:', e.message);
  }
}

async function processDeckSubmission(submissionId, submission, source) {
  const ref = db.collection('deck_submissions').doc(submissionId);
  const existing = await ref.get();
  const docRef = existing.exists ? ref : db.collection('deck_submissions').doc(submissionId);

  try {
    await docRef.set({
      ...submission,
      status: 'publishing',
      publishSource: source,
      publishStartedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    const result = await publishDeckToGitHub(submission, submissionId);

    await docRef.set({
      status: 'published',
      publishedPath: result.relativePath,
      publishedAt: admin.firestore.FieldValue.serverTimestamp(),
      publishError: admin.firestore.FieldValue.delete(),
    }, { merge: true });

    const adminUser = await getAdminUserRecord();
    await sendAdminEmail(
      adminUser,
      `[Fab'Anki] Nouveau deck publié : ${submission.title}`,
      buildDeckPublishedEmail(submission, result, submissionId)
    );

    await notifyUsersNewDeck(submission.title, `decks/${result.relativePath}`);

    console.log(`[auto-publish] OK ${submissionId} -> ${result.relativePath}`);
    return result;
  } catch (error) {
    console.error(`[auto-publish] FAILED ${submissionId}:`, error);
    await docRef.set({
      status: 'failed',
      publishError: String(error.message || error),
      publishFailedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    try {
      const adminUser = await getAdminUserRecord();
      await sendAdminEmail(
        adminUser,
        `[Fab'Anki] Échec publication deck : ${submission.title || submissionId}`,
        buildDeckFailedEmail(submission, error.message, submissionId)
      );
    } catch (mailErr) {
      console.warn('[auto-publish] Admin alert email failed:', mailErr.message);
    }

    throw error;
  }
}

// ── Auto-publish: deck_submissions ────────────────────────────────────────

exports.onDeckSubmissionCreated = fn()
  .runWith({ timeoutSeconds: 120, memory: '512MB' })
  .firestore.document('deck_submissions/{submissionId}')
  .onCreate(async (snap, context) => {
    const data = snap.data() || {};
    if (data.status && data.status !== 'pending') return null;
    return processDeckSubmission(context.params.submissionId, data, 'deck_submissions');
  });

// Fallback channel used when deck_submissions rules reject writes
exports.onModificationDeckSubmission = fn()
  .runWith({ timeoutSeconds: 120, memory: '512MB' })
  .firestore.document('modification_requests/{requestId}')
  .onCreate(async (snap, context) => {
    const data = snap.data() || {};
    if (data.requestType !== 'deck_submission') return null;
    const submission = normalizeSubmissionFromModificationRequest(data);
    return processDeckSubmission(context.params.requestId, submission, 'modification_requests');
  });

// ── Admin HTTP API (exports explicites pour Firebase deploy) ──────────────
const _adminHttp = buildAdminHttpExports(db, processDeckSubmission);
exports.adminHttpListDecks = _adminHttp.adminHttpListDecks;
exports.adminHttpPublishAll = _adminHttp.adminHttpPublishAll;
exports.adminHttpRetryPublish = _adminHttp.adminHttpRetryPublish;
exports.adminHttpRemoveDeck = _adminHttp.adminHttpRemoveDeck;

// ── Push: test réel via web-push ──────────────────────────────────────────

exports.sendTestPush = fn().https.onCall(async (_data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Connexion requise pour tester les push.');
  }

  initWebPush();
  const snap = await db.collection('push_subscriptions').doc(context.auth.uid).get();
  if (!snap.exists || !snap.data()?.subscription) {
    throw new functions.https.HttpsError('failed-precondition', 'Aucune souscription push enregistrée.');
  }

  const sub = snap.data();
  const dueCount = sub.dueCount || 0;
  const payload = {
    title: 'Fab\'Anki — Test push',
    body: dueCount > 0
      ? `Push serveur OK — ${dueCount} carte${dueCount > 1 ? 's' : ''} à réviser.`
      : 'Push serveur OK — les rappels fonctionnent même navigateur fermé.',
    icon: '/fabankiapp.png',
    badge: '/fabankiapp.png',
    tag: 'fabanki-test-server',
    url: '/',
  };

  const result = await sendPush(sub.subscription, payload);
  if (result === 'expired') {
    await db.collection('push_subscriptions').doc(context.auth.uid).delete().catch(() => {});
    throw new functions.https.HttpsError('failed-precondition', 'Souscription expirée — réactive les notifications.');
  }
  if (!result) {
    throw new functions.https.HttpsError('internal', 'Envoi push échoué — vérifie les clés VAPID.');
  }
  return { ok: true };
});

// ── Cloud Function 1 : Rappel quotidien (toutes les heures 6h–23h Paris) ──

exports.sendDailyReviewReminders = fn()
  .runWith({ timeoutSeconds: 300, memory: '256MB' })
  .pubsub.schedule('0 6-23 * * *')
  .timeZone('Europe/Paris')
  .onRun(async () => {
    initWebPush();
    const subs = await getAllSubscriptions();
    const now = new Date();
    const currentHour = now.getHours();

    const expired = [];
    let sent = 0;

    for (const sub of subs) {
      try {
        const prefs = sub.preferences || {};
        if (prefs.dailyReminder === false) continue;

        const dueCount = sub.dueCount || 0;
        if (dueCount === 0) continue;

        const prefHour = prefs.reminderHour != null ? prefs.reminderHour : 18;
        if (Math.abs(currentHour - prefHour) > 1) continue;

        const showTime = prefs.showTimeEstimate !== false;
        const avgTime = sub.avgSecondsPerCard || 120;
        const timeStr = showTime ? ` (${estimateTime(dueCount, avgTime)})` : '';

        const payload = {
          title: 'Fab\'Anki — Cartes à réviser',
          body: `Il te reste ${dueCount} carte${dueCount > 1 ? 's' : ''} à faire${timeStr} !`,
          icon: '/fabankiapp.png',
          badge: '/fabankiapp.png',
          tag: 'fabanki-daily',
          renotify: true,
          url: '/',
        };

        const result = await sendPush(sub.subscription, payload);
        if (result === 'expired') expired.push(sub.uid);
        else if (result) sent += 1;
      } catch (e) {
        console.error('Error for uid', sub.uid, e);
      }
    }

    await Promise.all(expired.map((uid) =>
      db.collection('push_subscriptions').doc(uid).delete().catch(() => {})
    ));

    console.log(`Daily reminders: ${sent} sent, ${expired.length} expired cleaned`);
    return null;
  });

// ── Cloud Function 2 : Notification de nouveau deck (manifest) ────────────

exports.checkNewDecks = fn()
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
      currentDecks = (Array.isArray(data) ? data : (data.decks || [])).map((d) => d.path || d.name || d.url || String(d));
    } catch (e) {
      console.error('Failed to fetch manifest:', e);
      return null;
    }

    const stateRef = db.collection('app_state').doc('manifest');
    const stateSnap = await stateRef.get();
    const knownDecks = stateSnap.exists ? (stateSnap.data().knownDecks || []) : [];

    const newDecks = currentDecks.filter((d) => !knownDecks.includes(d));

    if (newDecks.length === 0) {
      console.log('No new decks found.');
      await stateRef.set({ knownDecks: currentDecks, lastChecked: new Date().toISOString() }, { merge: true });
      return null;
    }

    console.log('New decks found:', newDecks);

    const deckNames = newDecks.map((path) => {
      const parts = path.split('/');
      return parts[parts.length - 1].replace(/\.xml$/i, '').replace(/_/g, ' ');
    });
    const body = newDecks.length === 1
      ? `Nouveau deck : ${deckNames[0]}`
      : `${newDecks.length} nouveaux decks disponibles : ${deckNames.slice(0, 2).join(', ')}${newDecks.length > 2 ? '…' : ''}`;

    const subs = await getAllSubscriptions();
    const expired = [];
    let sent = 0;

    for (const sub of subs) {
      if (sub.preferences?.newDecks === false) continue;

      const payload = {
        title: 'Fab\'Anki — Nouveau contenu disponible',
        body,
        icon: '/fabankiapp.png',
        badge: '/fabankiapp.png',
        tag: 'fabanki-new-deck',
        renotify: false,
        url: '/',
        deckUrl: newDecks.length === 1 ? newDecks[0] : null,
      };

      const result = await sendPush(sub.subscription, payload);
      if (result === 'expired') expired.push(sub.uid);
      else if (result) sent += 1;
    }

    await Promise.all(expired.map((uid) =>
      db.collection('push_subscriptions').doc(uid).delete().catch(() => {})
    ));

    await stateRef.set({ knownDecks: currentDecks, lastChecked: new Date().toISOString() }, { merge: true });
    console.log(`New deck notifications: ${sent} sent, ${expired.length} expired cleaned`);
    return null;
  });

// ── Cloud Function 3 : Alerte streak en danger ───────────────────────────

exports.sendStreakWarnings = fn()
  .runWith({ timeoutSeconds: 120, memory: '256MB' })
  .pubsub.schedule('0 20 * * *')
  .timeZone('Europe/Paris')
  .onRun(async () => {
    initWebPush();
    const subs = await getAllSubscriptions();
    const expired = [];
    let sent = 0;
    const now = Date.now();

    for (const sub of subs) {
      if (sub.preferences?.streakWarning === false) continue;

      const lastUpdate = sub.updatedAt ? new Date(sub.updatedAt).getTime() : 0;
      const hoursSince = (now - lastUpdate) / (1000 * 60 * 60);

      if (hoursSince < 20 || (sub.dueCount || 0) === 0) continue;

      const payload = {
        title: 'Fab\'Anki — Streak en danger ! 🔥',
        body: `Tu n'as pas révisé depuis plus de ${Math.floor(hoursSince)}h. ${sub.dueCount} carte${sub.dueCount > 1 ? 's' : ''} t'attendent !`,
        icon: '/fabankiapp.png',
        badge: '/fabankiapp.png',
        tag: 'fabanki-streak',
        renotify: false,
        url: '/',
      };

      const result = await sendPush(sub.subscription, payload);
      if (result === 'expired') expired.push(sub.uid);
      else if (result) sent += 1;
    }

    await Promise.all(expired.map((uid) =>
      db.collection('push_subscriptions').doc(uid).delete().catch(() => {})
    ));

    console.log(`Streak warnings: ${sent} sent`);
    return null;
  });

// ── Cloud Function 4 (HTTP) : Déclencher manuellement un nouveau deck ─────

exports.notifyDeckManually = fn()
  .runWith({ timeoutSeconds: 60 })
  .https.onRequest(async (req, res) => {
    const secret = process.env.NOTIFY_SECRET;
    if (secret && req.body.secret !== secret) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    initWebPush();
    const { deckName = 'Nouveau deck', deckUrl = null } = req.body;

    const subs = await getAllSubscriptions();
    const expired = [];
    let sent = 0;

    for (const sub of subs) {
      if (sub.preferences?.newDecks === false) continue;

      const payload = {
        title: 'Fab\'Anki — Nouveau deck disponible',
        body: `Nouveau deck : ${deckName}`,
        icon: '/fabankiapp.png',
        badge: '/fabankiapp.png',
        tag: 'fabanki-new-deck-manual',
        renotify: false,
        url: '/',
        deckUrl,
      };

      const result = await sendPush(sub.subscription, payload);
      if (result === 'expired') expired.push(sub.uid);
      else if (result) sent += 1;
    }

    await Promise.all(expired.map((uid) =>
      db.collection('push_subscriptions').doc(uid).delete().catch(() => {})
    ));

    res.json({ sent, expired: expired.length });
  });
