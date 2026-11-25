/* Shared GitHub Contents-API JSON store. The database file (db.json) lives on
   the `data` branch of this repo; the token stays server-side in env vars. */
const REPO = process.env.DB_REPO || 'noorima82/nakhban-website';
const REF = process.env.DB_REF || 'data';
const PATH = 'db.json';
const TOKEN = process.env.GH_DB_TOKEN;

function empty() {
  return { registrants: [], threads: {} };
}

async function call(opts) {
  return fetch(`https://api.github.com/repos/${REPO}/contents/${PATH}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'noknban-fn',
      ...(opts && opts.headers)
    }
  });
}

async function readDB() {
  const r = await call({ method: 'GET', headers: { 'Cache-Control': 'no-cache' } });
  if (r.status === 404) return { sha: null, data: empty() };
  if (!r.ok) throw new Error('read failed ' + r.status);
  const j = await r.json();
  let data;
  try {
    data = JSON.parse(Buffer.from(j.content, 'base64').toString('utf8'));
  } catch (e) {
    data = empty();
  }
  if (!Array.isArray(data.registrants)) data.registrants = [];
  if (!data.threads || typeof data.threads !== 'object') data.threads = {};
  return { sha: j.sha, data };
}

async function writeDB(sha, data) {
  const r = await call({
    method: 'PUT',
    body: JSON.stringify({
      message: 'db update (function)',
      content: Buffer.from(JSON.stringify(data, null, 2)).toString('base64'),
      branch: REF,
      sha
    })
  });
  if (!r.ok) throw new Error('write failed ' + r.status);
}

/* read → mutate → write with conflict retry (another instance may commit first) */
async function updateDB(mutator, tries = 4) {
  for (let i = 0; i < tries; i++) {
    const { sha, data } = await readDB();
    const result = mutator(data);
    if (result === null) return { skipped: true, data };  /* nothing to write */
    try {
      await writeDB(sha, data);
      return { skipped: false, data };
    } catch (e) {
      if (i === tries - 1) throw e;
      await new Promise(res => setTimeout(res, 300 + Math.random() * 400));
    }
  }
  throw new Error('db busy');
}

function json(status, obj) {
  return {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    body: JSON.stringify(obj)
  };
}

module.exports = { readDB, updateDB, json, empty };
