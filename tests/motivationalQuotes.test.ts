import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PRODUCTIVITY_QUOTES,
  getQuoteForDate,
} from '../src/utils/motivationalQuotes.ts';

test('motivational quotes array is populated with valid productivity affirmations', () => {
  assert.ok(PRODUCTIVITY_QUOTES.length >= 25);

  for (const item of PRODUCTIVITY_QUOTES) {
    assert.ok(typeof item.quote === 'string' && item.quote.length > 10);
    assert.ok(typeof item.author === 'string' && item.author.length > 1);
    assert.ok(typeof item.tag === 'string' && item.tag.length > 1);
  }
});

test('getQuoteForDate returns deterministic quote for a date and updates per day', () => {
  const quoteDay1 = getQuoteForDate('2026-10-28');
  const quoteDay1Again = getQuoteForDate('2026-10-28');
  assert.deepEqual(quoteDay1, quoteDay1Again);

  const quoteDay2 = getQuoteForDate('2026-10-29');
  assert.ok(quoteDay2.quote);

  // Offset allows manual cycling through other affirmations
  const quoteOffset1 = getQuoteForDate('2026-10-28', 1);
  const quoteOffset2 = getQuoteForDate('2026-10-28', 2);
  assert.notDeepEqual(quoteDay1, quoteOffset1);
  assert.notDeepEqual(quoteOffset1, quoteOffset2);
});
