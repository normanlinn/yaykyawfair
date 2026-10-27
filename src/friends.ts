import Peer, { DataConnection } from 'peerjs';

type Presence = Record<string, unknown>;
type Guest = { peer: string; kind: 'viewer'; presence: Presence; sameTab: boolean };
const text = (v: unknown, max: number) => typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, max) : '';
/** Small, invitation-only WebRTC rooms. The host relays state; no chat history is stored. */
export function friends(onPeers: (peers: Guest[]) => void) {
  let peer: Peer | null = null, host = false, self = '', last: Presence = {}, active = false;
  let timer: ReturnType<typeof setTimeout>;
  const links = new Map<string, DataConnection>(), states = new Map<string, Presence>(), chatAt = new Map<string, number>();
  const panel = document.createElement('section'); panel.id = 'friends'; panel.hidden = true;
  panel.innerHTML = `<header><b>Friends · သူငယ်ချင်းများ</b><button type="button" id="friendsClose" aria-label="Close friends">×</button></header>
    <p id="roomStatus" role="status">Create a room or join a friend's link. Up to 8 players. Chat with T once you are connected.</p>
    <div class="roomActions"><button id="roomCreate">Create room</button><input id="roomCode" aria-label="Room code" placeholder="Room code" maxlength="60" autocapitalize="none"><button id="roomJoin">Join</button><button id="roomLeave" hidden>Leave</button></div>
    <input id="roomLink" aria-label="Share this room link" readonly hidden><button id="roomCopy" hidden>Copy invite link</button>
    <p class="muted">The host must stay online. Invite trusted friends; anyone with the link can join. Some networks block direct connections. Rides and tickets are individual.</p>
    <ol id="fChatLog" hidden aria-label="Room conversation" aria-live="polite"></ol>
    <form id="fChatForm" hidden><input id="fChatText" lang="my" aria-label="Message in Myanmar or English" placeholder="မင်္ဂလာပါ — say hello" maxlength="240" autocomplete="off"><button id="fChatSend" disabled>Send</button></form>`;
  document.body.append(panel);
  const get = <T extends HTMLElement>(id: string) => panel.querySelector<T>('#' + id)!;
  const status = (s: string) => { get('roomStatus').textContent = s; };
  function line(name: string, message: string) {
    const li = document.createElement('li'); const b = document.createElement('b'); b.textContent = name + ': ';
    li.append(b, document.createTextNode(message)); get('fChatLog').append(li);
    while (get('fChatLog').children.length > 50) get('fChatLog').firstChild!.remove();
    li.scrollIntoView({ block: 'nearest' });
  }
  function send(c: DataConnection, msg: unknown) { if (c.open) try { c.send(msg); } catch { /* connection close follows */ } }
  function peers() { onPeers([...states].filter(([id]) => id !== self).map(([id, p]) => ({ peer: id, kind: 'viewer', presence: p, sameTab: false }))); }
  function snapshot() { peers(); const msg = { type: 'snapshot', entries: [...states] }; for (const c of links.values()) send(c, msg); }
  function leave() {
    clearTimeout(timer); const old=peer; peer=null; old?.destroy(); links.clear(); states.clear(); chatAt.clear(); self = ''; active = false; host = false; peers();
    get<HTMLButtonElement>('fChatSend').disabled = true; get('roomLeave').hidden = true;
    get('roomLink').hidden = get('roomCopy').hidden = true;
    get<HTMLButtonElement>('roomCreate').disabled = get<HTMLButtonElement>('roomJoin').disabled = false;
    status('Offline — create a room or join a friend.');
  }
  function presence(raw: unknown): Presence | null {
    if (!raw || typeof raw !== 'object') return null;
    const p = raw as Presence;
    if (typeof p.x !== 'number' || typeof p.y !== 'number' || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
    return { x: Math.max(0, Math.min(1800, p.x)), y: Math.max(0, Math.min(2600, p.y)), n: text(p.n, 28), av: p.av,
      f: p.f === -1 ? -1 : 1, w: text(p.w, 12), b: text(p.b, 12), wv: typeof p.wv === 'number' ? p.wv : 0,
      h: typeof p.h === 'number' && Number.isFinite(p.h) ? p.h : 0,
      say: p.say && typeof p.say === 'object' && typeof (p.say as Presence).i === 'number' ? { i: (p.say as Presence).i, t: text((p.say as Presence).t, 120) } : undefined };
  }
  function receive(c: DataConnection, raw: unknown) {
    if (!raw || typeof raw !== 'object') return;
    const m = raw as any;
    if (host && m.type === 'presence') { const p = presence(m.value); if (p) { states.set(c.peer, p); snapshot(); } }
    else if (!host && m.type === 'snapshot' && Array.isArray(m.entries) && m.entries.length <= 8) {
      states.clear(); for (const entry of m.entries) { if (!Array.isArray(entry)) continue; const [id, value] = entry, p = presence(value); if (typeof id === 'string' && p) states.set(id, p); } peers();
    } else if (m.type === 'chat') {
      if (host) {
        if (Date.now() - (chatAt.get(c.peer) || 0) < 1000) return;
        chatAt.set(c.peer, Date.now()); const body = text(m.text, 240).trim(); if (!body) return;
        const name = text(states.get(c.peer)?.n, 28) || 'Friend'; line(name, body);
        for (const link of links.values()) send(link, { type: 'chat', name, text: body });
      } else { const body = text(m.text, 240); if (body) line(text(m.name, 28) || 'Friend', body); }
    } else if (!host && m.type === 'full') { leave(); status('This room is full (8 players).'); }
  }
  function attach(c: DataConnection) {
    const owner=peer;
    if (host && links.size >= 7) { c.on('open', () => { send(c, { type: 'full' }); setTimeout(() => c.close(), 200); }); return; }
    links.set(c.peer, c);
    c.on('open', () => {
      if(peer!==owner) return;
      clearTimeout(timer); active = true; get<HTMLButtonElement>('fChatSend').disabled = false;
      status(host ? 'Room open — share your invite link.' : 'Connected to your friend’s room.');
      if (host) snapshot(); else send(c, { type: 'presence', value: last });
    });
    c.on('data', m => {if(peer===owner) receive(c, m);});
    c.on('close', () => { if(peer!==owner) return; links.delete(c.peer); states.delete(c.peer); if (host) snapshot(); else { leave(); status('The host left. Create or join another room.'); } });
    c.on('error', () => { if(peer!==owner) return; c.close(); status('Connection lost. Leave and try again.'); });
  }
  function start(code?: string) {
    leave(); host = !code; const instance = host ? new Peer('ykn-' + crypto.randomUUID()) : new Peer(); peer = instance;
    status('Connecting…'); get('roomLeave').hidden = false;
    get<HTMLButtonElement>('roomCreate').disabled = get<HTMLButtonElement>('roomJoin').disabled = true;
    timer = setTimeout(() => { if (!active) { leave(); status('Could not connect. Check the code or try another network.'); } }, 20000);
    instance.on('open', id => {
      if (peer !== instance) return; self = id;
      if (host) {
        active = true; clearTimeout(timer); states.set(self, last); get<HTMLButtonElement>('fChatSend').disabled = false;
        const url = new URL(location.href); url.searchParams.set('room', id);
        get<HTMLInputElement>('roomLink').value = url.href; get('roomLink').hidden = get('roomCopy').hidden = false;
        status('Room open — share your invite link.');
      } else attach(instance.connect(code!, { reliable: true }));
    });
    instance.on('connection', c => { if (peer === instance && host) attach(c); else c.close(); });
    instance.on('error', () => { if (peer !== instance) return; leave(); status('Room unavailable. Check the invite or create a new room.'); });
    instance.on('disconnected', () => { if (peer !== instance) return; leave(); status('Signaling disconnected. Create or join a room again.'); });
  }
  get('roomCreate').onclick = () => start();
  get('roomLeave').onclick = leave;
  get('roomJoin').onclick = () => { const value = get<HTMLInputElement>('roomCode').value.trim(); if (/^ykn-[a-z0-9-]{1,50}$/i.test(value)) start(value); else status('Paste the room code from your friend’s invite link.'); };
  get('friendsClose').onclick = () => { panel.hidden = true; };
  get('roomCopy').onclick = async () => { try { await navigator.clipboard.writeText(get<HTMLInputElement>('roomLink').value); status('Invite copied. Send it to your friends.'); } catch { get<HTMLInputElement>('roomLink').select(); status('Select and copy the invite link above.'); } };
  let sentAt = 0;
  get<HTMLFormElement>('fChatForm').onsubmit = e => {
    e.preventDefault(); const input = get<HTMLInputElement>('fChatText'), body = text(input.value, 240).trim();
    if (!active || !body || Date.now() - sentAt < 1000) return; sentAt = Date.now(); input.value = '';
    const name = text(last.n, 28) || 'Friend';
    if (host) { line(name, body); for (const c of links.values()) send(c, { type: 'chat', name, text: body }); }
    else for (const c of links.values()) send(c, { type: 'chat', text: body });
  };
  panel.addEventListener('keydown', e => e.stopPropagation());
  const invite = new URLSearchParams(location.search).get('room');
  if (invite) { get<HTMLInputElement>('roomCode').value = invite; status('A friend invited you. Press Join to connect.'); }
  return {
    get id(){return self;},
    open() { panel.hidden = !panel.hidden; },
    presence(value: Presence) { last = value; if (active) { if (host) { states.set(self, value); snapshot(); } else for (const c of links.values()) send(c, { type: 'presence', value }); } return Promise.resolve(); },
  };
}
