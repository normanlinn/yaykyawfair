// The small icon people: one drawing routine shared by the crowd, vendors, riders and the player.
import { Ctx, TAU, el, circ, rr, ln, pick } from './util';

export const SHIRTS = ['#f3efe6', '#f7b7c3', '#9fd3f0', '#b5e6c8', '#f2d49b', '#b84a5e', '#cfc3f2', '#ffffff', '#e98b6d', '#7fc4b4'] as const;
export const LONS = ['#6b2335', '#2f5d50', '#283a6b', '#4b2c63', '#1f6f78', '#5a3a24', '#7a2e5c', '#3c5a2a', '#7b4b1f'] as const;
export const SKINS = ['#d9a77a', '#c58c5c', '#a8714a', '#e4b98f', '#8d5a3b', '#b7835a'] as const;
export const BALLOONS = ['#ff5a4e', '#f4b63f', '#3fc7a5', '#8fb4ff', '#ff8ad8'] as const;

export type Gender = 'male' | 'female' | 'unspecified';
export type Hair = 'short' | 'bun' | 'long';
/** Lower wrap is drawn the same way for everyone; the outfit decides the top and how the wrap falls. */
export type Outfit = 'longyi' | 'htamein' | 'taikpon';
export type Headwear = 'none' | 'gaungbaung' | 'flower' | 'hat' | 'cap';
export type Pattern = 'plain' | 'stripe' | 'check' | 'acheik';

export interface PersonOpts {
  gender?: Gender;
  s?: number; bob?: number; step?: number; t?: number; face?: number;
  shirt: string; lon: string; skin: string;
  pat?: Pattern; hair?: Hair; bun?: boolean; capc?: string; outfit?: Outfit; head?: Headwear; gbc?: string;
  thanaka?: boolean; hat?: boolean; fan?: boolean; flower?: boolean; glasses?: boolean; bag?: boolean;
  balloon?: string | null; armsUp?: boolean; hl?: boolean;
}

/** The player's chosen look. */
export interface Avatar {
  gender: Gender;
  skin: string; hair: Hair; outfit: Outfit; head: Headwear;
  shirt: string; lon: string; pat: Pattern;
  thanaka: boolean; glasses: boolean; bag: boolean;
}
export const DEFAULT_AVATAR: Avatar = {
  gender: 'unspecified',
  skin: '#c58c5c', hair: 'short', outfit: 'longyi', head: 'none', shirt: '#f4b63f', lon: '#7a2e5c', pat: 'check',
  thanaka: true, glasses: false, bag: false,
};
const GENDERS: Gender[] = ['male', 'female', 'unspecified'];
const HAIRS: Hair[] = ['short', 'bun', 'long'];
const OUTFITS: Outfit[] = ['longyi', 'htamein', 'taikpon'];
const HEADS: Headwear[] = ['none', 'gaungbaung', 'flower', 'hat', 'cap'];
const PATS: Pattern[] = ['plain', 'stripe', 'check', 'acheik'];
/** Keeps an avatar received from another player (or old saved settings) to known values. */
export function cleanAvatar(raw: unknown): Avatar {
  const a = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const col = (v: unknown, d: string) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : d);
  const one = <T extends string>(v: unknown, list: T[], d: T): T => (list.includes(v as T) ? (v as T) : d);
  return {
    gender: one(a.gender, GENDERS, 'unspecified'),
    skin: col(a.skin, DEFAULT_AVATAR.skin), hair: one(a.hair, HAIRS, 'short'), outfit: one(a.outfit, OUTFITS, 'longyi'),
    head: one(a.head, HEADS, 'none'), shirt: col(a.shirt, DEFAULT_AVATAR.shirt), lon: col(a.lon, DEFAULT_AVATAR.lon),
    pat: one(a.pat, PATS, 'plain'), thanaka: a.thanaka === true, glasses: a.glasses === true, bag: a.bag === true,
  };
}
export const AV_SHIRTS = ['#f4b63f', '#ffffff', '#ff5a4e', '#f7b7c3', '#9fd3f0', '#3fc7a5', '#cfc3f2', '#2d7bb6', '#1b1420', '#e98b6d'];
export const AV_LONS = ['#7a2e5c', '#6b2335', '#2f5d50', '#283a6b', '#4b2c63', '#1f6f78', '#5a3a24', '#c23b4b', '#3c5a2a'];

