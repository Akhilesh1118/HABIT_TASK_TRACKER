import React, { useState } from 'react';
import {
  Check,
  Plus,
  Trash2,
  Edit2,
  Clock,
  Filter,
  Sparkles,
  Repeat,
  CheckCircle2,
  Star,
  AlertCircle,
  Zap,
  Play,
  GraduationCap,
  Target,
} from 'lucide-react';
import { DailySummaryItem, TaskCategory, StreakStatusInfo } from '../types';
import { CATEGORY_DETAILS, formatFriendlyDate } from '../utils/calendarUtils';
import {
  formatTime12Hour,
  getCurrentIST,
  isTimeArrivedOrPast,
  evaluateTaskScheduleStatus,
} from '../utils/timeUtils';

interface DailyTaskPanelProps {
  selectedDate: string;
  todayDate: string;
  items: DailySummaryItem[];
  revisionsDueTodayCount?: number;
  streakStatus?: StreakStatusInfo;
  onOpenStreakModal?: () => void;
  onOpenRevisionModal?: () => void;
  onToggleTask: (id: string, isHabit: boolean, habitId?: string) => void;
  onTogglePriority?: (itemId: string) => { success: boolean; error?: string } | void;
  onAutoPickTop3?: () => void;
  onAddTask: () => void;
  onEditTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onStartFocus?: (item: DailySummaryItem) => void;
}

const ALL_CATEGORIES: Array<{ key: 'all' | TaskCategory; label: string; icon: string }> = [
  { key: 'all', label: 'All Items', icon: '📋' },
  { key: 'SSC CGL', label: 'SSC CGL', icon: '🎯' },
  { key: 'Technical', label: 'Technical', icon: '💻' },
  { key: 'English', label: 'English', icon: '🗣️' },
  { key: 'Health/Fitness', label: 'Fitness', icon: '💪' },
  { key: 'Personal Learning', label: 'Learning', icon: '📖' },
  { key: 'Other', label: 'Other', icon: '📌' },
];

