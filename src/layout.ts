// The fair's floor plan. Positions are in map units (the minimap and collisions use them);
// the 3D world converts them with M = 1/20 (so 20 map units = 1 metre).
import { srng } from './util';

export const M = 1 / 20;
export const WW = 1800, WH = 2600, NORTH = 340;
export const ROAD = { x: 760, w: 280 };

export interface Zone { id: string; n: number; name: string; my: string; x: number; y: number; w: number; h: number; g: string; card: string }
export const ZONES: Zone[] = [
  { id: 'ferris', n: 1, name: 'Ferris Wheel', my: 'ချားရဟတ်', x: 100, y: 350, w: 640, h: 530, g: '#2b2238',
    card: 'From the top car the whole fair becomes a field of lights, and the Shwedagon glows gold beyond the rooftops.' },
  { id: 'carousel', n: 2, name: 'Carousel', my: 'မြင်းစီးချားရဟတ်', x: 1060, y: 350, w: 640, h: 530, g: '#2d2133',
    card: 'Painted horses rise and fall to the music. Grandparents wave every time the children come round.' },
  { id: 'food', n: 3, name: 'Food Street', my: 'စားသောက်တန်း', x: 100, y: 900, w: 640, h: 520, g: '#30252c',
    card: 'Steam from mohinga pots, the hiss of mont lin ma yar pans, and a sugarcane queue that never ends.' },
  { id: 'pirate', n: 4, name: 'Pirate Ship', my: 'ပင်လယ်ဓားပြသင်္ဘော', x: 1060, y: 900, w: 640, h: 520, g: '#26243a',
    card: 'The ship swings higher on every pass. The back row screams loudest, every single time.' },
  { id: 'games', n: 5, name: 'Game Booths', my: 'ကစားပွဲဆိုင်များ', x: 100, y: 1440, w: 640, h: 520, g: '#2b2234',
    card: 'Ring toss and balloon darts. Win tickets, then trade them for a prize to carry home.' },
  { id: 'kids', n: 6, name: 'Kids Corner', my: 'ကလေးကစားကွင်း', x: 1060, y: 1440, w: 640, h: 520, g: '#22283a',
    card: 'A little train toots around its track while toy sellers twirl tumbling dolls and paper fans.' },
  { id: 'music', n: 7, name: 'Music + Photo', my: 'ဂီတနှင့် ဓာတ်ပုံ', x: 100, y: 1980, w: 640, h: 460, g: '#2e2131',
    card: 'A saing waing ensemble shares the stage with a pop singer, and somebody always starts dancing.' },
  { id: 'finale', n: 8, name: 'Finale View', my: 'မီးပန်းကြည့်ရှုရာ', x: 1060, y: 1980, w: 640, h: 460, g: '#1f2236',
    card: 'The best seat in the fair for fireworks blooming over the city skyline.' },
];

// rides and landmarks
export const FW = { cx: 420, cy: 560, R: 170 };          // Ferris wheel (cy is the base line in map units)
export const CR = { cx: 1380, cy: 640 };                  // carousel
export const PS = { px: 1380, py: 1130 };                 // pirate ship
export const TR = { cx: 1380, cy: 1650, rx: 210, ry: 110 }; // mini train track
export const ST = { x: 360, y: 2110 };                    // music stage
export const FV = { x: 1380, y: 2150 };                   // finale deck
export const PHOTO = { x: 625, y: 2300 };
export const TOYS_AT = { x: 1590, y: 1920 };
export const ARCH_Y = 2475;
export const UNCLE = { x: 1120, y: 2520 };

export interface Snack { id: string; name: string; my: string; p: number; col: string; d: string }
export const SNACKS: Snack[] = [
  { id: 'mohinga', name: 'Mohinga', my: 'မုန့်ဟင်းခါး', p: 1000, col: '#c2543a', d: 'Fish noodle soup with crispy fritters, Yangon’s breakfast that tastes even better at night.' },
  { id: 'mlmy', name: 'Mont lin ma yar', my: 'မုန့်လင်မယား', p: 500, col: '#d9932b', d: 'The “husband and wife” snack: two crispy halves pressed together.' },
  { id: 'shweyinaye', name: 'Shwe yin aye', my: 'ရွှေရင်အေး', p: 1200, col: '#3f9f8a', d: 'Coconut milk, sago and jelly over shaved ice.' },
  { id: 'laphet', name: 'Laphet thoke', my: 'လက်ဖက်သုပ်', p: 1000, col: '#5f7b2d', d: 'Pickled tea leaf salad with crunchy fried beans.' },
  { id: 'kyan', name: 'Sugarcane juice', my: 'ကြံရည်', p: 600, col: '#8aa63a', d: 'Pressed fresh through the roller while you wait.' },
  { id: 'bbq', name: 'Barbecue skewers', my: 'အကင်', p: 800, col: '#a03a2a', d: 'Grilled sticks in the style of 19th Street in Chinatown.' },
];
export const CARTS: Array<[number, number]> = [[250, 1030], [430, 1030], [610, 1030], [250, 1290], [430, 1290], [610, 1290]];
export const TEA_TABLES: Array<[number, number]> = [[180, 1160], [290, 1165], [400, 1158], [510, 1166], [620, 1162]];