/** Distinct starting styles; users can override every field afterward. */
export function genderStartingLook(gender: Gender): Partial<Avatar> {
  if(gender==='male') return {gender,hair:'short',outfit:'longyi',head:'none',pat:'check'};
  if(gender==='female') return {gender,hair:'bun',outfit:'htamein',head:'flower',pat:'acheik'};
  return {gender};
}
/** Silhouette data is independent from clothing choices. */
export function bodyProfile(gender?: Gender) {
  if(gender==='male') return {shoulders:1.02,waist:.82,hip:.83,neck:.25,arm:.2,face:.77};
  if(gender==='female') return {shoulders:.73,waist:.55,hip:.77,neck:.19,arm:.15,face:.67};
  return {shoulders:.86,waist:.71,hip:.8,neck:.22,arm:.17,face:.72};
}

export function avatarOpts(a: Avatar): PersonOpts {
  return {
    gender: a.gender, skin: a.skin, shirt: a.shirt, lon: a.lon, pat: a.pat, hair: a.hair, bun: a.hair === 'bun',
    outfit: a.outfit, head: a.head, thanaka: a.thanaka, glasses: a.glasses, bag: a.bag,
    flower: a.head === 'flower', hat: a.head === 'hat',
    capc: a.shirt === '#c23b4b' || a.shirt === '#ff5a4e' ? '#2d7bb6' : '#c23b4b',
    gbc: a.shirt === '#f7b7c3' ? '#f4b63f' : '#f7b7c3',
  };
}
export function randomAvatar(): Avatar {
  return {
    gender: pick(GENDERS), skin: pick(SKINS), hair: pick(HAIRS), outfit: pick(OUTFITS), head: pick(HEADS), shirt: pick(AV_SHIRTS), lon: pick(AV_LONS),
    pat: pick(PATS), thanaka: Math.random() < 0.6, glasses: Math.random() < 0.2, bag: Math.random() < 0.35,
  };
}

