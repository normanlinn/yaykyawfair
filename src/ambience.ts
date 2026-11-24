// Ambient sound for each zone of the fair, all synthesized in Web Audio (nothing recorded or copied).
// Every zone has its own bus whose volume follows how close the player is (see zoneMix.ts), so walking
// between zones crossfades from one place's sounds to the next. Everything runs through the master gain,
// so the Sound off button silences it too; muted or faraway zones schedule nothing and stop their beds.
import { A, tone, noiseHit, BEAT_S } from './audio';
import { ZONES, Zone } from './layout';
import { zoneWeight } from './zoneMix';
import { rand, pick } from './util';

type Fire = (t: number, o: AudioNode) => void;
interface Ev { every: () => number; fire: Fire; sync?: () => number }
interface Def { id: string; vol: number; bed?: (o: AudioNode) => AudioScheduledSourceNode[]; ev: Ev[] }

// ---------------------------------------------------------------- building blocks
const ac = () => A.c!;
/** A looping noise bed through one filter, optionally breathing with a slow LFO (waves, flames, sizzling oil). */
function loopNoise(o: AudioNode, type: BiquadFilterType, f: number, q: number, vol: number, lfoHz = 0, depth = 0): AudioScheduledSourceNode[] {
  const C = ac(), s = C.createBufferSource(); s.buffer = A.noise; s.loop = true;
  const fl = C.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
  const g = C.createGain(); g.gain.value = vol;
  s.connect(fl); fl.connect(g); g.connect(o); s.start(C.currentTime, Math.random() * 2);
  if (!lfoHz) return [s];
  const l = C.createOscillator(), lg = C.createGain(); l.frequency.value = lfoHz; lg.gain.value = vol * depth;
  l.connect(lg); lg.connect(g.gain); l.start();
  return [s, l];
}
/** A steady electrical or motor hum. */
function hum(o: AudioNode, f: number, type: OscillatorType, vol: number, lp: number): AudioScheduledSourceNode[] {
  const C = ac(), s = C.createOscillator(), fl = C.createBiquadFilter(), g = C.createGain();
  s.type = type; s.frequency.value = f; fl.type = 'lowpass'; fl.frequency.value = lp; g.gain.value = vol;
  s.connect(fl); fl.connect(g); g.connect(o); s.start();
  return [s];
}
/** A filtered noise swell: a crowd cheer, a TV crowd's roar, a flare of fire. */
function swell(t: number, o: AudioNode, type: BiquadFilterType, f: number, q: number, vol: number, att: number, dec: number): void {
  const C = ac(), s = C.createBufferSource(); s.buffer = A.noise; s.loop = true;
  const fl = C.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
  const g = C.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + att); g.gain.exponentialRampToValueAtTime(0.0001, t + att + dec);
  s.connect(fl); fl.connect(g); g.connect(o); s.start(t, Math.random() * 2); s.stop(t + att + dec + 0.1);
}
/** Struck metal: a wok, a ladle on a pot, a hand bell. A few inharmonic partials and a click. */
function metal(t: number, o: AudioNode, f: number, vol: number, dur: number): void {
  [1, 2.76, 5.4, 8.93].forEach((m, i) => tone(f * m, dur * (1 - i * 0.2), 'sine', vol * [1, 0.5, 0.3, 0.15][i], t, o));
  noiseHit(0.015, vol * 0.8, 4000, t, 'highpass', o);
}
/** A hollow wooden or rattan knock. */
function tok(t: number, o: AudioNode, f: number, vol: number): void {
  tone(f, 0.08, 'triangle', vol, t, o, f * 0.82); noiseHit(0.02, vol * 0.5, f * 2, t, 'bandpass', o);
}
/** A pagoda bell left to ring. */
function bellRing(t: number, o: AudioNode, f: number, vol: number, dur: number): void {
  [1, 2.71, 5.18].forEach((m, i) => tone(f * m, dur * [1, 0.55, 0.3][i], 'sine', vol * [1, 0.35, 0.15][i], t, o, f * m * 0.998));
}
/** A short lowpass in front of `o` that cleans itself up. */
function soft(o: AudioNode, f: number, life: number): BiquadFilterNode {
  const lp = ac().createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = f; lp.connect(o);
  setTimeout(() => { try { lp.disconnect(); } catch { /* gone */ } }, life * 1000);
  return lp;
}
/** One sung or spoken syllable: a buzzy source through two vowel formants, with an optional hissed consonant first. */
function syl(t: number, o: AudioNode, f0: number, f1: number, v: [number, number], dur: number, vol: number, hiss = 0): void {
  const C = ac();
  if (hiss) noiseHit(0.05, vol * 0.7, hiss, t, 'highpass', o);
  const t0 = t + (hiss ? 0.04 : 0), s = C.createOscillator(); s.type = 'sawtooth';
  s.frequency.setValueAtTime(f0, t0); s.frequency.linearRampToValueAtTime(f1, t0 + dur);
  const g = C.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.04); g.gain.setValueAtTime(vol, t0 + dur * 0.7); g.gain.linearRampToValueAtTime(0, t0 + dur);
  for (const [f, q, k] of [[v[0], 7, 1], [v[1], 9, 0.55]] as Array<[number, number, number]>) {
    const b = C.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = f0 > 160 ? f * 1.12 : f; b.Q.value = q;
    const bg = C.createGain(); bg.gain.value = k; s.connect(b); b.connect(bg); bg.connect(g);
  }
  g.connect(o); s.start(t0); s.stop(t0 + dur + 0.05);
}
const VA: [number, number] = [730, 1090], VU: [number, number] = [300, 870], VI: [number, number] = [270, 2290], VO: [number, number] = [450, 800];
const voicePitch = () => pick([105, 118, 130, 195, 210, 230]);

