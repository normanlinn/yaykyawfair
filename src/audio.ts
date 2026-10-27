// Web Audio: crowd murmur, distant Burmese-style chatter, the stage's saing waing loop, bicycle bells and effects.
import { clamp, rand, pick } from './util';

interface AudioState {
  c: AudioContext | null;
  m: GainNode | null;      // master
  music: GainNode | null;  // stage band, faded by distance
  amb: GainNode | null;    // broadband crowd murmur
  chat: GainNode | null;   // voices
  noise: AudioBuffer | null;
  nextStep: number; step: number;
}
export const A: AudioState = { c: null, m: null, music: null, amb: null, chat: null, noise: null, nextStep: 0, step: 0 };

export function audioInit(soundOn: boolean): void {
  if (A.c) return;
  try {
    const AC: typeof AudioContext = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const C = new AC(); A.c = C;
    A.m = C.createGain(); A.m.gain.value = soundOn ? 0.7 : 0; A.m.connect(C.destination);
    const len = C.sampleRate * 3, buf = C.createBuffer(1, len, C.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
    const src = C.createBufferSource(); src.buffer = buf; src.loop = true;
    const f = C.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 480; f.Q.value = 0.6;
    A.amb = C.createGain(); A.amb.gain.value = 0.22; src.connect(f); f.connect(A.amb); A.amb.connect(A.m); src.start();
    A.noise = buf;
    A.music = C.createGain(); A.music.gain.value = 0; A.music.connect(A.m);
    // chatter bus: muffled so the words never resolve into anything you can make out
    const lp = C.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1500; lp.Q.value = 0.4;
    A.chat = C.createGain(); A.chat.gain.value = 0; A.chat.connect(lp); lp.connect(A.m);
    for (let v = 0; v < 6; v++) setTimeout(speakPhrase, 300 + v * 700);
    A.nextStep = C.currentTime + 0.1;
    setInterval(schedMusic, 60);
  } catch { A.c = null; }
}

export function tone(f: number, dur: number, type: OscillatorType = 'sine', vol = 0.1, when?: number, dest?: AudioNode | null, f2?: number): void {
  if (!A.c || !A.m) return;
  const C = A.c, t = when || C.currentTime;
  const o = C.createOscillator(), g = C.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest || A.m); o.start(t); o.stop(t + dur + 0.05);
}
export function noiseHit(dur: number, vol: number, freq: number, when?: number, type: BiquadFilterType = 'lowpass'): void {
  if (!A.c || !A.m || !A.noise) return;
  const C = A.c, t = when || C.currentTime;
  const s = C.createBufferSource(); s.buffer = A.noise;
  const f = C.createBiquadFilter(); f.type = type; f.frequency.value = freq;
  const g = C.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(A.m); s.start(t, Math.random() * 2); s.stop(t + dur + 0.05);
}

// ---- stage music: si (bell) and wa (clapper) keep time, pat waing drums, a pentatonic hne-like line
const PENTA = [261.6, 293.7, 329.6, 392, 440, 523.3, 587.3, 659.3];
let mel = 3;
function schedMusic(): void {
  if (!A.c || !A.music) return;
  const C = A.c, spb = 60 / 116 / 2;
  while (A.nextStep < C.currentTime + 0.25) {
    const t = A.nextStep, st = A.step % 16;
    if (st % 4 === 0) tone(1900, 0.18, 'sine', 0.06, t, A.music);
    if (st % 4 === 2) noiseHit(0.05, 0.18, 3000, t, 'highpass');
    if ([0, 3, 6, 10, 12].includes(st)) { const p = [110, 147, 131, 165, 98][st % 5]; tone(p * 1.6, 0.35, 'sine', 0.32, t, A.music, p); }
    if (st % 2 === 0 && Math.random() < 0.85) { mel = clamp(mel + Math.floor(rand(-2, 3)), 0, 7); tone(PENTA[mel] * 2, spb * 1.9, 'triangle', 0.11, t, A.music); }
    A.nextStep += spb; A.step++;
  }
}

