/** Heading uses the same X/Z ground plane as the 3D world. Keep facing when stopped. */
export function movementHeading(dx: number, dy: number, previous: number): number {
  return Math.hypot(dx, dy) > .05 ? Math.atan2(dx, dy) : previous;
}
export function turnToward(current: number, target: number, dt: number): number {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + delta * Math.min(1, Math.max(0, dt) * 9);
}
export interface CrowdBody { x: number; y: number; s?: number }
/** Separate pedestrians without moving either one into a booth or through the player. */
export function spaceCrowd<T extends CrowdBody>(crowd: T[], fixed: CrowdBody[], blocked: (x: number, y: number, r: number) => boolean): void {
  for (let pass = 0; pass < 2; pass++) {
    const cells = new Map<string, T[]>();
    for (let i = 0; i < crowd.length; i++) {
      const a = crowd[i], cx = Math.floor(a.x / 30), cy = Math.floor(a.y / 30);
      const move = (dx: number, dy: number) => {
        if (!blocked(a.x + dx, a.y, 7)) a.x += dx;
        if (!blocked(a.x, a.y + dy, 7)) a.y += dy;
      };
      for (const f of fixed) {
        let dx = a.x - f.x, dy = a.y - f.y, d = Math.hypot(dx, dy), min = 14 + 9 * (a.s || 1);
        if (d < min) { if (d < .01) { dx = i % 2 ? 1 : -1; dy = .5; d = Math.hypot(dx, dy); } move(dx / d * (min - d), dy / d * (min - d)); }
      }
      for (let x = cx - 1; x <= cx + 1; x++) for (let y = cy - 1; y <= cy + 1; y++) {
        for (const b of cells.get(`${x}:${y}`) || []) {
          let dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy), min = 11 * ((a.s || 1) + (b.s || 1));
          if (d >= min) continue;
          if (d < .01) { dx = i % 2 ? 1 : -1; dy = .3; d = Math.hypot(dx, dy); }
          const push = (min - d) * .55, px = dx / d * push, py = dy / d * push;
          move(px, py);
          if (!blocked(b.x - px, b.y, 7)) b.x -= px;
          if (!blocked(b.x, b.y - py, 7)) b.y -= py;
        }
      }
      const key = `${Math.floor(a.x / 30)}:${Math.floor(a.y / 30)}`;
      const cell = cells.get(key) || []; cell.push(a); cells.set(key, cell);
    }
  }
}