/** "Sadhu, sadhu, sadhu" (သာဓု): a few people together, the way everyone answers a good deed. */
function sadhu(t: number, o: AudioNode): void {
  const lp = soft(o, 2200, 5);
  const n = Math.floor(rand(3, 6));
  for (let v = 0; v < n; v++) {
    const f0 = voicePitch(), d = rand(0, 0.07), vol = rand(0.03, 0.045);
    for (let k = 0; k < 3; k++) {
      const b = t + d + k * 1.05;
      syl(b, lp, f0 * 1.06, f0, VA, 0.28, vol, 5200);             // tha
      noiseHit(0.015, vol * 0.4, 2500, b + 0.31, 'bandpass', lp); // d
      syl(b + 0.32, lp, f0 * 0.96, f0 * 0.8, VU, 0.5, vol);        // du, falling
    }
  }
}
/** A crowd's "ohhh" when a firework opens. */
function ooh(t: number, o: AudioNode): void {
  const lp = soft(o, 1500, 3);
  for (let v = 0; v < 6; v++) { const f0 = voicePitch(); syl(t + rand(0, 0.15), lp, f0, f0 * 1.25, VO, rand(0.9, 1.3), 0.022); }
}
/** "La bi!" (လာပြီ, coming!): the tea boy answering a call. */
function laBi(t: number, o: AudioNode): void {
  const lp = soft(o, 2600, 2), f0 = rand(150, 175);
  syl(t, lp, f0, f0 * 1.08, VA, 0.2, 0.05); noiseHit(0.012, 0.03, 2000, t + 0.22, 'bandpass', lp); syl(t + 0.23, lp, f0 * 1.1, f0 * 0.9, VI, 0.26, 0.05);
}

// The stage band's step clock, so the carousel's pattala and the crowd's claps sit in time with the saing waing.
const STEP = BEAT_S / 2;
const onStep = () => A.nextStep;
const onBeat = () => A.nextStep + (A.step % 2 ? STEP : 0);
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19].map(s => 587.33 * Math.pow(2, s / 12)); // D pentatonic, like the stage tune
const PATTALA = [4, 5, 6, 5, 4, 3, 2, 3, 4, -1, 2, 1, 0, 1, 2, -1, 6, 7, 8, 7, 6, 5, 4, 5, 6, 5, 4, 2, 1, 2, 0, -1];
let patI = 0, ozI = 0, ozT = 0;
const OZI = [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 1, 0];

