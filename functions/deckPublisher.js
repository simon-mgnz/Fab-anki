/**
 * GitHub deck publishing helpers for Fab'Anki Cloud Functions.
 */
const fetch = require('node-fetch');

function getGitHubConfig() {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO || 'simon-mgnz/Fab-anki';
  const branch = process.env.GITHUB_BRANCH || 'main';
  if (!token) {
    throw new Error('GITHUB_TOKEN non configuré dans functions/.env');
  }
  return { token, repo, branch };
}

function githubHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'FabAnki-CloudFunctions',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

async function githubGetFile(repoPath) {
  const { token, repo, branch } = getGitHubConfig();
  const url = `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(repoPath).replace(/%2F/g, '/')}?ref=${branch}`;
  const resp = await fetch(url, { headers: githubHeaders(token) });
  if (resp.status === 404) return null;
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`GitHub GET ${repoPath} failed (${resp.status}): ${body}`);
  }
  const data = await resp.json();
  const content = Buffer.from(data.content, 'base64').toString('utf8');
  return { content, sha: data.sha, path: data.path };
}

async function githubPutFile(repoPath, content, message, sha) {
  const { token, repo, branch } = getGitHubConfig();
  const url = `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(repoPath).replace(/%2F/g, '/')}`;
  const body = {
    message,
    content: Buffer.from(content, 'utf8').toString('base64'),
    branch,
  };
  if (sha) body.sha = sha;

  const resp = await fetch(url, {
    method: 'PUT',
    headers: { ...githubHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const errBody = await resp.text();
    throw new Error(`GitHub PUT ${repoPath} failed (${resp.status}): ${errBody}`);
  }
  return resp.json();
}

async function githubDeleteFile(repoPath, sha, message) {
  const { token, repo, branch } = getGitHubConfig();
  const url = `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(repoPath).replace(/%2F/g, '/')}`;
  const resp = await fetch(url, {
    method: 'DELETE',
    headers: { ...githubHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sha, branch }),
  });
  if (!resp.ok) {
    const errBody = await resp.text();
    throw new Error(`GitHub DELETE ${repoPath} failed (${resp.status}): ${errBody}`);
  }
  return resp.json();
}

function sanitizeFilename(title) {
  const base = String(title || 'deck')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const name = base || 'deck';
  return name.toLowerCase().endsWith('.xml') ? name : `${name}.xml`;
}

function normalizeFolderPath(path) {
  return String(path || '')
    .replace(/^\/+|\/+$/g, '')
    .replace(/\\/g, '/');
}

function buildRelativeDeckPath(folderPath, title) {
  const folder = normalizeFolderPath(folderPath);
  const filename = sanitizeFilename(title);
  return folder ? `${folder}/${filename}` : filename;
}

const MODE_TO_TAG = {
  anki: 'text',
  fillblank: 'text',
  timer: 'timer',
  activeMemory: 'text',
  step: 'text',
  reverse: 'text',
  random: 'text',
  hold: 'text',
  multiple: 'text',
  calcul: 'calcul',
  associer: 'text',
  rush: 'timer',
};

function modesToTags(modes) {
  const tags = new Set();
  (Array.isArray(modes) ? modes : []).forEach((mode) => {
    const tag = MODE_TO_TAG[String(mode || '').trim()];
    if (tag) tags.add(tag);
  });
  if (tags.size === 0) tags.add('text');
  return [...tags];
}

function buildManifestEntry(submission, relativePath) {
  const tags = modesToTags(submission.modes);
  if (!tags.includes('community')) tags.push('community');

  const customDesc = submission.description || submission.manifestDescription;
  const entry = {
    path: relativePath,
    tags,
    description: customDesc && String(customDesc).trim()
      ? String(customDesc).trim()
      : `Deck communautaire soumis par ${submission.submittedBy || 'un utilisateur'} — ${submission.title || 'Sans titre'}.`,
  };
  const cost = Number(submission.cost);
  const level = Number(submission.level);
  if (Number.isFinite(cost) && cost > 0) entry.cost = cost;
  if (Number.isFinite(level) && level > 0) entry.level = level;
  const timeRaw = submission.time ?? submission.deckTime;
  if (timeRaw != null && String(timeRaw).trim()) {
    const t = String(timeRaw).trim().replace(',', '.');
    if (/^[12]\.\d{1,2}$/.test(t)) entry.time = t;
  }
  return entry;
}

async function listManifestFolders() {
  const manifestRepoPath = 'decks/manifest.json';
  const manifestFull = await readManifestFullFromGitHub();
  const manifestEntries = manifestFull.decks || [];
  const manifestFile = manifestFull.sha ? { sha: manifestFull.sha } : null;
  const folders = new Set(['']);
  for (const e of manifestEntries) {
    const p = String(e.path || e);
    const parts = p.split('/').filter(Boolean);
    if (parts.length <= 1) continue;
    for (let i = 1; i < parts.length; i += 1) {
      folders.add(parts.slice(0, i).join('/'));
    }
  }
  return [...folders].sort((a, b) => a.localeCompare(b, 'fr'));
}

function parseManifestFull(content) {
  const parsed = JSON.parse(content);
  if (Array.isArray(parsed)) {
    return { Warning: '', Information: '', decks: parsed };
  }
  if (parsed && typeof parsed === 'object') {
    return {
      Warning: String(parsed.Warning ?? parsed.warning ?? ''),
      Information: String(parsed.Information ?? parsed.information ?? ''),
      decks: Array.isArray(parsed.decks) ? parsed.decks : [],
    };
  }
  return { Warning: '', Information: '', decks: [] };
}

function parseManifest(content) {
  return parseManifestFull(content).decks;
}

function formatManifestEntries(entries, meta = {}) {
  return JSON.stringify({
    Warning: meta.Warning ?? '',
    Information: meta.Information ?? '',
    decks: entries,
  }, null, '\t') + '\n';
}

function formatManifest(entries, meta = {}) {
  return formatManifestEntries(entries, meta);
}

async function readManifestFullFromGitHub() {
  const manifestRepoPath = 'decks/manifest.json';
  const manifestFile = await githubGetFile(manifestRepoPath);
  if (!manifestFile) {
    return { Warning: '', Information: '', decks: [], sha: null };
  }
  const full = parseManifestFull(manifestFile.content);
  return { ...full, sha: manifestFile.sha };
}

async function bulkAssignManifestDeckTime(folderPrefix, year, week) {
  const y = Number(year);
  const w = Number(week);
  if (y !== 1 && y !== 2) throw new Error('Année invalide (1 ou 2)');
  if (!Number.isFinite(w) || w < 1 || w > 36) throw new Error('Semaine invalide (1–36)');
  const timeStr = `${y}.${String(w).padStart(2, '0')}`;
  const prefix = String(folderPrefix || '').replace(/^\//, '').replace(/\\/g, '/').replace(/\/$/, '');
  const current = await readManifestFullFromGitHub();
  let updated = 0;
  const decks = (current.decks || []).map((entry) => {
    const p = String(entry.path || entry);
    if (!p.toLowerCase().endsWith('.xml')) return entry;
    if (prefix && !p.startsWith(prefix)) return entry;
    updated += 1;
    return { ...entry, time: timeStr };
  });
  if (updated === 0) throw new Error('Aucun deck .xml trouvé pour ce dossier');
  const content = formatManifestEntries(decks, {
    Warning: current.Warning,
    Information: current.Information,
  });
  await githubPutFile(
    'decks/manifest.json',
    content,
    `Admin: bulk assign time ${timeStr} → ${prefix || '(tous)'}`,
    current.sha
  );
  return { updated, time: timeStr, prefix: prefix || '/' };
}

async function updateManifestNotices(warning, information) {
  const current = await readManifestFullFromGitHub();
  const nextWarning = warning !== undefined ? String(warning) : current.Warning;
  const nextInformation = information !== undefined ? String(information) : current.Information;
  const content = formatManifestEntries(current.decks, {
    Warning: nextWarning,
    Information: nextInformation,
  });
  await githubPutFile(
    'decks/manifest.json',
    content,
    'Admin: update manifest Warning/Information',
    current.sha
  );
  return { Warning: nextWarning, Information: nextInformation };
}

function ensureUniqueRelativePath(entries, relativePath) {
  const exists = entries.some((e) => (e.path || e) === relativePath);
  if (!exists) return relativePath;
  const dot = relativePath.lastIndexOf('.');
  const base = dot >= 0 ? relativePath.slice(0, dot) : relativePath;
  const ext = dot >= 0 ? relativePath.slice(dot) : '.xml';
  let i = 2;
  while (entries.some((e) => (e.path || e) === `${base} (${i})${ext}`)) i += 1;
  return `${base} (${i})${ext}`;
}

function validateSubmission(submission) {
  if (!submission || typeof submission !== 'object') {
    throw new Error('Soumission invalide');
  }
  if (!submission.title || !String(submission.title).trim()) {
    throw new Error('Titre manquant');
  }
  if (!submission.xmlContent || !String(submission.xmlContent).trim()) {
    throw new Error('Contenu XML manquant');
  }
  if (String(submission.xmlContent).length > 700000) {
    throw new Error('XML trop volumineux');
  }
  if (!String(submission.xmlContent).includes('<deck') && !String(submission.xmlContent).includes('<card')) {
    throw new Error('XML deck invalide');
  }
}

async function publishDeckToGitHub(submission, submissionId) {
  validateSubmission(submission);

  const manifestRepoPath = 'decks/manifest.json';
  const manifestFull = await readManifestFullFromGitHub();
  const manifestEntries = manifestFull.decks || [];
  const manifestFile = manifestFull.sha ? { sha: manifestFull.sha } : null;

  let relativePath = buildRelativeDeckPath(submission.path, submission.title);
  relativePath = ensureUniqueRelativePath(manifestEntries, relativePath);

  const xmlRepoPath = `decks/${relativePath}`;
  const manifestEntry = buildManifestEntry(submission, relativePath);

  await githubPutFile(
    xmlRepoPath,
    submission.xmlContent,
    `Auto-publish deck: ${submission.title} (${submissionId})`,
    null
  );

  manifestEntries.push(manifestEntry);
  await githubPutFile(
    manifestRepoPath,
    formatManifestEntries(manifestEntries, {
      Warning: manifestFull.Warning,
      Information: manifestFull.Information,
    }),
    `Auto-publish manifest: ${submission.title} (${submissionId})`,
    manifestFile ? manifestFile.sha : undefined
  );

  return { relativePath, xmlRepoPath, manifestEntry };
}

async function removeDeckFromGitHub(publishedPath) {
  if (!publishedPath) throw new Error('publishedPath manquant');

  const relativePath = String(publishedPath).replace(/^decks\//, '');
  const xmlRepoPath = `decks/${relativePath}`;
  const manifestRepoPath = 'decks/manifest.json';

  const manifestFull = await readManifestFullFromGitHub();
  if (!manifestFull.sha) throw new Error('manifest.json introuvable sur GitHub');

  const manifestEntries = manifestFull.decks || [];
  const filtered = manifestEntries.filter((e) => (e.path || e) !== relativePath);
  if (filtered.length === manifestEntries.length) {
    throw new Error(`Deck absent du manifest: ${relativePath}`);
  }

  const xmlFile = await githubGetFile(xmlRepoPath);
  if (xmlFile) {
    await githubDeleteFile(xmlRepoPath, xmlFile.sha, `Moderation: remove deck ${relativePath}`);
  }

  await githubPutFile(
    manifestRepoPath,
    formatManifestEntries(filtered, {
      Warning: manifestFull.Warning,
      Information: manifestFull.Information,
    }),
    `Moderation: remove deck from manifest ${relativePath}`,
    manifestFull.sha
  );

  return { relativePath, xmlRepoPath };
}

module.exports = {
  publishDeckToGitHub,
  removeDeckFromGitHub,
  buildRelativeDeckPath,
  listManifestFolders,
  modesToTags,
  parseManifestFull,
  readManifestFullFromGitHub,
  updateManifestNotices,
  bulkAssignManifestDeckTime,
};
