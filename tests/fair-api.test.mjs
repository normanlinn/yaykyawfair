import test from 'node:test';
import assert from 'node:assert/strict';
import { handle, roomKey } from '../api/fair.js';

const env = { KV_REST_API_URL: 'https://x', KV_REST_API_TOKEN: 't' };
function fakeRedis() {
  const h = new Map();
  const run = ([cmd, key, ...a]) => {
    const m = h.get(key) || new Map(); h.set(key, m);
    if (cmd === 'HSET') { m.set(a[0], a[1]); return 1; }
    if (cmd === 'HGETALL') return [...m].flat();
    if (cmd === 'HDEL') { a.forEach(k => m.delete(k)); return a.length; }
    return 1;
  };
  return async (u, o) => ({ ok: true, json: async () => JSON.parse(o.body).map(c => ({ result: run(c) })) });
}

test('players in the same fair see each other, but not themselves', async () => {
  const f = fakeRedis();
  await handle('POST', { id: 'aaaaaaaa1', p: { x: 1, y: 2 } }, env, f, 1000);
  const [s, out] = await handle('POST', { id: 'bbbbbbbb2', p: { x: 5, y: 6 } }, env, f, 1500);
  assert.equal(s, 200);
  assert.deepEqual(out.peers, [{ id: 'aaaaaaaa1', p: { x: 1, y: 2 } }]);
  const [, back] = await handle('POST', { id: 'aaaaaaaa1', p: { x: 1, y: 3 } }, env, f, 2000);
  assert.deepEqual(back.peers.map(p => p.id), ['bbbbbbbb2']);
});

test('players who stop posting drop out, and leaving is immediate', async () => {
  const f = fakeRedis();
  await handle('POST', { id: 'aaaaaaaa1', p: {} }, env, f, 0);
  await handle('POST', { id: 'cccccccc3', p: {} }, env, f, 10000);
  let [, out] = await handle('POST', { id: 'bbbbbbbb2', p: {} }, env, f, 15000);
  assert.deepEqual(out.peers.map(p => p.id), ['cccccccc3']);
  await handle('POST', { id: 'cccccccc3', bye: 1 }, env, f, 15100);
  [, out] = await handle('POST', { id: 'bbbbbbbb2', p: {} }, env, f, 15200);
  assert.deepEqual(out.peers, []);
});

test('private rooms are separate from the public fair', async () => {
  const f = fakeRedis();
  await handle('POST', { id: 'aaaaaaaa1', room: 'ykn-abc', p: {} }, env, f, 0);
  const [, out] = await handle('POST', { id: 'bbbbbbbb2', p: {} }, env, f, 10);
  assert.deepEqual(out.peers, []);
  assert.equal(roomKey('bad room!'), null);
});

test('without a database it says so, and bad input is refused', async () => {
  assert.equal((await handle('POST', { id: 'aaaaaaaa1' }, {}))[0], 503);
  assert.equal((await handle('POST', { id: 'x' }, env, fakeRedis()))[0], 400);
  assert.equal((await handle('GET', null, env))[0], 405);
});