// ---- crowd chatter: synthetic voices built from short tonal syllables.
// Burmese is tonal (low, high, creaky and checked/stopped syllables), so each syllable gets one of those pitch
// shapes. The voices pass through vowel formants and a low-pass, which keeps them speech-like but unintelligible.
const VOWELS: Array<[number, number]> = [[730, 1090], [270, 2290], [300, 870], [530, 1840], [570, 840], [440, 1020], [390, 1990]];
type Tone = 'low' | 'high' | 'creaky' | 'checked';
const TONES: Tone[] = ['low', 'low', 'high', 'creaky', 'checked'];
function speakPhrase(): void {
  if (!A.c || !A.chat) return;
  const C = A.c;
  const now = C.currentTime;
  let t = now + 0.05;
  const f0 = pick([102, 115, 128, 140, 185, 205, 225, 240]);
  const o = C.createOscillator(); o.type = 'sawtooth';
  const f1 = C.createBiquadFilter(); f1.type = 'bandpass'; f1.Q.value = 7;
  const f2 = C.createBiquadFilter(); f2.type = 'bandpass'; f2.Q.value = 9;
  const g2 = C.createGain(); g2.gain.value = 0.55;
  const g = C.createGain(); g.gain.value = 0;
  const pan = C.createStereoPanner(); pan.pan.value = rand(-0.9, 0.9);
  o.connect(f1); f1.connect(g); o.connect(f2); f2.connect(g2); g2.connect(g); g.connect(pan); pan.connect(A.chat);
  o.frequency.setValueAtTime(f0, t);
  const n = Math.floor(rand(3, 12));
  for (let i = 0; i < n; i++) {
    const tn = pick(TONES), v = pick(VOWELS);
    const dur = tn === 'checked' ? rand(0.06, 0.09) : rand(0.11, 0.24);
    f1.frequency.setTargetAtTime(v[0] * (f0 > 160 ? 1.12 : 1), t, 0.02);
    f2.frequency.setTargetAtTime(v[1] * (f0 > 160 ? 1.12 : 1), t, 0.02);
    const decl = 1 - (i / n) * 0.12; // phrases drift down in pitch
    if (tn === 'low') { o.frequency.setTargetAtTime(f0 * 0.88 * decl, t, 0.03); }
    if (tn === 'high') { o.frequency.setValueAtTime(f0 * 1.28 * decl, t); o.frequency.linearRampToValueAtTime(f0 * 1.05 * decl, t + dur); }
    if (tn === 'creaky') { o.frequency.setValueAtTime(f0 * 1.15 * decl, t); o.frequency.linearRampToValueAtTime(f0 * 0.92 * decl, t + dur); }
    if (tn === 'checked') { o.frequency.setTargetAtTime(f0 * 1.2 * decl, t, 0.01); }
    const peak = tn === 'creaky' ? 0.32 : 0.5;
    g.gain.setTargetAtTime(peak, t, 0.015);
    g.gain.setTargetAtTime(0, t + dur * (tn === 'checked' ? 0.95 : 0.8), tn === 'checked' ? 0.004 : 0.025);
    t += dur + (Math.random() < 0.2 ? rand(0.08, 0.2) : rand(0.01, 0.05));
  }
  o.start(now); o.stop(t + 0.2);
  o.onended = () => { try { pan.disconnect(); } catch { /* already gone */ } };
  setTimeout(speakPhrase, (t - now) * 1000 + rand(300, 2600));
}
/** Sets how loud the chatter is (0..1), usually from how many people are around the player. */
export function setChatter(level: number): void {
  if (A.c && A.chat) A.chat.gain.setTargetAtTime(clamp(level, 0, 1) * 0.16, A.c.currentTime, 0.6);
}

