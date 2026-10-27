import test from 'node:test';
import assert from 'node:assert/strict';
import { handle, makeWish } from '../api/wishes.js';

// a tiny in-memory stand-in for Upstash's REST pipeline
function fakeRedis() {
  const lists = new Map(), nums = new Map();
  const run = ([cmd, key, ...a]) => {
    if (cmd === 'RPUSH') { const l = lists.get(key) || []; l.push(...a); lists.set(key, l); return l.length; }
    if (cmd === 'LTRIM') { const l = lists.get(key) || []; lists.set(key, l.slice(Math.max(0, l.length + a[0]))); return 'OK'; }
    if (cmd === 'LRANGE') { const l = lists.get(key) || []; return l.slice(Math.max(0, l.length + a[0])); }
    if (cmd === 'INCR') { const n = (nums.get(key) || 0) + 1; nums.set(key, n); return n; }
    if (cmd === 'EXPIRE') return 1;
    throw new Error('unexpected ' + cmd);
  };
  return async (url, opts) => ({ ok: true, json: async () => JSON.parse(opts.body).map(c => ({ result: run(c) })) });
}
const env = { KV_REST_API_URL: 'https://example.upstash.io', KV_REST_API_TOKEN: 't' };

test('wishes are saved and read back by everyone', async () => {
  const f = fakeRedis();
  const [s1, r1] = await handle('POST', { k: 'sky', t: '  မိသားစု ကျန်းမာပါစေ ', n: 'Zaw' }, '1.1.1.1', env, f);
  assert.equal(s1, 201); assert.equal(r1.wish.t, 'မိသားစု ကျန်းမာပါစေ');
  await handle('POST', JSON.stringify({ k: 'water', t: 'Peace', n: '' }), '2.2.2.2', env, f);
  const [s2, r2] = await handle('GET', null, '3.3.3.3', env, f);
  assert.equal(s2, 200); assert.deepEqual(r2.wishes.map(w => [w.k, w.t, w.n]), [['sky', 'မိသားစု ကျန်းမာပါစေ', 'Zaw'], ['water', 'Peace', 'Visitor']]);
});
test('bad wishes and floods are refused', async () => {
  const f = fakeRedis();
  assert.equal((await handle('POST', { k: 'fire', t: 'x' }, 'a', env, f))[0], 400);
  assert.equal((await handle('POST', { k: 'sky', t: '   ' }, 'a', env, f))[0], 400);
  for (let i = 0; i < 20; i++) assert.equal((await handle('POST', { k: 'sky', t: 'w' + i }, 'b', env, f))[0], 201);
  assert.equal((await handle('POST', { k: 'sky', t: 'one more' }, 'b', env, f))[0], 429);
});
test('without the database env vars the API says so', async () => {
  assert.equal((await handle('GET', null, 'a', {}, fakeRedis()))[0], 503);
});
test('wish text is trimmed to 80 characters and names lose markup', () => {
  const w = makeWish({ k: 'sky', t: 'a'.repeat(200), n: '<b>Zaw</b>' });
  assert.equal(w.t.length, 80); assert.equal(w.n, 'bZaw/b');
});
