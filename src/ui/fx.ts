/*
 * Sound and haptic feedback. Every moment in the game that makes a noise calls fx('<name>'),
 * so this file is the full list of sounds to design. The sounds below are PLACEHOLDERS,
 * synthesised with the Web Audio API so nothing has to be downloaded. To swap one for a
 * designed sound, replace its entry in SOUNDS (e.g. with a function that plays an AudioBuffer).
 *
 * Haptics use navigator.vibrate, which works on Android browsers; iOS Safari ignores it.
 */

export type FxName =
  | 'tap' //          generic button press: top bar, sheet buttons, sort
  | 'tab' //          switching shelf tab (Bases / Catalysts / Binders)
  | 'select' //       choosing a House, theme or toggle in settings
  | 'pickUp' //       starting to drag an ingredient
  | 'place' //        an ingredient lands in its slot
  | 'remove' //       an ingredient goes back to the shelf
  | 'reject' //       dropped on the wrong slot
  | 'crossOut' //     ruling an ingredient out
  | 'restore' //      un-ruling an ingredient
  | 'notesOn' //      notes mode switched on
  | 'notesOff' //     notes mode switched off
  | 'reveal' //       a new clue is revealed
  | 'holdTick' //     while holding the brew button (called with progress 0–1)
  | 'holdCancel' //   brew button released early
  | 'brew' //         hold completed, potion committed
  | 'slotCorrect' //  a slot flips over and was right
  | 'slotWrong' //    a slot flips over and was wrong
  | 'win' //          the potion holds
  | 'lose' //         the potion curdles
  | 'sheetOpen' //    a bottom sheet slides up
  | 'sheetClose'; //  a bottom sheet is dismissed

let enabled = true;
let ctx: AudioContext | null = null;

export function setSoundEnabled(on: boolean) {
  enabled = on;
}

function audio(): AudioContext | null {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null;
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

interface Tone {
  freq: number;
  /** End frequency for a glide. */
  to?: number;
  type?: OscillatorType;
  dur: number;
  delay?: number;
  gain?: number;
}

function tones(list: Tone[]) {
  const ac = audio();
  if (!ac) return;
  const now = ac.currentTime;
  for (const t of list) {
    const start = now + (t.delay ?? 0);
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = t.type ?? 'sine';
    osc.frequency.setValueAtTime(t.freq, start);
    if (t.to) osc.frequency.exponentialRampToValueAtTime(t.to, start + t.dur);
    const peak = t.gain ?? 0.12;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(peak, start + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, start + t.dur);
    osc.connect(g).connect(ac.destination);
    osc.start(start);
    osc.stop(start + t.dur + 0.02);
  }
}

function noise(dur: number, gain = 0.08, filterFreq = 1800) {
  const ac = audio();
  if (!ac) return;
  const buf = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = ac.createBufferSource();
  src.buffer = buf;
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = filterFreq;
  const g = ac.createGain();
  g.gain.value = gain;
  src.connect(filter).connect(g).connect(ac.destination);
  src.start();
}

const SOUNDS: Record<FxName, (progress?: number) => void> = {
  tap: () => tones([{ freq: 660, dur: 0.05, type: 'triangle', gain: 0.07 }]),
  tab: () => tones([{ freq: 520, dur: 0.06, type: 'triangle', gain: 0.07 }]),
  select: () => tones([{ freq: 700, dur: 0.07, type: 'triangle', gain: 0.08 }, { freq: 1050, dur: 0.08, delay: 0.05, gain: 0.06 }]),
  pickUp: () => tones([{ freq: 380, to: 560, dur: 0.08, type: 'triangle', gain: 0.07 }]),
  place: () => {
    tones([{ freq: 300, to: 180, dur: 0.12, type: 'sine', gain: 0.16 }]);
    noise(0.06, 0.05, 2400);
  },
  remove: () => tones([{ freq: 260, to: 420, dur: 0.1, type: 'triangle', gain: 0.08 }]),
  reject: () => tones([{ freq: 160, dur: 0.09, type: 'square', gain: 0.05 }, { freq: 140, dur: 0.1, delay: 0.09, type: 'square', gain: 0.05 }]),
  crossOut: () => noise(0.12, 0.09, 1200),
  restore: () => tones([{ freq: 520, to: 700, dur: 0.08, type: 'triangle', gain: 0.06 }]),
  notesOn: () => tones([{ freq: 600, dur: 0.05, type: 'triangle', gain: 0.07 }, { freq: 900, dur: 0.06, delay: 0.05, type: 'triangle', gain: 0.06 }]),
  notesOff: () => tones([{ freq: 900, dur: 0.05, type: 'triangle', gain: 0.06 }, { freq: 600, dur: 0.06, delay: 0.05, type: 'triangle', gain: 0.07 }]),
  reveal: () => {
    noise(0.14, 0.05, 3200);
    tones([{ freq: 880, dur: 0.18, delay: 0.04, gain: 0.06 }]);
  },
  holdTick: (p = 0) => tones([{ freq: 300 + 500 * p, dur: 0.04, type: 'triangle', gain: 0.05 }]),
  holdCancel: () => tones([{ freq: 400, to: 220, dur: 0.12, type: 'triangle', gain: 0.06 }]),
  brew: () => {
    noise(0.5, 0.08, 600);
    tones([{ freq: 220, to: 440, dur: 0.35, type: 'sine', gain: 0.14 }]);
  },
  slotCorrect: () => tones([{ freq: 784, dur: 0.16, type: 'sine', gain: 0.1 }]),
  slotWrong: () => tones([{ freq: 196, dur: 0.18, type: 'triangle', gain: 0.1 }]),
  win: () =>
    tones([
      { freq: 523, dur: 0.18, gain: 0.1 },
      { freq: 659, dur: 0.18, delay: 0.1, gain: 0.1 },
      { freq: 784, dur: 0.3, delay: 0.2, gain: 0.1 },
      { freq: 1047, dur: 0.45, delay: 0.3, gain: 0.08 },
    ]),
  lose: () =>
    tones([
      { freq: 330, to: 300, dur: 0.25, type: 'triangle', gain: 0.1 },
      { freq: 262, to: 220, dur: 0.45, delay: 0.2, type: 'triangle', gain: 0.1 },
    ]),
  sheetOpen: () => tones([{ freq: 400, to: 600, dur: 0.1, gain: 0.05 }]),
  sheetClose: () => tones([{ freq: 600, to: 400, dur: 0.1, gain: 0.05 }]),
};

const HAPTICS: Partial<Record<FxName, number | number[]>> = {
  tap: 6,
  tab: 6,
  select: 10,
  pickUp: 8,
  place: 14,
  remove: 8,
  reject: [12, 40, 12],
  crossOut: 10,
  restore: 6,
  notesOn: 8,
  notesOff: 8,
  reveal: 10,
  holdTick: 5,
  brew: 30,
  slotCorrect: 12,
  slotWrong: [20, 30, 20],
  win: [20, 60, 20, 60, 40],
  lose: 60,
};

export function fx(name: FxName, progress?: number) {
  const pattern = HAPTICS[name];
  if (pattern !== undefined && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      /* ignore */
    }
  }
  if (!enabled) return;
  try {
    SOUNDS[name](progress);
  } catch {
    /* audio unavailable: play silently */
  }
}
