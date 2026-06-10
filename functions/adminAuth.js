/**
 * Admin verification — secrets stay server-side only.
 */
const functions = require('firebase-functions');
const admin = require('firebase-admin');

function getAdminUid() {
  return String(process.env.ADMIN_UID || '').trim();
}

async function getAdminUserRecord() {
  const adminUid = getAdminUid();
  if (!adminUid) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'ADMIN_UID non configuré. Remplis functions/.env puis redéploie : firebase deploy --only functions'
    );
  }
  return admin.auth().getUser(adminUid);
}

function assertAdminContext(context) {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Connexion requise. Utilise Réglages → Synchroniser.');
  }
  const adminUid = getAdminUid();
  if (!adminUid) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'ADMIN_UID non configuré côté serveur. Redéploie les Functions après avoir rempli functions/.env'
    );
  }
  if (context.auth.uid !== adminUid) {
    throw new functions.https.HttpsError(
      'permission-denied',
      `Compte non autorisé. UID connecté : ${context.auth.uid}. Vérifie ADMIN_UID dans functions/.env.`
    );
  }
}

function isAdminUid(uid) {
  const adminUid = getAdminUid();
  return !!(adminUid && uid && uid === adminUid);
}

module.exports = {
  getAdminUserRecord,
  assertAdminContext,
  isAdminUid,
};
