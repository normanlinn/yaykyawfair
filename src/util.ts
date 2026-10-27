// Shared math and canvas drawing helpers.
export type Ctx = CanvasRenderingContext2D;

export const TAU = Math.PI * 2;
export const rand = (a: number, b: number): number => a + Math.random() * (b - a);
export const pick = <T>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)];
export const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Small seeded PRNG (mulberry32) so the skyline and decor look the same every visit. */
export function srng(seed: number): () => number {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rr(c: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  c.beginPath();
  if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h);
}
export function el(c: Ctx, x: number, y: number, rx: number, ry: number): void {
  c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, TAU); c.fill();
}
export function circ(c: Ctx, x: number, y: number, r: number): void {
  c.beginPath(); c.arc(x, y, Math.max(0.1, r), 0, TAU); c.fill();
}
export function ln(c: Ctx, x1: number, y1: number, x2: number, y2: number): void {
  c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
}
export const ks = (n: number): string => n.toLocaleString('en-US') + ' Ks';
export function hexA(h: string, a: number): string {
  const n = parseInt(h.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

export const MMF = '"Pyidaungsu","Padauk","Myanmar Text","Noto Sans Myanmar",sans-serif';
export const DISP = '"Bungee","Arial Black",sans-serif';
export const BODY = '"Brandon Text","Baloo 2","Pyidaungsu","Padauk","Trebuchet MS",sans-serif';

export const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;
