import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import {
  Clock,
  GraduationCap,
  CheckCircle2,
  BarChart2,
  Layers,
  CalendarDays,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { DailySummaryItem } from '../types';
import { storageService, parseDateKey, formatDateKey } from '../services/storageService';
import { getCurrentIST } from '../utils/timeUtils';

/**
 * Robust duration string parser into integer minutes.
 * Handles inputs like:
 * - "2 HOURS", "2 hours", "1.5h", "1h 20m", "80 min", "25 minutes", "45m"
 */
export function parseDurationToMinutes(durationStr?: string): number {
  if (!durationStr) return 0;
  const str = durationStr.trim().toLowerCase();
  if (!str) return 0;

  let totalMinutes = 0;
  let matched = false;

  // Pattern: hours like "2 hours", "2 hrs", "2h", "1.5h"
  const hourMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/);
  // Pattern: minutes like "20 minutes", "20 mins", "20m"
  const minMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|m)\b/);

  if (hourMatch) {
    totalMinutes += parseFloat(hourMatch[1]) * 60;
    matched = true;
  }
  if (minMatch) {
    totalMinutes += parseFloat(minMatch[1]);
    matched = true;
  }

  // Fallback for bare numbers or single integer
  if (!matched) {
    const num = parseFloat(str);
    if (!isNaN(num) && num > 0) {
      if (num <= 12) {
        totalMinutes = num * 60; // likely hours
      } else {
        totalMinutes = num; // likely minutes
      }
    }
  }

  return Math.round(totalMinutes);
}

/**
 * Determines whether a daily item represents an academic/exam study session
 * rather than a routine daily task or habit.
 */
export function isStudyItem(item: DailySummaryItem): boolean {
  if (item.isStudySession) return true;
  if (item.studySubject && item.studySubject.trim().length > 0) return true;
  if (item.studyDurationMinutes && item.studyDurationMinutes > 0) return true;
  if (item.isRevisionTask) return true;

  const categoryLower = (item.category || '').toLowerCase();
  if (categoryLower.includes('cgl') || categoryLower.includes('exam') || categoryLower.includes('academic')) {
    return true;
  }

  const titleLower = (item.title || '').toLowerCase();
  if (
    titleLower.includes('lecture') ||
    titleLower.includes('study') ||
    titleLower.includes('polity') ||
    titleLower.includes('quant') ||
    titleLower.includes('reasoning') ||
    titleLower.includes('mock test') ||
    titleLower.includes('revision') ||
    titleLower.includes('syllabus') ||
    titleLower.includes('formula')
  ) {
    return true;
  }

  return false;
}

export interface DayBreakdownData {
  date: string; // YYYY-MM-DD
  dayLabel: string; // "Wed, Oct 29"
  shortDay: string; // "Wed 29"
  dayName: string; // "Wed"
  dayNumber: number; // 29
  fullDate: string;
  isToday: boolean;
  isSelected: boolean;
  // Metrics in hours (rounded to 1 decimal for charts)
  taskHours: number;
  studyHours: number;
  totalHours: number;
  // Raw minutes
  taskMinutes: number;
  studyMinutes: number;
  totalMinutes: number;
  // Item counts
  taskCount: number;
  studyCount: number;
  totalCount: number;
  // Item details for tooltips
  taskDetails: Array<{ title: string; minutes: number; category: string }>;
  studyDetails: Array<{ title: string; minutes: number; subject: string; topic?: string }>;
}

interface TaskVsStudyBarChartProps {
  selectedDate: string;
  onSelectDate?: (date: string) => void;
  refreshTrigger?: number;
  className?: string;
}

