import { DayActivity, TaskCategory } from '../types';
import { formatDateKey, storageService } from '../services/storageService';

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const WEEKDAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export interface GridMonthData {
  year: number;
  month: number; // 0-indexed
  monthName: string;
  days: DayActivity[];
}

export function buildMonthGrid(
  year: number,
  month: number,
  selectedDateStr: string,
  todayStr: string
): GridMonthData {
  const days: DayActivity[] = [];

  // First day of target month
  const firstDay = new Date(year, month, 1);
  // Total days in target month
  const lastDay = new Date(year, month + 1, 0);
  const totalDaysInMonth = lastDay.getDate();

  // Day of week for 1st of month: JS 0=Sun, 1=Mon, ..., 6=Sat
  // We want Monday = 0, Tuesday = 1, ..., Sunday = 6
  const firstDayOfWeek = (firstDay.getDay() + 6) % 7;

  // Previous month padding days
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const padDay = prevMonthLastDay - i;
    const padDate = new Date(year, month - 1, padDay);
    const dateStr = formatDateKey(padDate);
    const activity = storageService.getDayActivity(dateStr, dateStr === todayStr, dateStr === selectedDateStr);
    days.push({
      ...activity,
      isCurrentMonth: false,
    });
  }

  // Current month days
  for (let d = 1; d <= totalDaysInMonth; d++) {
    const curDate = new Date(year, month, d);
    const dateStr = formatDateKey(curDate);
    const activity = storageService.getDayActivity(dateStr, dateStr === todayStr, dateStr === selectedDateStr);
    days.push({
      ...activity,
      isCurrentMonth: true,
    });
  }

  // Next month padding days to complete row to multiple of 7
  const remainingCells = (7 - (days.length % 7)) % 7;
  for (let d = 1; d <= remainingCells; d++) {
    const nextDate = new Date(year, month + 1, d);
    const dateStr = formatDateKey(nextDate);
    const activity = storageService.getDayActivity(dateStr, dateStr === todayStr, dateStr === selectedDateStr);
    days.push({
      ...activity,
      isCurrentMonth: false,
    });
  }

  return {
    year,
    month,
    monthName: MONTH_NAMES[month],
    days,
  };
}

export function formatFriendlyDate(dateStr: string, todayStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const dateObj = new Date(year, month - 1, day);

  const monthName = MONTH_NAMES[dateObj.getMonth()];
  const dayNum = dateObj.getDate();
  const yearNum = dateObj.getFullYear();

  const formatted = `${monthName} ${dayNum}, ${yearNum}`;

  if (dateStr === todayStr) {
    return `Today (${formatted})`;
  }

  // Check yesterday
  const [tY, tM, tD] = todayStr.split('-').map(Number);
  const todayObj = new Date(tY, tM - 1, tD);
  const yesterdayObj = new Date(todayObj);
  yesterdayObj.setDate(todayObj.getDate() - 1);
  if (dateStr === formatDateKey(yesterdayObj)) {
    return `Yesterday (${formatted})`;
  }

  return formatted;
}

export const CATEGORY_DETAILS: Record<
  TaskCategory,
  { icon: string; bg: string; text: string; border: string; darkBadge: string }
> = {
  'SSC CGL': {
    icon: '🎯',
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
    darkBadge: 'bg-amber-900/40 text-amber-300 border-amber-800',
  },
  Technical: {
    icon: '💻',
    bg: 'bg-blue-50',
    text: 'text-blue-800',
    border: 'border-blue-200',
    darkBadge: 'bg-blue-900/40 text-blue-300 border-blue-800',
  },
  English: {
    icon: '🗣️',
    bg: 'bg-purple-50',
    text: 'text-purple-800',
    border: 'border-purple-200',
    darkBadge: 'bg-purple-900/40 text-purple-300 border-purple-800',
  },
  'Health/Fitness': {
    icon: '💪',
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-200',
    darkBadge: 'bg-emerald-900/40 text-emerald-300 border-emerald-800',
  },
  'Personal Learning': {
    icon: '📖',
    bg: 'bg-indigo-50',
    text: 'text-indigo-800',
    border: 'border-indigo-200',
    darkBadge: 'bg-indigo-900/40 text-indigo-300 border-indigo-800',
  },
  Other: {
    icon: '📌',
    bg: 'bg-stone-50',
    text: 'text-stone-700',
    border: 'border-stone-200',
    darkBadge: 'bg-stone-800 text-stone-300 border-stone-700',
  },
};
