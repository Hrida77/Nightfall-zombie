export class GameAudio {
  constructor() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    this.context = AudioContext ? new AudioContext() : null;
    this.lastGroanTime = -Infinity;
    this.gunshotNoiseBuffer = null;
    if (this.context) {
      this.gunshotNoiseBuffer = this.context.createBuffer(
        1,
        Math.floor(this.context.sampleRate * 0.16),
        this.context.sampleRate,
      );
      const samples = this.gunshotNoiseBuffer.getChannelData(0);
      for (let i = 0; i < samples.length; i++) {
        samples[i] = (Math.random() * 2 - 1) * (1 - i / samples.length);
      }
    }
  }

  async unlock() {
    if (this.context?.state === 'suspended') await this.context.resume();
  }

  playGunshot() {
    if (!this.context) return;
    const now = this.context.currentTime;
    const noise = this.context.createBufferSource();
    noise.buffer = this.gunshotNoiseBuffer;
    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1900, now);
    filter.frequency.exponentialRampToValueAtTime(220, now + 0.14);
    const noiseGain = this.context.createGain();
    noiseGain.gain.setValueAtTime(0.35, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    noise.connect(filter).connect(noiseGain).connect(this.context.destination);
    noise.start(now);
    noise.stop(now + 0.16);
    this.tone(88, 42, 0.12, 0.28, 'sawtooth');
  }

  playGroan() {
    if (!this.context) return;
    const now = this.context.currentTime;
    if (now - this.lastGroanTime < 0.55) return;
    this.lastGroanTime = now;
    const frequency = 55 + Math.random() * 32;
    this.tone(frequency, frequency * 0.72, 0.52, 0.13, 'sawtooth');
    this.tone(frequency * 1.48, frequency * 1.1, 0.42, 0.035, 'triangle');
  }

  playHurt() {
    if (!this.context) return;
    this.tone(145, 58, 0.22, 0.2, 'triangle');
  }

  tone(startFrequency, endFrequency, duration, volume, type) {
    if (!this.context) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(startFrequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(endFrequency, 1), now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain).connect(this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }
}
