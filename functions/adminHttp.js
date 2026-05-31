/**
 * Admin API HTTP (CORS explicite) pour fabanki.fr
 */
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });

const { assertAdminContext } = require('./adminAuth');
const { removeDeckFromGitHub } = require('./deckPublisher');

const REGION = 'europe-west1';
const fn = () => functions.region(REGION);

function withCors(handler) {
  return (req, res) => {
    cors(req, res, async () => {
      if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
      }
      try {
        await handler(req, res);
      } catch (e) {
        console.error('[adminHttp]', e);
        const code = e.code || '';
        const status = code === 'permission-denied' ? 403
          : code === 'unauthenticated' ? 401
            : e.statusCode || 500;
        res.status(status).json({ error: e.message || String(e) });
      }
    });
  };
}

async function verifyAuth(req) {
  const header = req.headers.authorization || '';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    const err = new Error('Token manquant. Connecte-toi via Synchroniser.');
    err.code = 'unauthenticated';
    throw err;
  }
  const decoded = await admin.auth().verifyIdToken(token);
  assertAdminContext({ auth: { uid: decoded.uid } });
  return decoded;
}

function buildAdminHttpExports(db, processDeckSubmission) {
  return {
    adminHttpListDecks: fn().https.onRequest(withCors(async (req, res) => {
      if (req.method !== 'POST' && req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
      }
      await verifyAuth(req);

      const allowed = new Set(['pending', 'published', 'publishing', 'failed', 'removed']);
      const snap = await db.collection('deck_submissions').limit(100).get();
      const docs = snap.docs
        .filter((d) => allowed.has(d.data().status))
        .sort((a, b) => {
          const ta = a.data().submittedAt?.toMillis?.() || 0;
          const tb = b.data().submittedAt?.toMillis?.() || 0;
          return tb - ta;
        })
        .slice(0, 50);

      res.json({
        decks: docs.map((doc) => ({
          id: doc.id,
          title: doc.data().title,
          publishedPath: doc.data().publishedPath || null,
          submittedBy: doc.data().submittedBy || '',
          status: doc.data().status,
          cardCount: doc.data().cardCount || 0,
          submittedAt: doc.data().submittedAt?.toDate?.()?.toISOString?.() || null,
          publishError: doc.data().publishError || null,
        })),
      });
    })),

    adminHttpPublishAll: fn()
      .runWith({ timeoutSeconds: 540, memory: '512MB' })
      .https.onRequest(withCors(async (req, res) => {
        if (req.method !== 'POST') {
          res.status(405).json({ error: 'POST required' });
          return;
        }
        await verifyAuth(req);

        const snap = await db.collection('deck_submissions').where('status', '==', 'pending').limit(20).get();
        let published = 0;
        let failed = 0;
        const errors = [];

        for (const doc of snap.docs) {
          try {
            await processDeckSubmission(doc.id, doc.data(), 'admin_batch');
            published += 1;
          } catch (e) {
            failed += 1;
            errors.push({ id: doc.id, title: doc.data().title, error: String(e.message || e) });
          }
        }

        res.json({ ok: true, published, failed, errors });
      })),

    adminHttpRetryPublish: fn()
      .runWith({ timeoutSeconds: 120, memory: '512MB' })
      .https.onRequest(withCors(async (req, res) => {
        if (req.method !== 'POST') {
          res.status(405).json({ error: 'POST required' });
          return;
        }
        await verifyAuth(req);
        const submissionId = String(req.body?.submissionId || '').trim();
        if (!submissionId) {
          res.status(400).json({ error: 'submissionId requis' });
          return;
        }
        const snap = await db.collection('deck_submissions').doc(submissionId).get();
        if (!snap.exists) {
          res.status(404).json({ error: 'Soumission introuvable' });
          return;
        }
        await processDeckSubmission(submissionId, snap.data(), 'admin_retry');
        res.json({ ok: true });
      })),

    adminHttpRemoveDeck: fn()
      .runWith({ timeoutSeconds: 120, memory: '512MB' })
      .https.onRequest(withCors(async (req, res) => {
        if (req.method !== 'POST') {
          res.status(405).json({ error: 'POST required' });
          return;
        }
        const decoded = await verifyAuth(req);
        const submissionId = String(req.body?.submissionId || '').trim();
        const publishedPath = String(req.body?.publishedPath || '').trim();
        if (!submissionId || !publishedPath) {
          res.status(400).json({ error: 'submissionId et publishedPath requis' });
          return;
        }
        await removeDeckFromGitHub(publishedPath);
        await db.collection('deck_submissions').doc(submissionId).set({
          status: 'removed',
          removedAt: admin.firestore.FieldValue.serverTimestamp(),
          removedBy: decoded.uid,
        }, { merge: true });
        res.json({ ok: true, removedPath: publishedPath });
      })),
  };
}

module.exports = { buildAdminHttpExports };