export const TaskVsStudyBarChart: React.FC<TaskVsStudyBarChartProps> = ({
  selectedDate,
  onSelectDate,
  refreshTrigger = 0,
  className = '',
}) => {
  // Chart visual display mode: Grouped (side-by-side) vs Stacked
  const [chartMode, setChartMode] = useState<'grouped' | 'stacked'>('grouped');

  // Scope: Completed hours (actual work done) vs All planned hours
  const [scopeMode, setScopeMode] = useState<'completed' | 'all'>('completed');

  // Time window: Trailing 7 Days vs Monday–Sunday Calendar Week
  const [windowMode, setWindowMode] = useState<'trailing7' | 'calendar'>('trailing7');

  const todayStr = useMemo(() => getCurrentIST().dateStr, []);

  // Compute 7-day breakdown data reactively
  const { chartData, totals } = useMemo(() => {
    const targetObj = parseDateKey(selectedDate || todayStr);
    const dateList: string[] = [];

    if (windowMode === 'trailing7') {
      // 7 days ending at selectedDate
      for (let i = 6; i >= 0; i--) {
        const d = new Date(targetObj);
        d.setDate(targetObj.getDate() - i);
        dateList.push(formatDateKey(d));
      }
    } else {
      // Monday to Sunday calendar week
      const dayOfWeek = (targetObj.getDay() + 6) % 7; // Monday = 0
      const monday = new Date(targetObj);
      monday.setDate(targetObj.getDate() - dayOfWeek);
      for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        dateList.push(formatDateKey(d));
      }
    }

    const shortDayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    let sumTaskMinutes = 0;
    let sumStudyMinutes = 0;
    let sumTaskCount = 0;
    let sumStudyCount = 0;

    const days: DayBreakdownData[] = dateList.map((dStr) => {
      const dObj = parseDateKey(dStr);
      const dayName = shortDayNames[dObj.getDay()];
      const dayNumber = dObj.getDate();
      const monthName = monthNames[dObj.getMonth()];
      const shortDay = `${dayName} ${dayNumber}`;
      const dayLabel = `${dayName}, ${monthName} ${dayNumber}`;
      const fullDate = dObj.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

      const isToday = dStr === todayStr;
      const isSelected = dStr === selectedDate;

      const items = storageService.getDayItems(dStr);
      const focusSessions = storageService.getFocusSessionsForDate(dStr);

      const taskDetails: Array<{ title: string; minutes: number; category: string }> = [];
      const studyDetails: Array<{ title: string; minutes: number; subject: string; topic?: string }> = [];

      let dayTaskMinutes = 0;
      let dayStudyMinutes = 0;
      let dayTaskCount = 0;
      let dayStudyCount = 0;

      // Track session IDs or task IDs that already accounted for focus
      const linkedSessionTaskIds = new Set<string>();

      // Process day items (Tasks & Habits)
      items.forEach((item) => {
        const isEligible = scopeMode === 'all' || item.completed;
        if (!isEligible) return;

        const isStudy = isStudyItem(item);

        // Calculate item duration
        let itemMinutes = 0;
        if (isStudy && item.studyDurationMinutes && item.studyDurationMinutes > 0) {
          itemMinutes = item.studyDurationMinutes;
        } else if (item.duration) {
          itemMinutes = parseDurationToMinutes(item.duration);
        }

        // Check if there was an associated focus session with logged timer seconds
        const matchingSessions = focusSessions.filter((s) => s.taskId === item.id || s.taskTitle === item.title);
        const focusMins = matchingSessions.reduce((acc, s) => {
          linkedSessionTaskIds.add(s.id);
          return acc + Math.round((s.actualSecondsSpent || 0) / 60);
        }, 0);

        // Use the larger of verified timer focus or stated task duration, fallback to 30m if completed with no duration
        const finalMinutes = Math.max(itemMinutes, focusMins) || (item.completed ? 30 : 25);

        if (isStudy) {
          dayStudyMinutes += finalMinutes;
          dayStudyCount++;
          studyDetails.push({
            title: item.title,
            minutes: finalMinutes,
            subject: item.studySubject || item.category || 'Study',
            topic: item.studyTopic,
          });
        } else {
          dayTaskMinutes += finalMinutes;
          dayTaskCount++;
          taskDetails.push({
            title: item.title,
            minutes: finalMinutes,
            category: item.category || 'Task',
          });
        }
      });

      // Process any unlinked standalone focus sessions
      focusSessions.forEach((session) => {
        if (linkedSessionTaskIds.has(session.id)) return;
        const mins = Math.round((session.actualSecondsSpent || 0) / 60);
        if (mins <= 0) return;

        const cat = session.taskCategory || '';
        const titleLower = (session.taskTitle || '').toLowerCase();
        const isStudySession =
          cat === 'SSC CGL' ||
          titleLower.includes('study') ||
          titleLower.includes('lecture') ||
          titleLower.includes('polity') ||
          titleLower.includes('quant') ||
          titleLower.includes('reasoning') ||
          titleLower.includes('revision');

        if (isStudySession) {
          dayStudyMinutes += mins;
          dayStudyCount++;
          studyDetails.push({
            title: session.taskTitle,
            minutes: mins,
            subject: session.taskCategory || 'Focus Study',
          });
        } else {
          dayTaskMinutes += mins;
          dayTaskCount++;
          taskDetails.push({
            title: session.taskTitle,
            minutes: mins,
            category: session.taskCategory || 'Focus Session',
          });
        }
      });

      const taskHours = Number((dayTaskMinutes / 60).toFixed(1));
      const studyHours = Number((dayStudyMinutes / 60).toFixed(1));
      const totalHours = Number(((dayTaskMinutes + dayStudyMinutes) / 60).toFixed(1));

      sumTaskMinutes += dayTaskMinutes;
      sumStudyMinutes += dayStudyMinutes;
      sumTaskCount += dayTaskCount;
      sumStudyCount += dayStudyCount;

      return {
        date: dStr,
        dayLabel,
        shortDay,
        dayName,
        dayNumber,
        fullDate,
        isToday,
        isSelected,
        taskHours,
        studyHours,
        totalHours,
        taskMinutes: dayTaskMinutes,
        studyMinutes: dayStudyMinutes,
        totalMinutes: dayTaskMinutes + dayStudyMinutes,
        taskCount: dayTaskCount,
        studyCount: dayStudyCount,
        totalCount: dayTaskCount + dayStudyCount,
        taskDetails,
        studyDetails,
      };
    });

    const totalMinutesCombined = sumTaskMinutes + sumStudyMinutes;
    const totalHoursCombined = Number((totalMinutesCombined / 60).toFixed(1));
    const totalTaskHours = Number((sumTaskMinutes / 60).toFixed(1));
    const totalStudyHours = Number((sumStudyMinutes / 60).toFixed(1));

    const studyRatio = totalMinutesCombined > 0 ? Math.round((sumStudyMinutes / totalMinutesCombined) * 100) : 0;
    const taskRatio = totalMinutesCombined > 0 ? 100 - studyRatio : 0;

    return {
      chartData: days,
      totals: {
        totalHoursCombined,
        totalTaskHours,
        totalStudyHours,
        sumTaskMinutes,
        sumStudyMinutes,
        sumTaskCount,
        sumStudyCount,
        studyRatio,
        taskRatio,
        startDate: dateList[0],
        endDate: dateList[dateList.length - 1],
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, todayStr, windowMode, scopeMode, refreshTrigger]);

  return (
    <div
      id="task-vs-study-bar-chart-card"
      className={`bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-4 sm:p-6 shadow-xs transition-colors ${className}`}
    >
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-stone-100 dark:border-stone-800">
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <BarChart2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 tracking-tight flex items-center space-x-2">
                <span>Task Hours vs. Study Session Hours</span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  Last 7 Days
                </span>
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                Visualizing total hours invested in tasks & habits vs. academic study sessions.
              </p>
            </div>
          </div>
        </div>

        {/* Interactive Controls (Scope, Mode, Window) */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Grouped vs Stacked Toggle */}
          <div className="flex items-center p-0.5 bg-stone-100 dark:bg-stone-800 rounded-lg text-xs font-semibold">
            <button
              id="chart-mode-grouped-btn"
              onClick={() => setChartMode('grouped')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                chartMode === 'grouped'
                  ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-2xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
              title="Compare side-by-side"
            >
              Grouped
            </button>
            <button
              id="chart-mode-stacked-btn"
              onClick={() => setChartMode('stacked')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                chartMode === 'stacked'
                  ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-2xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
              title="Stacked cumulative daily hours"
            >
              Stacked
            </button>
          </div>

          {/* Scope Mode: Completed (Actual) vs All Planned */}
          <div className="flex items-center p-0.5 bg-stone-100 dark:bg-stone-800 rounded-lg text-xs font-semibold">
            <button
              id="chart-scope-completed-btn"
              onClick={() => setScopeMode('completed')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                scopeMode === 'completed'
                  ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-2xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
              title="Actual completed tasks and focus sessions"
            >
              Completed
            </button>
            <button
              id="chart-scope-all-btn"
              onClick={() => setScopeMode('all')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                scopeMode === 'all'
                  ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-2xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
              title="All scheduled & planned items"
            >
              All Planned
            </button>
          </div>

          {/* Time Window: Trailing 7 vs Calendar Week */}
          <div className="flex items-center p-0.5 bg-stone-100 dark:bg-stone-800 rounded-lg text-xs font-semibold">
            <button
              id="chart-window-trailing-btn"
              onClick={() => setWindowMode('trailing7')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                windowMode === 'trailing7'
                  ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-2xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
              title="Trailing 7 days ending at selected date"
            >
              Trailing 7D
            </button>
            <button
              id="chart-window-calendar-btn"
              onClick={() => setWindowMode('calendar')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                windowMode === 'calendar'
                  ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-2xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
              title="Monday to Sunday calendar week"
            >
              Mon–Sun
            </button>
          </div>
        </div>
      </div>

      {/* Summary KPI Badges Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4 sm:my-5">
        {/* Total Study Sessions */}
        <div className="p-3 sm:p-3.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-indigo-700 dark:text-indigo-300 mb-1">
            <span className="text-xs font-semibold tracking-tight flex items-center space-x-1.5">
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Study Sessions</span>
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-200/60 dark:bg-indigo-900/60 text-indigo-900 dark:text-indigo-200">
              {totals.sumStudyCount} {totals.sumStudyCount === 1 ? 'item' : 'items'}
            </span>
          </div>
          <div className="flex items-baseline space-x-1.5">
            <span className="text-xl sm:text-2xl font-extrabold font-mono text-indigo-900 dark:text-indigo-100">
              {totals.totalStudyHours}h
            </span>
            <span className="text-xs text-indigo-600 dark:text-indigo-400">
              ({totals.studyRatio}% of total)
            </span>
          </div>
        </div>

        {/* Total Tasks & Habits */}
        <div className="p-3 sm:p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-300 mb-1">
            <span className="text-xs font-semibold tracking-tight flex items-center space-x-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Tasks & Habits</span>
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-200/60 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200">
              {totals.sumTaskCount} {totals.sumTaskCount === 1 ? 'item' : 'items'}
            </span>
          </div>
          <div className="flex items-baseline space-x-1.5">
            <span className="text-xl sm:text-2xl font-extrabold font-mono text-emerald-900 dark:text-emerald-100">
              {totals.totalTaskHours}h
            </span>
            <span className="text-xs text-emerald-600 dark:text-emerald-400">
              ({totals.taskRatio}% of total)
            </span>
          </div>
        </div>

        {/* Total Combined Productive Hours */}
        <div className="p-3 sm:p-3.5 rounded-xl bg-stone-50 dark:bg-stone-800/70 border border-stone-200 dark:border-stone-700 flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-600 dark:text-stone-400 mb-1">
            <span className="text-xs font-semibold tracking-tight flex items-center space-x-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>Total Work Time</span>
            </span>
            <span className="text-[10px] font-medium text-stone-500 dark:text-stone-400">
              7-Day Sum
            </span>
          </div>
          <div className="flex items-baseline space-x-1.5">
            <span className="text-xl sm:text-2xl font-extrabold font-mono text-stone-900 dark:text-stone-100">
              {totals.totalHoursCombined}h
            </span>
            <span className="text-xs text-stone-500 dark:text-stone-400">
              ~{(totals.totalHoursCombined / 7).toFixed(1)}h/day
            </span>
          </div>
        </div>

        {/* Ratio Balance Indicator */}
        <div className="p-3 sm:p-3.5 rounded-xl bg-stone-50 dark:bg-stone-800/70 border border-stone-200 dark:border-stone-700 flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-600 dark:text-stone-400 mb-1">
            <span className="text-xs font-semibold tracking-tight flex items-center space-x-1.5">
              <Layers className="w-3.5 h-3.5 text-stone-500" />
              <span>Study vs Task Split</span>
            </span>
            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 font-mono">
              {totals.studyRatio} : {totals.taskRatio}
            </span>
          </div>
          <div>
            <div className="w-full bg-stone-200 dark:bg-stone-700 rounded-full h-2.5 overflow-hidden flex">
              <div
                className="h-2.5 bg-indigo-600 transition-all duration-300"
                style={{ width: `${Math.max(5, totals.studyRatio)}%` }}
                title={`Study: ${totals.studyRatio}%`}
              />
              <div
                className="h-2.5 bg-emerald-600 transition-all duration-300"
                style={{ width: `${Math.max(5, totals.taskRatio)}%` }}
                title={`Tasks: ${totals.taskRatio}%`}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-stone-500 dark:text-stone-400 mt-1 font-medium">
              <span className="text-indigo-600 dark:text-indigo-400">Study {totals.studyRatio}%</span>
              <span className="text-emerald-600 dark:text-emerald-400">Tasks {totals.taskRatio}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Recharts Bar Chart Container */}
      <div className="w-full h-72 sm:h-80 pt-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 12, right: 12, left: -16, bottom: 4 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="#e2e8f0"
              opacity={0.7}
            />
            <XAxis
              dataKey="shortDay"
              tickLine={false}
              stroke="#64748b"
              fontSize={12}
              tick={{ fill: '#64748b', fontWeight: 500 }}
            />
            <YAxis
              unit="h"
              tickLine={false}
              stroke="#64748b"
              fontSize={11}
              allowDecimals={true}
              domain={[0, 'dataMax + 0.5']}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data: DayBreakdownData = payload[0].payload;
                  return (
                    <div className="bg-stone-900 text-stone-100 rounded-xl p-3.5 shadow-xl border border-stone-700 text-xs space-y-2 min-w-[240px] max-w-xs animate-in fade-in duration-150">
                      {/* Date Header */}
                      <div className="flex items-center justify-between pb-1.5 border-b border-stone-800">
                        <span className="font-bold text-stone-100">{data.dayLabel}</span>
                        {data.isToday ? (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-900/80 text-emerald-300">
                            Today
                          </span>
                        ) : data.isSelected ? (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-900/80 text-indigo-300">
                            Selected
                          </span>
                        ) : null}
                      </div>

                      {/* Total Daily Hours */}
                      <div className="flex items-center justify-between font-mono bg-stone-800/80 px-2.5 py-1 rounded-md">
                        <span className="text-stone-300">Total Hours:</span>
                        <span className="font-extrabold text-white text-sm">
                          {data.totalHours}h
                        </span>
                      </div>

                      {/* Study Sessions Row */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center space-x-1.5 text-indigo-400 font-semibold">
                            <span className="w-2.5 h-2.5 rounded-xs bg-indigo-500 inline-block" />
                            <span>Study Sessions ({data.studyCount})</span>
                          </span>
                          <span className="font-mono font-bold text-indigo-300">
                            {data.studyHours}h
                          </span>
                        </div>
                        {data.studyDetails.length > 0 && (
                          <div className="pl-4 space-y-0.5 text-[11px] text-stone-400 max-h-20 overflow-y-auto">
                            {data.studyDetails.slice(0, 3).map((s, idx) => (
                              <div key={idx} className="flex items-center justify-between">
                                <span className="truncate max-w-[140px]">{s.title}</span>
                                <span className="font-mono text-stone-400 shrink-0">
                                  {s.minutes}m
                                </span>
                              </div>
                            ))}
                            {data.studyDetails.length > 3 && (
                              <div className="text-[10px] text-stone-500 italic">
                                +{data.studyDetails.length - 3} more study item(s)
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* General Tasks Row */}
                      <div className="space-y-1 pt-1 border-t border-stone-800/80">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center space-x-1.5 text-emerald-400 font-semibold">
                            <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 inline-block" />
                            <span>Tasks & Habits ({data.taskCount})</span>
                          </span>
                          <span className="font-mono font-bold text-emerald-300">
                            {data.taskHours}h
                          </span>
                        </div>
                        {data.taskDetails.length > 0 && (
                          <div className="pl-4 space-y-0.5 text-[11px] text-stone-400 max-h-20 overflow-y-auto">
                            {data.taskDetails.slice(0, 3).map((t, idx) => (
                              <div key={idx} className="flex items-center justify-between">
                                <span className="truncate max-w-[140px]">{t.title}</span>
                                <span className="font-mono text-stone-400 shrink-0">
                                  {t.minutes}m
                                </span>
                              </div>
                            ))}
                            {data.taskDetails.length > 3 && (
                              <div className="text-[10px] text-stone-500 italic">
                                +{data.taskDetails.length - 3} more task(s)
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {onSelectDate && (
                        <div className="pt-1 text-[10px] text-stone-500 text-center">
                          Click bar to inspect this day
                        </div>
                      )}
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
              iconType="circle"
            />
            {chartMode === 'grouped' ? (
              <>
                <Bar
                  dataKey="studyHours"
                  name="Study Sessions"
                  fill="#6366f1"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={36}
                  cursor={onSelectDate ? 'pointer' : 'default'}
                  onClick={(entry) => onSelectDate && entry?.date && onSelectDate(entry.date)}
                />
                <Bar
                  dataKey="taskHours"
                  name="Tasks & Habits"
                  fill="#059669"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={36}
                  cursor={onSelectDate ? 'pointer' : 'default'}
                  onClick={(entry) => onSelectDate && entry?.date && onSelectDate(entry.date)}
                />
              </>
            ) : (
              <>
                <Bar
                  dataKey="studyHours"
                  name="Study Sessions"
                  stackId="hours"
                  fill="#6366f1"
                  radius={[0, 0, 0, 0]}
                  maxBarSize={44}
                  cursor={onSelectDate ? 'pointer' : 'default'}
                  onClick={(entry) => onSelectDate && entry?.date && onSelectDate(entry.date)}
                />
                <Bar
                  dataKey="taskHours"
                  name="Tasks & Habits"
                  stackId="hours"
                  fill="#059669"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={44}
                  cursor={onSelectDate ? 'pointer' : 'default'}
                  onClick={(entry) => onSelectDate && entry?.date && onSelectDate(entry.date)}
                />
              </>
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Interactive 7-Day Quick Strip (Clickable Day Badges) */}
      <div className="mt-4 pt-4 border-t border-stone-100 dark:border-stone-800">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
            7-Day Daily Breakdown
          </span>
          <span className="text-[11px] text-stone-400 dark:text-stone-500">
            Click any day to jump to its detailed plan
          </span>
        </div>

        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {chartData.map((day) => {
            const hasData = day.totalHours > 0;
            return (
              <button
                key={day.date}
                id={`bar-strip-day-${day.date}`}
                onClick={() => onSelectDate && onSelectDate(day.date)}
                className={`p-1.5 sm:p-2 rounded-xl border text-center transition-all ${
                  day.isSelected
                    ? 'ring-2 ring-indigo-500 border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/60 shadow-xs'
                    : day.isToday
                    ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/40'
                    : 'border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-800/40 hover:bg-stone-100 dark:hover:bg-stone-800'
                }`}
                title={`${day.dayLabel}: ${day.studyHours}h study, ${day.taskHours}h tasks`}
              >
                <div className="flex items-center justify-center space-x-1">
                  <span className="text-[10px] font-bold text-stone-500 dark:text-stone-400">
                    {day.dayName}
                  </span>
                  {day.isToday && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  )}
                </div>

                <div className="font-mono font-black text-xs sm:text-sm text-stone-900 dark:text-stone-100 mt-0.5">
                  {day.totalHours > 0 ? `${day.totalHours}h` : '0h'}
                </div>

                <div className="flex items-center justify-center gap-1 text-[9px] sm:text-[10px] font-mono mt-1 pt-1 border-t border-stone-200/60 dark:border-stone-700/60">
                  <span className="text-indigo-600 dark:text-indigo-400 font-semibold" title="Study Hours">
                    {day.studyHours}h
                  </span>
                  <span className="text-stone-300 dark:text-stone-600">•</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold" title="Task Hours">
                    {day.taskHours}h
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