export const DailyTaskPanel: React.FC<DailyTaskPanelProps> = ({
  selectedDate,
  todayDate,
  items,
  revisionsDueTodayCount,
  streakStatus,
  onOpenStreakModal,
  onOpenRevisionModal,
  onToggleTask,
  onTogglePriority,
  onAutoPickTop3,
  onAddTask,
  onEditTask,
  onDeleteTask,
  onStartFocus,
}) => {
  const [categoryFilter, setCategoryFilter] = useState<'all' | TaskCategory>('all');
  const [priorityAlert, setPriorityAlert] = useState<string | null>(null);

  const totalItems = items.length;
  const completedItems = items.filter((i) => i.completed).length;
  const percentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
  const isToday = selectedDate === todayDate;

  // Separate Top 3 priorities from Other tasks (strictly mutually exclusive)
  const priorityItems = items
    .filter((item) => item.isTopPriority)
    .sort((a, b) => (a.priorityRank || 99) - (b.priorityRank || 99));

  const otherItems = items.filter((item) => !item.isTopPriority);

  // Filter items by category
  const filteredPriorityItems = priorityItems.filter((item) => {
    if (categoryFilter === 'all') return true;
    return item.category === categoryFilter;
  });

  const filteredOtherItems = otherItems.filter((item) => {
    if (categoryFilter === 'all') return true;
    return item.category === categoryFilter;
  });

  // Accurate Overdue status check in Asia/Kolkata timezone
  const checkIsOverdue = (item: DailySummaryItem): boolean => {
    if (item.completed) return false;
    const ist = getCurrentIST();
    const schedule = evaluateTaskScheduleStatus({
      completed: item.completed,
      dueDate: item.dueDate || selectedDate,
      dueTime: item.dueTime,
      currentTimeIST: ist.timeStr,
      currentDateIST: ist.dateStr,
    });
    return schedule.isOverdue;
  };

  // Handle toggling priority
  const handleStarClick = (itemId: string, isCurrentlyPriority: boolean) => {
    if (!isCurrentlyPriority && priorityItems.length >= 3) {
      setPriorityAlert('Maximum 3 Top Priorities reached. Unstar an existing priority first to replace it.');
      setTimeout(() => setPriorityAlert(null), 4000);
      return;
    }
    setPriorityAlert(null);
    if (onTogglePriority) {
      const res = onTogglePriority(itemId);
      if (res && !res.success && res.error) {
        setPriorityAlert(res.error);
        setTimeout(() => setPriorityAlert(null), 4000);
      }
    }
  };

  // Helper for task schedule & priority status badge:
  // - Completed (✅)
  // - Incomplete + deadline passed → overdue (❌)
  // - Incomplete + before deadline → pending (⏳)
  const renderStatusBadge = (item: DailySummaryItem) => {
    const ist = getCurrentIST();
    const schedule = evaluateTaskScheduleStatus({
      completed: item.completed,
      dueDate: item.dueDate || selectedDate,
      dueTime: item.dueTime,
      currentTimeIST: ist.timeStr,
      currentDateIST: ist.dateStr,
    });

    if (schedule.status === 'completed') {
      return (
        <span
          id={`status-badge-completed-${item.id}`}
          className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs shrink-0"
          title="Completed"
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>Completed</span>
          <span aria-hidden="true">✅</span>
        </span>
      );
    }

    if (schedule.status === 'overdue') {
      return (
        <span
          id={`status-badge-overdue-${item.id}`}
          className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300 shadow-2xs shrink-0 animate-pulse"
          title={`Incomplete + deadline passed (${formatTime12Hour(item.dueTime || '20:00')} IST)`}
        >
          <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
          <span>Overdue</span>
          <span aria-hidden="true">❌</span>
        </span>
      );
    }

    return (
      <span
        id={`status-badge-pending-${item.id}`}
        className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-stone-100 text-stone-700 border border-stone-200 shadow-2xs shrink-0"
        title={`Due at ${formatTime12Hour(item.dueTime || '20:00')} IST`}
      >
        <Clock className="w-3.5 h-3.5 text-stone-500" />
        <span>Pending</span>
        <span aria-hidden="true">⏳</span>
      </span>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-stone-200/90 shadow-xs p-5 sm:p-6 flex flex-col h-full">
      {/* Header & Date */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-stone-100">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
            Selected Day Plan
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">
            {formatFriendlyDate(selectedDate, todayDate)}
          </h2>
        </div>

        {/* Quick Add Task Button */}
        <button
          id="add-task-btn"
          onClick={onAddTask}
          className="inline-flex items-center justify-center space-x-2 px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-sm font-semibold transition-colors shadow-xs active:scale-98"
        >
          <Plus className="w-4 h-4" />
          <span>Add Task</span>
        </button>
      </div>

      {/* 🧠 Spaced Revision Due Today Banner */}
      <div
        id="spaced-revisions-due-banner"
        onClick={onOpenRevisionModal}
        className="my-4 p-3 sm:p-4 rounded-xl bg-gradient-to-r from-purple-50 via-white to-purple-50/70 border border-purple-200 hover:border-purple-300 transition-all cursor-pointer flex items-center justify-between group shadow-xs"
        title="Click to manage Spaced Revision Schedules"
      >
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-purple-600/15 border border-purple-300/80 flex items-center justify-center text-xl shrink-0">
            🧠
          </div>
          <div>
            <div className="flex items-center space-x-2 flex-wrap">
              <span className="text-sm sm:text-base font-bold text-purple-950">
                {revisionsDueTodayCount !== undefined ? revisionsDueTodayCount : 12} revisions due today
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-200/70 text-purple-900">
                Day 0 • 1 • 3 • 7 • 14 • 30
              </span>
            </div>
            <p className="text-xs text-purple-700 mt-0.5">
              Review spaced repetition topics to build long-term memory retention.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-1 text-xs font-bold text-purple-800 group-hover:translate-x-0.5 transition-transform shrink-0 pl-2">
          <span>Manage</span>
          <span>→</span>
        </div>
      </div>

      {/* 🔥 STREAK WARNING / PROTECTION BANNER */}
      {streakStatus && selectedDate === todayDate && (
        <div
          id="streak-protection-daily-banner"
          onClick={onOpenStreakModal}
          className={`my-3 p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer shadow-xs flex items-center justify-between group ${
            streakStatus.isAtRisk
              ? 'bg-gradient-to-r from-amber-50 via-amber-50/80 to-orange-50/40 border-amber-300 hover:border-amber-400'
              : streakStatus.isTodayFrozen
              ? 'bg-gradient-to-r from-sky-50 via-sky-50/80 to-blue-50/40 border-sky-300 hover:border-sky-400'
              : streakStatus.isBrokenStreakDetected
              ? 'bg-gradient-to-r from-purple-50 via-purple-50/80 to-indigo-50/40 border-purple-300 hover:border-purple-400'
              : 'bg-stone-50/80 border-stone-200/90 hover:border-orange-200'
          }`}
          title="Click to view Streak Protection & Recovery details"
        >
          <div className="flex items-center space-x-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 ${
                streakStatus.isAtRisk
                  ? 'bg-amber-100 border border-amber-300 text-amber-700 animate-pulse'
                  : streakStatus.isTodayFrozen
                  ? 'bg-sky-100 border border-sky-300 text-sky-700'
                  : 'bg-orange-100 border border-orange-200 text-orange-600'
              }`}
            >
              {streakStatus.isAtRisk ? '⚠️' : streakStatus.isTodayFrozen ? '❄️' : '🔥'}
            </div>
            <div>
              <div className="flex items-center space-x-2 flex-wrap">
                <span className="text-sm font-extrabold text-stone-900 tracking-tight">
                  🔥 {streakStatus.currentStreak} DAY STREAK
                </span>
                {streakStatus.isAtRisk && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-200 text-amber-950 border border-amber-300">
                    ⚠️ Today's streak is at risk.
                  </span>
                )}
                {streakStatus.isTodayFrozen && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-sky-200 text-sky-950 border border-sky-300">
                    ❄️ Protected by Streak Freeze
                  </span>
                )}
                {streakStatus.isTodayActive && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                    ✅ Safe for today
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-600 mt-0.5">
                {streakStatus.isAtRisk
                  ? "Today's streak is at risk. Complete a task before midnight or equip a freeze."
                  : streakStatus.isTodayFrozen
                  ? 'Streak is frozen for today. It will not reset at midnight.'
                  : 'Maintain daily consistency to protect your progress and earn streak freezes.'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3 shrink-0 pl-2">
            <div className="hidden sm:flex flex-col items-end text-right">
              <span className="text-[10px] uppercase font-bold text-stone-400">Streak Freeze:</span>
              <span className="text-xs font-bold text-stone-800">
                {streakStatus.availableFreezes} available
              </span>
            </div>
            <div className="flex items-center space-x-1 text-xs font-bold text-stone-700 group-hover:text-stone-900 group-hover:translate-x-0.5 transition-all">
              <span>Protect</span>
              <span>→</span>
            </div>
          </div>
        </div>
      )}

      {/* Daily Progress Bar */}
      <div className="my-5 p-4 rounded-xl bg-stone-50 border border-stone-100">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="font-semibold text-stone-800">
            {completedItems} / {totalItems} tasks completed
          </span>
          <span
            className={`font-bold text-sm ${
              percentage === 100 ? 'text-emerald-600' : 'text-stone-700'
            }`}
          >
            {percentage}% Progress
          </span>
        </div>

        {/* Bar */}
        <div className="w-full h-2.5 bg-stone-200 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 rounded-full ${
              percentage === 100 ? 'bg-emerald-600' : 'bg-emerald-500'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center space-x-1.5 overflow-x-auto pb-2 mb-4 scrollbar-none text-xs">
        <div className="flex items-center text-stone-400 mr-1 shrink-0">
          <Filter className="w-3.5 h-3.5 mr-1" />
          <span>Filter:</span>
        </div>
        {ALL_CATEGORIES.map((cat) => {
          const isSelected = categoryFilter === cat.key;
          return (
            <button
              key={cat.key}
              id={`filter-${cat.key.replace(/\s+/g, '-').toLowerCase()}`}
              onClick={() => setCategoryFilter(cat.key)}
              className={`shrink-0 inline-flex items-center space-x-1 px-2.5 py-1 rounded-full font-medium transition-all ${
                isSelected
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Priority Limit Alert Banner */}
      {priorityAlert && (
        <div
          id="priority-limit-alert"
          className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-center justify-between animate-in fade-in duration-150"
        >
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="font-semibold">{priorityAlert}</span>
          </div>
          <button
            onClick={() => setPriorityAlert(null)}
            className="text-amber-700 hover:text-amber-950 font-bold ml-2 text-sm px-1"
            aria-label="Dismiss alert"
          >
            ×
          </button>
        </div>
      )}

      {/* Scrollable Tasks Container */}
      <div className="space-y-6 flex-1 overflow-y-auto pr-1 min-h-[300px]">
        {/* ========================================================================= */}
        {/* FEATURE 1: TODAY'S TOP 3 PRIORITY SECTION                                 */}
        {/* ========================================================================= */}
        <section
          id="top-3-priority-section"
          aria-labelledby="top-3-priority-heading"
          className="rounded-2xl border-2 border-amber-300/80 bg-gradient-to-b from-amber-50/70 via-amber-50/30 to-amber-50/10 p-4 sm:p-4.5 shadow-xs"
        >
          {/* Top 3 Section Header */}
          <div className="flex items-center justify-between pb-3 border-b border-amber-200/80">
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded-lg bg-amber-400/90 text-stone-900 flex items-center justify-center font-bold text-sm shadow-2xs">
                ⭐
              </div>
              <div>
                <h3
                  id="top-3-priority-heading"
                  className="text-sm sm:text-base font-extrabold uppercase tracking-wide text-stone-900 flex items-center gap-2"
                >
                  <span>{isToday ? "TODAY'S TOP 3" : "TOP 3 PRIORITIES"}</span>
                </h3>
                <p className="text-[11px] text-amber-900/80">
                  Focus on these 3 most critical items first to conquer your day
                </p>
              </div>
            </div>

            {/* Counter pill */}
            <div className="flex items-center space-x-1.5">
              <span
                id="top-3-counter-badge"
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold border transition-colors ${
                  priorityItems.length === 3
                    ? 'bg-amber-400 text-stone-900 border-amber-500 shadow-2xs'
                    : 'bg-amber-100 text-amber-900 border-amber-300'
                }`}
              >
                ⭐ {priorityItems.length} / 3
              </span>
            </div>
          </div>

          {/* Priority Items List or Fallback */}
          <div className="mt-3 space-y-2.5">
            {priorityItems.length === 0 ? (
              /* Sensible Fallback if no Top 3 tasks have been selected */
              <div
                id="top-3-fallback-card"
                className="p-4 rounded-xl border border-dashed border-amber-300 bg-white/80 text-center flex flex-col items-center justify-center space-y-2"
              >
                <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 text-lg">
                  ⭐
                </div>
                <div>
                  <p className="text-xs font-bold text-stone-800">No Top 3 Priorities Selected Yet</p>
                  <p className="text-[11px] text-stone-500 max-w-sm mt-0.5">
                    Click the star icon (⭐) next to any task below to elevate it into your Top 3, or let us pick the top commitments for you.
                  </p>
                </div>
                {onAutoPickTop3 && items.length > 0 && (
                  <button
                    id="auto-pick-top-3-btn"
                    onClick={onAutoPickTop3}
                    className="mt-1 inline-flex items-center space-x-1.5 px-3 py-1.5 bg-amber-400 hover:bg-amber-500 text-stone-900 rounded-lg text-xs font-bold shadow-2xs transition-colors"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>⭐ Auto-Select Top 3 for Today</span>
                  </button>
                )}
              </div>
            ) : filteredPriorityItems.length === 0 ? (
              /* When category filter hides selected priorities */
              <div className="p-3 rounded-xl border border-dashed border-amber-200 bg-white/70 text-center text-xs text-stone-500">
                <span>
                  No top priorities in "{categoryFilter}". ({priorityItems.length} priorities active in other categories)
                </span>
              </div>
            ) : (
              /* Render Top 3 Items */
              filteredPriorityItems.map((item, index) => {
                const catMeta = CATEGORY_DETAILS[item.category] || CATEGORY_DETAILS.Other;
                const rankNumber = item.priorityRank || (index + 1);
                const isOverdue = checkIsOverdue(item);

                return (
                  <div
                    key={item.id}
                    id={`top-priority-row-${item.id}`}
                    className={`group relative flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-3.5 rounded-xl border transition-all gap-2 ${
                      item.completed
                        ? 'bg-emerald-50/50 border-emerald-300 text-stone-600 shadow-2xs'
                        : isOverdue
                        ? 'bg-white border-rose-300 shadow-xs'
                        : 'bg-white border-amber-300/90 hover:border-amber-400 shadow-xs'
                    }`}
                  >
                    {/* Left: Star + Rank + Checkbox + Details */}
                    <div className="flex items-start sm:items-center space-x-3 flex-1 min-w-0">
                      {/* Priority Star & Rank Badge */}
                      <div className="flex items-center space-x-1.5 shrink-0 mt-0.5 sm:mt-0">
                        <button
                          id={`unstar-priority-${item.id}`}
                          onClick={() => handleStarClick(item.id, true)}
                          className="p-1 text-amber-500 hover:text-amber-600 hover:scale-110 transition-transform"
                          title="Remove from Top 3 Priority"
                          aria-label="Remove from Top 3 Priority"
                        >
                          <Star className="w-5 h-5 fill-amber-400 text-amber-500" />
                        </button>
                        <span
                          className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-black shrink-0 ${
                            rankNumber === 1
                              ? 'bg-amber-400 text-stone-900 shadow-2xs'
                              : rankNumber === 2
                              ? 'bg-amber-300 text-stone-900'
                              : 'bg-amber-200 text-stone-900'
                          }`}
                          title={`Priority #${rankNumber}`}
                        >
                          #{rankNumber}
                        </span>
                      </div>

                      {/* Checkbox */}
                      <button
                        id={`checkbox-priority-${item.id}`}
                        onClick={() => onToggleTask(item.id, item.isHabit, item.habitId)}
                        className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors shrink-0 ${
                          item.completed
                            ? 'bg-emerald-600 text-white'
                            : 'border-2 border-stone-300 hover:border-stone-500 bg-white'
                        }`}
                        aria-label={item.completed ? 'Mark uncompleted' : 'Mark completed'}
                      >
                        {item.completed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </button>

                      {/* Title & Metadata */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                          <span
                            className={`text-sm font-bold tracking-tight break-words ${
                              item.completed ? 'line-through text-stone-500 font-normal' : 'text-stone-900'
                            }`}
                          >
                            {item.title}
                          </span>

                          {/* Habit Badge */}
                          {item.isHabit && (
                            <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-stone-100 text-stone-700 border border-stone-200">
                              <Repeat className="w-2.5 h-2.5" />
                              <span>Habit</span>
                            </span>
                          )}

                          {/* Category Badge */}
                          <span
                            className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${catMeta.bg} ${catMeta.text} ${catMeta.border}`}
                          >
                            <span>{catMeta.icon}</span>
                            <span>{item.category}</span>
                          </span>

                          {/* Due Date & Time Badge */}
                          {item.dueTime && (
                            <span
                              className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                item.completed
                                  ? 'bg-stone-100 text-stone-500 border-stone-200'
                                  : isOverdue
                                  ? 'bg-rose-50 text-rose-800 border-rose-300'
                                  : 'bg-amber-50 text-amber-900 border-amber-300'
                              }`}
                              title={`Deadline: ${formatTime12Hour(item.dueTime)} IST`}
                            >
                              <Clock className="w-2.5 h-2.5" />
                              <span>Due: {formatTime12Hour(item.dueTime)}</span>
                            </span>
                          )}

                          {/* Recurring Schedule Badge */}
                          {item.recurringSchedule && item.recurringSchedule !== 'none' && (
                            <span
                              className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-medium border bg-sky-50 text-sky-800 border-sky-300"
                              title={`Recurring schedule: ${item.recurringSchedule}`}
                            >
                              <Repeat className="w-2.5 h-2.5 text-sky-600" />
                              <span className="capitalize">{item.recurringSchedule}</span>
                            </span>
                          )}
                        </div>

                        {/* Duration / Description */}
                        {(item.duration || item.description) && (
                          <div className="flex items-center space-x-3 mt-1 text-xs text-stone-500">
                            {item.duration && (
                              <span className="inline-flex items-center space-x-1 text-stone-500">
                                <Clock className="w-3 h-3 text-stone-400" />
                                <span>{item.duration}</span>
                              </span>
                            )}
                            {item.description && (
                              <span className="truncate max-w-sm text-stone-400">
                                {item.description}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Study-Specific Tracking Session Info */}
                        {item.isStudySession && !item.isRevisionTask && (
                          <div className="mt-2.5 p-2.5 rounded-xl bg-gradient-to-r from-indigo-50/80 via-white to-indigo-50/40 border border-indigo-200/80 space-y-1.5 shadow-2xs">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md font-bold bg-indigo-600 text-white text-[11px] shadow-2xs">
                                  <GraduationCap className="w-3 h-3 mr-0.5" />
                                  <span>Subject: {item.studySubject || 'Study'}</span>
                                </span>
                                {item.studyTopic && (
                                  <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-indigo-100/70 text-indigo-900 border border-indigo-200">
                                    <span>Topic:</span>
                                    <strong className="text-indigo-950 font-bold">{item.studyTopic}</strong>
                                  </span>
                                )}
                                {item.studyDurationMinutes && (
                                  <span className="inline-flex items-center space-x-1 text-stone-700 font-medium bg-stone-100 px-2 py-0.5 rounded-md text-[11px]">
                                    <Clock className="w-3 h-3 text-stone-500" />
                                    <span>Study Time: <strong>{Math.floor(item.studyDurationMinutes / 60) > 0 ? `${Math.floor(item.studyDurationMinutes / 60)}h ` : ''}{item.studyDurationMinutes % 60 > 0 ? `${item.studyDurationMinutes % 60}m` : ''}</strong></span>
                                  </span>
                                )}
                              </div>

                              {(item.questionsAttempted !== undefined || item.accuracy !== undefined) && (
                                <div className="flex items-center space-x-2.5 text-xs">
                                  {item.questionsAttempted !== undefined && (
                                    <span className="text-stone-600 font-medium">
                                      Questions: <strong className="text-stone-900">{item.questionsAttempted}</strong>
                                      {item.questionsCorrect !== undefined && (
                                        <> (Correct: <strong className="text-emerald-700">{item.questionsCorrect}</strong>)</>
                                      )}
                                    </span>
                                  )}
                                  {item.accuracy !== undefined && (
                                    <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                                      item.accuracy >= 80
                                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                        : item.accuracy >= 60
                                        ? 'bg-amber-50 text-amber-800 border-amber-300'
                                        : 'bg-rose-50 text-rose-800 border-rose-300'
                                    }`}>
                                      <Target className="w-3 h-3 mr-0.5" />
                                      <span>{item.accuracy}% Accuracy</span>
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Spaced Revision Task Card */}
                        {item.isRevisionTask && (
                          <div className="mt-2.5 p-2.5 rounded-xl bg-gradient-to-r from-purple-50 via-white to-purple-50/60 border border-purple-200 space-y-1.5 shadow-2xs">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md font-bold bg-purple-600 text-white text-[11px] shadow-2xs">
                                  <span>🧠</span>
                                  <span>Spaced Revision {item.revisionDayOffset !== undefined ? `• Day ${item.revisionDayOffset}` : ''}</span>
                                </span>
                                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-purple-100/80 text-purple-950 border border-purple-200">
                                  <span>Topic:</span>
                                  <strong className="font-bold">{item.revisionTopic || item.studyTopic}</strong>
                                </span>
                                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-stone-100 text-stone-700">
                                  <span>Subject:</span>
                                  <strong>{item.revisionSubject || item.studySubject}</strong>
                                </span>
                              </div>

                              <div className="flex items-center space-x-2 text-xs">
                                <span className="text-[11px] text-purple-800 font-semibold">
                                  Checking off automatically schedules next revision interval
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Dedicated Completion Status + Action Buttons */}
                    <div className="flex items-center justify-between sm:justify-end space-x-2 pl-9 sm:pl-0 shrink-0">
                      {/* Focus Mode Button */}
                      {onStartFocus && !item.completed && (
                        <button
                          id={`focus-priority-task-${item.id}`}
                          onClick={() => onStartFocus(item)}
                          className="inline-flex items-center space-x-1 px-2 py-1 rounded-md text-[11px] font-semibold bg-stone-100 hover:bg-stone-900 text-stone-700 hover:text-emerald-400 border border-stone-200 hover:border-stone-800 transition-all shadow-2xs"
                          title={`Launch Focus Mode for ${item.title}`}
                        >
                          <Play className="w-2.5 h-2.5 fill-current" />
                          <span className="hidden sm:inline">Focus</span>
                        </button>
                      )}

                      {/* Completion / Overdue / Pending Status */}
                      {renderStatusBadge(item)}

                      {/* Edit/Delete if custom task */}
                      {!item.isHabit && (
                        <div className="flex items-center space-x-1 opacity-70 group-hover:opacity-100 transition-opacity">
                          <button
                            id={`edit-priority-task-${item.id}`}
                            onClick={() => onEditTask(item.id)}
                            className="p-1.5 text-stone-400 hover:text-stone-800 hover:bg-stone-100 rounded-md transition-colors"
                            title="Edit task"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            id={`delete-priority-task-${item.id}`}
                            onClick={() => onDeleteTask(item.id)}
                            className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            title="Delete task"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* ========================================================================= */}
        {/* OTHER TASKS SECTION                                                       */}
        {/* ========================================================================= */}
        <section id="other-tasks-section" aria-labelledby="other-tasks-heading">
          {/* Section Heading */}
          <div className="flex items-center justify-between pb-2 border-b border-stone-200 mb-3">
            <h3
              id="other-tasks-heading"
              className="text-xs font-bold uppercase tracking-wider text-stone-500 flex items-center space-x-2"
            >
              <span>OTHER TASKS & HABITS</span>
              <span className="px-1.5 py-0.2 rounded bg-stone-100 text-stone-600 text-[11px] font-semibold">
                {filteredOtherItems.length}
              </span>
            </h3>
            {priorityItems.length < 3 && otherItems.length > 0 && (
              <span className="text-[11px] text-stone-400">
                Click ⭐ to pin to Top 3
              </span>
            )}
          </div>

          {/* Other Tasks List */}
          <div className="space-y-2.5">
            {filteredOtherItems.length === 0 ? (
              <div className="text-center py-6 px-4 border border-dashed border-stone-200 rounded-xl bg-stone-50/50">
                {items.length === 0 ? (
                  <>
                    <div className="w-9 h-9 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 mb-2 mx-auto">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <p className="text-xs font-semibold text-stone-700">No tasks for this day</p>
                    <p className="text-[11px] text-stone-500 max-w-xs mt-0.5 mb-3 mx-auto">
                      Schedule your study sessions, coding challenges, or revision tasks to build your streak.
                    </p>
                    <button
                      id="empty-state-add-task-btn"
                      onClick={onAddTask}
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Add your first task</span>
                    </button>
                  </>
                ) : priorityItems.length > 0 ? (
                  <p className="text-xs text-stone-500">
                    All tasks for this day are currently elevated to your Top 3 Priorities above!
                  </p>
                ) : (
                  <p className="text-xs text-stone-500">
                    No other tasks under "{categoryFilter}".
                  </p>
                )}
              </div>
            ) : (
              filteredOtherItems.map((item) => {
                const catMeta = CATEGORY_DETAILS[item.category] || CATEGORY_DETAILS.Other;
                const isOverdue = checkIsOverdue(item);

                return (
                  <div
                    key={item.id}
                    id={`task-row-${item.id}`}
                    className={`group flex items-start sm:items-center justify-between p-3 sm:p-3.5 rounded-xl border transition-all ${
                      item.completed
                        ? 'bg-emerald-50/40 border-emerald-200/80 text-stone-600'
                        : isOverdue
                        ? 'bg-rose-50/30 border-rose-200 text-stone-900'
                        : 'bg-white border-stone-200/90 hover:border-stone-300 text-stone-900 shadow-2xs'
                    }`}
                  >
                    {/* Left: Star to Promote + Checkbox + Info */}
                    <div className="flex items-start sm:items-center space-x-2.5 flex-1 min-w-0 mr-2">
                      {/* Star Button to promote to Top 3 */}
                      <button
                        id={`star-promote-${item.id}`}
                        onClick={() => handleStarClick(item.id, false)}
                        className={`p-1 text-stone-300 hover:text-amber-500 hover:scale-110 transition-transform shrink-0 ${
                          priorityItems.length >= 3 ? 'opacity-40 hover:text-stone-400' : ''
                        }`}
                        title={
                          priorityItems.length >= 3
                            ? 'Top 3 already full (remove one first)'
                            : 'Mark as Top 3 Priority'
                        }
                        aria-label="Mark as Top 3 Priority"
                      >
                        <Star className="w-4 h-4 hover:fill-amber-300" />
                      </button>

                      {/* Checkbox */}
                      <button
                        id={`checkbox-${item.id}`}
                        onClick={() => onToggleTask(item.id, item.isHabit, item.habitId)}
                        className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors shrink-0 ${
                          item.completed
                            ? 'bg-emerald-600 text-white'
                            : 'border-2 border-stone-300 hover:border-stone-500 bg-white'
                        }`}
                        aria-label={item.completed ? 'Mark uncompleted' : 'Mark completed'}
                      >
                        {item.completed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                          <span
                            className={`text-sm font-medium tracking-tight break-words ${
                              item.completed ? 'line-through text-stone-500 font-normal' : 'text-stone-900'
                            }`}
                          >
                            {item.title}
                          </span>

                          {/* Habit Badge */}
                          {item.isHabit && (
                            <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-stone-100 text-stone-700 border border-stone-200">
                              <Repeat className="w-2.5 h-2.5" />
                              <span>Habit</span>
                            </span>
                          )}

                          {/* Category Badge */}
                          <span
                            className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${catMeta.bg} ${catMeta.text} ${catMeta.border}`}
                          >
                            <span>{catMeta.icon}</span>
                            <span>{item.category}</span>
                          </span>

                          {/* Due Date & Time Badge */}
                          {item.dueTime && (
                            <span
                              className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                item.completed
                                  ? 'bg-stone-100 text-stone-500 border-stone-200'
                                  : isOverdue
                                  ? 'bg-rose-50 text-rose-800 border-rose-300'
                                  : 'bg-stone-50 text-stone-700 border-stone-200'
                              }`}
                              title={`Deadline: ${formatTime12Hour(item.dueTime)} IST`}
                            >
                              <Clock className="w-2.5 h-2.5" />
                              <span>Due: {formatTime12Hour(item.dueTime)}</span>
                            </span>
                          )}

                          {/* Recurring Schedule Badge */}
                          {item.recurringSchedule && item.recurringSchedule !== 'none' && (
                            <span
                              className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-medium border bg-sky-50 text-sky-800 border-sky-300"
                              title={`Recurring schedule: ${item.recurringSchedule}`}
                            >
                              <Repeat className="w-2.5 h-2.5 text-sky-600" />
                              <span className="capitalize">{item.recurringSchedule}</span>
                            </span>
                          )}
                        </div>

                        {/* Duration & Description */}
                        {(item.duration || item.description) && (
                          <div className="flex items-center space-x-3 mt-1 text-xs text-stone-500">
                            {item.duration && (
                              <span className="inline-flex items-center space-x-1 text-stone-500">
                                <Clock className="w-3 h-3 text-stone-400" />
                                <span>{item.duration}</span>
                              </span>
                            )}
                            {item.description && (
                              <span className="truncate max-w-sm text-stone-400">
                                {item.description}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Study-Specific Tracking Session Info */}
                        {item.isStudySession && !item.isRevisionTask && (
                          <div className="mt-2.5 p-2.5 rounded-xl bg-gradient-to-r from-indigo-50/80 via-white to-indigo-50/40 border border-indigo-200/80 space-y-1.5 shadow-2xs">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md font-bold bg-indigo-600 text-white text-[11px] shadow-2xs">
                                  <GraduationCap className="w-3 h-3 mr-0.5" />
                                  <span>Subject: {item.studySubject || 'Study'}</span>
                                </span>
                                {item.studyTopic && (
                                  <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-indigo-100/70 text-indigo-900 border border-indigo-200">
                                    <span>Topic:</span>
                                    <strong className="text-indigo-950 font-bold">{item.studyTopic}</strong>
                                  </span>
                                )}
                                {item.studyDurationMinutes && (
                                  <span className="inline-flex items-center space-x-1 text-stone-700 font-medium bg-stone-100 px-2 py-0.5 rounded-md text-[11px]">
                                    <Clock className="w-3 h-3 text-stone-500" />
                                    <span>Study Time: <strong>{Math.floor(item.studyDurationMinutes / 60) > 0 ? `${Math.floor(item.studyDurationMinutes / 60)}h ` : ''}{item.studyDurationMinutes % 60 > 0 ? `${item.studyDurationMinutes % 60}m` : ''}</strong></span>
                                  </span>
                                )}
                              </div>

                              {(item.questionsAttempted !== undefined || item.accuracy !== undefined) && (
                                <div className="flex items-center space-x-2.5 text-xs">
                                  {item.questionsAttempted !== undefined && (
                                    <span className="text-stone-600 font-medium">
                                      Questions: <strong className="text-stone-900">{item.questionsAttempted}</strong>
                                      {item.questionsCorrect !== undefined && (
                                        <> (Correct: <strong className="text-emerald-700">{item.questionsCorrect}</strong>)</>
                                      )}
                                    </span>
                                  )}
                                  {item.accuracy !== undefined && (
                                    <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                                      item.accuracy >= 80
                                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                        : item.accuracy >= 60
                                        ? 'bg-amber-50 text-amber-800 border-amber-300'
                                        : 'bg-rose-50 text-rose-800 border-rose-300'
                                    }`}>
                                      <Target className="w-3 h-3 mr-0.5" />
                                      <span>{item.accuracy}% Accuracy</span>
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Spaced Revision Task Card */}
                        {item.isRevisionTask && (
                          <div className="mt-2.5 p-2.5 rounded-xl bg-gradient-to-r from-purple-50 via-white to-purple-50/60 border border-purple-200 space-y-1.5 shadow-2xs">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md font-bold bg-purple-600 text-white text-[11px] shadow-2xs">
                                  <span>🧠</span>
                                  <span>Spaced Revision {item.revisionDayOffset !== undefined ? `• Day ${item.revisionDayOffset}` : ''}</span>
                                </span>
                                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-purple-100/80 text-purple-950 border border-purple-200">
                                  <span>Topic:</span>
                                  <strong className="font-bold">{item.revisionTopic || item.studyTopic}</strong>
                                </span>
                                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-stone-100 text-stone-700">
                                  <span>Subject:</span>
                                  <strong>{item.revisionSubject || item.studySubject}</strong>
                                </span>
                              </div>

                              <div className="flex items-center space-x-2 text-xs">
                                <span className="text-[11px] text-purple-800 font-semibold">
                                  Checking off automatically schedules next revision interval
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Dedicated Completion Status + Action Buttons */}
                    <div className="flex items-center space-x-2 shrink-0 pl-7 sm:pl-0">
                      {/* Focus Mode Button */}
                      {onStartFocus && !item.completed && (
                        <button
                          id={`focus-other-task-${item.id}`}
                          onClick={() => onStartFocus(item)}
                          className="inline-flex items-center space-x-1 px-2 py-1 rounded-md text-[11px] font-semibold bg-stone-100 hover:bg-stone-900 text-stone-700 hover:text-emerald-400 border border-stone-200 hover:border-stone-800 transition-all shadow-2xs"
                          title={`Launch Focus Mode for ${item.title}`}
                        >
                          <Play className="w-2.5 h-2.5 fill-current" />
                          <span className="hidden sm:inline">Focus</span>
                        </button>
                      )}

                      {/* Completion / Overdue / Pending Status */}
                      {renderStatusBadge(item)}

                      {/* Actions */}
                      {!item.isHabit && (
                        <div className="flex items-center space-x-1 opacity-80 group-hover:opacity-100 transition-opacity">
                          <button
                            id={`edit-task-${item.id}`}
                            onClick={() => onEditTask(item.id)}
                            className="p-1.5 text-stone-400 hover:text-stone-800 hover:bg-stone-100 rounded-md transition-colors"
                            title="Edit task"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            id={`delete-task-${item.id}`}
                            onClick={() => onDeleteTask(item.id)}
                            className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            title="Delete task"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
