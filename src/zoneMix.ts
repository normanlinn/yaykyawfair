// How loud each zone's ambience is from where the player stands. Pure math, no imports, so the tests can load it.

export interface Rect { x: number; y: number; w: number; h: number }

/** Distance from a point to a rectangle (0 when inside). */
export function rectDist(px: number, py: number, r: Rect): number {
  const dx = Math.max(r.x - px, 0, px - (r.x + r.w)), dy = Math.max(r.y - py, 0, py - (r.y + r.h));
  return Math.hypot(dx, dy);
}

/** 0..1: full inside the zone, easing out to silence `fade` map units beyond its edge. */
export function zoneWeight(px: number, py: number, r: Rect, fade = 420): number {
  const k = 1 - rectDist(px, py, r) / fade;
  return k <= 0 ? 0 : k * k;
}
