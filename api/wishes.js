// Vercel function: Thadingyut wishes shared by everyone who plays the deployed game.
// Stored in Upstash Redis (add it from the Vercel Marketplace; it sets the env vars below).
//   GET  /api/wishes        -> { wishes: [{ id, k, t, n, at }] } (newest last)
//   POST /api/wishes {k,t,n} -> { wish }

const KEY = 'ykn:wishes';
const KEEP = 5000;          // wishes kept, oldest dropped first
const SEND = 1000;          // wishes sent to each player
const PER_HOUR = 20;        // wishes one address may make per hour

export function redisEnv(env = process.env) {
  const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ''), token } : null;
}

/** Runs Redis commands in one round trip through Upstash's REST pipeline. */
export async function redis(cfg, cmds, fetchImpl = fetch) {
  const r = await fetchImpl(cfg.url + '/pipeline', {
    method: 'POST', headers: { Authorization: 'Bearer ' + cfg.token, 'Content-Type': 'application/json' }, body: JSON.stringify(cmds),
  });
  if (!r.ok) throw new Error('redis ' + r.status);
  const out = await r.json();
  for (const o of out) if (o && o.error) throw new Error('redis ' + o.error);
  return out.map(o => o.result);
}

export function cleanWish(t) {
  return typeof t === 'string' ? t.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) : '';
}
/** Checks a posted wish; returns the wish to store or null. */
export function makeWish(body, now = Date.now(), rnd = Math.random) {
  if (!body || typeof body !== 'object') return null;
  const t = cleanWish(body.t);
  if (!t || (body.k !== 'sky' && body.k !== 'water')) return null;
  const n = typeof body.n === 'string' ? body.n.replace(/[\u0000-\u001f\u007f<>]+/g, '').trim().slice(0, 24) : '';
  return { id: now.toString(36) + rnd().toString(36).slice(2, 8), k: body.k, t, n: n || 'Visitor', at: now };
}
function parseRows(rows) {
  const out = [];
  for (const s of rows || []) { try { const w = JSON.parse(s); if (w && w.id && w.t) out.push(w); } catch { /* skip bad rows */ } }
  return out;
}

export async function handle(method, body, ip, env = process.env, fetchImpl = fetch) {
  const cfg = redisEnv(env);
  if (!cfg) return [503, { error: 'Wishes database is not set up yet.' }];
  if (method === 'GET') {
    const [rows] = await redis(cfg, [['LRANGE', KEY, -SEND, -1]], fetchImpl);
    return [200, { wishes: parseRows(rows) }];
  }
  if (method === 'POST') {
    const wish = makeWish(typeof body === 'string' ? safeJson(body) : body);
    if (!wish) return [400, { error: 'A wish needs some words and a kind (sky or water).' }];
    const rk = 'ykn:rate:' + (ip || 'unknown');
    const [count] = await redis(cfg, [['INCR', rk], ['EXPIRE', rk, 3600, 'NX']], fetchImpl);
    if (count > PER_HOUR) return [429, { error: 'Lots of wishes already! Try again in a while.' }];
    await redis(cfg, [['RPUSH', KEY, JSON.stringify(wish)], ['LTRIM', KEY, -KEEP, -1]], fetchImpl);
    return [201, { wish }];
  }
  return [405, { error: 'Use GET or POST.' }];
}
function safeJson(s) { try { return JSON.parse(s); } catch { return null; } }

export default async function handler(req, res) {
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress;
  let status, out;
  try { [status, out] = await handle(req.method, req.body, ip); }
  catch { status = 502; out = { error: 'The wishes database did not answer.' }; }
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(out);
}
