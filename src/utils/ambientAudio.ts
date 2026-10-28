/**
 * Pure Web Audio API Ambient Sound Generator
 * Generates offline synthetic soundscapes for deep focus and study blocks.
 * Zero external audio files or network requests required.
 */

export type AmbientSoundType = 'off' | 'flute' | 'tibetanBowls' | 'thetaMeditation' | 'rain' | 'brownNoise' | 'binaural';

class AmbientAudioEngine {
  private ctx: AudioContext | null = null;
  private currentType: AmbientSoundType = 'off';
  private gainNode: GainNode | null = null;
  private volume: number = 0.5;
  private activeNodes: AudioNode[] = [];
  private rainInterval: any = null;
  private fluteInterval: any = null;
  private bowlsInterval: any = null;
  private thetaInterval: any = null;

  private initContext(): boolean {
    if (typeof window === 'undefined') return false;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return false;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return true;
  }

  public getSoundType(): AmbientSoundType {
    return this.currentType;
  }

  public getVolume(): number {
    return this.volume;
  }

  public setVolume(val: number): void {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.gainNode && this.ctx) {
      this.gainNode.gain.setTargetAtTime(this.volume * 0.35, this.ctx.currentTime, 0.05);
    }
  }

  public stop(): void {
    if (this.rainInterval) {
      clearInterval(this.rainInterval);
      this.rainInterval = null;
    }

    if (this.fluteInterval) {
      clearInterval(this.fluteInterval);
      this.fluteInterval = null;
    }

    if (this.bowlsInterval) {
      clearInterval(this.bowlsInterval);
      this.bowlsInterval = null;
    }

    if (this.thetaInterval) {
      clearInterval(this.thetaInterval);
      this.thetaInterval = null;
    }

    this.activeNodes.forEach((node) => {
      try {
        if ('stop' in node && typeof (node as AudioScheduledSourceNode).stop === 'function') {
          (node as AudioScheduledSourceNode).stop();
        }
        node.disconnect();
      } catch {
        // Ignore
      }
    });

    this.activeNodes = [];
    this.currentType = 'off';
  }

  public play(type: AmbientSoundType): void {
    this.stop();
    if (type === 'off') return;
    if (!this.initContext() || !this.ctx) return;

    this.currentType = type;

    // Master gain
    const masterGain = this.ctx.createGain();
    masterGain.gain.setValueAtTime(this.volume * 0.35, this.ctx.currentTime);
    masterGain.connect(this.ctx.destination);
    this.gainNode = masterGain;

    if (type === 'brownNoise') {
      this.playBrownNoise(masterGain);
    } else if (type === 'rain') {
      this.playRain(masterGain);
    } else if (type === 'binaural') {
      this.playBinaural(masterGain);
    } else if (type === 'flute') {
      this.playFlute(masterGain);
    } else if (type === 'tibetanBowls') {
      this.playTibetanBowls(masterGain);
    } else if (type === 'thetaMeditation') {
      this.playThetaMeditation(masterGain);
    }
  }

  private playBrownNoise(destination: GainNode): void {
    if (!this.ctx) return;
    const bufferSize = 2 * this.ctx.sampleRate;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let lastOut = 0.0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = output[i];
      output[i] *= 3.5; // Gain compensation
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    // Lowpass filter for smooth, deep rumble
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450, this.ctx.currentTime);

    whiteNoise.connect(filter);
    filter.connect(destination);
    whiteNoise.start();

    this.activeNodes.push(whiteNoise, filter);
  }

  private playRain(destination: GainNode): void {
    if (!this.ctx) return;

    // 1. Continuous rain hiss (pink noise with bandpass)
    const bufferSize = 2 * this.ctx.sampleRate;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      output[i] *= 0.11;
      b6 = white * 0.115926;
    }

    const rainSource = this.ctx.createBufferSource();
    rainSource.buffer = noiseBuffer;
    rainSource.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1200, this.ctx.currentTime);

    rainSource.connect(filter);
    filter.connect(destination);
    rainSource.start();
    this.activeNodes.push(rainSource, filter);

    // 2. Randomized droplet pings
    this.rainInterval = setInterval(() => {
      if (!this.ctx || this.currentType !== 'rain') return;
      try {
        const osc = this.ctx.createOscillator();
        const dropGain = this.ctx.createGain();
        const freq = 1400 + Math.random() * 800;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.08);

        dropGain.gain.setValueAtTime(0.02 * Math.random(), this.ctx.currentTime);
        dropGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.08);

        osc.connect(dropGain);
        dropGain.connect(destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.09);
      } catch {
        // Ignore
      }
    }, 280);
  }

  private playBinaural(destination: GainNode): void {
    if (!this.ctx) return;

    // Stereo panner or left/right separation for 10Hz Alpha Focus Wave
    // Base frequency 216Hz Left, 226Hz Right -> 10Hz Alpha Beat
    const baseFreq = 216;
    const beatFreq = 10;

    const oscLeft = this.ctx.createOscillator();
    const oscRight = this.ctx.createOscillator();

    oscLeft.type = 'sine';
    oscRight.type = 'sine';

    oscLeft.frequency.setValueAtTime(baseFreq, this.ctx.currentTime);
    oscRight.frequency.setValueAtTime(baseFreq + beatFreq, this.ctx.currentTime);

    const merger = this.ctx.createChannelMerger(2);
    oscLeft.connect(merger, 0, 0);
    oscRight.connect(merger, 0, 1);

    const binauralGain = this.ctx.createGain();
    binauralGain.gain.setValueAtTime(0.2, this.ctx.currentTime);

    merger.connect(binauralGain);
    binauralGain.connect(destination);

    oscLeft.start();
    oscRight.start();

    this.activeNodes.push(oscLeft, oscRight, merger, binauralGain);
  }

  private playFlute(destination: GainNode): void {
    if (!this.ctx) return;

    // 1. Deep Meditative Tanpura / Ambient Bamboo Drone (D3 root 146.83Hz + A2 fifth 110Hz + D4 octave)
    const droneRoot = this.ctx.createOscillator();
    droneRoot.type = 'sine';
    droneRoot.frequency.setValueAtTime(146.83, this.ctx.currentTime);

    const droneFifth = this.ctx.createOscillator();
    droneFifth.type = 'sine';
    droneFifth.frequency.setValueAtTime(110.00, this.ctx.currentTime);

    const droneFilter = this.ctx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.setValueAtTime(280, this.ctx.currentTime);

    const droneGain = this.ctx.createGain();
    droneGain.gain.setValueAtTime(0.08, this.ctx.currentTime);

    droneRoot.connect(droneFilter);
    droneFifth.connect(droneFilter);
    droneFilter.connect(droneGain);
    droneGain.connect(destination);

    droneRoot.start();
    droneFifth.start();
    this.activeNodes.push(droneRoot, droneFifth, droneFilter, droneGain);

    // 2. Spatial Sacred Temple Reverb Delay
    const delay = this.ctx.createDelay();
    delay.delayTime.setValueAtTime(0.44, this.ctx.currentTime);

    const delayFeedback = this.ctx.createGain();
    delayFeedback.gain.setValueAtTime(0.42, this.ctx.currentTime);

    const delayDamp = this.ctx.createBiquadFilter();
    delayDamp.type = 'lowpass';
    delayDamp.frequency.setValueAtTime(1600, this.ctx.currentTime);

    delay.connect(delayDamp);
    delayDamp.connect(delayFeedback);
    delayFeedback.connect(delay);
    delay.connect(destination);
    this.activeNodes.push(delay, delayFeedback, delayDamp);

    // 3. Breath Turbulence Air Noise Buffer
    const noiseBufferSize = 2 * this.ctx.sampleRate;
    const noiseBuffer = this.ctx.createBuffer(1, noiseBufferSize, this.ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < noiseBufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.992 * b0 + white * 0.045;
      b1 = 0.96 * b1 + white * 0.09;
      b2 = 0.86 * b2 + white * 0.18;
      noiseData[i] = (b0 + b1 + b2 + white * 0.12) * 0.18;
    }

    // 4. Meditative Spiritual Bansuri Scale (Raga Bhupali / Peace Pentatonic: D4, E4, F#4, A4, B4, D5)
    const notesSequence = [
      { freq: 440.00, dur: 5.6 }, // A4
      { freq: 369.99, dur: 5.0 }, // F#4
      { freq: 493.88, dur: 5.8 }, // B4
      { freq: 440.00, dur: 5.2 }, // A4
      { freq: 587.33, dur: 6.2 }, // D5 (High spiritual elevation)
      { freq: 493.88, dur: 4.8 }, // B4
      { freq: 369.99, dur: 5.4 }, // F#4
      { freq: 293.66, dur: 6.8 }, // D4 (Deep peaceful grounding root)
      { freq: 329.63, dur: 5.0 }, // E4
      { freq: 369.99, dur: 5.2 }, // F#4
      { freq: 440.00, dur: 6.0 }, // A4
    ];

    let noteIdx = 0;

    const playNextFluteNote = () => {
      if (!this.ctx || this.currentType !== 'flute') return;

      try {
        const currentNote = notesSequence[noteIdx % notesSequence.length];
        noteIdx++;

        const now = this.ctx.currentTime;
        const dur = currentNote.dur;
        const noteFreq = currentNote.freq;

        // Warm living vibrato LFO (4.6 Hz slow serene modulation)
        const lfo = this.ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(4.6, now);

        const lfoGain = this.ctx.createGain();
        lfoGain.gain.setValueAtTime(5.8, now);
        lfo.connect(lfoGain);

        // Fundamental Bamboo Tone (Pure, warm sine wave)
        const osc1 = this.ctx.createOscillator();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(noteFreq, now);
        lfoGain.connect(osc1.frequency);

        // 2nd Harmonic (Octave overtone for hollow wood bamboo resonance)
        const osc2 = this.ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(noteFreq * 2, now);
        lfoGain.connect(osc2.frequency);

        // Harmonic balance gains
        const osc1Gain = this.ctx.createGain();
        osc1Gain.gain.setValueAtTime(0.68, now);
        osc1.connect(osc1Gain);

        const osc2Gain = this.ctx.createGain();
        osc2Gain.gain.setValueAtTime(0.14, now);
        osc2.connect(osc2Gain);

        // Breath air stream
        const breathSource = this.ctx.createBufferSource();
        breathSource.buffer = noiseBuffer;
        breathSource.loop = true;

        const breathFilter = this.ctx.createBiquadFilter();
        breathFilter.type = 'bandpass';
        breathFilter.frequency.setValueAtTime(noteFreq * 1.5, now);
        breathFilter.Q.setValueAtTime(6.0, now);

        const breathGain = this.ctx.createGain();
        breathSource.connect(breathFilter);
        breathFilter.connect(breathGain);

        // Flute meditative breath envelope (slow peaceful inhalation & exhalation)
        const noteEnvelope = this.ctx.createGain();
        noteEnvelope.gain.setValueAtTime(0.0001, now);
        noteEnvelope.gain.exponentialRampToValueAtTime(0.25, now + 1.4);
        noteEnvelope.gain.setValueAtTime(0.23, now + dur - 1.4);
        noteEnvelope.gain.exponentialRampToValueAtTime(0.0001, now + dur);

        // Breath air envelope
        breathGain.gain.setValueAtTime(0.0001, now);
        breathGain.gain.exponentialRampToValueAtTime(0.04, now + 1.0);
        breathGain.gain.exponentialRampToValueAtTime(0.0001, now + dur - 0.3);

        osc1Gain.connect(noteEnvelope);
        osc2Gain.connect(noteEnvelope);
        breathGain.connect(noteEnvelope);

        noteEnvelope.connect(destination);
        noteEnvelope.connect(delay);

        lfo.start(now);
        osc1.start(now);
        osc2.start(now);
        breathSource.start(now);

        const stopTime = now + dur + 0.05;
        lfo.stop(stopTime);
        osc1.stop(stopTime);
        osc2.stop(stopTime);
        breathSource.stop(stopTime);

        this.activeNodes.push(lfo, osc1, osc2, breathSource, noteEnvelope, osc1Gain, osc2Gain, breathGain, breathFilter);
      } catch {
        // Ignore
      }
    };

    playNextFluteNote();

    this.fluteInterval = setInterval(() => {
      if (this.currentType === 'flute') {
        playNextFluteNote();
      }
    }, 5400);
  }

  private playTibetanBowls(destination: GainNode): void {
    if (!this.ctx) return;

    // 1. Warm Background Singing Hum (Continuous metal friction singing resonance ~216Hz & 432Hz)
    const humOsc1 = this.ctx.createOscillator();
    const humOsc2 = this.ctx.createOscillator();
    humOsc1.type = 'sine';
    humOsc2.type = 'sine';
    humOsc1.frequency.setValueAtTime(216.0, this.ctx.currentTime);
    humOsc2.frequency.setValueAtTime(218.4, this.ctx.currentTime); // 2.4Hz warm singing beat

    const humGain = this.ctx.createGain();
    humGain.gain.setValueAtTime(0.07, this.ctx.currentTime);

    humOsc1.connect(humGain);
    humOsc2.connect(humGain);
    humGain.connect(destination);
    humOsc1.start();
    humOsc2.start();
    this.activeNodes.push(humOsc1, humOsc2, humGain);

    // 2. Spatial Temple Delay
    const delay = this.ctx.createDelay();
    delay.delayTime.setValueAtTime(0.48, this.ctx.currentTime);

    const delayFeedback = this.ctx.createGain();
    delayFeedback.gain.setValueAtTime(0.40, this.ctx.currentTime);

    const delayDamp = this.ctx.createBiquadFilter();
    delayDamp.type = 'lowpass';
    delayDamp.frequency.setValueAtTime(2200, this.ctx.currentTime);

    delay.connect(delayDamp);
    delayDamp.connect(delayFeedback);
    delayFeedback.connect(delay);
    delay.connect(destination);
    this.activeNodes.push(delay, delayFeedback, delayDamp);

    // 3. Periodic Singing Bowl Strikes with Rich Inharmonic Metallic Rings
    // Bowls tuned to heart & crown frequencies (216Hz, 288Hz, 432Hz, 576Hz)
    const bowlPitches = [
      { base: 216.0, ringTime: 9.0 },
      { base: 432.0, ringTime: 8.5 },
      { base: 288.0, ringTime: 9.5 },
      { base: 384.0, ringTime: 8.0 },
      { base: 432.0, ringTime: 9.0 },
    ];
    let bowlIdx = 0;

    const strikeBowl = () => {
      if (!this.ctx || this.currentType !== 'tibetanBowls') return;
      try {
        const item = bowlPitches[bowlIdx % bowlPitches.length];
        bowlIdx++;

        const now = this.ctx.currentTime;
        const ring = item.ringTime;
        const f0 = item.base;

        // Tibetan bowls resonate with non-harmonic metal plate modes:
        // Modal frequencies: f0, f0 * 2.76, f0 * 5.4, with micro-beating
        const modes = [
          { freq: f0, amp: 0.35 },
          { freq: f0 + 2.1, amp: 0.30 }, // Beating shimmer
          { freq: f0 * 2.76, amp: 0.16 }, // First non-integer metal overtone
          { freq: f0 * 5.40, amp: 0.08 }, // Shimmering high rim
        ];

        const strikeMaster = this.ctx.createGain();
        strikeMaster.gain.setValueAtTime(0.0001, now);
        // Soft mallet strike attack (0.04s)
        strikeMaster.gain.linearRampToValueAtTime(0.32, now + 0.04);
        // Long, shimmering natural decay
        strikeMaster.gain.exponentialRampToValueAtTime(0.0001, now + ring);

        strikeMaster.connect(destination);
        strikeMaster.connect(delay);

        modes.forEach((mode) => {
          if (!this.ctx) return;
          const osc = this.ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(mode.freq, now);

          const g = this.ctx.createGain();
          g.gain.setValueAtTime(mode.amp, now);

          osc.connect(g);
          g.connect(strikeMaster);

          osc.start(now);
          osc.stop(now + ring + 0.1);
          this.activeNodes.push(osc, g);
        });

        this.activeNodes.push(strikeMaster);
      } catch {
        // Ignore
      }
    };

    strikeBowl();

    this.bowlsInterval = setInterval(() => {
      if (this.currentType === 'tibetanBowls') {
        strikeBowl();
      }
    }, 7800);
  }

  private playThetaMeditation(destination: GainNode): void {
    if (!this.ctx) return;

    // 1. Sacred 432Hz Binaural Beat (432Hz Left / 438Hz Right -> Pure 6Hz Theta Brainwave)
    // 6Hz Theta frequency is linked to deep meditation, flow-state memory, and mental calm
    const baseFreq = 432.0;
    const thetaBeat = 6.0;

    const oscL = this.ctx.createOscillator();
    const oscR = this.ctx.createOscillator();
    oscL.type = 'sine';
    oscR.type = 'sine';

    oscL.frequency.setValueAtTime(baseFreq, this.ctx.currentTime);
    oscR.frequency.setValueAtTime(baseFreq + thetaBeat, this.ctx.currentTime);

    const merger = this.ctx.createChannelMerger(2);
    oscL.connect(merger, 0, 0);
    oscR.connect(merger, 0, 1);

    const thetaGain = this.ctx.createGain();
    thetaGain.gain.setValueAtTime(0.18, this.ctx.currentTime);
    merger.connect(thetaGain);
    thetaGain.connect(destination);

    oscL.start();
    oscR.start();
    this.activeNodes.push(oscL, oscR, merger, thetaGain);

    // 2. Harmonic Sacred 5th Celestial Pad Drone (648Hz = 432 * 1.5, lowpass filtered for warmth)
    const padOsc = this.ctx.createOscillator();
    padOsc.type = 'sine';
    padOsc.frequency.setValueAtTime(648.0, this.ctx.currentTime);

    const padFilter = this.ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.setValueAtTime(480, this.ctx.currentTime);

    const padGain = this.ctx.createGain();
    padGain.gain.setValueAtTime(0.06, this.ctx.currentTime);

    padOsc.connect(padFilter);
    padFilter.connect(padGain);
    padGain.connect(destination);
    padOsc.start();
    this.activeNodes.push(padOsc, padFilter, padGain);

    // 3. Ethereal Zen Wind Chimes / Bell Harmonics (1296Hz, 1728Hz, 2160Hz)
    const chimeFrequencies = [1296, 1728, 2160, 1512];
    const triggerChime = () => {
      if (!this.ctx || this.currentType !== 'thetaMeditation') return;
      try {
        const freq = chimeFrequencies[Math.floor(Math.random() * chimeFrequencies.length)];
        const now = this.ctx.currentTime;
        const dur = 4.2;

        const chimeOsc = this.ctx.createOscillator();
        chimeOsc.type = 'sine';
        chimeOsc.frequency.setValueAtTime(freq, now);

        const chimeGain = this.ctx.createGain();
        chimeGain.gain.setValueAtTime(0.0001, now);
        chimeGain.gain.linearRampToValueAtTime(0.04, now + 0.02);
        chimeGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

        chimeOsc.connect(chimeGain);
        chimeGain.connect(destination);

        chimeOsc.start(now);
        chimeOsc.stop(now + dur + 0.05);
        this.activeNodes.push(chimeOsc, chimeGain);
      } catch {
        // Ignore
      }
    };

    triggerChime();

    this.thetaInterval = setInterval(() => {
      if (this.currentType === 'thetaMeditation') {
        triggerChime();
      }
    }, 6200);
  }
}

export const ambientAudio = new AmbientAudioEngine();
