// Thadingyut wishes (ဆုတောင်း): paper fire balloons in the sky and candle lanterns on the pond.
// On claude.ai every wish is kept in the artifact's shared store, so everyone sees everyone's wishes, forever.
// A deployed copy with the wishes database (api/wishes.js on Vercel) shares them the same way.
// Anywhere else they are kept in this browser.

export type WishKind = 'sky' | 'water';
export interface Wish { id: string; k: WishKind; t: string; n: string; at: number; mine?: boolean }

export const WISH_PRICE: Record<WishKind, number> = { sky: 1000, water: 500 };
export const WISH_MAX_LEN = 80;
const MY_MAX = 50;

/** Wishes already glowing when the fair opens. */
export const SAMPLE_WISHES: Wish[] = [
  { id: 's1', k: 'sky', t: 'မိသားစု ကျန်းမာချမ်းသာပါစေ', n: 'မနှင်း', at: 0 },
  { id: 's2', k: 'sky', t: 'စာမေးပွဲ အောင်ပါစေ', n: 'Min Thu', at: 0 },
  { id: 's3', k: 'water', t: 'အမေ အသက်ရာကျော် ရှည်ပါစေ', n: 'Su Su', at: 0 },
  { id: 's4', k: 'sky', t: 'ကမ္ဘာကြီး ငြိမ်းချမ်းပါစေ', n: 'ဦးဘ', at: 0 },
  { id: 's5', k: 'water', t: 'ချစ်သူနဲ့ အမြဲအတူရှိပါရစေ', n: 'Thiri', at: 0 },
  { id: 's6', k: 'sky', t: 'ပြည်ပက မောင်လေး အိမ်ပြန်ရောက်ပါစေ', n: 'Ma Aye', at: 0 },
  { id: 's7', k: 'water', t: 'ဆရာ ဆရာမတွေ ကျန်းမာပါစေ', n: 'Ko Zaw', at: 0 },
  { id: 's8', k: 'sky', t: 'စီးပွားရေး တိုးတက်ပါစေ', n: 'ဒေါ်မြ', at: 0 },
  { id: 's9', k: 'water', t: 'ဘေးရန်ခပ်သိမ်း ကင်းဝေးပါစေ', n: 'Aung Aung', at: 0 },
  { id: 's10', k: 'sky', t: 'သီတင်းကျွတ် ပျော်ရွှင်ကြပါစေ', n: 'Hnin Si', at: 0 },
  { id: 's11', k: 'water', t: 'သူငယ်ချင်းတွေ အမြဲပျော်ရွှင်ပါစေ', n: 'Phyo', at: 0 },
  { id: 's12', k: 'sky', t: 'May everyone get home safe tonight', n: 'Nadi', at: 0 },
  { id: 's13', k: 'water', t: 'ဖေဖေ မြန်မြန် နေကောင်းပါစေ', n: 'May May', at: 0 },
  { id: 's14', k: 'sky', t: 'နောက်နှစ်လည်း ဒီပွဲကို အတူလာနိုင်ပါစေ', n: 'Kyaw Gyi', at: 0 },
];

/** Tap-to-fill ideas in the wish form. */
export const WISH_IDEAS = ['ကျန်းမာပါစေ', 'ချမ်းသာပါစေ', 'စာမေးပွဲ အောင်ပါစေ', 'ငြိမ်းချမ်းပါစေ', 'ချစ်သူနဲ့ အတူရှိပါရစေ', 'မိသားစု ပျော်ရွှင်ပါစေ'];

export function cleanWish(t: unknown): string {
  return typeof t === 'string' ? t.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, WISH_MAX_LEN) : '';
}
function parse(o: unknown, owner: string): Wish | null {
  if (!o || typeof o !== 'object') return null;
  const w = o as Record<string, unknown>, t = cleanWish(w.t);
  if (!t || (w.k !== 'sky' && w.k !== 'water') || typeof w.id !== 'string') return null;
  return { id: owner + ':' + w.id.slice(0, 24), k: w.k, t, n: typeof w.n === 'string' ? w.n.slice(0, 24) : '', at: typeof w.at === 'number' ? w.at : 0 };
}

const WISH_API = 'api/wishes';
async function fetchWishes(): Promise<unknown[] | null> {
  if (location.protocol !== 'http:' && location.protocol !== 'https:') return null;
  try {
    const r = await fetch(WISH_API, { cache: 'no-store' }); if (!r.ok) return null;
    const j = await r.json(); return Array.isArray(j?.wishes) ? j.wishes : null;
  } catch { return null; }
}

type Listener = (all: Wish[], fresh: Wish[]) => void;
interface Store { list: Wish[]; mine: Array<Omit<Wish, 'mine'>>; add(w: Omit<Wish, 'id' | 'at'>): Promise<Wish | 'full' | 'failed'>; shared: boolean }

