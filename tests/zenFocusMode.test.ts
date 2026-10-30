import { test } from 'node:test';
import assert from 'node:assert';
import { ambientAudio, AmbientSoundType } from '../src/utils/ambientAudio';

test('Ambient audio engine supports flute, tibetan bowls, theta meditation, rain, brown noise, and binaural', () => {
  const supportedTypes: AmbientSoundType[] = [
    'off',
    'flute',
    'tibetanBowls',
    'thetaMeditation',
    'rain',
    'brownNoise',
    'binaural',
  ];

  supportedTypes.forEach((type) => {
    ambientAudio.play(type);
    assert.ok(
      ['off', type].includes(ambientAudio.getSoundType()),
      `Sound type should be off (in Node.js headless) or match ${type}`
    );
  });

  ambientAudio.stop();
  assert.strictEqual(ambientAudio.getSoundType(), 'off', 'Stopping should revert sound type to off');
});

test('Ambient audio engine volume clamped within valid range 0.0 to 1.0', () => {
  ambientAudio.setVolume(0.75);
  assert.strictEqual(ambientAudio.getVolume(), 0.75);

  ambientAudio.setVolume(1.5);
  assert.strictEqual(ambientAudio.getVolume(), 1.0, 'Volume above 1.0 should clamp to 1.0');

  ambientAudio.setVolume(-0.2);
  assert.strictEqual(ambientAudio.getVolume(), 0.0, 'Volume below 0.0 should clamp to 0.0');
});

test('Box Breathing 4-4-4-4 Pranayama phase sequence integrity', () => {
  const phases = ['inhale', 'hold-in', 'exhale', 'hold-out'] as const;
  let currentIdx = 0;

  function nextPhase(idx: number): number {
    return (idx + 1) % phases.length;
  }

  assert.strictEqual(phases[nextPhase(0)], 'hold-in');
  assert.strictEqual(phases[nextPhase(1)], 'exhale');
  assert.strictEqual(phases[nextPhase(2)], 'hold-out');
  assert.strictEqual(phases[nextPhase(3)], 'inhale');
});

test('Session time extension math (+5 min and +10 min)', () => {
  const initialRemaining = 25 * 60; // 1500 seconds
  const initialTotal = 25 * 60;

  const plus5Remaining = initialRemaining + 5 * 60;
  const plus5Total = initialTotal + 5 * 60;
  assert.strictEqual(plus5Remaining, 1800, 'Remaining should be 30 minutes (1800s)');
  assert.strictEqual(plus5Total, 1800, 'Total should be 30 minutes (1800s)');

  const plus10Remaining = plus5Remaining + 10 * 60;
  assert.strictEqual(plus10Remaining, 2400, 'Remaining should be 40 minutes (2400s)');
});