/** Bicycle bell, a bright "cling cling": two quick metallic strikes. Volume falls off with distance. */
export function bell(vol: number): void {
  if (!A.c || vol <= 0.01) return;
  const t = A.c.currentTime;
  for (const off of [0, 0.15]) {
    noiseHit(0.03, vol * 0.18, 6000, t + off, 'highpass'); // the striker's click
    [3150, 4720, 6900, 8650].forEach((f, i) => tone(f, 0.42 - i * 0.08, 'sine', vol * [0.2, 0.1, 0.06, 0.03][i], t + off));
  }
}
/** Motorbike horn, a short nasal "tee tee". */
export function horn(vol: number): void {
  if (!A.c || !A.m || vol <= 0.01) return;
  const C = A.c, t = C.currentTime;
  const lp = C.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400; lp.connect(A.m);
  for (const off of [0, 0.22]) {
    tone(415, 0.15, 'square', vol * 0.07, t + off, lp); tone(495, 0.15, 'square', vol * 0.06, t + off, lp);
  }
  setTimeout(() => { try { lp.disconnect(); } catch { /* gone */ } }, 900);
}

export type Sfx = 'coin' | 'ding' | 'pop' | 'throw' | 'miss' | 'toot' | 'launch' | 'boom' | 'crackle' | 'shutter' | 'whee' | 'chat';
export function sfx(k: Sfx): void {
  if (!A.c) return;
  const t = A.c.currentTime;
  switch (k) {
    case 'coin': tone(1320, 0.08, 'square', 0.05, t); tone(1760, 0.16, 'square', 0.05, t + 0.07); break;
    case 'ding': tone(880, 0.25, 'triangle', 0.18, t); tone(1320, 0.35, 'triangle', 0.14, t + 0.1); break;
    case 'pop': noiseHit(0.12, 0.5, 2400, t); break;
    case 'throw': tone(500, 0.2, 'sine', 0.08, t, null, 900); break;
    case 'miss': tone(300, 0.18, 'triangle', 0.1, t, null, 180); break;
    case 'toot': tone(440, 0.25, 'square', 0.06, t); tone(554, 0.35, 'square', 0.06, t + 0.25); break;
    case 'launch': tone(500, 0.9, 'sine', 0.025, t, null, 1500); break;
    case 'boom': noiseHit(1.3, 0.7, 380, t); tone(70, 0.8, 'sine', 0.35, t, null, 35); break;
    case 'crackle': for (let i = 0; i < 8; i++) noiseHit(0.04, 0.15, 4000, t + 0.15 + Math.random() * 0.6, 'highpass'); break;
    case 'shutter': noiseHit(0.06, 0.4, 5000, t, 'highpass'); tone(2400, 0.03, 'square', 0.04, t + 0.07); break;
    case 'chat': tone(1046, 0.09, 'sine', 0.05, t); tone(1568, 0.12, 'sine', 0.04, t + 0.07); break;
    case 'whee': tone(700, 0.6, 'sawtooth', 0.02, t, null, 1100); break;
  }
}
export function setMaster(on: boolean): void { if (A.m) A.m.gain.value = on ? 0.7 : 0; }

// ---------------------------------------------------------------- spoken Burmese from the crowd
const voiceBufs = new Map<string, AudioBuffer>();
let voicesLoading = false;
/** Decodes the voice clips once the audio context exists. */
export function loadVoices(clips: Record<string, string>): void {
  if (!A.c || voicesLoading) return; voicesLoading = true;
  for (const [k, url] of Object.entries(clips)) {
    fetch(url).then(r => r.arrayBuffer()).then(b => A.c.decodeAudioData(b)).then(buf => { voiceBufs.set(k, buf); }).catch(() => { /* that line stays silent */ });
  }
}
/** Plays a spoken line. vol 0..1, pan -1..1, far 0..1 muffles it like someone further down the street. Returns false if the clip isn't ready. */
export function speak(name: string, vol: number, pan = 0, far = 0): boolean {
  const buf = voiceBufs.get(name);
  if (!A.c || !buf || vol <= 0.01) return false;
  const C = A.c, t = C.currentTime, src = C.createBufferSource(); src.buffer = buf;
  src.playbackRate.value = rand(0.94, 1.08);
  const lp = C.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4200 - clamp(far, 0, 1) * 3300; lp.Q.value = 0.4;
  const g = C.createGain(); g.gain.value = clamp(vol, 0, 1) * 0.55;
  let out: AudioNode = g;
  if (C.createStereoPanner) { const p = C.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); g.connect(p); out = p; }
  src.connect(lp); lp.connect(g); out.connect(A.m); src.start(t);
  return true;
}
