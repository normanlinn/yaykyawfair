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
export function noiseHit(dur: number, vol: number, freq: number, when?: number, type: BiquadFilterType = 'lowpass', dest?: AudioNode | null): void {
  if (!A.c || !A.m || !A.noise) return;
  const C = A.c, t = when || C.currentTime;
  const s = C.createBufferSource(); s.buffer = A.noise;
  const f = C.createBiquadFilter(); f.type = type; f.frequency.value = freq;
  const g = C.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(dest || A.m); s.start(t, Math.random() * 2); s.stop(t + dur + 0.05);
}

// ---- stage music: an original tune in the style of a Myanmar saing waing ensemble (nothing recorded or copied).
// The hne (oboe) carries the melody with slides and turns, the kyi waing (gong circle) shadows it an octave up,
// the pat waing (drum circle) runs patterns underneath, the pat ma drum marks phrases, and the si (bell) and wa
// (clapper) keep the meter: wa on the strong beat, si in between.
export const BEAT_S = 60 / 100; // one beat of the stage music
const D4 = 293.66, hz = (semi: number) => D4 * Math.pow(2, semi / 12);
// [semitones from D4 (null = rest), length in eighth notes]; a pentatonic D E F# A B, four 16-step phrases
const TUNE: Array<[number | null, number]> = [
  [7, 2], [9, 1], [12, 1], [9, 2], [7, 2], [4, 2], [7, 1], [4, 1], [2, 4],
  [0, 1], [2, 1], [4, 2], [7, 3], [9, 1], [7, 2], [4, 2], [2, 4],
  [12, 2], [14, 1], [12, 1], [9, 2], [12, 2], [9, 1], [7, 1], [4, 2], [7, 4],
  [9, 1], [7, 1], [4, 1], [2, 1], [4, 2], [2, 1], [0, 1], [-3, 2], [0, 2], [null, 4],
];
const TUNE_STEPS = TUNE.reduce((a, n) => a + n[1], 0);
const DRUMS = [hz(-12), hz(-10), hz(-8), hz(-5), hz(-3), hz(0)]; // pat waing pitches
let lastHne = hz(7);
function hneNote(f: number, dur: number, t: number): void {
  const C = A.c!, o = C.createOscillator(), vib = C.createOscillator(), vg = C.createGain(), bp = C.createBiquadFilter(), lp = C.createBiquadFilter(), g = C.createGain();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(lastHne, t); o.frequency.exponentialRampToValueAtTime(f, t + Math.min(0.09, dur * 0.3)); // the slide into each note
  if (dur > 0.5) { o.frequency.setValueAtTime(f, t + dur * 0.55); o.frequency.exponentialRampToValueAtTime(f * 1.06, t + dur * 0.62); o.frequency.exponentialRampToValueAtTime(f, t + dur * 0.72); } // a turn on long notes
  vib.frequency.value = 5.6; vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(f * 0.018, t + dur * 0.6); vib.connect(vg); vg.connect(o.frequency);
  bp.type = 'bandpass'; bp.frequency.value = 1350; bp.Q.value = 1.1; lp.type = 'lowpass'; lp.frequency.value = 3600;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.13, t + 0.03); g.gain.setValueAtTime(0.12, t + dur * 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.06);
  o.connect(bp); bp.connect(lp); lp.connect(g); g.connect(A.music!);
  o.start(t); vib.start(t); o.stop(t + dur + 0.1); vib.stop(t + dur + 0.1);
  lastHne = f;
}
function gong(f: number, t: number, vol = 0.07): void { // a small bossed gong: a few inharmonic partials
  tone(f, 0.9, 'sine', vol, t, A.music); tone(f * 2.76, 0.35, 'sine', vol * 0.35, t, A.music); tone(f * 5.4, 0.12, 'sine', vol * 0.15, t, A.music);
}
let tuneStep = 0, noteLeft = 0, noteI = -1;
function schedMusic(): void {
  if (!A.c || !A.music) return;
  const C = A.c, spb = BEAT_S / 2;
  while (A.nextStep < C.currentTime + 0.25) {
    const t = A.nextStep, st = A.step % 8;
    // si and wa
    if (st % 4 === 0) noiseHit(0.05, 0.22, 2200, t, 'bandpass', A.music);
    if (st % 4 === 2) { tone(2950, 0.4, 'sine', 0.05, t, A.music); tone(4430, 0.25, 'sine', 0.025, t, A.music); }
    // melody
    if (noteLeft <= 0) {
      noteI = (noteI + 1) % TUNE.length; const [semi, len] = TUNE[noteI]; noteLeft = len;
      if (semi !== null) {
        hneNote(hz(semi), len * spb, t);
        gong(hz(semi + 12), t); if (len >= 2) gong(hz(semi + 12), t + spb, 0.04); // the gong circle answers on long notes
      }
    }
    noteLeft--;
    // pat waing: a running figure, busier at the end of each phrase
    const pos = tuneStep % 16, busy = pos >= 12;
    if (st % 2 === 0 || busy) { const d = DRUMS[(tuneStep * 3 + (busy ? pos : 0)) % DRUMS.length]; tone(d * 1.5, 0.28, 'sine', 0.2, t, A.music, d); }
    if (busy && Math.random() < 0.5) { const d = DRUMS[(pos + 2) % DRUMS.length]; tone(d * 1.5, 0.2, 'sine', 0.13, t + spb / 2, A.music, d); }
    // pat ma: the big drum on each phrase and half-phrase
    if (pos === 0 || pos === 8) tone(90, 0.7, 'sine', 0.42, t, A.music, 48);
    if (tuneStep % TUNE_STEPS === 0) noiseHit(0.5, 0.08, 400, t, 'lowpass', A.music);
    A.nextStep += spb; A.step++; tuneStep++;
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

export type Sfx = 'coin' | 'ding' | 'pop' | 'throw' | 'miss' | 'toot' | 'launch' | 'boom' | 'crackle' | 'shutter' | 'whee' | 'chat' | 'bump' | 'zap' | 'fizz' | 'clank' | 'scream';
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
    case 'bump': noiseHit(0.18, 0.6, 260, t); tone(90, 0.22, 'sine', 0.4, t, null, 50); tone(420, 0.1, 'square', 0.05, t + 0.02, null, 300); break;
    case 'zap': for (let i = 0; i < 5; i++) noiseHit(0.03, 0.18, 5200, t + i * 0.035 + Math.random() * 0.02, 'highpass'); tone(110, 0.25, 'sawtooth', 0.03, t); break;
    case 'fizz': noiseHit(1.4, 0.08, 3000, t, 'highpass'); break;
    case 'clank': noiseHit(0.08, 0.35, 1800, t); tone(260, 0.3, 'square', 0.05, t, null, 180); break;
    case 'scream': for (let i = 0; i < 3; i++) tone(820 + i * 140, 1.0, 'sawtooth', 0.012, t + i * 0.05, null, 1150 + i * 120); break;
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