/** Connects to wherever wishes live and calls back with every wish whenever the set changes. */
export async function openWishes(onChange: Listener): Promise<Store> {
  let mine: Array<Omit<Wish, 'mine'>> = [], others: Wish[] = [];
  const known = new Set<string>();
  const store: Store = { list: [], mine, shared: false, add: async () => 'failed' };
  const emit = (animate = true): void => {
    const ownIds = new Set(mine.map(w => w.id));
    store.list = [...SAMPLE_WISHES, ...others.filter(w => !ownIds.has(w.id)), ...mine.map(w => ({ ...w, mine: true }))];
    const fresh = animate ? store.list.filter(w => !known.has(w.id)) : [];
    for (const w of store.list) known.add(w.id);
    store.mine = mine; onChange(store.list, fresh);
  };
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  let db: DB | null = null, uid: string | null = null;
  try {
    const [d, u] = await Promise.all([window.claude?.use?.('db'), window.claude?.use?.('user')]);
    db = d || null; uid = u ? await u.id() : null;
  } catch { db = null; }

  if (db && uid) {
    store.shared = true;
    const meKey = 'wishes/' + uid; let firstSnap = true;
    emit(false);
    db.collection('wishes').onSnapshot(snap => {
      const all: Wish[] = [];
      for (const doc of snap.docs) {
        const l = doc.data()?.list; if (!Array.isArray(l)) continue;
        for (const o of l.slice(-MY_MAX)) { const w = parse(o, doc.id); if (w) all.push(w); }
        if (doc.id === uid) mine = all.filter(w => w.id.startsWith(uid + ':'));
      }
      others = all; emit(!firstSnap); firstSnap = false;
    }, () => { /* the store went away; keep what we have */ });
    store.add = async w => {
      if (mine.length >= MY_MAX) return 'full';
      const raw = { id: newId(), k: w.k, t: cleanWish(w.t), n: w.n.slice(0, 24), at: Date.now() };
      const next = [...mine.map(m => ({ id: m.id.slice(uid.length + 1), k: m.k, t: m.t, n: m.n, at: m.at })), raw];
      try { await db.doc(meKey).set({ list: next }); } catch { return 'failed'; }
      const added = { ...raw, id: uid + ':' + raw.id };
      if (!mine.some(m => m.id === added.id)) { mine = [...mine, added]; known.add(added.id); emit(); }
      return added;
    };
    return store;
  }

  // a deployed copy (for example on Vercel) with its own wishes database: see api/wishes.js
  const api = await fetchWishes();
  if (api) {
    store.shared = true;
    let mineIds: string[] = [];
    try { const l = JSON.parse(localStorage.getItem('ykn-wish-mine') || '[]'); if (Array.isArray(l)) mineIds = l.filter(x => typeof x === 'string'); } catch { /* storage unavailable */ }
    const take = (rows: unknown[]): void => {
      const all = rows.map(o => parse(o, 'w')).filter(Boolean) as Wish[];
      mine = all.filter(w => mineIds.includes(w.id)); others = all;
    };
    take(api); emit(false);
    setInterval(async () => { if (document.hidden) return; const rows = await fetchWishes(); if (rows) { take(rows); emit(); } }, 20000);
    store.add = async w => {
      try {
        const r = await fetch(WISH_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ k: w.k, t: cleanWish(w.t), n: w.n.slice(0, 24) }) });
        if (r.status === 429) return 'full';
        if (!r.ok) return 'failed';
        const added = parse((await r.json()).wish, 'w'); if (!added) return 'failed';
        mineIds.push(added.id); try { localStorage.setItem('ykn-wish-mine', JSON.stringify(mineIds.slice(-200))); } catch { /* still shown this visit */ }
        mine = [...mine, added]; known.add(added.id); emit(); return added;
      } catch { return 'failed'; }
    };
    return store;
  }

  // this browser only
  try { const l = JSON.parse(localStorage.getItem('ykn-wishes') || '[]'); if (Array.isArray(l)) mine = l.map(o => parse(o, 'me')).filter(Boolean) as Wish[]; } catch { /* storage unavailable */ }
  store.add = async w => {
    if (mine.length >= MY_MAX) return 'full';
    const added = { id: 'me:' + newId(), k: w.k, t: cleanWish(w.t), n: w.n.slice(0, 24), at: Date.now() };
    mine = [...mine, added]; known.add(added.id);
    try { localStorage.setItem('ykn-wishes', JSON.stringify(mine.map(m => ({ ...m, id: m.id.slice(3) })))); } catch { /* kept for this visit only */ }
    emit(); return added;
  };
  emit(false);
  return store;
}
