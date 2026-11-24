import test from 'node:test';
import assert from 'node:assert/strict';
import { zoneWeight, rectDist } from '../src/zoneMix.ts';
const ferris = { x: 100, y: 350, w: 640, h: 530 }, carousel = { x: 1060, y: 350, w: 640, h: 530 };
test('a zone is at full volume anywhere inside it', () => {
  assert.equal(zoneWeight(420, 600, ferris), 1);
  assert.equal(zoneWeight(739, 351, ferris), 1);
});
test('a zone fades with distance and goes silent far away', () => {
  const near = zoneWeight(800, 600, ferris), far = zoneWeight(1000, 600, ferris);
  assert.ok(near < 1 && far < near && far > 0);
  assert.equal(zoneWeight(1400, 600, ferris), 0);
  assert.equal(rectDist(740 + 30, 350 - 40, ferris), 50);
});
test('the road between two zones hears both, the middle of one hears only it', () => {
  assert.ok(zoneWeight(900, 600, ferris) > 0.2 && zoneWeight(900, 600, carousel) > 0.2);
  assert.equal(zoneWeight(420, 600, carousel), 0);
});