export type BoothKind = 'ring' | 'darts' | 'prize';
export const BOOTHS: Array<{ x: number; y: number; kind: BoothKind; my: string; en: string }> = [
  { x: 270, y: 1590, kind: 'ring', my: 'ကွင်းပစ်', en: 'RING TOSS' },
  { x: 570, y: 1590, kind: 'darts', my: 'မြှားပစ်', en: 'BALLOON DARTS' },
  { x: 420, y: 1870, kind: 'prize', my: 'ဆုများ', en: 'PRIZES' },
];

export interface Secret { id: string; x: number; y: number; name: string; d: string }
export const SECRETS: Secret[] = [
  { id: 'cat', x: 410, y: 1186, name: 'Sleeping cat', d: 'Under the tea-shop stools, a ginger cat sleeps through the whole festival.' },
  { id: 'slipper', x: 990, y: 1720, name: 'A lost slipper', d: 'One blue rubber slipper on the road. Somebody is hopping home tonight.' },
  { id: 'saika', x: 1210, y: 2490, name: 'Parked trishaw', d: 'A sidecar trishaw, a saika, waits by the gate for the late crowd heading home.' },
  { id: 'parrot', x: 700, y: 1935, name: 'Fortune parrot', d: 'A green parrot picks a folded card for you. It says: a lucky night ahead.' },
  { id: 'kite', x: 1560, y: 362, name: 'Kite on the fence', d: 'A paper kite is tangled on the lakeside fence, its tail still dancing in the breeze.' },
  { id: 'quail', x: 742, y: 1432, name: 'Quail-egg grandma', d: 'An old lady sells quail eggs from a basket by lamplight and remembers every regular.' },
];

export const STRINGS: number[] = []; for (let y = 470; y <= 2370; y += 140) STRINGS.push(y);
export const TREES: Array<[number, number]> = (() => {
  const r = srng(3), spots: Array<[number, number]> = [];
  for (let y = 420; y < WH - 60; y += 150) { spots.push([62 + r() * 16, y + r() * 40]); spots.push([WW - 62 - r() * 16, y + r() * 40]); }
  return spots;
})();

// people standing at their posts
export interface Post { x: number; y: number; hat?: boolean; seed: number }
export const VENDOR_POSTS: Post[] = [
  ...CARTS.map(([x, y], i) => ({ x, y: y - 52, hat: i % 2 === 0, seed: i })),
  ...BOOTHS.map((b, i) => ({ x: b.x, y: b.y - 46, seed: 10 + i })),
  { x: 1590, y: 1860, hat: true, seed: 20 },
];

// where the crowd likes to stop
export const STALLFRONTS: Array<{ x: number; y: number }> = [
  ...CARTS.map(([x, y]) => ({ x, y: y + 20 })), ...BOOTHS.map(b => ({ x: b.x, y: b.y + 24 })), { x: 1590, y: 1945 },
];

// solid things you cannot walk through
export const COL: Array<{ x: number; y: number; w: number; h: number }> = [];
const addCol = (x: number, y: number, w: number, h: number) => COL.push({ x, y, w, h });
TREES.forEach(([x, y]) => addCol(x - 10, y - 8, 20, 16));
addCol(FW.cx - 145, FW.cy + 190, 290, 50); addCol(560, 795, 60, 30);
addCol(CR.cx - 160, CR.cy - 160, 320, 300);
addCol(PS.px - 150, PS.py - 40, 300, 80);
CARTS.forEach(([x, y]) => addCol(x - 62, y - 34, 124, 36));
BOOTHS.forEach(b => addCol(b.x - 100, b.y - 48, 200, 50));
addCol(1530, 1885, 120, 36);
addCol(ST.x - 175, ST.y - 80, 350, 90);
addCol(590, 2255, 70, 45);
addCol(770, 2465, 24, 12); addCol(1006, 2465, 24, 12);
addCol(1184, 2478, 52, 16);

export function blocked(x: number, y: number, r: number): boolean {
  if (x < 40 + r || x > WW - 40 - r || y < NORTH + 8 + r || y > WH - 14 - r) return true;
  for (const b of COL) if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
  return false;
}
export function trackPos(u: number): [number, number] { return [TR.cx + Math.cos(u) * TR.rx, TR.cy + Math.sin(u) * TR.ry]; }
