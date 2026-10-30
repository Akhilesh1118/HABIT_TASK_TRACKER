/**
 * Celebration FX Utility: Pure HTML5 Canvas Confetti & Web Audio Harmonic Fanfare
 * Fully self-contained, lightweight, zero external library dependency.
 */

// Confetti Particle model
interface Particle {
  x: number;
  y: number;
  size: number;
  color: string;
  vx: number;
  vy: number;
  rotation: number;
  vRot: number;
  shape: 'rect' | 'circle' | 'star';
  opacity: number;
}

const CELEBRATION_COLORS = [
  '#10B981', // Emerald
  '#34D399', // Mint
  '#F59E0B', // Amber
  '#FBBF24', // Gold
  '#6366F1', // Indigo
  '#818CF8', // Soft Violet
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#FFFFFF', // White Spark
];

let activeCanvas: HTMLCanvasElement | null = null;
let animationFrameId: number | null = null;

export function triggerConfetti(particleCount: number = 140, durationMs: number = 3200): void {
  if (typeof window === 'undefined') return;

  // Stop any existing animation
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  if (activeCanvas && activeCanvas.parentNode) {
    activeCanvas.parentNode.removeChild(activeCanvas);
    activeCanvas = null;
  }

  // Create overlay canvas
  const canvas = document.createElement('canvas');
  canvas.id = 'celebration-confetti-canvas';
  canvas.style.position = 'fixed';
  canvas.style.inset = '0';
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '9999';
  document.body.appendChild(canvas);
  activeCanvas = canvas;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const updateSize = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  updateSize();

  const particles: Particle[] = [];
  const startX = canvas.width / 2;
  const startY = canvas.height * 0.45;

  for (let i = 0; i < particleCount; i++) {
    const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.8;
    const speed = 4 + Math.random() * 12;
    const shapeType = Math.random() > 0.6 ? 'star' : Math.random() > 0.3 ? 'rect' : 'circle';

    particles.push({
      x: startX + (Math.random() - 0.5) * 80,
      y: startY + (Math.random() - 0.5) * 60,
      size: 5 + Math.random() * 8,
      color: CELEBRATION_COLORS[Math.floor(Math.random() * CELEBRATION_COLORS.length)],
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 5 - Math.random() * 4,
      rotation: Math.random() * 360,
      vRot: (Math.random() - 0.5) * 12,
      shape: shapeType,
      opacity: 1,
    });
  }

  const startTime = Date.now();

  function drawStar(context: CanvasRenderingContext2D, cx: number, cy: number, spikes: number, outerR: number, innerR: number) {
    let rot = (Math.PI / 2) * 3;
    let x = cx;
    let y = cy;
    const step = Math.PI / spikes;

    context.beginPath();
    context.moveTo(cx, cy - outerR);
    for (let i = 0; i < spikes; i++) {
      x = cx + Math.cos(rot) * outerR;
      y = cy + Math.sin(rot) * outerR;
      context.lineTo(x, y);
      rot += step;

      x = cx + Math.cos(rot) * innerR;
      y = cy + Math.sin(rot) * innerR;
      context.lineTo(x, y);
      rot += step;
    }
    context.lineTo(cx, cy - outerR);
    context.closePath();
    context.fill();
  }

  function frame() {
    if (!ctx || !canvas) return;
    const elapsed = Date.now() - startTime;
    const progress = elapsed / durationMs;

    if (progress >= 1) {
      if (canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
      activeCanvas = null;
      animationFrameId = null;
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.22; // gravity
      p.vx *= 0.985; // friction
      p.rotation += p.vRot;
      p.opacity = Math.max(0, 1 - progress * 1.1);

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle = p.color;

      if (p.shape === 'star') {
        drawStar(ctx, 0, 0, 5, p.size, p.size / 2);
      } else if (p.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
      }

      ctx.restore();
    }

    animationFrameId = requestAnimationFrame(frame);
  }

  animationFrameId = requestAnimationFrame(frame);
}

/**
 * Triumphant Web Audio Chime Fanfare:
 * Ascending major chord (C5 -> E5 -> G5 -> C6) with warm shimmer decay.
 */
export function playCelebrationFanfare(): void {
  if (typeof window === 'undefined') return;

  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const notes = [
      { freq: 523.25, time: 0.0, dur: 0.45 }, // C5
      { freq: 659.25, time: 0.12, dur: 0.45 }, // E5
      { freq: 783.99, time: 0.24, dur: 0.55 }, // G5
      { freq: 1046.5, time: 0.38, dur: 1.1 }, // C6 (Finale)
    ];

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.35, ctx.currentTime);
    masterGain.connect(ctx.destination);

    notes.forEach(({ freq, time, dur }) => {
      const osc = ctx.createOscillator();
      const noteGain = ctx.createGain();

      // Soft warm sine + triangle blend
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + time);

      const noteStart = ctx.currentTime + time;
      noteGain.gain.setValueAtTime(0.001, noteStart);
      noteGain.gain.exponentialRampToValueAtTime(0.6, noteStart + 0.03);
      noteGain.gain.exponentialRampToValueAtTime(0.001, noteStart + dur);

      osc.connect(noteGain);
      noteGain.connect(masterGain);

      osc.start(noteStart);
      osc.stop(noteStart + dur + 0.05);
    });

    // Clean up AudioContext after completion
    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 2200);
  } catch {
    // Graceful fallback if AudioContext is blocked
  }
}
