/**
 * Synthesizes a gentle, calming bell chime using the Web Audio API.
 * Completely offline, zero asset downloads required.
 */
export function playFocusChime(type: 'focus_complete' | 'break_complete' | 'start' = 'focus_complete'): void {
  if (typeof window === 'undefined') return;

  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    if (type === 'start') {
      // Soft single rising note
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(587.33, now + 0.15); // D5

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
      return;
    }

    if (type === 'focus_complete') {
      // Gentle 3-tone peaceful chime (C5 -> E5 -> G5)
      const notes = [523.25, 659.25, 783.99];
      notes.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const noteStart = now + index * 0.18;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, noteStart);

        gain.gain.setValueAtTime(0, noteStart);
        gain.gain.linearRampToValueAtTime(0.18, noteStart + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 1.2);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(noteStart);
        osc.stop(noteStart + 1.2);
      });
      return;
    }

    if (type === 'break_complete') {
      // Gentle 2-tone return chime (G5 -> C6)
      const notes = [783.99, 1046.5];
      notes.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const noteStart = now + index * 0.2;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, noteStart);

        gain.gain.setValueAtTime(0, noteStart);
        gain.gain.linearRampToValueAtTime(0.15, noteStart + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 1.0);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(noteStart);
        osc.stop(noteStart + 1.0);
      });
    }
  } catch (err) {
    // Audio contexts might be blocked by user browser policy until interaction
    console.debug('[FocusAudio] Note synthesis deferred:', err);
  }
}
