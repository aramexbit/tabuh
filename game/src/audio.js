// Procedural gamelan music (WebAudio, no audio files). A 16-beat colotomic cycle
// in a slendro-style pentatonic scale: gong marks the cycle, kenong the halves,
// saron carries the melody, bonang interlocks, kendang drives the pulse. The game
// calls onBeat() when its beat clock advances; every sound is synthesized here.
// On top of the music sits a night ambience layer — crickets, wind, a low drone,
// distant owl and frogs — so the village feels haunted even between waves.
// Audio is optional: with no AudioContext (headless probe) every call is a no-op.
const BASE = 220; // A3
const SCALE = [0, 3, 5, 7, 10]; // slendro-style pentatonic, semitones
const MELODY = [0, 2, 4, 2, 1, 2, 3, 4, 0, 2, 4, 3, 2, 1, 0, -1]; // 16 steps
const KENDANG_BEATS = { 0: 'low', 3: 'high', 6: 'low', 8: 'high', 11: 'low', 14: 'high' };

function midiToFreq(semitones) {
  return BASE * Math.pow(2, semitones / 12);
}

export class GamelanAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    try {
      this.muted = localStorage.getItem('tabuh-muted') === '1';
    } catch (e) {
      this.muted = false;
    }
  }

  // Create/resume the context on a user gesture. Returns false when audio is
  // unavailable (headless), in which case the game plays silently.
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      this.startAmbience();
      return true;
    } catch (e) {
      this.ctx = null;
      return false;
    }
  }

  // Night ambience: wind + low drone run continuously; crickets, owl and
  // frogs fire on random timers. Everything routes through the master gain,
  // so mute silences it too. All of it is quiet on purpose.
  startAmbience() {
    if (!this.ctx || this.ambience) return;
    this.ambience = this.ctx.createGain();
    this.ambience.gain.value = 0.6;
    this.ambience.connect(this.master);
    // Wind: looped noise through a lowpass, breathing slowly.
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const wind = this.ctx.createBufferSource();
    wind.buffer = buf;
    wind.loop = true;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 320;
    const windGain = this.ctx.createGain();
    windGain.gain.value = 0.035;
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain);
    lfoGain.connect(windGain.gain);
    wind.connect(lp);
    lp.connect(windGain);
    windGain.connect(this.ambience);
    wind.start();
    lfo.start();
    // Low drone: two detuned sines, barely audible.
    for (const f of [55, 55.7]) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const g = this.ctx.createGain();
      g.gain.value = 0.016;
      osc.connect(g);
      g.connect(this.ambience);
      osc.start();
    }
    // Crickets: short high chirps, random pan and pitch, every ~0.7 s.
    this._cricketTimer = setInterval(() => {
      if (Math.random() < 0.75) this.cricketChirp();
    }, 650);
    // Owl: a two-note hoot every ~24 s.
    this._owlTimer = setInterval(() => {
      if (Math.random() < 0.5) this.owlHoot();
    }, 24000);
    // Frogs: a low croak every ~9 s.
    this._frogTimer = setInterval(() => {
      if (Math.random() < 0.6) this.frogCroak();
    }, 9000);
  }

  _pan(node, pan) {
    if (this.ctx.createStereoPanner) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = pan;
      node.connect(p);
      p.connect(this.ambience);
    } else {
      node.connect(this.ambience);
    }
  }

  cricketChirp() {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + 0.05;
    const base = 4000 + Math.random() * 1200;
    const pulses = 3 + Math.floor(Math.random() * 2);
    const pan = Math.random() * 1.6 - 0.8;
    for (let i = 0; i < pulses; i++) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = base * (1 + (Math.random() - 0.5) * 0.04);
      const g = this.ctx.createGain();
      const t = t0 + i * 0.07;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.04, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      osc.connect(g);
      this._pan(g, pan);
      osc.start(t);
      osc.stop(t + 0.08);
    }
  }

  owlHoot() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + 0.05;
    for (const [dt, f] of [[0, 380], [0.4, 310]]) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, t + dt);
      g.gain.linearRampToValueAtTime(0.045, t + dt + 0.08);
      g.gain.exponentialRampToValueAtTime(0.001, t + dt + 0.38);
      osc.connect(g);
      this._pan(g, Math.random() * 1.2 - 0.6);
      osc.start(t + dt);
      osc.stop(t + dt + 0.42);
    }
  }

  frogCroak() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + 0.05;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(170, t);
    osc.frequency.exponentialRampToValueAtTime(90, t + 0.15);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.035, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.connect(g);
    this._pan(g, Math.random() * 1.4 - 0.7);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  setMuted(m) {
    this.muted = m;
    try {
      localStorage.setItem('tabuh-muted', m ? '1' : '0');
    } catch (e) { /* storage unavailable */ }
    if (this.master && this.ctx) {
      this.master.gain.setValueAtTime(m ? 0 : 0.5, this.ctx.currentTime);
    }
  }

  // Bronze voice: sine + inharmonic partials, exponential decay.
  bronze(freq, dur, gain, partials = [1, 2.76, 5.4]) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const out = this.ctx.createGain();
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(gain, t + 0.008);
    out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    out.connect(this.master);
    partials.forEach((p, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq * p;
      const g = this.ctx.createGain();
      g.gain.value = i === 0 ? 1 : 1 / (i * 3 + 1);
      osc.connect(g);
      g.connect(out);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    });
  }

  // Drum voice: sine pitch drop + a short noise click.
  drum(low) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(low ? 150 : 220, t);
    osc.frequency.exponentialRampToValueAtTime(low ? 55 : 90, t + 0.12);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  // Soft woodblock tick on every beat, so the beat is audible.
  tick() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 1200;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.06, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.06);
  }

  // Called by the game when the beat clock advances to a new beat.
  onBeat(beatIndex) {
    if (!this.ctx || this.muted) return;
    const step = ((beatIndex % 16) + 16) % 16;
    this.tick();
    if (step === 0) this.bronze(midiToFreq(-12), 4.0, 0.5); // gong, low A
    if (step === 8) this.bronze(midiToFreq(-12), 2.5, 0.22); // soft gong
    if (step === 4 || step === 12) this.bronze(midiToFreq(0), 1.6, 0.3); // kenong
    const deg = MELODY[step];
    if (deg >= 0) {
      const f = midiToFreq(SCALE[deg]);
      this.bronze(f, 0.9, 0.22); // saron melody
      // Bonang interlock a touch later, one degree up.
      setTimeout(() => this.bronze(midiToFreq(SCALE[(deg + 2) % 5]), 0.5, 0.12), 140);
    }
    const k = KENDANG_BEATS[step];
    if (k) this.drum(k === 'low');
  }

  // Short metallic ping when a tower strikes. Quieter than the music.
  strike(type) {
    if (!this.ctx || this.muted) return;
    const notes = { saron: 12, kendang: 0, bonang: 7, kenong: 5, gong: -12 };
    const n = notes[type] ?? 7;
    this.bronze(midiToFreq(n), type === 'gong' ? 2.5 : 0.4, type === 'gong' ? 0.3 : 0.1);
  }

  // Victory / defeat stingers.
  fanfare(win) {
    if (!this.ctx || this.muted) return;
    const seq = win ? [0, 3, 5, 7, 10, 12] : [10, 7, 5, 3, 0];
    seq.forEach((n, i) => {
      setTimeout(() => this.bronze(midiToFreq(n), 1.2, 0.25), i * 160);
    });
    if (win) setTimeout(() => this.bronze(midiToFreq(-12), 4.0, 0.5), seq.length * 160);
  }
}
