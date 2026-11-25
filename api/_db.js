/* GitHub Git Data API store (uncached) — db.json lives on the `data` branch.
   Contents API is CDN-cached, which yields stale SHAs and 409/422 on writes;
   the blob/tree/commit/ref flow always reads fresh state. */
const REPO = process.env.DB_REPO || 'noorima82/nakhban-website';
const REF = process.env.DB_REF || 'data';
const PATH = 'db.json';
const TOKEN = process.env.GH_DB_TOKEN;
const BASE = `https://api.github.com/repos/${REPO}`;

function headers() {
  return {
    Authorization: `Bearer ${TOKEN}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'User-Agent': 'noknban-fn'
  };
}

async function api(path, opts) {
  const r = await fetch(BASE + path, { ...opts, headers: headers() });
  let j = null;
  try { j = await r.json(); } catch (e) { j = {}; }
  if (!r.ok) {
    const err = new Error('github ' + r.status + ' ' + (j.message || '').slice(0, 120));
    err.status = r.status;
    throw err;
  }
  return j;
}

function empty() {
  return { registrants: [], threads: {} };
}

function sanitize(data) {
  if (!Array.isArray(data.registrants)) data.registrants = [];
  if (!data.threads || typeof data.threads !== 'object') data.threads = {};
  return data;
}

async function readDB() {
  const ref = await api('/git/ref/heads/' + REF);
  const headCommit = ref.object.sha;
  const commit = await api('/git/commits/' + headCommit);
  const treeSha = commit.tree.sha;
  const tree = await api('/git/trees/' + treeSha);
  const entry = (tree.tree || []).find(x => x.path === PATH);
  if (!entry) return { headCommit, treeSha, blobSha: null, data: empty() };
  const blob = await api('/git/blobs/' + entry.sha);
  let data;
  try {
    data = JSON.parse(Buffer.from(blob.content, 'base64').toString('utf8'));
  } catch (e) {
    data = empty();
  }
  return { headCommit, treeSha, blobSha: entry.sha, data: sanitize(data) };
}

async function writeDB(ctx, data) {
  const blob = await api('/git/blobs', {
    method: 'POST',
    body: JSON.stringify({ content: Buffer.from(JSON.stringify(data, null, 2)).toString('base64'), encoding: 'base64' })
  });
  const tree = await api('/git/trees', {
    method: 'POST',
    body: JSON.stringify({ base_tree: ctx.treeSha, tree: [{ path: PATH, mode: '100644', type: 'blob', sha: blob.sha }] })
  });
  const commit = await api('/git/commits', {
    method: 'POST',
    body: JSON.stringify({ message: 'db update (function)', tree: tree.sha, parents: [ctx.headCommit] })
  });
  await api('/git/refs/heads/' + REF, {
    method: 'PATCH',
    body: JSON.stringify({ sha: commit.sha, force: false })
  });
}

/* read → mutate → write with retry (another writer may move the ref) */
async function updateDB(mutator, tries = 5) {
  for (let i = 0; i < tries; i++) {
    const ctx = await readDB();
    const result = mutator(ctx.data);
    if (result === null) return { skipped: true, data: ctx.data };
    try {
      await writeDB(ctx, ctx.data);
      return { skipped: false, data: ctx.data };
    } catch (e) {
      if (i === tries - 1) throw e;
      await new Promise(res => setTimeout(res, 400 + Math.random() * 900));
    }
  }
  throw new Error('db busy');
}

function json(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}

module.exports = { readDB, updateDB, json, empty };
