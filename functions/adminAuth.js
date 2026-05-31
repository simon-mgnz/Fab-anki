/**
 * Admin verification — secrets stay server-side only.
 */
const functions = require('firebase-functions');
const admin = require('firebase-admin');

async function getAdminUserRecord() {
  const adminUid = process.env.ADMIN_UID;
  if (!adminUid) {
    throw new Error('ADMIN_UID non configuré dans functions/.env');
  }
  return admin.auth().getUser(adminUid);
}

function assertAdminContext(context) {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Connexion requise.');
  }
  const adminUid = process.env.ADMIN_UID;
  if (!adminUid) {
    throw new functions.https.HttpsError('failed-precondition', 'ADMIN_UID non configuré côté serveur.');
  }
  if (context.auth.uid !== adminUid) {
    throw new functions.https.HttpsError('permission-denied', 'Accès réservé à l\'administrateur.');
  }
}

module.exports = {
  getAdminUserRecord,
  assertAdminContext,
};
