import test from 'node:test';
import assert from 'node:assert/strict';
import { movementHeading, turnToward, spaceCrowd } from '../src/motion.ts';
test('walkers face north, south, east and west rather than the camera', () => {
  assert.equal(movementHeading(0, -10, 0), Math.PI);
  assert.equal(movementHeading(0, 10, Math.PI), 0);
  assert.equal(movementHeading(10, 0, 0), Math.PI / 2);
  assert.equal(movementHeading(-10, 0, 0), -Math.PI / 2);
  assert.equal(movementHeading(0, 0, 2.1), 2.1);
});
test('turns cross the angle boundary by the short route', () => {
  const a = Math.PI - .1, b = -Math.PI + .1;
  assert.ok(turnToward(a, b, .03) > a);
});
test('coincident visitors separate and keep clear of the player', () => {
  const crowd = [{ x: 0, y: 0 }, { x: 0, y: 0 }];
  for (let i = 0; i < 20; i++) spaceCrowd(crowd, [{ x: 0, y: 0 }], () => false);
  assert.ok(Math.hypot(crowd[0].x - crowd[1].x, crowd[0].y - crowd[1].y) >= 21);
  for (const n of crowd) assert.ok(Math.hypot(n.x, n.y) >= 22);
});
test('separation respects booth walls', () => {
  const crowd = [{ x: 2, y: 10 }, { x: 3, y: 10 }];
  spaceCrowd(crowd, [], x => x < 0);
  assert.ok(crowd.every(n => n.x >= 0));
});
