import Peer, { DataConnection } from 'peerjs';

type Presence = Record<string, unknown>;
type Guest = { peer: string; kind: 'viewer'; presence: Presence; sameTab: boolean };
const text = (v: unknown, max: number) => typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, max) : '';
// Everyone who opens the game joins one public fair. Whoever holds the fair's well-known id relays everyone's state;
// when they leave, the others race to take it over. A full fair spills into the next one.
const PUBLIC = (n: number) => `ykn-public-fair-v1-${n}`;
const SHARDS = 4, PUBLIC_MAX = 12, ROOM_MAX = 8;
const WW = 2500, WH = 2600;

/** WebRTC multiplayer: a shared public fair, plus small invitation-only rooms for friends. The host relays state; no chat history is stored. */
export function friends(onPeers: (peers: Guest[]) => void, onStatus?: (s: string) => void) {
  let peer: Peer | null = null, host = false, self = '', last: Presence = {}, active = false;
  let mode: 'off' | 'public' | 'room' = 'off', shard = 0, max = ROOM_MAX;
  let timer: ReturnType<typeof setTimeout>, retry: ReturnType<typeof setTimeout>, flushT: ReturnType<typeof setTimeout> | null = null;
  const links = new Map<string, DataConnection>(), states = new Map<string, Presence>(), chatAt = new Map<string, number>();
  const panel = document.createElement('section'); panel.id = 'friends'; panel.hidden = true;
  panel.innerHTML = `<header><b>Players · ကစားသူများ</b><button type="button" id="friendsClose" aria-label="Close">×</button></header>
    <p id="roomStatus" role="status">Joining the public fair…</p>
    <p class="muted">Everyone playing right now shares the public fair. Want a private one? Create a room and send your friends the link (up to 8 players).</p>
    <div class="roomActions"><button id="roomCreate">Create private room</button><input id="roomCode" aria-label="Room code" placeholder="Room code" maxlength="60" autocapitalize="none"><button id="roomJoin">Join</button><button id="roomLeave" hidden>Back to the public fair</button></div>
    <input id="roomLink" aria-label="Share this room link" readonly hidden><button id="roomCopy" hidden>Copy invite link</button>
    <p class="muted">Some school or office networks block direct connections. Rides and tickets are your own. Be kind in chat.</p>
    <ol id="fChatLog" hidden aria-label="Room conversation" aria-live="polite"></ol>
    <form id="fChatForm" hidden><input id="fChatText" lang="my" aria-label="Message in Myanmar or English" placeholder="မင်္ဂလာပါ — say hello" maxlength="240" autocomplete="off"><button id="fChatSend" disabled>Send</button></form>`;
  document.body.append(panel);
  const get = <T extends HTMLElement>(id: string) => panel.querySelector<T>('#' + id)!;
  const status = (s: string) => { get('roomStatus').textContent = s; onStatus?.(s); };
  function line(name: string, message: string) {
    const li = document.createElement('li'); const b = document.createElement('b'); b.textContent = name + ': ';
    li.append(b, document.createTextNode(message)); get('fChatLog').append(li);
    while (get('fChatLog').children.length > 50) get('fChatLog').firstChild!.remove();
  }
  function send(c: DataConnection, msg: unknown) { if (c.open) try { c.send(msg); } catch { /* connection close follows */ } }
  function count() { return [...states.values()].filter(p => typeof p.x === 'number').length || 1; }
  function describe() {
    if (mode === 'public' && active) status(`Public fair: ${count()} playing now${host ? ' (you are keeping it running)' : ''}.`);
    else if (mode === 'room' && active) status(host ? 'Private room open. Share your invite link.' : 'Connected to your friend’s room.');
  }
  function peers() { onPeers([...states].filter(([id]) => id !== self).map(([id, p]) => ({ peer: id, kind: 'viewer', presence: p, sameTab: false }))); }
  function snapshot() { // batched so a busy fair sends at most about ten updates a second
    peers(); describe();
    if (flushT) return;
    flushT = setTimeout(() => { flushT = null; const msg = { type: 'snapshot', entries: [...states] }; for (const c of links.values()) send(c, msg); }, 90);
  }
  function leave(quiet = false) {
    clearTimeout(timer); clearTimeout(retry); if (flushT) { clearTimeout(flushT); flushT = null; }
    const old = peer; peer = null; old?.destroy(); links.clear(); states.clear(); chatAt.clear(); self = ''; active = false; host = false; peers();
    get<HTMLButtonElement>('fChatSend').disabled = true;
    get('roomLink').hidden = get('roomCopy').hidden = true;
    get<HTMLButtonElement>('roomCreate').disabled = get<HTMLButtonElement>('roomJoin').disabled = false;
    if (!quiet) status('Offline.');
  }
  function presence(raw: unknown): Presence | null {
    if (!raw || typeof raw !== 'object') return null;
    const p = raw as Presence;
    if (typeof p.x !== 'number' || typeof p.y !== 'number' || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return {};
    return { x: Math.max(0, Math.min(WW, p.x)), y: Math.max(0, Math.min(WH, p.y)), n: text(p.n, 28), av: p.av,
      f: p.f === -1 ? -1 : 1, w: text(p.w, 12), b: text(p.b, 12), wv: typeof p.wv === 'number' ? p.wv : 0, dn: p.dn === 1 ? 1 : 0,
      h: typeof p.h === 'number' && Number.isFinite(p.h) ? p.h : 0,
      say: p.say && typeof p.say === 'object' && typeof (p.say as Presence).i === 'number' ? { i: (p.say as Presence).i, t: text((p.say as Presence).t, 120) } : undefined };
  }
  /** Public fair: try again soon (someone else may be taking over as host). */
  function rejoin(ms: number) { clearTimeout(retry); retry = setTimeout(() => { if (mode === 'public') joinPublic(shard); }, ms); }
  function receive(c: DataConnection, raw: unknown) {
    if (!raw || typeof raw !== 'object') return;
    const m = raw as any;
    if (host && m.type === 'presence') { const p = presence(m.value); if (p) { states.set(c.peer, p); snapshot(); } }
    else if (!host && m.type === 'snapshot' && Array.isArray(m.entries) && m.entries.length <= PUBLIC_MAX + 2) {
      states.clear(); for (const entry of m.entries) { if (!Array.isArray(entry)) continue; const [id, value] = entry, p = presence(value); if (typeof id === 'string' && p) states.set(id, p); } peers(); describe();
    } else if (m.type === 'chat') {
      if (host) {
        if (Date.now() - (chatAt.get(c.peer) || 0) < 1000) return;
        chatAt.set(c.peer, Date.now()); const body = text(m.text, 240).trim(); if (!body) return;
        const name = text(states.get(c.peer)?.n, 28) || 'Player'; line(name, body);
        for (const link of links.values()) send(link, { type: 'chat', name, text: body });
      } else { const body = text(m.text, 240); if (body) line(text(m.name, 28) || 'Player', body); }
    } else if (!host && m.type === 'full') {
      if (mode === 'public' && shard + 1 < SHARDS) { leave(true); joinPublic(shard + 1); }
      else { leave(); status(mode === 'public' ? 'Every public fair is full right now. You are exploring on your own.' : 'This room is full (8 players).'); }
    }
  }
  function attach(c: DataConnection) {
    const owner = peer;
    if (host && links.size >= max - 1) { c.on('open', () => { send(c, { type: 'full' }); setTimeout(() => c.close(), 200); }); return; }
    links.set(c.peer, c);
    c.on('open', () => {
      if (peer !== owner) return;
      clearTimeout(timer); active = true; get<HTMLButtonElement>('fChatSend').disabled = false;
      if (host) snapshot(); else { send(c, { type: 'presence', value: last }); describe(); }
    });
    c.on('data', m => { if (peer === owner) receive(c, m); });
    c.on('close', () => {
      if (peer !== owner) return; links.delete(c.peer); states.delete(c.peer);
      if (host) snapshot();
      else if (mode === 'public') { leave(true); status('The fair’s host left. Reconnecting…'); rejoin(300 + Math.random() * 2500); }
      else { leave(); status('The host left. Create or join another room, or go back to the public fair.'); }
    });
    c.on('error', () => { if (peer !== owner) return; c.close(); });
  }
  function becomeHost(instance: Peer, id: string) {
    self = id; host = true; active = true; clearTimeout(timer); states.set(self, last); get<HTMLButtonElement>('fChatSend').disabled = false;
    instance.on('connection', c => { if (peer === instance) attach(c); else c.close(); });
    if (mode === 'room') {
      const url = new URL(location.href); url.searchParams.set('room', id);
      get<HTMLInputElement>('roomLink').value = url.href; get('roomLink').hidden = get('roomCopy').hidden = false;
    }
    snapshot();
  }
  /** Joins public fair number n: connect to whoever holds it, or take it over when nobody does. */
  function joinPublic(n: number) {
    leave(true); mode = 'public'; shard = n; max = PUBLIC_MAX; get('roomLeave').hidden = true;
    status('Joining the public fair…');
    const instance = new Peer(); peer = instance;
    timer = setTimeout(() => { if (!active && peer === instance) { leave(true); status('Could not reach the public fair. Trying again…'); rejoin(15000); } }, 20000);
    instance.on('open', id => { if (peer !== instance) return; self = id; attach(instance.connect(PUBLIC(n), { reliable: true })); });
    instance.on('error', (e: { type?: string }) => {
      if (peer !== instance) return;
      if (e.type === 'peer-unavailable') claimPublic(n); // nobody is hosting this fair yet
      else { leave(true); status('Connection trouble. Trying again…'); rejoin(8000 + Math.random() * 4000); }
    });
  }
  function claimPublic(n: number) {
    leave(true); mode = 'public'; shard = n; max = PUBLIC_MAX;
    const instance = new Peer(PUBLIC(n)); peer = instance;
    timer = setTimeout(() => { if (!active && peer === instance) { leave(true); rejoin(10000); } }, 20000);
    instance.on('open', id => { if (peer === instance) becomeHost(instance, id); });
    instance.on('error', (e: { type?: string }) => {
      if (peer !== instance) return;
      leave(true); rejoin(e.type === 'unavailable-id' ? 400 + Math.random() * 1200 : 8000); // someone else just took it: join them
    });
    instance.on('disconnected', () => { if (peer === instance) instance.reconnect(); }); // keep relaying; just re-register the id
  }
  function startRoom(code?: string) {
    leave(true); mode = 'room'; max = ROOM_MAX; const instance = code ? new Peer() : new Peer('ykn-' + crypto.randomUUID()); peer = instance;
    status('Connecting…'); get('roomLeave').hidden = false;
    get<HTMLButtonElement>('roomCreate').disabled = get<HTMLButtonElement>('roomJoin').disabled = true;
    timer = setTimeout(() => { if (!active) { leave(); status('Could not connect. Check the code or try another network.'); } }, 20000);
    instance.on('open', id => { if (peer !== instance) return; if (!code) becomeHost(instance, id); else { self = id; attach(instance.connect(code, { reliable: true })); } });
    instance.on('error', () => { if (peer !== instance) return; leave(); status('Room unavailable. Check the invite or create a new room.'); });
    instance.on('disconnected', () => { if (peer === instance) instance.reconnect(); });
  }
  get('roomCreate').onclick = () => startRoom();
  get('roomLeave').onclick = () => joinPublic(0);
  get('roomJoin').onclick = () => { const value = get<HTMLInputElement>('roomCode').value.trim(); if (/^ykn-[a-z0-9-]{1,50}$/i.test(value)) startRoom(value); else status('Paste the room code from your friend’s invite link.'); };
  get('friendsClose').onclick = () => { panel.hidden = true; };
  get('roomCopy').onclick = async () => { try { await navigator.clipboard.writeText(get<HTMLInputElement>('roomLink').value); status('Invite copied. Send it to your friends.'); } catch { get<HTMLInputElement>('roomLink').select(); status('Select and copy the invite link above.'); } };
  let sentAt = 0;
  get<HTMLFormElement>('fChatForm').onsubmit = e => {
    e.preventDefault(); const input = get<HTMLInputElement>('fChatText'), body = text(input.value, 240).trim();
    if (!active || !body || Date.now() - sentAt < 1000) return; sentAt = Date.now(); input.value = '';
    const name = text(last.n, 28) || 'Player';
    if (host) { line(name, body); for (const c of links.values()) send(c, { type: 'chat', name, text: body }); }
    else for (const c of links.values()) send(c, { type: 'chat', text: body });
  };
  panel.addEventListener('keydown', e => e.stopPropagation());
  const invite = new URLSearchParams(location.search).get('room');
  if (invite && /^ykn-[a-z0-9-]{1,50}$/i.test(invite)) { get<HTMLInputElement>('roomCode').value = invite; startRoom(invite); }
  else joinPublic(0);
  return {
    get id() { return self; },
    get isPublic() { return mode === 'public'; },
    open() { panel.hidden = !panel.hidden; },
    presence(value: Presence) {
      last = value;
      if (active) { if (host) { states.set(self, value); snapshot(); } else for (const c of links.values()) send(c, { type: 'presence', value }); }
      return Promise.resolve();
    },
  };
}
