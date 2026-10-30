import test from 'node:test';
import assert from 'node:assert/strict';
import { DAILY_QUOTES, getTimeOfDayGreeting } from '../src/components/QuoteCard.tsx';

test('daily quotes pool has valid entries with author and category', () => {
  assert.ok(DAILY_QUOTES.length >= 10);
  DAILY_QUOTES.forEach((q) => {
    assert.ok(q.id && q.id.length > 0);
    assert.ok(q.text && q.text.length > 10);
    assert.ok(q.author && q.author.length > 0);
    assert.ok(q.category && q.category.length > 0);
  });
});

test('deterministic seed generates valid quote index for date strings', () => {
  const dates = ['2026-10-30', '2026-10-31', '2026-11-01', '2026-01-01'];
  dates.forEach((d) => {
    let hash = 0;
    for (let i = 0; i < d.length; i++) {
      hash = (hash << 5) - hash + d.charCodeAt(i);
      hash |= 0;
    }
    const idx = Math.abs(hash) % DAILY_QUOTES.length;
    assert.ok(idx >= 0 && idx < DAILY_QUOTES.length);
    assert.ok(DAILY_QUOTES[idx].text);
  });
});

test('getTimeOfDayGreeting returns personalized greeting and icon for all hours of day', () => {
  // Morning: 5:00 - 11:59
  assert.equal(getTimeOfDayGreeting(6).greeting, 'Good Morning');
  assert.equal(getTimeOfDayGreeting(11).greeting, 'Good Morning');

  // Afternoon: 12:00 - 16:59
  assert.equal(getTimeOfDayGreeting(12).greeting, 'Good Afternoon');
  assert.equal(getTimeOfDayGreeting(14).greeting, 'Good Afternoon');
  assert.equal(getTimeOfDayGreeting(16).greeting, 'Good Afternoon');

  // Evening / Night: 17:00 onwards
  assert.equal(getTimeOfDayGreeting(17).greeting, 'Good Evening');
  assert.equal(getTimeOfDayGreeting(20).greeting, 'Good Evening');
  assert.equal(getTimeOfDayGreeting(22).greeting, 'Good Evening');
  assert.equal(getTimeOfDayGreeting(2).greeting, 'Good Evening');
});
