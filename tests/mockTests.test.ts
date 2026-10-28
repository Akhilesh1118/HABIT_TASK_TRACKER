import test from 'node:test';
import assert from 'node:assert/strict';
import { storageService } from '../src/services/storageService.ts';

test('mock tests can be saved, listed, and deleted per user', () => {
  const userId = 'test_student_user';

  const mock1 = {
    id: 'mock_test_1',
    userId,
    date: '2026-10-28',
    title: 'SSC CGL Tier 1 Mock 01',
    examType: 'SSC CGL',
    totalScore: 152.5,
    maxScore: 200,
    accuracy: 89.2,
    quantScore: 45,
    reasoningScore: 47.5,
    englishScore: 38,
    generalAwarenessScore: 22,
    timeSpentMinutes: 58,
    notes: 'Good score in quant; improve GA history',
    createdAt: new Date().toISOString(),
  };

  storageService.saveMockTest(mock1, userId);

  const list = storageService.getMockTests(userId);
  assert.equal(list.length >= 1, true);
  const saved = list.find((m) => m.id === 'mock_test_1');
  assert.ok(saved);
  assert.equal(saved?.totalScore, 152.5);
  assert.equal(saved?.accuracy, 89.2);

  // Clean up
  storageService.deleteMockTest('mock_test_1', userId);
  const afterDelete = storageService.getMockTests(userId);
  assert.equal(afterDelete.some((m) => m.id === 'mock_test_1'), false);
});
