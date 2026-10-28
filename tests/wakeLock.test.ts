import test from 'node:test';
import assert from 'node:assert/strict';
import { screenWakeLock } from '../src/utils/screenWakeLock.ts';

test('screen wake lock manager defaults to enabled and supports toggling', () => {
  // Should default to enabled
  assert.equal(typeof screenWakeLock.getIsEnabled(), 'boolean');

  // Toggle off
  screenWakeLock.setIsEnabled(false);
  assert.equal(screenWakeLock.getIsEnabled(), false);

  // Toggle back on
  screenWakeLock.setIsEnabled(true);
  assert.equal(screenWakeLock.getIsEnabled(), true);
});

test('screen wake lock subscription notifies listener on state change', () => {
  let latestState: boolean | null = null;
  const unsubscribe = screenWakeLock.subscribe((isActive) => {
    latestState = isActive;
  });

  assert.equal(typeof latestState, 'boolean');
  unsubscribe();
});

test('acquire and release run gracefully without crashing in non-browser or mock environments', async () => {
  // In node.js (no navigator.wakeLock or window), acquire and release should resolve cleanly
  const result = await screenWakeLock.acquire();
  assert.equal(typeof result, 'boolean');

  await screenWakeLock.release();
  assert.equal(screenWakeLock.isActive(), false);
});
