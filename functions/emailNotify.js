/**
 * Email notifications for Fab'Anki admin.
 */
const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) return null;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user, pass },
  });
  return transporter;
}

async function sendAdminEmail(admin, subject, html) {
  const transport = getTransporter();
  if (!transport) {
    console.warn('[email] SMTP non configuré — email ignoré:', subject);
    return false;
  }
  if (!admin?.email) {
    console.warn('[email] Email admin introuvable');
    return false;
  }

  await transport.sendMail({
    from: process.env.SMTP_FROM || admin.email,
    to: admin.email,
    subject,
    html,
  });
  return true;
}

function buildDeckPublishedEmail(submission, publishResult, submissionId) {
  const siteUrl = process.env.SITE_URL || 'https://fabanki-classement.web.app';
  const path = publishResult.relativePath;
  return `
    <h2>Nouveau deck publié automatiquement</h2>
    <ul>
      <li><strong>Titre :</strong> ${escapeHtml(submission.title)}</li>
      <li><strong>Chemin :</strong> ${escapeHtml(path)}</li>
      <li><strong>Cartes :</strong> ${submission.cardCount || '?'}</li>
      <li><strong>Soumis par :</strong> ${escapeHtml(submission.submittedBy || 'Anonymous')}</li>
      <li><strong>ID :</strong> ${escapeHtml(submissionId)}</li>
    </ul>
    <p>Le deck est en ligne. Pour le retirer, utilise la modération dans Réglages (connexion admin requise).</p>
    <p><a href="${siteUrl}/?deck=${encodeURIComponent('decks/' + path)}">Ouvrir le deck</a></p>
  `;
}

function buildDeckFailedEmail(submission, errorMessage, submissionId) {
  return `
    <h2>Échec de publication automatique d'un deck</h2>
    <ul>
      <li><strong>Titre :</strong> ${escapeHtml(submission?.title || '?')}</li>
      <li><strong>ID :</strong> ${escapeHtml(submissionId)}</li>
      <li><strong>Erreur :</strong> ${escapeHtml(errorMessage)}</li>
    </ul>
  `;
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = {
  sendAdminEmail,
  buildDeckPublishedEmail,
  buildDeckFailedEmail,
};
