import test from 'node:test';
import assert from 'node:assert/strict';
import * as esbuild from 'esbuild';

// layout.ts uses extensionless imports, so bundle it before loading
const out = await esbuild.build({ entryPoints: ['src/layout.ts'], bundle: true, format: 'esm', write: false, platform: 'neutral' });
const { blocked, POND, WISH_STALL } = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'));

test('nobody can walk into the wishing pond', () => {
  assert.ok(blocked(POND.x, POND.y, 6));
  assert.ok(blocked(POND.x + POND.rx * .95, POND.y, 6));
  assert.ok(blocked(POND.x, POND.y - POND.ry * .95, 6));
  assert.ok(blocked(POND.x + POND.rx * .7, POND.y + POND.ry * .7, 6));
});
test('the path around the pond and the wish stall stay open', () => {
  assert.ok(!blocked(POND.x, POND.y + POND.ry + 30, 6));
  assert.ok(!blocked(POND.x - POND.rx - 30, POND.y, 6));
  assert.ok(!blocked(WISH_STALL.x, WISH_STALL.y + 50, 6));
});