export function person(c: Ctx, x: number, y: number, o: PersonOpts): void {
  const s = o.s || 1, b = o.bob || 0, st = o.step || 0;
  c.fillStyle = 'rgba(0,0,0,.35)'; el(c, x, y, 7 * s, 2.6 * s);
  c.fillStyle = '#1b1420';
  c.fillRect(x - 4 * s + st * s, y - 2.2 * s, 3 * s, 2.2 * s); c.fillRect(x + 1 * s - st * s, y - 2.2 * s, 3 * s, 2.2 * s);
  // longyi
  if (o.outfit === 'htamein') {
    c.fillStyle = o.lon; c.beginPath();
    c.moveTo(x - 4.6 * s, y - 13.5 * s + b); c.lineTo(x + 4.6 * s, y - 13.5 * s + b); c.lineTo(x + 5.8 * s, y - 0.6 * s); c.lineTo(x - 5.8 * s, y - 0.6 * s); c.closePath(); c.fill();
    c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(x - 5.8 * s, y - 2.4 * s, 11.6 * s, 1.6 * s); // dark hem band
  } else { c.fillStyle = o.lon; rr(c, x - 5 * s, y - 13 * s + b, 10 * s, 11.4 * s - b, 2 * s); c.fill(); }
  if (o.pat === 'check') {
    c.fillStyle = 'rgba(0,0,0,.25)'; for (let k = -4; k <= 3; k += 2.5) c.fillRect(x + k * s, y - 13 * s + b, 0.9 * s, 11.4 * s - b);
    c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(x - 5 * s, y - 10.5 * s + b, 10 * s, 0.9 * s); c.fillRect(x - 5 * s, y - 6.5 * s + b, 10 * s, 0.9 * s); c.fillRect(x - 5 * s, y - 3.5 * s + b, 10 * s, 0.9 * s);
  } else if (o.pat === 'acheik') {
    // acheik: the wavy interlocking bands woven into silk longyi and htamein
    c.strokeStyle = 'rgba(255,236,170,.55)'; c.lineWidth = 0.9 * s;
    for (let k = 0; k < 3; k++) { const yy = y - 11 * s + b + k * 3.3 * s; c.beginPath(); c.moveTo(x - 5 * s, yy);
      for (let i = 1; i <= 5; i++) c.lineTo(x - 5 * s + i * 2 * s, yy + (i % 2 ? -1.3 : 1.3) * s); c.stroke(); }
  } else if (o.pat === 'stripe') {
    c.fillStyle = 'rgba(255,255,255,.26)'; for (let k = 0; k < 4; k++) c.fillRect(x - 5 * s, y - 12 * s + b + k * 2.8 * s, 10 * s, 1.1 * s);
  } else {
    c.fillStyle = 'rgba(255,255,255,.16)'; c.fillRect(x - 5 * s, y - 8.5 * s + b, 10 * s, 1.1 * s); c.fillRect(x - 5 * s, y - 5.5 * s + b, 10 * s, 0.8 * s);
  }
  // long hair sits behind the shoulders
  if (o.hair === 'long') { c.fillStyle = '#17101a'; rr(c, x - 5.8 * s, y - 30 * s + b, 11.6 * s, 13 * s, 3 * s); c.fill(); }
  // shirt
  if (o.outfit === 'taikpon') {
    // white collarless shirt under the short taikpon jacket
    c.fillStyle = '#f7f3ea'; rr(c, x - 6 * s, y - 22.5 * s + b, 12 * s, 10.5 * s, 4 * s); c.fill();
    c.fillStyle = o.shirt; rr(c, x - 6.4 * s, y - 22.5 * s + b, 5.4 * s, 10 * s, 3 * s); c.fill(); rr(c, x + 1 * s, y - 22.5 * s + b, 5.4 * s, 10 * s, 3 * s); c.fill();
    c.fillStyle = 'rgba(255,255,255,.75)'; for (let k = 0; k < 3; k++) circ(c, x + 1.6 * s, y - 20 * s + b + k * 2.6 * s, 0.55 * s);
  } else if (o.outfit === 'htamein') {
    // fitted eingyi blouse
    c.fillStyle = o.shirt; rr(c, x - 5.4 * s, y - 22.5 * s + b, 10.8 * s, 9.6 * s, 3.6 * s); c.fill();
    c.fillStyle = 'rgba(255,255,255,.3)'; c.fillRect(x - 0.5 * s, y - 22 * s + b, 1 * s, 8 * s);
  } else { c.fillStyle = o.shirt; rr(c, x - 6 * s, y - 22.5 * s + b, 12 * s, 10.5 * s, 4 * s); c.fill(); }
  if (o.bag) {
    c.strokeStyle = '#c23b4b'; c.lineWidth = 1.2 * s; ln(c, x - 4 * s, y - 22 * s + b, x + 5 * s, y - 12 * s + b);
    c.fillStyle = '#c23b4b'; rr(c, x + 3 * s, y - 13 * s + b, 6 * s, 6.5 * s, 1 * s); c.fill();
    c.fillStyle = 'rgba(255,230,160,.6)'; c.fillRect(x + 3 * s, y - 11 * s + b, 6 * s, 0.9 * s); c.fillRect(x + 3 * s, y - 9 * s + b, 6 * s, 0.6 * s);
  }
  if (o.armsUp) {
    c.strokeStyle = o.shirt; c.lineWidth = 2.6 * s; c.lineCap = 'round';
    const w = Math.sin((o.t || 0) * 8) * 2 * s;
    ln(c, x - 5 * s, y - 20 * s + b, x - 8 * s - w, y - 30 * s + b); ln(c, x + 5 * s, y - 20 * s + b, x + 8 * s + w, y - 30 * s + b);
  }
  // head
  c.fillStyle = o.skin; circ(c, x, y - 27.5 * s + b, 5.3 * s);
  c.fillStyle = '#17101a';
  c.beginPath(); c.arc(x, y - 28.3 * s + b, 5.4 * s, Math.PI * 1.02, Math.PI * 1.98); c.fill();
  if (o.bun) circ(c, x + (o.face || 0) * -3 * s, y - 33 * s + b, 2.4 * s);
  if (o.head === 'gaungbaung') {
    // gaung baung: wrapped silk headdress with its knot flaring to one side
    c.fillStyle = o.gbc || '#f7b7c3';
    c.beginPath(); c.arc(x, y - 28.6 * s + b, 5.9 * s, Math.PI * 0.95, Math.PI * 2.05); c.fill();
    c.fillRect(x - 5.9 * s, y - 29.5 * s + b, 11.8 * s, 2.2 * s);
    c.beginPath(); c.moveTo(x + 3 * s, y - 31 * s + b); c.lineTo(x + 9 * s, y - 35.5 * s + b); c.lineTo(x + 6.5 * s, y - 29.5 * s + b); c.fill();
    c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(x - 5.6 * s, y - 30.6 * s + b, 11.2 * s, 0.7 * s);
  }
  if (o.head === 'cap' || o.hair === ('cap' as Hair)) {
    c.fillStyle = o.capc || '#c23b4b';
    c.beginPath(); c.arc(x, y - 28.6 * s + b, 5.7 * s, Math.PI, 0); c.fill();
    c.fillRect(x - 7.5 * s, y - 29.2 * s + b, 15 * s, 1.5 * s);
  }
  if (o.thanaka && s >= 1.5) { c.fillStyle = 'rgba(240,222,170,.7)'; el(c, x - 2.8 * s, y - 25.6 * s + b, 1.2 * s, 0.85 * s); el(c, x + 2.8 * s, y - 25.6 * s + b, 1.2 * s, 0.85 * s); }
  if (o.glasses) {
    c.fillStyle = '#0b0b10'; c.fillRect(x - 4.4 * s, y - 28.4 * s + b, 3.6 * s, 2.2 * s); c.fillRect(x + 0.8 * s, y - 28.4 * s + b, 3.6 * s, 2.2 * s);
    c.fillRect(x - 1 * s, y - 27.9 * s + b, 2 * s, 0.6 * s);
  }
  if (o.flower) { c.fillStyle = '#ffd23f'; circ(c, x + 4.6 * s, y - 31.5 * s + b, 1.9 * s); c.fillStyle = '#ff5a4e'; circ(c, x + 4.6 * s, y - 31.5 * s + b, 0.8 * s); }
  if (o.hat) { c.fillStyle = '#c9a46a'; el(c, x, y - 31 * s + b, 10 * s, 3.2 * s); c.beginPath(); c.moveTo(x - 5 * s, y - 31 * s + b); c.lineTo(x, y - 37 * s + b); c.lineTo(x + 5 * s, y - 31 * s + b); c.fill(); }
  if (o.fan) { c.fillStyle = '#e9c46a'; c.beginPath(); c.moveTo(x + 7 * s, y - 16 * s + b); c.arc(x + 7 * s, y - 16 * s + b, 6 * s, -2.2, -0.9); c.fill(); }
  if (o.balloon) {
    const bx = x + 9 * s + Math.sin((o.t || 0) * 1.7) * 2 * s, by = y - 50 * s + b;
    c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 0.8; ln(c, x + 6 * s, y - 17 * s + b, bx, by + 7 * s);
    c.fillStyle = o.balloon; el(c, bx, by, 5.2 * s, 6.6 * s);
    c.fillStyle = 'rgba(255,255,255,.45)'; el(c, bx - 1.8 * s, by - 2.4 * s, 1.3 * s, 2 * s);
  }
  if (o.hl) {
    c.strokeStyle = 'rgba(244,182,63,.95)'; c.lineWidth = 1.6;
    c.beginPath(); c.ellipse(x, y, 10 * s, 4 * s, 0, 0, TAU); c.stroke();
    const ay = y - 44 * s + b + Math.sin((o.t || 0) * 4) * 2;
    c.fillStyle = '#f4b63f'; c.beginPath(); c.moveTo(x - 4 * s, ay - 5 * s); c.lineTo(x + 4 * s, ay - 5 * s); c.lineTo(x, ay); c.fill();
  }
}
