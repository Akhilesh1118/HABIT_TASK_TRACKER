import test from 'node:test';
import assert from 'node:assert/strict';
import { storageService } from '../src/services/storageService';

test('Top 3 priority sanitization and slot recovery', () => {
  const mockStorage: Record<string, string> = {};
  const fakeLocalStorage = {
    getItem: (key: string) => mockStorage[key] ?? null,
    setItem: (key: string, val: string) => {
      mockStorage[key] = String(val);
    },
    removeItem: (key: string) => {
      delete mockStorage[key];
    },
    clear: () => {
      Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
    },
  };

  (globalThis as any).window = { localStorage: fakeLocalStorage };
  (globalThis as any).localStorage = fakeLocalStorage;

  const testDate = '2026-10-29';

  // Seed two tasks and one active habit
  const task1 = {
    id: 'task_math_123',
    userId: 'usr_default',
    title: 'MATH',
    category: 'SSC CGL' as const,
    date: testDate,
    scheduledDate: testDate,
    status: 'pending' as const,
    completed: false,
    duration: '2 HOURS',
    recurringSchedule: 'daily' as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const task2 = {
    id: 'task_gk_456',
    userId: 'usr_default',
    title: 'GK LECTURE 19',
    category: 'GK' as const,
    date: testDate,
    scheduledDate: testDate,
    status: 'pending' as const,
    completed: false,
    duration: '2 HOURS',
    recurringSchedule: 'none' as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const habit1 = {
    id: 'habit_vocab_789',
    name: 'English Speaking & Vocab',
    category: 'English' as const,
    target: '20 minutes',
    active: true,
    startDate: '2026-10-01',
    createdAt: new Date().toISOString(),
  };

  fakeLocalStorage.setItem('habits_app_tasks', JSON.stringify([task1, task2]));
  fakeLocalStorage.setItem('habits_app_habits', JSON.stringify([habit1]));

  // Simulate stale/corrupted daily priorities where slot 1 is an orphaned/ghost task ID:
  // ["ghost_id_that_does_not_exist", "task_math_123", "h_item_habit_vocab_789"]
  fakeLocalStorage.setItem(
    'habits_app_daily_priorities',
    JSON.stringify({
      [testDate]: ['ghost_id_that_does_not_exist', 'task_math_123', 'h_item_habit_vocab_789'],
    })
  );

  // 1. Calling getDailyPriorities should self-heal and purge the ghost ID
  const sanitized = storageService.getDailyPriorities(testDate);
  assert.deepEqual(sanitized, ['task_math_123', 'h_item_habit_vocab_789']);

  // 2. getDayItems should return only 2 priority items with ranks #1 and #2 (not starting at #2)
  const dayItems = storageService.getDayItems(testDate);
  const topPriorities = dayItems.filter((i) => i.isTopPriority);
  assert.equal(topPriorities.length, 2);
  assert.equal(topPriorities[0].id, 'task_math_123');
  assert.equal(topPriorities[0].priorityRank, 1);
  assert.equal(topPriorities[1].id, 'h_item_habit_vocab_789');
  assert.equal(topPriorities[1].priorityRank, 2);

  // 3. Adding task2 (GK LECTURE 19) should SUCCEED and fill slot 3 without the "Maximum 3 reached" error
  const addResult = storageService.toggleDailyPriority(testDate, 'task_gk_456');
  assert.equal(addResult.success, true);
  assert.equal(addResult.error, undefined);
  assert.deepEqual(addResult.priorities, ['task_math_123', 'h_item_habit_vocab_789', 'task_gk_456']);

  // 4. Now with 3 items, attempting to add a 4th should return the maximum error
  const extraTask = {
    id: 'task_extra_999',
    userId: 'usr_default',
    title: 'Extra Task',
    category: 'Reasoning' as const,
    date: testDate,
    scheduledDate: testDate,
    status: 'pending' as const,
    completed: false,
    duration: '1 HOUR',
    recurringSchedule: 'none' as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  fakeLocalStorage.setItem('habits_app_tasks', JSON.stringify([task1, task2, extraTask]));

  const fourthResult = storageService.toggleDailyPriority(testDate, 'task_extra_999');
  assert.equal(fourthResult.success, false);
  assert.match(fourthResult.error || '', /Maximum 3 Top Priorities reached/);

  // 5. Deleting a task prunes it from daily priorities
  storageService.deleteTask('task_math_123', testDate);
  const afterDeletePriorities = storageService.getDailyPriorities(testDate);
  assert.equal(afterDeletePriorities.includes('task_math_123'), false);
  assert.equal(afterDeletePriorities.length, 2);
});

test('autoSelectTop3 handles array growth beyond 2 items and preserves existing priorities', () => {
  const mockStorage: Record<string, string> = {};
  const fakeLocalStorage = {
    getItem: (key: string) => mockStorage[key] ?? null,
    setItem: (key: string, val: string) => {
      mockStorage[key] = String(val);
    },
    removeItem: (key: string) => {
      delete mockStorage[key];
    },
    clear: () => {
      Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
    },
  };

  (globalThis as any).window = { localStorage: fakeLocalStorage };
  (globalThis as any).localStorage = fakeLocalStorage;

  const testDate = '2026-10-30';

  // Seed 5 tasks for the day
  const tasks = [
    {
      id: 't1',
      userId: 'usr_default',
      title: 'Math Algebra Lecture',
      category: 'SSC CGL' as const,
      date: testDate,
      scheduledDate: testDate,
      completed: true, // completed
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 't2',
      userId: 'usr_default',
      title: 'Polity Article 21 Revision',
      category: 'SSC CGL' as const,
      date: testDate,
      scheduledDate: testDate,
      completed: false, // pending
      isStudySession: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 't3',
      userId: 'usr_default',
      title: 'Vocabulary Editorial Reading',
      category: 'English' as const,
      date: testDate,
      scheduledDate: testDate,
      completed: false, // pending
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 't4',
      userId: 'usr_default',
      title: 'Reasoning Puzzle 5',
      category: 'Other' as const,
      date: testDate,
      scheduledDate: testDate,
      completed: false, // pending
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 't5',
      userId: 'usr_default',
      title: 'Evening Walk',
      category: 'Health/Fitness' as const,
      date: testDate,
      scheduledDate: testDate,
      completed: false, // pending
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  fakeLocalStorage.setItem('habits_app_tasks', JSON.stringify(tasks));
  fakeLocalStorage.setItem('habits_app_daily_priorities', JSON.stringify({}));

  // 1. autoSelectTop3 on empty priorities picks 3 items without throwing
  const autoPicked = storageService.autoSelectTop3(testDate);
  assert.equal(autoPicked.length, 3);
  // Pending items (t2, t3, t4) picked before completed t1
  assert.equal(autoPicked.includes('t2'), true);
  assert.equal(autoPicked.includes('t3'), true);

  // 2. autoSelectTop3 with undefined/empty date does not crash
  const fallbackPicked = storageService.autoSelectTop3();
  assert.equal(Array.isArray(fallbackPicked), true);

  // 3. User manually has 2 items in Top 3 (growth beyond 2 items):
  // Let's set 2 explicit priorities: ['t1', 't2']
  storageService.setDailyPriorities(testDate, ['t1', 't2']);
  assert.deepEqual(storageService.getDailyPriorities(testDate), ['t1', 't2']);

  // Calling autoSelectTop3 preserves the 2 existing priorities ('t1', 't2') and adds a 3rd item
  const filledTop3 = storageService.autoSelectTop3(testDate);
  assert.equal(filledTop3.length, 3);
  assert.equal(filledTop3[0], 't1');
  assert.equal(filledTop3[1], 't2');
  assert.equal(filledTop3.includes('t3') || filledTop3.includes('t4'), true);

  // 4. Updating a task in Top 3 retains its priority and does not crash
  const updatedTask = storageService.saveTask({
    id: 't1',
    userId: 'usr_default',
    title: 'Math Algebra Lecture - Part 2',
    category: 'SSC CGL',
    date: testDate,
    completed: true,
    isTopPriority: true,
  });
  assert.equal(updatedTask.id, 't1');
  assert.equal(storageService.getDailyPriorities(testDate).includes('t1'), true);

  // 5. Updating an unstarred task with isTopPriority=true when Top 3 is full does not overflow 3 items
  const nonPriorityTaskUpdate = storageService.saveTask({
    id: 't5',
    userId: 'usr_default',
    title: 'Evening Walk & Jogging',
    category: 'Health/Fitness',
    date: testDate,
    completed: false,
    isTopPriority: true,
  });
  // Top 3 was already full with 3 items, so t5 is not forced into overflowing
  const prioritiesAfterOverflowAttempt = storageService.getDailyPriorities(testDate);
  assert.equal(prioritiesAfterOverflowAttempt.length, 3);
  assert.equal(prioritiesAfterOverflowAttempt.includes('t5'), false);
});

