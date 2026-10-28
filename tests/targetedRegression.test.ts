import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'node:crypto';
import { isValidDateKey, validateSyncCompletionDates, validateTaskCompletionSync } from '../server/utils/dateValidation.ts';
import { aggregateCompletedStudyMinutes, isUniqueMorningPeak } from '../src/utils/weeklyAnalytics.ts';
import { isValidDailyPriorities, mergeDailyPriorities } from '../server/utils/dailyPriorities.ts';
import { authorizeAdminRequest } from '../server/middleware/authMiddleware.ts';
import { scopeRecordsToUser } from '../server/utils/userScoping.ts';

test('date validation rejects malformed and impossible date keys', () => {
  assert.equal(isValidDateKey('2026-10-28'), true);
  assert.equal(isValidDateKey('2026-02-29'), false);
  assert.equal(isValidDateKey('2026-2-03'), false);
  assert.equal(isValidDateKey('yesterday'), false);
});

test('sync accepts unchanged history but rejects historical adds and completion toggles', () => {
  const existing = [{ taskId: 't1', date: '2026-10-27', completed: true }];
  const key = (record: { taskId: string; date: string; completed?: boolean }) => `${record.taskId}_${record.date}`;
  assert.equal(validateSyncCompletionDates(existing, existing, key, '2026-10-28'), true);
  assert.equal(validateSyncCompletionDates([{ taskId: 't2', date: '2026-10-27', completed: true }], existing, key, '2026-10-28'), false);
  assert.equal(validateSyncCompletionDates([{ taskId: 't1', date: '2026-10-27', completed: false }], existing, key, '2026-10-28'), false);
  assert.equal(validateSyncCompletionDates([{ taskId: 't1', date: '2026-02-30', completed: false }], existing, key, '2026-10-28'), false);
});

test('task sync rejects non-today completion state changes but allows unrelated edits and unchanged history', () => {
  const oldTask = { id: 't1', date: '2026-10-27', completed: true };
  assert.equal(validateTaskCompletionSync([{ ...oldTask, completed: true }], [oldTask], '2026-10-28'), true);
  assert.equal(validateTaskCompletionSync([{ id: 't1', date: '2026-10-27', completed: false }], [oldTask], '2026-10-28'), false);
  assert.equal(validateTaskCompletionSync([{ id: 't2', date: '2026-10-28', completed: true }], [], '2026-10-28'), true);
});

test('morning insight requires five timed observations and a unique peak across all buckets', () => {
  assert.equal(isUniqueMorningPeak([0, 0, 0, 0]), false);
  assert.equal(isUniqueMorningPeak([2, 1, 0, 0]), false);
  assert.equal(isUniqueMorningPeak([3, 2, 0, 3]), false);
  assert.equal(isUniqueMorningPeak([5, 2, 1, 1]), true);
  assert.equal(isUniqueMorningPeak([1, 1, 1, 5]), false);
});

test('study totals ignore planned sessions and deduplicate completed occurrences', () => {
  const totals = aggregateCompletedStudyMinutes([
    { occurrenceId: 'task-a-2026-10-28', completed: true, subject: 'Quant', minutes: 45 },
    { occurrenceId: 'task-a-2026-10-28', completed: true, subject: 'Quant', minutes: 45 },
    { occurrenceId: 'task-b-2026-10-28', completed: false, subject: 'GK', minutes: 30 },
    { occurrenceId: 'task-c-2026-10-28', completed: true, subject: 'GK', minutes: 20 },
  ]);
  assert.equal(totals.get('Quant'), 45);
  assert.equal(totals.get('GK'), 20);
});

test('priority sync merges dates atomically and preserves explicit cleared dates', () => {
  const merged = mergeDailyPriorities(
    { '2026-10-28': ['task-a'], '2026-10-29': ['task-b'] },
    { '2026-10-28': [], '2026-10-30': ['task-c'] }
  );
  assert.deepEqual(merged, {
    '2026-10-28': [],
    '2026-10-29': ['task-b'],
    '2026-10-30': ['task-c'],
  });
  assert.equal(isValidDailyPriorities(merged), true);
  assert.equal(isValidDailyPriorities({ '2026-10-28': ['a', 'b', 'c', 'd'] }), false);
  assert.equal(isValidDailyPriorities({ '2026-02-30': ['a'] }), false);
});

test('sync ownership always comes from the authenticated user, not submitted record fields', () => {
  const incoming = [{ id: 'record-1', userId: 'user-b', title: 'spoofed' }];
  assert.deepEqual(scopeRecordsToUser(incoming, 'user-a'), [{ id: 'record-1', userId: 'user-a', title: 'spoofed' }]);
});

test('diagnostic authorization rejects missing, invalid, expired, and ordinary-user sessions', () => {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
  const response = () => ({
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.body = body; return this; },
  });
  const request = (token?: string) => ({
    headers: token ? { authorization: `Bearer ${token}` } : {},
    cookies: {},
  });

  try {
    const missingResponse = response();
    assert.equal(authorizeAdminRequest(request() as any, missingResponse as any), false);
    assert.equal(missingResponse.statusCode, 401);

    const invalidResponse = response();
    assert.equal(authorizeAdminRequest(request('malformed.token.value') as any, invalidResponse as any), false);
    assert.equal(invalidResponse.statusCode, 401);

    const expired = jwt.sign({ userId: 'test-admin', email: 'admin@example.test', role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '-1s' });
    const expiredResponse = response();
    assert.equal(authorizeAdminRequest(request(expired) as any, expiredResponse as any), false);
    assert.equal(expiredResponse.statusCode, 401);

    const userToken = jwt.sign({ userId: 'test-user', email: 'user@example.test', role: 'user' }, process.env.JWT_SECRET, { expiresIn: '1m' });
    const userResponse = response();
    assert.equal(authorizeAdminRequest(request(userToken) as any, userResponse as any), false);
    assert.equal(userResponse.statusCode, 403);

    const adminToken = jwt.sign({ userId: 'test-admin', email: 'admin@example.test', role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1m' });
    assert.equal(authorizeAdminRequest(request(adminToken) as any, response() as any), true);
  } finally {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  }
});