// ---------------------------------------------------------------- the zones
const DEFS: Def[] = [
  { id: 'ferris', vol: 0.45, // the generator, the big wheel's creak and its cars clacking over the joints, a child's "whee"
    bed: o => hum(o, 50, 'sawtooth', 0.035, 220),
    ev: [
      { every: () => rand(3, 7), fire: (t, o) => tone(rand(150, 210), 0.9, 'sawtooth', 0.012, t, soft(o, 700, 2), rand(110, 140)) },
      { every: () => rand(1.5, 3), fire: (t, o) => { tok(t, o, 520, 0.05); tok(t + 0.12, o, 480, 0.04); } },
      { every: () => rand(9, 16), fire: (t, o) => { tone(rand(700, 900), 0.7, 'sine', 0.02, t, o, rand(1100, 1300)); } },
    ] },
  { id: 'carousel', vol: 0.55, // a pattala (bamboo xylophone) tune going round, and the horses' poles clunking
    ev: [
      { every: () => STEP, sync: onStep, fire: (t, o) => {
        const n = PATTALA[patI++ % PATTALA.length];
        if (n >= 0) { const f = PENTA[n]; tone(f, 0.35, 'triangle', 0.07, t, o); tone(f * 4, 0.06, 'sine', 0.015, t, o); noiseHit(0.015, 0.03, 3000, t, 'bandpass', o); }
        if (patI % 8 === 0) tone(70, 0.2, 'sine', 0.06, t, o, 55);
      } },
    ] },
  { id: 'food', vol: 0.7, // oil sizzling, woks and ladles, a knife on the board
    bed: o => [...loopNoise(o, 'highpass', 5000, 0.5, 0.22, 0.7, 0.5), ...loopNoise(o, 'bandpass', 2500, 0.8, 0.08)],
    ev: [
      { every: () => rand(0.8, 2.6), fire: (t, o) => { const f = rand(500, 900); metal(t, o, f, 0.04, 0.35); if (Math.random() < 0.4) metal(t + 0.16, o, f * 1.03, 0.03, 0.3); } },
      { every: () => rand(3, 6), fire: (t, o) => noiseHit(0.9, 0.1, 4000, t, 'highpass', o) },
      { every: () => rand(4, 9), fire: (t, o) => { const n = Math.floor(rand(4, 9)); for (let i = 0; i < n; i++) tok(t + i * 0.14, o, 700, 0.05); } },
      { every: () => rand(5, 10), fire: (t, o) => metal(t, o, rand(280, 340), 0.05, 0.6) },
    ] },
  { id: 'pirate', vol: 0.75, // the ship's rush of air on each swing, a creak at the top, the back row screaming
    ev: [
      { every: () => 3.6, fire: (t, o) => {
        const C = ac(), s = C.createBufferSource(); s.buffer = A.noise; s.loop = true;
        const b = C.createBiquadFilter(); b.type = 'bandpass'; b.Q.value = 1.2;
        b.frequency.setValueAtTime(250, t); b.frequency.exponentialRampToValueAtTime(1300, t + 1.5); b.frequency.exponentialRampToValueAtTime(250, t + 3);
        const g = C.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.22, t + 1.5); g.gain.linearRampToValueAtTime(0, t + 3.2);
        s.connect(b); b.connect(g); g.connect(o); s.start(t, Math.random()); s.stop(t + 3.3);
        tone(rand(160, 190), 0.6, 'sawtooth', 0.01, t + 3.1, soft(o, 600, 5), 130);
        if (Math.random() < 0.5) for (let i = 0; i < 3; i++) tone(820 + i * 140, 1.0, 'sawtooth', 0.007, t + 3.1 + i * 0.05, o, 1150 + i * 120);
      } },
    ] },
  { id: 'games', vol: 1, // balloon darts popping, rings clinking on bottles, the prize bell
    ev: [
      { every: () => rand(1.5, 4), fire: (t, o) => noiseHit(0.1, 0.3, 2400, t, 'lowpass', o) },
      { every: () => rand(1.5, 3.5), fire: (t, o) => { const f = rand(2000, 2800); tone(f, 0.25, 'sine', 0.03, t, o); tone(f * 2.3, 0.12, 'sine', 0.012, t, o); } },
      { every: () => rand(10, 18), fire: (t, o) => { for (let i = 0; i < 8; i++) metal(t + i * 0.09, o, 1400, 0.025, 0.25); swell(t + 0.2, o, 'bandpass', 1200, 0.7, 0.08, 0.4, 1.2); } },
    ] },
  { id: 'kids', vol: 1, // the little train's toot and chuffs, a pellet-drum toy, a water-bird whistle
    ev: [
      { every: () => rand(12, 22), fire: (t, o) => {
        tone(587, 0.25, 'triangle', 0.05, t, o); tone(740, 0.35, 'triangle', 0.05, t + 0.25, o);
        for (let i = 0; i < 10; i++) { noiseHit(0.18, 0.08 * (1 - i / 12), 520, t + 0.8 + i * 0.42, 'bandpass', o); tok(t + 0.95 + i * 0.42, o, 1500, 0.015); }
      } },
      { every: () => rand(3, 7), fire: (t, o) => { const n = Math.floor(rand(6, 13)); for (let i = 0; i < n; i++) tok(t + i * 0.06, o, i % 2 ? 900 : 960, 0.035); } },
      { every: () => rand(8, 15), fire: (t, o) => {
        const C = ac(), s = C.createOscillator(), v = C.createOscillator(), vg = C.createGain(), g = C.createGain();
        s.frequency.value = rand(1800, 2200); v.frequency.value = rand(14, 20); vg.gain.value = 260; v.connect(vg); vg.connect(s.frequency);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.02, t + 0.05); g.gain.linearRampToValueAtTime(0, t + 0.9);
        s.connect(g); g.connect(o); s.start(t); v.start(t); s.stop(t + 1); v.stop(t + 1);
      } },
    ] },
  { id: 'music', vol: 0.8, // the audience clapping along with the band, cheering, cameras clicking
    ev: [
      { every: () => BEAT_S, sync: onBeat, fire: (t, o) => { for (let i = 0; i < 3; i++) if (Math.random() < 0.7) noiseHit(0.04, rand(0.12, 0.22), rand(1300, 1800), t + rand(0, 0.03), 'bandpass', o); } },
      { every: () => rand(12, 22), fire: (t, o) => swell(t, o, 'bandpass', 1200, 0.6, 0.1, 0.5, 1.5) },
      { every: () => rand(4, 9), fire: (t, o) => noiseHit(0.03, 0.12, 5000, t, 'highpass', o) },
    ] },
  { id: 'finale', vol: 0.6, // distant fireworks, crackle, and the crowd's "ohhh"
    ev: [
      { every: () => rand(4, 9), fire: (t, o) => {
        noiseHit(1.6, 0.3, 200, t, 'lowpass', o); tone(55, 1, 'sine', 0.13, t, o, 35);
        for (let i = 0; i < 6; i++) noiseHit(0.04, 0.05, 4000, t + 0.4 + Math.random() * 0.6, 'highpass', o);
        if (Math.random() < 0.6) ooh(t + 0.35, o);
      } },
    ] },
  { id: 'midway', vol: 0.6, // bumper cars buzzing on their grid, bangs and sparks, the hand-spun wheel's ratchet, banana fritters frying
    bed: o => [...hum(o, 60, 'sawtooth', 0.02, 300), ...hum(o, 120, 'square', 0.005, 900)],
    ev: [
      { every: () => rand(1.5, 4), fire: (t, o) => { noiseHit(0.15, 0.25, 260, t, 'lowpass', o); tone(90, 0.2, 'sine', 0.12, t, o, 50); } },
      { every: () => rand(4, 8), fire: (t, o) => { for (let i = 0; i < 4; i++) noiseHit(0.03, 0.08, 5200, t + i * 0.035, 'highpass', o); } },
      { every: () => rand(8, 14), fire: (t, o) => { let w = t; for (let i = 0; i < 20; i++) { tok(w, o, 1200, 0.03); w += 0.05 + i * 0.007; } swell(t, o, 'bandpass', 600, 1, 0.05, 0.4, 1.4); } },
      { every: () => rand(5, 9), fire: (t, o) => noiseHit(1.5, 0.05, 4500, t, 'highpass', o) },
    ] },
  { id: 'candles', vol: 0.6, // the stupa's hti bells in the breeze, and someone striking the pagoda bell three times after praying
    ev: [
      { every: () => rand(0.35, 1.4), fire: (t, o) => bellRing(t, o, pick([2637, 2960, 3322, 3951, 4434]) * rand(0.995, 1.005), rand(0.012, 0.025), 2.5) },
      { every: () => rand(16, 28), fire: (t, o) => { for (let k = 0; k < 3; k++) { bellRing(t + k * 1.3, o, 520, 0.07, 3.5); noiseHit(0.02, 0.04, 1800, t + k * 1.3, 'bandpass', o); } } },
    ] },
  { id: 'teashop', vol: 0.9, // spoons stirring in glasses, cups set down, the kiss-call for the tea boy and his "la bi!", the football on the TV
    bed: o => loopNoise(o, 'bandpass', 3000, 2, 0.025),
    ev: [
      { every: () => rand(2.5, 6), fire: (t, o) => { const n = Math.floor(rand(6, 11)); for (let i = 0; i < n; i++) tone(rand(3800, 4200), 0.08, 'sine', 0.025, t + i * 0.11, o); } },
      { every: () => rand(1.5, 4), fire: (t, o) => { const f = rand(1700, 2200); tone(f, 0.15, 'sine', 0.035, t, o); tone(f * 2.6, 0.08, 'sine', 0.012, t, o); noiseHit(0.02, 0.06, 3000, t, 'bandpass', o); } },
      { every: () => rand(7, 13), fire: (t, o) => {
        for (const d of [0, 0.18]) { noiseHit(0.025, 0.2, 3500, t + d, 'highpass', o); tone(2200, 0.04, 'sine', 0.035, t + d, o, 1400); }
        if (Math.random() < 0.7) laBi(t + rand(0.9, 1.5), o);
      } },
      { every: () => rand(14, 26), fire: (t, o) => swell(t, soft(o, 3000, 6), 'bandpass', 900, 0.8, 0.09, 1.2, 2.5) },
      { every: () => rand(8, 15), fire: (t, o) => { tone(rand(180, 260), 0.25, 'sawtooth', 0.01, t, soft(o, 900, 2), rand(140, 200)); noiseHit(0.25, 0.04, 900, t, 'bandpass', o); } },
    ] },
  { id: 'lake', vol: 0.45, // water lapping, crickets, frogs, a fish jumping
    bed: o => loopNoise(o, 'lowpass', 380, 0.7, 0.11, 0.23, 0.6),
    ev: [
      { every: () => rand(0.6, 1.8), fire: (t, o) => { const n = Math.floor(rand(3, 7)), f = rand(4300, 4700); for (let i = 0; i < n; i++) tone(f, 0.03, 'sine', 0.012, t + i * 0.07, o); } },
      { every: () => rand(2, 5), fire: (t, o) => { const n = Math.floor(rand(2, 6)), f = rand(180, 260); for (let i = 0; i < n; i++) tone(f, 0.09, 'triangle', 0.035, t + i * 0.16, o, f * 0.85); } },
      { every: () => rand(6, 14), fire: (t, o) => { tone(rand(500, 700), 0.12, 'sine', 0.04, t, o, rand(150, 250)); noiseHit(0.15, 0.05, 1200, t, 'lowpass', o); } },
    ] },
  { id: 'nibbana', vol: 0.7, // "sadhu, sadhu, sadhu", ladles in the mohinga pots, bowls stacking, the merit gong
    ev: [
      { every: () => rand(10, 18), fire: sadhu },
      { every: () => rand(1.5, 4), fire: (t, o) => metal(t, o, rand(350, 600), 0.035, 0.4) },
      { every: () => rand(3, 6), fire: (t, o) => { for (let i = 0; i < 3; i++) tone(rand(2400, 3000), 0.1, 'sine', 0.02, t + i * 0.09, o); } },
      { every: () => rand(16, 28), fire: (t, o) => bellRing(t, o, 330, 0.06, 2.4) },
    ] },
  { id: 'tazaung', vol: 0.8, // the robe looms racing (shuttle, beater, treadle), and the chinlone circle's cane ball
    ev: [
      { every: () => 1.05, fire: (t, o) => {
        noiseHit(0.03, 0.1, 2400, t, 'bandpass', o); tok(t, o, 600, 0.04);
        tone(120, 0.12, 'sine', 0.1, t + 0.45, o, 80); tok(t + 0.45, o, 300, 0.05);
        tok(t + 0.75, o, 900, 0.025);
      } },
      { every: () => rand(3, 7), fire: (t, o) => {
        const n = Math.floor(rand(4, 11)); let w = t;
        for (let i = 0; i < n; i++) { tone(rand(380, 460), 0.07, 'triangle', 0.07, w, o); noiseHit(0.03, 0.08, 1200, w, 'bandpass', o); w += rand(0.45, 0.8); }
        if (Math.random() < 0.4) swell(w, o, 'bandpass', 1100, 0.8, 0.06, 0.3, 0.9);
      } },
    ] },
  { id: 'balloons', vol: 0.38, // the fire roaring and crackling under the balloon, flare-ups, and an o-zi drum band with cymbals
    bed: o => loopNoise(o, 'lowpass', 320, 0.5, 0.14, 0.4, 0.4),
    ev: [
      { every: () => rand(0.15, 0.6), fire: (t, o) => noiseHit(0.03, rand(0.04, 0.12), rand(3000, 6000), t, 'highpass', o) },
      { every: () => rand(6, 12), fire: (t, o) => swell(t, o, 'lowpass', 500, 0.6, 0.18, 0.3, 1.2) },
      { every: () => 0.25, fire: (t, o) => {
        // the band plays a phrase, rests, then starts again
        if (ozT > 0) { ozT--; return; }
        const k = ozI++ % 16;
        if (OZI[k]) { tone(160, 0.18, 'sine', 0.14, t, o, 120); noiseHit(0.03, 0.06, 900, t, 'bandpass', o); }
        if (k % 4 === 2) { noiseHit(0.12, 0.05, 7000, t, 'highpass', o); tone(5200, 0.1, 'sine', 0.01, t, o); }
        if (k % 4 === 0) tok(t, o, 1800, 0.03);
        if (ozI % 64 === 0) ozT = 16;
      } },
    ] },
];

