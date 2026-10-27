// Vercel function: the shared fair, relayed through the same Upstash Redis database as the wishes.
// Every player posts where they are about once a second and gets back everyone else in their fair.
// This works on every network (it is plain HTTPS), unlike browser-to-browser WebRTC.
//   POST /api/fair { id, room, p }       -> { peers: [{ id, p }] }   (p is the player's presence: position, look, chat line…)
//   POST /api/fair { id, room, bye: 1 }  -> { ok: true }             (leaving)
import { redis, redisEnv } from './wishes.js';

const STALE = 12000;      // a player who has not been heard from for this long has left
const MAX_P = 4000;       // bytes of presence per player
const SEND = 40;          // players sent back, most recently heard first

export function roomKey(room) {
  if (room === undefined || room === null || room === 'public') return 'ykn:fair:public';
  return typeof room === 'string' && /^ykn-[a-z0-9-]{1,50}$/i.test(room) ? 'ykn:fair:' + room.toLowerCase() : null;
}
export const validId = id => typeof id === 'string' && /^[a-z0-9]{8,32}$/i.test(id);

export async function handle(method, body, env = process.env, fetchImpl = fetch, now = Date.now()) {
  if (method !== 'POST') return [405, { error: 'Use POST.' }];
  const cfg = redisEnv(env);
  if (!cfg) return [503, { error: 'The fair database is not set up yet.' }];
  const b = typeof body === 'string' ? safeJson(body) : body;
  if (!b || !validId(b.id)) return [400, { error: 'Missing player id.' }];
  const key = roomKey(b.room);
  if (!key) return [400, { error: 'Bad room code.' }];
  if (b.bye) { await redis(cfg, [['HDEL', key, b.id]], fetchImpl); return [200, { ok: true }]; }
  const p = JSON.stringify(b.p && typeof b.p === 'object' ? b.p : {});
  if (p.length > MAX_P) return [413, { error: 'Too much presence.' }];
  const [, all] = await redis(cfg, [['HSET', key, b.id, JSON.stringify({ at: now, p })], ['HGETALL', key], ['EXPIRE', key, 300]], fetchImpl);
  const peers = [], stale = [];
  for (let i = 0; i + 1 < (all || []).length; i += 2) {
    const id = all[i]; if (id === b.id) continue;
    let row; try { row = JSON.parse(all[i + 1]); } catch { stale.push(id); continue; }
    if (!row || now - row.at > STALE) { stale.push(id); continue; }
    let pres; try { pres = JSON.parse(row.p); } catch { continue; }
    peers.push({ id, p: pres, at: row.at });
  }
  if (stale.length) await redis(cfg, [['HDEL', key, ...stale]], fetchImpl);
  peers.sort((a, c) => c.at - a.at);
  return [200, { peers: peers.slice(0, SEND).map(({ id, p }) => ({ id, p })) }];
}
function safeJson(s) { try { return JSON.parse(s); } catch { return null; } }

export default async function handler(req, res) {
  let status, out;
  try { [status, out] = await handle(req.method, req.body); }
  catch { status = 502; out = { error: 'The fair database did not answer.' }; }
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(out);
}
