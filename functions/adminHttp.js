/**
 * Admin API HTTP (CORS explicite) pour fabanki.fr
 */
const functions = require('firebase-functions');
const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });

const { assertAdminContext, isAdminUid } = require('./adminAuth');
const { removeDeckFromGitHub, listManifestFolders, readManifestFullFromGitHub, updateManifestNotices, bulkAssignManifestDeckTime, updateExistingDeckXmlOnGitHub } = require('./deckPublisher');

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
          path: doc.data().path || '/',
          publishedPath: doc.data().publishedPath || null,
          submittedBy: doc.data().submittedBy || '',
          status: doc.data().status,
          cardCount: doc.data().cardCount || 0,
          cost: doc.data().cost || 0,
          level: doc.data().level || 0,
          modes: doc.data().modes || [],
          submittedAt: doc.data().submittedAt?.toDate?.()?.toISOString?.() || null,
          publishError: doc.data().publishError || null,
        })),
      });
    })),

    adminHttpGetSubmission: fn().https.onRequest(withCors(async (req, res) => {
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
      const data = snap.data() || {};
      res.json({
        submission: {
          id: snap.id,
          title: data.title || '',
          path: data.path || '/',
          cost: data.cost || 0,
          level: data.level || 0,
          modes: Array.isArray(data.modes) ? data.modes : [],
          description: data.description || '',
          xmlContent: data.xmlContent || '',
          cardCount: data.cardCount || 0,
          submittedBy: data.submittedBy || '',
          status: data.status || 'pending',
          publishedPath: data.publishedPath || null,
          publishError: data.publishError || null,
          submittedAt: data.submittedAt?.toDate?.()?.toISOString?.() || null,
        },
      });
    })),

    adminHttpUpdateSubmission: fn().https.onRequest(withCors(async (req, res) => {
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
      const ref = db.collection('deck_submissions').doc(submissionId);
      const snap = await ref.get();
      if (!snap.exists) {
        res.status(404).json({ error: 'Soumission introuvable' });
        return;
      }
      const current = snap.data() || {};
      const editable = new Set(['pending', 'failed']);
      if (!editable.has(current.status)) {
        res.status(400).json({ error: `Impossible de modifier un deck au statut « ${current.status} »` });
        return;
      }

      const title = String(req.body?.title ?? current.title ?? '').trim();
      if (!title) {
        res.status(400).json({ error: 'Titre requis' });
        return;
      }

      let folderPath = String(req.body?.path ?? current.path ?? '/').trim();
      if (!folderPath.startsWith('/')) folderPath = `/${folderPath}`;
      folderPath = folderPath.replace(/\\/g, '/').replace(/\/+/g, '/');
      if (folderPath !== '/' && folderPath.endsWith('/')) folderPath = folderPath.slice(0, -1);

      const cost = Math.max(0, Number(req.body?.cost ?? current.cost ?? 0) || 0);
      const level = Math.max(0, Number(req.body?.level ?? current.level ?? 0) || 0);
      const modes = Array.isArray(req.body?.modes) ? req.body.modes.map(String) : (current.modes || []);
      const description = String(req.body?.description ?? current.description ?? '').trim();
      let time = String(req.body?.time ?? current.time ?? '').trim().replace(',', '.');
      if (time && !/^[12]\.\d{1,2}$/.test(time)) {
        res.status(400).json({ error: 'time invalide — format attendu : 1.05 ou 2.24' });
        return;
      }

      await ref.set({
        title,
        path: folderPath,
        cost,
        level,
        modes,
        description,
        time: time || admin.firestore.FieldValue.delete(),
        status: 'pending',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: 'admin',
        publishError: admin.firestore.FieldValue.delete(),
      }, { merge: true });

      res.json({ ok: true });
    })),

    adminHttpListFolders: fn().https.onRequest(withCors(async (req, res) => {
      if (req.method !== 'POST' && req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
      }
      await verifyAuth(req);
      const folders = await listManifestFolders();
      res.json({ folders });
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

    adminHttpGetManifestNotices: fn().https.onRequest(withCors(async (req, res) => {
      if (req.method !== 'POST' && req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
      }
      await verifyAuth(req);
      const full = await readManifestFullFromGitHub();
      res.json({
        Warning: full.Warning || '',
        Information: full.Information || '',
      });
    })),

    adminHttpUpdateManifestNotices: fn().https.onRequest(withCors(async (req, res) => {
      if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
      }
      await verifyAuth(req);
      const body = req.body || {};
      const result = await updateManifestNotices(body.Warning, body.Information);
      res.json({ ok: true, ...result });
    })),

    adminHttpBulkAssignDeckTime: fn().https.onRequest(withCors(async (req, res) => {
      if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
      }
      await verifyAuth(req);
      const body = req.body || {};
      const result = await bulkAssignManifestDeckTime(body.folderPrefix, body.year, body.week);
      res.json({ ok: true, ...result });
    })),

    adminHttpCheckAccess: fn().https.onRequest(withCors(async (req, res) => {
      if (req.method !== 'POST' && req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
      }
      const header = req.headers.authorization || '';
      const token = header.replace(/^Bearer\s+/i, '').trim();
      if (!token) {
        res.json({ isAdmin: false });
        return;
      }
      try {
        const decoded = await admin.auth().verifyIdToken(token);
        res.json({ isAdmin: isAdminUid(decoded.uid) });
      } catch {
        res.json({ isAdmin: false });
      }
    })),

    adminHttpUpdateDeckXml: onRequest({
      region: REGION,
      timeoutSeconds: 120,
      memory: '256MiB',
      cors: true,
      invoker: 'public',
    }, withCors(async (req, res) => {
      if (req.method !== 'POST') {
        res.status(405).json({ error: 'POST required' });
        return;
      }
      const decoded = await verifyAuth(req);
      const deckPath = String(req.body?.deckPath || '').trim();
      const xmlContent = String(req.body?.xmlContent || '');
      const cardId = String(req.body?.cardId || '').trim();
      if (!deckPath) {
        res.status(400).json({ error: 'deckPath requis' });
        return;
      }
      if (!xmlContent.trim()) {
        res.status(400).json({ error: 'xmlContent requis' });
        return;
      }
      const message = cardId
        ? `Admin (${decoded.uid.slice(0, 8)}): carte ${cardId} dans ${deckPath}`
        : `Admin (${decoded.uid.slice(0, 8)}): mise à jour ${deckPath}`;
      const result = await updateExistingDeckXmlOnGitHub(deckPath, xmlContent, message);
      res.json({ ok: true, ...result });
    })),

    adminHttpPublishDeck: onRequest({
      region: REGION,
      timeoutSeconds: 120,
      memory: '512MiB',
      cors: true,
      invoker: 'public',
    }, withCors(async (req, res) => {
      if (req.method !== 'POST') {
        res.status(405).json({ error: 'POST required' });
        return;
      }
      const decoded = await verifyAuth(req);
      const body = req.body || {};
      const title = String(body.title || '').trim();
      const xmlContent = String(body.xmlContent || '');
      if (!title) {
        res.status(400).json({ error: 'Titre requis' });
        return;
      }
      if (!xmlContent.trim() || xmlContent.length > 700000) {
        res.status(400).json({ error: 'XML manquant ou trop volumineux' });
        return;
      }
      const asCommunity = body.asCommunity === true || body.official === false;
      const submission = {
        title,
        path: body.path || '/',
        cost: Math.max(0, Number(body.cost) || 0),
        level: Math.max(0, Number(body.level) || 0),
        modes: Array.isArray(body.modes) ? body.modes.map(String) : ['anki'],
        time: String(body.time || '').trim(),
        xmlContent,
        cardCount: Math.max(0, Number(body.cardCount) || 0),
        submittedBy: String(body.submittedBy || 'Admin').slice(0, 80),
        submittedByUid: decoded.uid,
        official: !asCommunity,
        status: 'pending',
      };
      const docRef = db.collection('deck_submissions').doc();
      await docRef.set({
        ...submission,
        status: 'publishing',
        submittedAt: admin.firestore.FieldValue.serverTimestamp(),
        publishSource: 'adminHttpPublishDeck',
      });
      const result = await processDeckSubmission(docRef.id, submission, 'adminHttpPublishDeck');
      res.json({ ok: true, submissionId: docRef.id, official: !asCommunity, ...result });
    })),
  };
}

module.exports = { buildAdminHttpExports };
