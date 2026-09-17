import type { BeatEvent, RhythmLayer } from './types';

const SCHEDULE_AHEAD_TIME = 0.12;
const LOOKAHEAD_INTERVAL_MS = 25;
const START_LEAD = 0.08;
const ACCENT_EPSILON = 0.004;

interface LayerRuntime {
  nextIndex: number;
}

/**
 * Look-ahead scheduler in the style of "A Tale of Two Clocks": a setInterval
 * timer periodically schedules oscillator events a short window ahead using
 * AudioContext.currentTime, so audio timing never depends on setTimeout/RAF
 * jitter. Visual code reads getPhase()/getAudioTime() from the same clock.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private timerId: number | null = null;
  private layers: RhythmLayer[] = [];
  private runtime = new Map<string, LayerRuntime>();

  private baseStartTime = 0;
  private cycleDuration = 1;
  private playing = false;
  private hasStarted = false;
  private frozenPhase = 0;

  private beatListeners = new Set<(events: BeatEvent[]) => void>();

  get isPlaying() {
    return this.playing;
  }

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.9;
      this.masterGain.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  getAudioTime(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  /** Fraction 0..1 of the shared base cycle, for canvas rendering. */
  getPhase(): number {
    if (!this.playing) return this.frozenPhase;
    const ctx = this.ctx;
    if (!ctx) return 0;
    const raw = (ctx.currentTime - this.baseStartTime) / this.cycleDuration;
    return ((raw % 1) + 1) % 1;
  }

  setLayers(layers: RhythmLayer[]) {
    const prevLayers = this.layers;
    this.layers = layers;
    for (const layer of layers) {
      const existing = this.runtime.get(layer.id);
      const prev = prevLayers.find((l) => l.id === layer.id);
      if (!existing) {
        this.runtime.set(layer.id, {
          nextIndex: this.playing ? this.computeNextIndex(layer) : 0,
        });
      } else if (this.playing && prev && prev.n !== layer.n) {
        this.runtime.set(layer.id, { nextIndex: this.computeNextIndex(layer) });
      }
    }
    for (const id of Array.from(this.runtime.keys())) {
      if (!layers.some((l) => l.id === id)) this.runtime.delete(id);
    }
  }

  /** Change the shared cycle length without discontinuity: the current
   * phase position is preserved so all layers keep their relative timing. */
  setTempo(cycleDuration: number) {
    if (cycleDuration <= 0) return;
    if (this.playing) {
      const ctx = this.ensureContext();
      const now = ctx.currentTime;
      const raw = (now - this.baseStartTime) / this.cycleDuration;
      const normalizedPhase = ((raw % 1) + 1) % 1;
      this.baseStartTime = now - normalizedPhase * cycleDuration;
      this.cycleDuration = cycleDuration;
      for (const layer of this.layers) {
        this.runtime.set(layer.id, { nextIndex: this.computeNextIndex(layer) });
      }
    } else {
      this.cycleDuration = cycleDuration;
    }
  }

  start() {
    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') void ctx.resume();
    if (this.playing) return;

    if (this.hasStarted) {
      this.baseStartTime = ctx.currentTime - this.frozenPhase * this.cycleDuration;
    } else {
      this.baseStartTime = ctx.currentTime + START_LEAD;
      this.hasStarted = true;
    }
    this.playing = true;
    for (const layer of this.layers) {
      this.runtime.set(layer.id, { nextIndex: this.computeNextIndex(layer) });
    }
    this.timerId = window.setInterval(() => this.schedulerTick(), LOOKAHEAD_INTERVAL_MS);
    this.schedulerTick();
  }

  pause() {
    if (!this.playing) return;
    const ctx = this.ensureContext();
    const raw = (ctx.currentTime - this.baseStartTime) / this.cycleDuration;
    this.frozenPhase = ((raw % 1) + 1) % 1;
    this.playing = false;
    if (this.timerId !== null) {
      window.clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  reset() {
    if (this.timerId !== null) {
      window.clearInterval(this.timerId);
      this.timerId = null;
    }
    this.playing = false;
    this.hasStarted = false;
    this.frozenPhase = 0;
    this.baseStartTime = 0;
    for (const layer of this.layers) {
      this.runtime.set(layer.id, { nextIndex: 0 });
    }
  }

  onBeat(cb: (events: BeatEvent[]) => void): () => void {
    this.beatListeners.add(cb);
    return () => this.beatListeners.delete(cb);
  }

  dispose() {
    if (this.timerId !== null) window.clearInterval(this.timerId);
    this.timerId = null;
    this.beatListeners.clear();
    this.masterGain?.disconnect();
    void this.ctx?.close();
    this.ctx = null;
  }

  private computeNextIndex(layer: RhythmLayer): number {
    const ctx = this.ensureContext();
    const interval = this.cycleDuration / layer.n;
    return Math.max(0, Math.ceil((ctx.currentTime - this.baseStartTime) / interval));
  }

  private schedulerTick() {
    const ctx = this.ensureContext();
    const scheduleUntil = ctx.currentTime + SCHEDULE_AHEAD_TIME;
    const pending: { layer: RhythmLayer; time: number; idx: number }[] = [];

    for (const layer of this.layers) {
      const rt = this.runtime.get(layer.id);
      if (!rt) continue;
      const interval = this.cycleDuration / layer.n;
      let idx = rt.nextIndex;
      let time = this.baseStartTime + idx * interval;
      while (time < scheduleUntil) {
        pending.push({ layer, time, idx });
        idx += 1;
        time = this.baseStartTime + idx * interval;
      }
      rt.nextIndex = idx;
    }

    if (pending.length === 0) return;
    pending.sort((a, b) => a.time - b.time);

    const events: BeatEvent[] = [];
    for (let i = 0; i < pending.length; i++) {
      const { layer, time, idx } = pending[i];
      let isAccent = false;
      for (let j = 0; j < pending.length; j++) {
        if (i === j || pending[j].layer.id === layer.id) continue;
        if (Math.abs(pending[j].time - time) < ACCENT_EPSILON) {
          isAccent = true;
          break;
        }
      }
      this.triggerSound(layer, time, isAccent);
      events.push({ layerId: layer.id, time, vertexIndex: idx % layer.n, isAccent });
    }

    if (this.beatListeners.size) {
      for (const cb of this.beatListeners) cb(events);
    }
  }

  private triggerSound(layer: RhythmLayer, time: number, isAccent: boolean) {
    if (layer.muted || layer.volume <= 0) return;
    const ctx = this.ensureContext();
    const osc = ctx.createOscillator();
    osc.type = layer.waveform;
    osc.frequency.setValueAtTime(layer.frequency, time);

    const gain = ctx.createGain();
    const peak = Math.min(1, layer.volume * (isAccent ? 1.4 : 1));
    const decay = isAccent ? 0.3 : 0.16;
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(peak, time + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + decay);

    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(time);
    osc.stop(time + decay + 0.02);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }
}
