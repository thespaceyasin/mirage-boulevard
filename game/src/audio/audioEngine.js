// 100% Offline Procedural Web Audio API Engine & 4-Station Coastal Radio:
// dynamic engine RPM synthesizer, drift tire screech, police siren wail,
// 5 weapon SFX, explosions, UI cues, and real-time synthesized music stations.

import { RADIO_STATIONS } from '../engine/gameConfig.js';

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.muted = false;
    this.stationIndex = 0;

    // Continuous nodes
    this.engineOscA = null;
    this.engineOscB = null;
    this.engineGain = null;
    this.engineFilter = null;

    this.sirenOsc = null;
    this.sirenGain = null;

    this.screechGain = null;
    this.noiseBuffer = null;

    this.radioTimer = 0;
    this.radioStep = 0;
  }

  get currentStation() {
    return RADIO_STATIONS[this.stationIndex];
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;

    this.ctx = new AC();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.muted ? 0 : 0.42;
    this.masterGain.connect(this.ctx.destination);

    // Reusable 1.5s white noise buffer for guns, explosions & tire screech
    const sr = this.ctx.sampleRate;
    this.noiseBuffer = this.ctx.createBuffer(1, Math.floor(sr * 1.5), sr);
    const ch = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < ch.length; i += 1) {
      ch[i] = Math.random() * 2 - 1;
    }

    // Engine loop
    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 320;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;

    this.engineOscA = this.ctx.createOscillator();
    this.engineOscA.type = 'sawtooth';
    this.engineOscA.frequency.value = 55;

    this.engineOscB = this.ctx.createOscillator();
    this.engineOscB.type = 'triangle';
    this.engineOscB.frequency.value = 110;

    this.engineOscA.connect(this.engineFilter);
    this.engineOscB.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain).connect(this.masterGain);
    this.engineOscA.start();
    this.engineOscB.start();

    // Police siren loop
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenOsc.frequency.value = 660;
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain).connect(this.masterGain);
    this.sirenOsc.start();

    // Tire drift screech loop
    const screechSrc = this.ctx.createBufferSource();
    screechSrc.buffer = this.noiseBuffer;
    screechSrc.loop = true;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1850;
    bp.Q.value = 6.5;
    this.screechGain = this.ctx.createGain();
    this.screechGain.gain.value = 0;
    screechSrc.connect(bp).connect(this.screechGain).connect(this.masterGain);
    screechSrc.start();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : 0.42, this.ctx.currentTime, 0.04);
    }
    return !this.muted;
  }

  nextRadioStation() {
    this.stationIndex = (this.stationIndex + 1) % RADIO_STATIONS.length;
    this.radioStep = 0;
    this.playUiClick(640);
    return this.currentStation;
  }

  updateContinuous(dt, elapsed, { inVehicle, speed, drifting, nitroActive, wantedLevel, paused }) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;

    if (paused || this.muted) {
      this.engineGain.gain.setTargetAtTime(0, now, 0.08);
      this.sirenGain.gain.setTargetAtTime(0, now, 0.08);
      this.screechGain.gain.setTargetAtTime(0, now, 0.08);
      return;
    }

    // Engine pitch & harmonic filter tied to speed + simulated 5-speed gear shift
    if (inVehicle) {
      const gearMod = ((speed % 12) / 12);
      const baseHz = 48 + speed * 2.1 + gearMod * 26 + (nitroActive ? 42 : 0);
      this.engineOscA.frequency.setTargetAtTime(baseHz, now, 0.05);
      this.engineOscB.frequency.setTargetAtTime(baseHz * 1.98, now, 0.05);
      this.engineFilter.frequency.setTargetAtTime(280 + speed * 26 + (nitroActive ? 600 : 0), now, 0.06);
      this.engineGain.gain.setTargetAtTime(0.085 + Math.min(0.09, speed * 0.002), now, 0.06);
    } else {
      this.engineGain.gain.setTargetAtTime(0, now, 0.1);
    }

    // Drift tire screech
    this.screechGain.gain.setTargetAtTime(inVehicle && drifting ? 0.12 : 0, now, 0.05);

    // Police siren wail when Wanted >= 1
    if (wantedLevel > 0) {
      const wail = 620 + Math.sin(elapsed * (wantedLevel >= 3 ? 6.5 : 3.6)) * 240;
      this.sirenOsc.frequency.setTargetAtTime(wail, now, 0.04);
      this.sirenGain.gain.setTargetAtTime(0.045, now, 0.1);
    } else {
      this.sirenGain.gain.setTargetAtTime(0, now, 0.12);
    }

    // Procedural Radio Sequencer
    const st = this.currentStation;
    if (st.style !== 'off' && st.bpm > 0) {
      const stepDur = 60 / st.bpm / 2; // eighth-note pulse
      this.radioTimer += dt;
      if (this.radioTimer >= stepDur) {
        this.radioTimer -= stepDur;
        this._playRadioBeat(st.style, this.radioStep++);
      }
    }
  }

  _playRadioBeat(style, step) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const barStep = step % 16;

    if (style === 'synthwave') {
      // Warm coastal sunset synthwave (A minor / F / C / G progression)
      const bassRoots = [110, 110, 87.31, 87.31, 130.81, 130.81, 98, 98];
      const root = bassRoots[Math.floor((step / 8) % bassRoots.length)];
      this._tone(root, 'sawtooth', 0.14, 0.055, now, 420);
      const arp = [1, 1.5, 2, 1.5, 2.5, 2, 1.5, 1.25];
      if (barStep % 2 === 0) {
        this._tone(root * 2 * arp[(barStep / 2) % arp.length], 'triangle', 0.18, 0.04, now, 1800);
      }
      if (barStep % 4 === 0) this._kick(now, 0.09);
      if (barStep % 8 === 4) this._noiseHit(now, 0.09, 1400, 0.045);
    } else if (style === 'electro') {
      const notes = [65.41, 65.41, 77.78, 98, 73.42, 65.41, 116.54, 98];
      const f = notes[barStep % notes.length];
      this._tone(f, 'square', 0.11, 0.042, now, 650);
      if (barStep % 2 === 0) this._kick(now, 0.09);
      if (barStep % 4 === 2) this._noiseHit(now, 0.05, 5200, 0.032);
    } else if (style === 'lounge') {
      if (barStep === 0 || barStep === 8) {
        const chord = barStep === 0 ? [261.63, 329.63, 392, 493.88] : [220, 261.63, 329.63, 392];
        for (const freq of chord) this._tone(freq, 'sine', 0.55, 0.024, now, 1400);
      }
      if (barStep % 4 === 0) this._kick(now, 0.055);
      if (barStep % 2 === 1) this._noiseHit(now, 0.03, 6200, 0.018);
    } else if (style === 'scanner') {
      if (barStep === 0) this._tone(1180, 'sine', 0.09, 0.03, now, 2200);
      if (barStep === 6) this._noiseHit(now, 0.14, 1600, 0.025);
    }
  }

  _tone(freq, type, dur, vol, startTime, filterHz = 2200) {
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);
    filter.type = 'lowpass';
    filter.frequency.value = filterHz;
    gain.gain.setValueAtTime(vol, startTime);
    gain.gain.exponentialRampToValueAtTime(0.0008, startTime + dur);
    osc.connect(filter).connect(gain).connect(this.masterGain);
    osc.start(startTime);
    osc.stop(startTime + dur + 0.02);
  }

  _kick(startTime, vol = 0.1) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(125, startTime);
    osc.frequency.exponentialRampToValueAtTime(38, startTime + 0.12);
    gain.gain.setValueAtTime(vol, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.15);
    osc.connect(gain).connect(this.masterGain);
    osc.start(startTime);
    osc.stop(startTime + 0.17);
  }

  _noiseHit(startTime, dur, filterHz, vol) {
    if (!this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const flt = this.ctx.createBiquadFilter();
    flt.type = 'bandpass';
    flt.frequency.value = filterHz;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, startTime);
    gain.gain.exponentialRampToValueAtTime(0.0008, startTime + dur);
    src.connect(flt).connect(gain).connect(this.masterGain);
    src.start(startTime);
    src.stop(startTime + dur + 0.02);
  }

  playWeaponShot(weaponId, volumeScale = 1.0) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const jitter = 0.94 + Math.random() * 0.12;
    if (weaponId === 'shotgun') {
      this._noiseHit(now, 0.24, 650 * jitter, 0.34 * volumeScale);
      this._kick(now, 0.28 * volumeScale);
    } else if (weaponId === 'rpg') {
      this._noiseHit(now, 0.45, 520, 0.28 * volumeScale);
      this._tone(160, 'sawtooth', 0.32, 0.12 * volumeScale, now, 620);
    } else if (weaponId === 'carbine') {
      this._noiseHit(now, 0.13, 1450 * jitter, 0.24 * volumeScale);
      this._tone(190 * jitter, 'triangle', 0.07, 0.12 * volumeScale, now, 900);
    } else if (weaponId === 'smg') {
      this._noiseHit(now, 0.07, 2100 * jitter, 0.16 * volumeScale);
    } else {
      this._noiseHit(now, 0.1, 1650 * jitter, 0.2 * volumeScale);
      this._tone(240 * jitter, 'triangle', 0.055, 0.09 * volumeScale, now, 1100);
    }
  }

  playExplosion(scale = 1.0) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    this._noiseHit(now, 0.85, 220, 0.45 * scale);
    this._noiseHit(now, 0.42, 950, 0.25 * scale);
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(95, now);
    osc.frequency.exponentialRampToValueAtTime(24, now + 0.6);
    gain.gain.setValueAtTime(0.42 * scale, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
    osc.connect(gain).connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.7);
  }

  playPickup() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    this._tone(587.33, 'sine', 0.12, 0.12, now);
    this._tone(880, 'sine', 0.18, 0.12, now + 0.08);
  }

  playMissionComplete() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, idx) => {
      this._tone(f, 'triangle', 0.26, 0.12, now + idx * 0.09, 2600);
    });
  }

  playAbility(id) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const base = id === 'blackout' ? 280 : id === 'nitro' ? 420 : 620;
    this._tone(base, 'sawtooth', 0.24, 0.11, now, 1400);
    this._tone(base * 1.5, 'sine', 0.3, 0.1, now + 0.07, 2400);
  }

  playUiClick(freq = 720) {
    if (!this.ctx || this.muted) return;
    this._tone(freq, 'sine', 0.055, 0.07, this.ctx.currentTime, 2400);
  }
}