// ---------------------------------------------------------------- mixing
interface Live { z: Zone; d: Def; g: GainNode; bed: GainNode | null; srcs: AudioScheduledSourceNode[]; next: number[]; idle: number }
const LIVE: Live[] = [];
let bus: GainNode | null = null;

function init(): boolean {
  if (bus) return true;
  if (!A.c || !A.m || !A.noise) return false;
  bus = A.c.createGain(); bus.gain.value = 1.6; bus.connect(A.m);
  for (const d of DEFS) {
    const z = ZONES.find(q => q.id === d.id); if (!z) continue;
    const g = A.c.createGain(); g.gain.value = 0; g.connect(bus);
    LIVE.push({ z, d, g, bed: null, srcs: [], next: d.ev.map(() => 0), idle: 0 });
  }
  return true;
}

/**
 * Call every frame. (x, y) is where the player is on the map; level (0..1) scales everything,
 * e.g. full while walking and quieter inside a ride or a minigame.
 */
export function updateAmbience(dt: number, x: number, y: number, level: number): void {
  if (!init()) return;
  const C = A.c!, now = C.currentTime, muted = A.m!.gain.value === 0 || C.state !== 'running';
  for (const L of LIVE) {
    const w = muted ? 0 : zoneWeight(x, y, L.z) * level;
    L.g.gain.setTargetAtTime(w * L.d.vol, now, 0.35);
    if (w > 0.01) {
      L.idle = 0;
      if (!L.bed && L.d.bed) { L.bed = C.createGain(); L.bed.connect(L.g); L.srcs = L.d.bed(L.bed); }
      L.d.ev.forEach((e, i) => {
        // first time in range, or back after a pause: start fresh rather than firing a backlog
        if (L.next[i] < now - 0.5) L.next[i] = e.sync ? Math.max(e.sync(), now) : now + rand(0, e.every());
        while (L.next[i] < now + 0.2) { e.fire(L.next[i], L.g); L.next[i] += e.every(); }
      });
    } else {
      L.next.fill(0);
      L.idle += dt;
      if (L.bed && L.idle > 3) { // silent for a while: stop the beds so faraway zones cost nothing
        for (const s of L.srcs) try { s.stop(); } catch { /* already stopped */ }
        L.bed.disconnect(); L.bed = null; L.srcs = [];
      }
    }
  }
}
