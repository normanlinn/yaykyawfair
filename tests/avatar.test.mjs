import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
const bundled = buildSync({ entryPoints: ['src/people.ts'], bundle: true, platform: 'node', format: 'esm', write: false });
const { cleanAvatar, avatarOpts, DEFAULT_AVATAR } = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'));
test('legacy avatars retain their look and default to unspecified gender', () => {
  const { gender, ...oldSave } = DEFAULT_AVATAR;
  const restored = cleanAvatar({ ...oldSave, outfit: 'htamein', hair: 'long' });
  assert.equal(restored.gender, 'unspecified');
  assert.equal(restored.outfit, 'htamein');
  assert.equal(restored.hair, 'long');
});
test('gender is validated before remote or saved avatar data is rendered', () => {
  for (const gender of ['unknown', '<script>', {}, null, 10]) assert.equal(cleanAvatar({ gender }).gender, 'unspecified');
});
test('every gender can retain every outfit and travels to the renderer', () => {
  for (const gender of ['male', 'female', 'unspecified']) for (const outfit of ['longyi', 'htamein', 'taikpon']) {
    const saved = JSON.parse(JSON.stringify({ ...DEFAULT_AVATAR, gender, outfit, head: 'flower' }));
    const avatar = cleanAvatar(saved), look = avatarOpts(avatar);
    assert.equal(look.gender, gender);
    assert.equal(look.outfit, outfit);
    assert.equal(look.head, 'flower');
  }
});
