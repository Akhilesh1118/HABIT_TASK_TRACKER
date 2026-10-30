import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseDurationToMinutes,
  isStudyItem,
} from '../src/components/TaskVsStudyBarChart';
import { DailySummaryItem } from '../src/types';

test('parseDurationToMinutes accurately parses diverse duration formats', () => {
  // Hours formats
  assert.equal(parseDurationToMinutes('2 HOURS'), 120);
  assert.equal(parseDurationToMinutes('2 hours'), 120);
  assert.equal(parseDurationToMinutes('1.5h'), 90);
  assert.equal(parseDurationToMinutes('1 hour'), 60);

  // Minutes formats
  assert.equal(parseDurationToMinutes('20 minutes'), 20);
  assert.equal(parseDurationToMinutes('25 minutes'), 25);
  assert.equal(parseDurationToMinutes('45m'), 45);
  assert.equal(parseDurationToMinutes('30 mins'), 30);

  // Compound formats
  assert.equal(parseDurationToMinutes('1h 20m'), 80);
  assert.equal(parseDurationToMinutes('2h 30m'), 150);
  assert.equal(parseDurationToMinutes('3 hours 15 mins'), 195);

  // Empty and edge cases
  assert.equal(parseDurationToMinutes(''), 0);
  assert.equal(parseDurationToMinutes(undefined), 0);
  assert.equal(parseDurationToMinutes('   '), 0);
});

test('isStudyItem correctly identifies academic and exam prep items', () => {
  const studySessionItem: DailySummaryItem = {
    id: 's1',
    title: 'Modern Indian History',
    category: 'SSC CGL',
    completed: true,
    isHabit: false,
    isStudySession: true,
    studySubject: 'GK',
    studyDurationMinutes: 80,
  };
  assert.equal(isStudyItem(studySessionItem), true);

  const lectureItem: DailySummaryItem = {
    id: 's2',
    title: 'GK LECTURE 19',
    category: 'GK',
    completed: true,
    isHabit: false,
    duration: '2 HOURS',
  };
  assert.equal(isStudyItem(lectureItem), true);

  const quantItem: DailySummaryItem = {
    id: 's3',
    title: 'Quant: Ratio & Proportion',
    category: 'Math',
    completed: false,
    isHabit: false,
  };
  assert.equal(isStudyItem(quantItem), true);

  const generalHabitItem: DailySummaryItem = {
    id: 'h1',
    title: 'Morning Jog & Hydration',
    category: 'Health/Fitness',
    completed: true,
    isHabit: true,
    duration: '30 minutes',
  };
  assert.equal(isStudyItem(generalHabitItem), false);

  const workTaskItem: DailySummaryItem = {
    id: 't1',
    title: 'Email Team Status Report',
    category: 'Other',
    completed: true,
    isHabit: false,
    duration: '45 minutes',
  };
  assert.equal(isStudyItem(workTaskItem), false);
});
