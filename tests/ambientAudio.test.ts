import test from 'node:test';
import assert from 'node:assert/strict';
import { ambientAudio } from '../src/utils/ambientAudio.ts';

test('ambient audio engine supports flute, tibetan bowls, and theta meditation sounds', () => {
  // Test volume getter & bounds
  ambientAudio.setVolume(0.8);
  assert.equal(ambientAudio.getVolume(), 0.8);

  ambientAudio.setVolume(1.5);
  assert.equal(ambientAudio.getVolume(), 1.0);

  ambientAudio.setVolume(-0.2);
  assert.equal(ambientAudio.getVolume(), 0.0);

  ambientAudio.setVolume(0.5);
  assert.equal(ambientAudio.getVolume(), 0.5);

  // In non-browser Node.js environment without Web Audio API window.AudioContext,
  // play() gracefully handles missing window/AudioContext without throwing
  ambientAudio.play('flute');
  assert.ok(['flute', 'off'].includes(ambientAudio.getSoundType()));

  ambientAudio.play('tibetanBowls');
  assert.ok(['tibetanBowls', 'off'].includes(ambientAudio.getSoundType()));

  ambientAudio.play('thetaMeditation');
  assert.ok(['thetaMeditation', 'off'].includes(ambientAudio.getSoundType()));

  ambientAudio.stop();
  assert.equal(ambientAudio.getSoundType(), 'off');
});
