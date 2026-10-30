import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
  Play,
  GraduationCap,
  Target,
  History,
  Trophy,
} from 'lucide-react';
import { DailySummaryItem, TaskCategory, StreakStatusInfo } from '../types';
import { CATEGORY_DETAILS, formatFriendlyDate } from '../utils/calendarUtils';
import { storageService } from '../services/storageService';
import {
  formatTime12Hour,
  getCurrentIST,
  evaluateTaskScheduleStatus,
} from '../utils/timeUtils';
import { QuoteCard } from './QuoteCard';
import { triggerConfetti, playCelebrationFanfare } from '../utils/celebration';

interface DailyTaskPanelProps {
  selectedDate: string;
  todayDate: string;
  items: DailySummaryItem[];
  userName?: string;
  revisionsDueTodayCount?: number;
  streakStatus?: StreakStatusInfo;
  focusMinutesToday?: number;
  focusMinutesSelectedDate?: number;
  onOpenStreakModal?: () => void;
  onOpenRevisionModal?: () => void;
  onOpenFocusModal?: () => void;
  onOpenMilestones?: () => void;
  onToggleTask: (id: string, isHabit: boolean, habitId?: string) => void;
  onTogglePriority?: (itemId: string) => { success: boolean; error?: string } | void;
  onAddTask: () => void;
  onEditTask: (id: string, targetDate?: string) => void;
  onDeleteTask: (id: string, targetDate?: string) => void;
  onStartFocus?: (item: DailySummaryItem) => void;
  onAutoPickTop3?: () => void;
}

export const DailyTaskPanel: React.FC<DailyTaskPanelProps> = ({
  selectedDate,
  todayDate,
  items,
  userName,
  revisionsDueTodayCount,
  streakStatus,
  focusMinutesToday = 0,
  focusMinutesSelectedDate,
  onOpenStreakModal,
  onOpenRevisionModal,
  onOpenFocusModal,
  onOpenMilestones,
  onToggleTask,
  onTogglePriority,
  onAddTask,
  onEditTask,
  onDeleteTask,
  onStartFocus,
  onAutoPickTop3,
}) => {
  const [categoryFilter, setCategoryFilter] = useState<'all' | TaskCategory>('all');
  const [priorityAlert, setPriorityAlert] = useState<string | null>(null);


  // User-specific categories state
  const [userCategories, setUserCategories] = useState(() => storageService.getCategories());

  useEffect(() => {
    const handleCategoriesUpdated = (e?: any) => {
      const updated = e?.detail || storageService.getCategories();
      setUserCategories(updated);
    };
    window.addEventListener('habits:categories_updated', handleCategoriesUpdated);
    handleCategoriesUpdated();
    return () => {
      window.removeEventListener('habits:categories_updated', handleCategoriesUpdated);
    };
  }, [items]);

  // If active filter no longer exists in current user categories, reset to 'all'
  useEffect(() => {
    if (categoryFilter !== 'all' && !userCategories.some((c) => c.name === categoryFilter)) {
      setCategoryFilter('all');
    }
  }, [userCategories, categoryFilter]);

  // Dynamic categories list for the current user
  const categoriesList = useMemo(() => {
    return [
      { key: 'all' as const, label: 'All Items', icon: '📋' },
      ...userCategories.map((c) => ({ key: c.name, label: c.name, icon: c.icon || '🏷️' })),
    ];
  }, [userCategories]);

  // User-configurable daily study target (defaults to 5 hours as requested)
  const getSavedTargetHours = useCallback((dateKey: string) => {
    try {
      const user = storageService.getUser();
      const userKey = (user?.email || user?.id || 'default').toLowerCase().trim();
      const savedDate = localStorage.getItem(`daily_study_target_hours_${userKey}_${dateKey}`);
      if (savedDate) {
        const parsed = parseFloat(savedDate);
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
      const savedUser = localStorage.getItem(`daily_study_target_hours_${userKey}`);
      if (savedUser) {
        const parsed = parseFloat(savedUser);
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
      const legacy = localStorage.getItem('ssc_cgl_daily_study_target_hours');
      if (legacy) {
        const parsed = parseFloat(legacy);
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
    } catch {
      // Fallback
    }
    return 5;
  }, []);

  const [targetHours, setTargetHours] = useState<number>(() => getSavedTargetHours(selectedDate));

  useEffect(() => {
    setTargetHours(getSavedTargetHours(selectedDate));
  }, [selectedDate, getSavedTargetHours]);

  const [isAdjustTargetModalOpen, setIsAdjustTargetModalOpen] = useState(false);

  const handleSetTargetHours = (hours: number) => {
    const sanitized = Math.max(1, Math.min(16, hours));
    setTargetHours(sanitized);
    try {
      const user = storageService.getUser();
      const userKey = (user?.email || user?.id || 'default').toLowerCase().trim();
      localStorage.setItem(`daily_study_target_hours_${userKey}_${selectedDate}`, String(sanitized));
      localStorage.setItem(`daily_study_target_hours_${userKey}`, String(sanitized));
      localStorage.setItem('ssc_cgl_daily_study_target_hours', String(sanitized));
    } catch {
      // Ignore storage error
    }
  };

  // Safe filtering: ensure items is an array and filter out any null/undefined entries
  const safeItems = useMemo(() => {
    if (!items || !Array.isArray(items)) return [];
    return items.filter((item): item is DailySummaryItem => Boolean(item && item.id));
  }, [items]);

  const totalItems = safeItems.length;
  const completedItems = safeItems.filter((i) => i.completed).length;
  const percentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
  const isToday = selectedDate === todayDate;
  const isFuture = selectedDate > todayDate;
  const isPast = selectedDate < todayDate;

  // Separate Top 3 priorities from Other tasks (strictly mutually exclusive, capped at 3)
  const priorityItems = useMemo(() => {
    return safeItems
      .filter((item) => Boolean(item.isTopPriority))
      .sort((a, b) => (a.priorityRank || 99) - (b.priorityRank || 99))
      .slice(0, 3);
  }, [safeItems]);

  const priorityItemIdSet = useMemo(() => {
    return new Set(priorityItems.map((p) => p.id));
  }, [priorityItems]);

  // Everything not in the Top 3 is an "other" task (guarantees mutually exclusive & no missing tasks)
  const otherItems = useMemo(() => {
    return safeItems.filter((item) => !priorityItemIdSet.has(item.id));
  }, [safeItems, priorityItemIdSet]);

  // Filter items by category
  const filteredPriorityItems = useMemo(() => {
    return priorityItems.filter((item) => {
      if (categoryFilter === 'all') return true;
      return item.category === categoryFilter;
    });
  }, [priorityItems, categoryFilter]);

  const filteredOtherItems = useMemo(() => {
    return otherItems.filter((item) => {
      if (categoryFilter === 'all') return true;
      return item.category === categoryFilter;
    });
  }, [otherItems, categoryFilter]);

  // Helper to parse item planned duration to minutes
  const parseDurationToMinutes = (item: DailySummaryItem): number => {
    if (item.studyDurationMinutes && item.studyDurationMinutes > 0) {
      return item.studyDurationMinutes;
    }
    const combinedStr = `${item.duration || ''} ${item.description || ''}`.toLowerCase();
    let total = 0;
    const hrMatch = combinedStr.match(/(\d+(?:\.\d+)?)\s*(?:hour|hours|hr|hrs|h)\b/);
    if (hrMatch) total += parseFloat(hrMatch[1]) * 60;
    const minMatch = combinedStr.match(/(\d+)\s*(?:minute|minutes|min|mins|m)\b/);
    if (minMatch) total += parseInt(minMatch[1], 10);
    if (total > 0) return total;
    return item.isStudySession || item.isHabit ? 60 : 30;
  };

  // 1. Task-level scheduled duration across individual tasks
  const tasksScheduledMinutes = useMemo(() => {
    return items.reduce((acc, it) => acc + parseDurationToMinutes(it), 0);
  }, [items]);
  const scheduledHours = Math.floor(tasksScheduledMinutes / 60);
  const scheduledMins = tasksScheduledMinutes % 60;

  // 2. TOTAL PLANNED STUDY DAY:
  // Directly driven by the user's adjusted Daily Study Target
  const targetMinutes = targetHours * 60;
  const plannedMinutes = targetMinutes;
  const plannedHours = Math.floor(plannedMinutes / 60);
  const plannedMins = plannedMinutes % 60;

  // 3. ACTUAL STUDIED: Focus mode time logged for the selected date
  const actualStudiedMinutes = focusMinutesSelectedDate !== undefined ? focusMinutesSelectedDate : focusMinutesToday;
  const actualHours = Math.floor(actualStudiedMinutes / 60);
  const actualMins = actualStudiedMinutes % 60;

  // 4. REMAINING TIME: Daily Target - Actual Focus Studied Today
  const remainingMinutes = Math.max(0, targetMinutes - actualStudiedMinutes);
  const remainingHours = Math.floor(remainingMinutes / 60);
  const remainingMins = remainingMinutes % 60;
  const isTargetAchieved = targetMinutes > 0 && actualStudiedMinutes >= targetMinutes;
  const targetProgress = targetMinutes > 0 ? Math.min(100, Math.round((actualStudiedMinutes / targetMinutes) * 100)) : 100;

  // Actionable completion breakdown
  const pomodorosNeeded = Math.ceil(remainingMinutes / 25);
  const deepBlocksNeeded = Math.ceil(remainingMinutes / 50);

  // Suggested next task to complete for study target
  const suggestedTask = useMemo(() => {
    // 1. Uncompleted top priority
    const uncompletedPriority = priorityItems.find((t) => !t.completed);
    if (uncompletedPriority) return uncompletedPriority;
    // 2. Uncompleted study session or SSC CGL / Technical task
    const uncompletedStudy = items.find(
      (t) => !t.completed && (t.isStudySession || t.category === 'SSC CGL' || t.category === 'Technical')
    );
    if (uncompletedStudy) return uncompletedStudy;
    // 3. Any uncompleted task
    return items.find((t) => !t.completed);
  }, [priorityItems, items]);

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
          className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold border shadow-2xs shrink-0 ${
            isPast ? 'bg-stone-100 text-stone-600 border-stone-300' : 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse'
          }`}
          title={isPast ? 'Saved as uncompleted on this date' : `Incomplete + deadline passed (${formatTime12Hour(item.dueTime || '20:00')} IST)`}
        >
          <AlertCircle className={`w-3.5 h-3.5 ${isPast ? 'text-stone-500' : 'text-rose-600'}`} />
          <span>{isPast ? 'Uncompleted' : 'Overdue'}</span>
          <span aria-hidden="true">{isPast ? '○' : '❌'}</span>
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
    <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/90 dark:border-stone-800 shadow-xs p-3.5 sm:p-6 flex flex-col h-full transition-colors">
      {/* Daily Quote Section (Prominent Header) */}
      <QuoteCard selectedDate={selectedDate} userName={userName} className="mb-3.5 sm:mb-4" />

      {/* Header & Date */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 sm:pb-4 border-b border-stone-100 dark:border-stone-800">
        <div>
          <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            {isPast ? 'Selected Date' : 'Selected Day Plan'}
          </span>
          <h2 className="text-lg sm:text-2xl font-bold text-stone-900 dark:text-stone-100 tracking-tight">
            {formatFriendlyDate(selectedDate, todayDate)}
          </h2>
          {isPast && (
            <div className="mt-2 flex items-center space-x-2 flex-wrap gap-y-1">
              <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-md text-xs font-black tracking-wider uppercase bg-stone-900 text-white shadow-2xs">
                <History className="w-3.5 h-3.5 text-stone-300" />
                <span>HISTORY</span>
              </span>
              <span className="text-xs text-stone-500 font-medium">
                Past Date Archive • View-Only
              </span>
            </div>
          )}
        </div>

        {/* Quick Add Task Button (Today & Future only) */}
        {!isPast && (
          <button
            id="add-task-btn"
            onClick={onAddTask}
            className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 sm:py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-sm font-semibold transition-colors shadow-xs active:scale-98 w-full sm:w-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Add Task</span>
          </button>
        )}

        {/* FOR PAST DATES: ONLY ACTUAL STUDIED & PLANNED STUDY CARDS (NO TODAY'S STUDY TARGET TITLE) */}
        {isPast && (
          <div className="flex items-center space-x-2.5 mt-2 sm:mt-0">
            {/* 1. ACTUAL STUDIED */}
            <div className="p-2.5 sm:p-3 rounded-2xl bg-white border border-blue-200/90 shadow-2xs min-w-[125px] sm:min-w-[140px]">
              <span className="text-[10px] sm:text-[11px] uppercase font-bold text-stone-500 flex items-center space-x-1">
                <span>🔥</span>
                <span>ACTUAL STUDIED</span>
              </span>
              <div className="flex items-baseline space-x-1 mt-0.5">
                <span className="text-xl sm:text-2xl font-black text-indigo-600 tracking-tight">
                  {actualHours}h {actualMins.toString().padStart(2, '0')}m
                </span>
              </div>
              <span className="text-[10px] sm:text-xs text-stone-500 block">via Focus Mode</span>
            </div>

            {/* 2. PLANNED STUDY (NOT "PLANNED TODAY" ON PAST DATES) */}
            <div className="p-2.5 sm:p-3 rounded-2xl bg-white border border-stone-200 shadow-2xs min-w-[125px] sm:min-w-[140px]">
              <span className="text-[10px] sm:text-[11px] uppercase font-bold text-stone-500 flex items-center space-x-1">
                <span>📋</span>
                <span>PLANNED STUDY</span>
              </span>
              <div className="flex items-baseline space-x-1 mt-0.5">
                <span className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">
                  {scheduledHours}h {scheduledMins.toString().padStart(2, '0')}m
                </span>
              </div>
              <span className="text-[10px] sm:text-xs text-stone-500 block">{items.length} tasks</span>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* FEATURE: TODAY STUDY TARGET (EXACT 3 CARDS AS IN SECOND IMAGE)            */}
      {/* ========================================================================= */}
      {!isPast && (
        <div id="today-study-target-container" className="my-3.5 space-y-2.5">
          {/* Header Row with Adjust Target Button */}
          <div className="flex items-center justify-between px-0.5">
            <div className="flex items-center space-x-2">
              <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wide text-stone-800 flex items-center gap-1.5">
                <Target className="w-4 h-4 text-indigo-600" />
                <span>Today's Study Target: {targetHours}h</span>
              </span>
            </div>
            <button
              type="button"
              id="adjust-target-btn"
              onClick={() => setIsAdjustTargetModalOpen(true)}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white hover:bg-stone-50 text-stone-700 border border-stone-200 rounded-xl text-xs font-bold shadow-2xs transition-all active:scale-98"
            >
              <Edit2 className="w-3.5 h-3.5 text-stone-500" />
              <span>Adjust Target</span>
            </button>
          </div>

          {/* Exact 3 Cards from Image 2 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* 1. ACTUAL STUDIED */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-blue-200/80 shadow-2xs">
              <span className="text-[11px] uppercase font-bold text-stone-500 flex items-center space-x-1.5">
                <span>⏱️</span>
                <span>ACTUAL STUDIED</span>
              </span>
              <div className="flex items-baseline space-x-1 mt-1">
                <span className="text-2xl sm:text-3xl font-black text-indigo-600 tracking-tight">
                  {actualHours}h {actualMins.toString().padStart(2, '0')}m
                </span>
              </div>
              <span className="text-xs text-stone-500 mt-0.5 block">via Focus Mode</span>
            </div>

            {/* 2. PLANNED TODAY */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-stone-200/90 shadow-2xs">
              <span className="text-[11px] uppercase font-bold text-stone-500 flex items-center space-x-1.5">
                <span>📋</span>
                <span>PLANNED TODAY</span>
              </span>
              <div className="flex items-baseline space-x-1 mt-1">
                <span className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">
                  {plannedHours}h {plannedMins.toString().padStart(2, '0')}m
                </span>
              </div>
              <span className="text-xs text-stone-500 mt-0.5 block">
                {items.length > 0
                  ? `${items.length} ${items.length === 1 ? 'task' : 'tasks'} (${scheduledHours}h ${scheduledMins.toString().padStart(2, '0')}m scheduled)`
                  : `Target: ${targetHours}h • 0 tasks`}
              </span>
            </div>

            {/* 3. REMAINING */}
            <div
              className={`p-3.5 sm:p-4 rounded-2xl border shadow-2xs ${
                isTargetAchieved
                  ? 'bg-emerald-50/70 border-emerald-300 text-emerald-900'
                  : 'bg-white border-amber-300 text-amber-900'
              }`}
            >
              <span className="text-[11px] uppercase font-bold text-stone-500 flex items-center space-x-1.5">
                <span>⏳</span>
                <span>REMAINING</span>
              </span>
              <div className="flex items-baseline space-x-1 mt-1">
                <span
                  className={`text-2xl sm:text-3xl font-black tracking-tight ${
                    isTargetAchieved ? 'text-emerald-700' : 'text-amber-800'
                  }`}
                >
                  {isTargetAchieved ? '0h 00m' : `${remainingHours}h ${remainingMins.toString().padStart(2, '0')}m`}
                </span>
              </div>
              <span className="text-xs text-stone-500 mt-0.5 block">
                {isTargetAchieved ? 'Target Achieved! 🎉' : 'to hit target'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Target Adjustment Modal: View & change target and view completion plan */}
      {isAdjustTargetModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setIsAdjustTargetModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl border border-stone-200 shadow-2xl max-w-lg w-full p-5 sm:p-6 space-y-5 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-base shadow-2xs">
                  <Target className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-stone-900">
                    Adjust Daily Study Target
                  </h3>
                  <p className="text-xs text-stone-500">
                    Set how many hours you want to study today
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAdjustTargetModalOpen(false)}
                className="text-stone-400 hover:text-stone-700 font-bold text-lg p-1"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Target Setter Control */}
            <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-stone-600">Daily Study Target:</span>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => handleSetTargetHours(targetHours - 1)}
                    disabled={targetHours <= 1}
                    className="w-9 h-9 rounded-lg bg-white border border-stone-300 text-stone-700 hover:bg-stone-100 font-bold text-lg flex items-center justify-center disabled:opacity-40 cursor-pointer active:scale-95 transition-all shadow-2xs"
                  >
                    -
                  </button>
                  <span className="text-2xl font-black text-indigo-700 px-3 min-w-[60px] text-center">
                    {targetHours}h
                  </span>
                  <button
                    type="button"
                    onClick={() => handleSetTargetHours(targetHours + 1)}
                    disabled={targetHours >= 16}
                    className="w-9 h-9 rounded-lg bg-white border border-stone-300 text-stone-700 hover:bg-stone-100 font-bold text-lg flex items-center justify-center disabled:opacity-40 cursor-pointer active:scale-95 transition-all shadow-2xs"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Quick Presets */}
              <div className="flex items-center space-x-2 pt-1 flex-wrap gap-y-2">
                <span className="text-xs text-stone-500 font-medium">Quick Presets:</span>
                {[2, 3, 4, 5, 6, 8, 10].map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => handleSetTargetHours(h)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      targetHours === h
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'bg-white text-stone-700 border border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    {h} Hours
                  </button>
                ))}
              </div>
            </div>

            {/* "How I Can Complete It" Plan Breakdown inside Modal */}
            <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-100 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-indigo-950 flex items-center space-x-1.5 uppercase tracking-wide">
                  <span>🚀</span>
                  <span>How to Complete This Target:</span>
                </span>
                <span className="font-bold text-indigo-800">
                  {isTargetAchieved ? 'Target Achieved! 🎉' : `${remainingHours}h ${remainingMins}m remaining`}
                </span>
              </div>

              <div className="text-stone-700 leading-relaxed">
                To achieve your <strong>{targetHours}h</strong> study goal today, you need:
              </div>

              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="p-2.5 rounded-lg bg-white border border-indigo-100">
                  <span className="text-lg font-black text-indigo-700">{pomodorosNeeded}</span>
                  <span className="text-[11px] text-stone-500 block">x 25-min Pomodoros</span>
                </div>
                <div className="p-2.5 rounded-lg bg-white border border-indigo-100">
                  <span className="text-lg font-black text-indigo-700">{deepBlocksNeeded}</span>
                  <span className="text-[11px] text-stone-500 block">x 50-min Deep Blocks</span>
                </div>
              </div>

              {suggestedTask && (
                <div className="pt-1">
                  <span className="text-[10px] font-bold uppercase text-stone-500 block mb-1">
                    Recommended Next Task:
                  </span>
                  <div className="p-2.5 rounded-lg bg-white border border-stone-200 flex items-center justify-between">
                    <div className="truncate min-w-0 pr-2">
                      <p className="font-bold text-stone-900 truncate">{suggestedTask.title}</p>
                      <p className="text-[10px] text-stone-500">
                        {suggestedTask.category} • {suggestedTask.duration || (suggestedTask.studyDurationMinutes ? `${suggestedTask.studyDurationMinutes} min` : '30 min')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAdjustTargetModalOpen(false);
                        if (suggestedTask && onStartFocus) {
                          onStartFocus(suggestedTask);
                        } else if (onOpenFocusModal) {
                          onOpenFocusModal();
                        }
                      }}
                      className="shrink-0 px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs flex items-center space-x-1"
                    >
                      <Play className="w-3 h-3 fill-white" />
                      <span>Focus</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setIsAdjustTargetModalOpen(false)}
                className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {isPast ? (
        /* ========================================================================= */
        /* PAST DATE HISTORY VIEW                                                    */
        /* ========================================================================= */
        <div className="mt-4 flex-1 flex flex-col space-y-5 overflow-y-auto pr-1">
          {/* Summary Cards: Only Total Tasks and Completed Tasks (plus uncompleted) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-3.5 sm:p-4 rounded-xl bg-stone-50 border border-stone-200/90 shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500 block mb-1">
                Total Tasks
              </span>
              <div className="flex items-baseline space-x-1.5">
                <span className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">
                  {totalItems}
                </span>
                <span className="text-xs text-stone-500 font-medium">scheduled</span>
              </div>
            </div>

            <div className="p-3.5 sm:p-4 rounded-xl bg-emerald-50/80 border border-emerald-200 shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 block mb-1">
                Completed
              </span>
              <div className="flex items-baseline space-x-1.5">
                <span className="text-2xl sm:text-3xl font-black text-emerald-800 tracking-tight">
                  {completedItems}
                </span>
                <span className="text-xs text-emerald-600 font-medium">tasks</span>
              </div>
            </div>

            <div className="col-span-2 sm:col-span-1 p-3.5 sm:p-4 rounded-xl bg-stone-50 border border-stone-200/90 shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500 block mb-1">
                Uncompleted
              </span>
              <div className="flex items-baseline space-x-1.5">
                <span className="text-2xl sm:text-3xl font-black text-stone-700 tracking-tight">
                  {Math.max(0, totalItems - completedItems)}
                </span>
                <span className="text-xs text-stone-500 font-medium">uncompleted</span>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-100 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold text-stone-700">
              <span>{completedItems} of {totalItems} tasks completed</span>
              <span className="font-bold text-stone-900">{percentage}% Completion Rate</span>
            </div>
            <div className="w-full h-2 bg-stone-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  percentage === 100 ? 'bg-emerald-600' : 'bg-emerald-500'
                }`}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>

          {/* Past Day Tasks History List */}
          <div className="space-y-3 flex-1">
            <div className="flex items-center justify-between pb-2 border-b border-stone-200">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-600 flex items-center space-x-2">
                <span>TASKS RECORDED FOR THIS DAY</span>
                <span className="px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 text-[11px] font-bold border border-stone-200">
                  {items.length}
                </span>
              </h3>
              <span className="text-[11px] text-stone-400 font-semibold flex items-center space-x-1">
                <span>🔒</span>
                <span>Historical Archive</span>
              </span>
            </div>

            {items.length === 0 ? (
              <div className="text-center py-10 px-4 border border-dashed border-stone-200 rounded-xl bg-stone-50/50">
                <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 mb-2 mx-auto text-lg">
                  📜
                </div>
                <p className="text-sm font-bold text-stone-700">No tasks were recorded on this day</p>
                <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
                  There were no tasks or habit entries scheduled or saved for this date.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {items.map((item) => {
                  const catMeta = CATEGORY_DETAILS[item.category] || CATEGORY_DETAILS.Other;
                  return (
                    <div
                      key={item.id}
                      className={`p-3.5 sm:p-4 rounded-xl border transition-all ${
                        item.completed
                          ? 'bg-emerald-50/30 border-emerald-200/90 shadow-2xs'
                          : 'bg-white border-stone-200/90 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
                        {/* Left: Completion check indicator & details */}
                        <div className="flex items-start sm:items-center space-x-3 flex-1 min-w-0">
                          {/* Indicator (Read-only) */}
                          <div
                            className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 sm:mt-0 ${
                              item.completed
                                ? 'bg-emerald-600 text-white'
                                : 'border-2 border-stone-300 bg-stone-100 text-stone-400'
                            }`}
                            title={item.completed ? 'Completed on this day' : 'Saved as uncompleted on this day'}
                          >
                            {item.completed ? (
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            ) : null}
                          </div>

                          {/* Task details */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                              <span
                                className={`text-sm font-bold tracking-tight break-words ${
                                  item.completed
                                    ? 'line-through text-stone-500 font-normal'
                                    : 'text-stone-900'
                                }`}
                              >
                                {item.title}
                              </span>

                              {/* Habit Tag */}
                              {item.isHabit && (
                                <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-stone-100 text-stone-700 border border-stone-200">
                                  <Repeat className="w-2.5 h-2.5" />
                                  <span>Habit</span>
                                </span>
                              )}

                              {/* Category Tag */}
                              <span
                                className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${catMeta.bg} ${catMeta.text} ${catMeta.border}`}
                              >
                                <span>{catMeta.icon}</span>
                                <span>{item.category}</span>
                              </span>

                              {/* Due Time */}
                              {item.dueTime && (
                                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-stone-100 text-stone-600 border-stone-200">
                                  <Clock className="w-2.5 h-2.5" />
                                  <span>Due: {formatTime12Hour(item.dueTime)}</span>
                                </span>
                              )}

                              {/* Target Duration */}
                              {item.duration && (
                                <span className="text-[11px] text-stone-500">
                                  Target: {item.duration}
                                </span>
                              )}

                              {/* Top priority badge if it was starred as priority */}
                              {item.isTopPriority && (
                                <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                  <span>⭐</span>
                                  <span>Priority #{item.priorityRank || 1}</span>
                                </span>
                              )}
                            </div>

                            {/* Description if present */}
                            {item.description && (
                              <p className="text-xs text-stone-500 mt-1 break-words">
                                {item.description}
                              </p>
                            )}

                            {/* Study Session Details if present */}
                            {item.isStudySession && item.studyTopic && (
                              <div className="mt-2 text-xs flex items-center space-x-2 text-stone-600 flex-wrap gap-y-1">
                                <span className="font-semibold text-stone-800">
                                  📚 {item.studySubject}: {item.studyTopic}
                                </span>
                                {item.accuracy !== undefined && (
                                  <span className="font-bold text-emerald-700">
                                    • {item.accuracy}% Accuracy
                                  </span>
                                )}
                                {item.questionsAttempted !== undefined && (
                                  <span className="text-stone-500">
                                    ({item.questionsAttempted} questions)
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Right: Explicit Status Badge */}
                        <div className="shrink-0 pl-8 sm:pl-0">
                          {item.completed ? (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Completed</span>
                              <span>✅</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-stone-100 text-stone-600 border border-stone-300 shadow-2xs">
                              <AlertCircle className="w-3.5 h-3.5 text-stone-400" />
                              <span>Uncompleted</span>
                              <span>○</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Daily Target Progress & Stepped Milestones */}
          <div className="my-5 p-4 rounded-2xl bg-stone-50 dark:bg-stone-850 border border-stone-200/80 dark:border-stone-800 space-y-3 transition-colors">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-stone-800 dark:text-stone-200">
                  {completedItems} / {totalItems} daily targets completed
                </span>
                {percentage === 100 && totalItems > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 animate-pulse">
                    100% Conquered
                  </span>
                )}
              </div>
              <span
                className={`font-mono font-bold text-sm tabular-nums ${
                  percentage === 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-stone-700 dark:text-stone-300'
                }`}
              >
                {percentage}%
              </span>
            </div>

            {/* Stepped Milestone Track */}
            <div className="relative w-full">
              <div className="w-full h-3 bg-stone-200 dark:bg-stone-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    percentage === 100
                      ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                      : percentage >= 75
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-500'
                      : percentage >= 50
                      ? 'bg-gradient-to-r from-emerald-600 to-emerald-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: `${percentage}%` }}
                />
              </div>

              {/* Milestone Step Markers: 25%, 50%, 75%, 100% */}
              <div className="flex justify-between items-center text-[10px] text-stone-400 dark:text-stone-500 font-mono mt-1 px-1">
                <span className={percentage >= 25 ? 'text-emerald-600 dark:text-emerald-400 font-bold' : ''}>25% Start</span>
                <span className={percentage >= 50 ? 'text-emerald-600 dark:text-emerald-400 font-bold' : ''}>50% Halfway</span>
                <span className={percentage >= 75 ? 'text-emerald-600 dark:text-emerald-400 font-bold' : ''}>75% Peak</span>
                <span className={percentage === 100 ? 'text-emerald-600 dark:text-emerald-400 font-bold' : ''}>100% Target 🏆</span>
              </div>
            </div>

            {/* Daily Target 100% Achieved Celebration Banner */}
            {percentage === 100 && totalItems >= 1 && (
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-300">
                <div className="flex items-center space-x-2.5">
                  <span className="text-2xl">🎉</span>
                  <div>
                    <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200 block">
                      Daily Target Milestone Achieved!
                    </span>
                    <span className="text-[11px] text-emerald-700 dark:text-emerald-400">
                      You've conquered every scheduled item for today.
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      triggerConfetti(140, 3000);
                      playCelebrationFanfare();
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-xs flex items-center space-x-1 cursor-pointer"
                    title="Celebrate with confetti"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Celebrate 🎊</span>
                  </button>

                  {onOpenMilestones && (
                    <button
                      type="button"
                      onClick={onOpenMilestones}
                      className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-stone-800 hover:bg-stone-100 text-stone-800 dark:text-stone-200 border border-stone-200 dark:border-stone-700 text-xs font-semibold transition-all shadow-2xs flex items-center space-x-1 cursor-pointer"
                      title="View all badges"
                    >
                      <Trophy className="w-3.5 h-3.5 text-amber-500" />
                      <span>Badges</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

      {/* Category Filter Pills */}
      <div className="flex items-center space-x-1.5 overflow-x-auto pb-2 mb-4 scrollbar-none text-xs">
        <div className="flex items-center text-stone-400 mr-1 shrink-0">
          <Filter className="w-3.5 h-3.5 mr-1" />
          <span>Filter:</span>
        </div>
        {categoriesList.map((cat) => {
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

            {/* Counter pill & Auto-Pick Action */}
            <div className="flex items-center space-x-1.5">
              {priorityItems.length < 3 && otherItems.length > 0 && onAutoPickTop3 && !isPast && (
                <button
                  type="button"
                  id="auto-pick-top-3-btn"
                  onClick={onAutoPickTop3}
                  className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 transition-all shadow-2xs cursor-pointer active:scale-95"
                  title="Auto-select Top 3 Priorities from your available tasks"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>Auto-Pick Top 3</span>
                </button>
              )}
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
              /* Fallback if no Top 3 tasks have been manually selected by user */
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
                    Click the star icon (⭐) next to any task below to set your Top 3 Priorities for today.
                  </p>
                </div>
                {otherItems.length > 0 && onAutoPickTop3 && !isPast && (
                  <button
                    type="button"
                    onClick={onAutoPickTop3}
                    className="mt-1 inline-flex items-center space-x-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-stone-900 font-bold text-xs rounded-lg shadow-2xs transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Auto-Select Top 3 for Today</span>
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
                if (!item) return null;
                const catMeta = (item.category && CATEGORY_DETAILS[item.category]) || CATEGORY_DETAILS.Other || {
                  icon: '🏷️',
                  bg: 'bg-stone-50',
                  text: 'text-stone-700',
                  border: 'border-stone-200',
                };
                const rankNumber = Math.min(3, Math.max(1, categoryFilter === 'all' ? (index + 1) : (item.priorityRank || (index + 1))));
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
                        onClick={() => !isFuture && !isPast && onToggleTask(item.id, item.isHabit, item.habitId)}
                        disabled={isFuture || isPast}
                        className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors shrink-0 ${
                          isPast
                            ? item.completed
                              ? 'bg-emerald-600/85 text-white cursor-default'
                              : 'border-2 border-stone-300 bg-stone-100 text-stone-400 cursor-not-allowed opacity-75'
                            : isFuture
                            ? 'border-2 border-stone-200 bg-stone-100 text-stone-300 cursor-not-allowed opacity-60'
                            : item.completed
                            ? 'bg-emerald-600 text-white'
                            : 'border-2 border-stone-300 hover:border-stone-500 bg-white'
                        }`}
                        title={
                          isPast
                            ? item.completed
                              ? 'Completed on this day (past date cannot be modified)'
                              : 'Saved as uncompleted on this day (past date cannot be modified)'
                            : isFuture
                            ? 'Future occurrences cannot be completed before their date'
                            : item.completed
                            ? 'Mark uncompleted'
                            : 'Mark completed'
                        }
                        aria-label={
                          isPast
                            ? item.completed
                              ? 'Completed on this day'
                              : 'Saved as uncompleted on this day'
                            : item.completed
                            ? 'Mark uncompleted'
                            : 'Mark completed'
                        }
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
                      {isToday && onStartFocus && !item.completed && (
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

                      {/* Edit/Delete if custom task and not a past historical record */}
                      {!item.isHabit && !isPast && (
                        <div className="flex items-center space-x-1 opacity-70 group-hover:opacity-100 transition-opacity">
                          <button
                            id={`edit-priority-task-${item.id}`}
                            onClick={() => onEditTask(item.id, selectedDate)}
                            className="p-1.5 text-stone-400 hover:text-stone-800 hover:bg-stone-100 rounded-md transition-colors"
                            title="Edit task"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            id={`delete-priority-task-${item.id}`}
                            onClick={() => onDeleteTask(item.id, selectedDate)}
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
                    <p className="text-xs font-semibold text-stone-700">{isPast ? 'No tasks recorded for this day' : 'No tasks for this day'}</p>
                    <p className="text-[11px] text-stone-500 max-w-xs mt-0.5 mb-3 mx-auto">
                      {isPast ? 'Past days are preserved as read-only historical records.' : 'Schedule your study sessions, coding challenges, or revision tasks to build your streak.'}
                    </p>
                    {!isPast && (
                      <button
                        id="empty-state-add-task-btn"
                        onClick={onAddTask}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Add your first task</span>
                      </button>
                    )}
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
              filteredOtherItems.map((item, index) => {
                if (!item) return null;
                const catMeta = (item.category && CATEGORY_DETAILS[item.category]) || CATEGORY_DETAILS.Other || {
                  icon: '🏷️',
                  bg: 'bg-stone-50',
                  text: 'text-stone-700',
                  border: 'border-stone-200',
                };
                const isOverdue = checkIsOverdue(item);

                return (
                  <div
                    key={item.id}
                    id={`task-row-${item.id}`}
                    className={`group flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-3.5 rounded-xl border transition-all gap-2.5 ${
                      item.completed
                        ? 'bg-emerald-50/40 border-emerald-200/80 text-stone-600'
                        : isOverdue
                        ? 'bg-rose-50/30 border-rose-200 text-stone-900'
                        : 'bg-white border-stone-200/90 hover:border-stone-300 text-stone-900 shadow-2xs'
                    }`}
                  >
                    {/* Left: Star to Promote + Checkbox + Info */}
                    <div className="flex items-start sm:items-center space-x-2.5 flex-1 min-w-0">
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
                        onClick={() => !isFuture && !isPast && onToggleTask(item.id, item.isHabit, item.habitId)}
                        disabled={isFuture || isPast}
                        className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors shrink-0 ${
                          isPast
                            ? item.completed
                              ? 'bg-emerald-600/85 text-white cursor-default'
                              : 'border-2 border-stone-300 bg-stone-100 text-stone-400 cursor-not-allowed opacity-75'
                            : isFuture
                            ? 'border-2 border-stone-200 bg-stone-100 text-stone-300 cursor-not-allowed opacity-60'
                            : item.completed
                            ? 'bg-emerald-600 text-white'
                            : 'border-2 border-stone-300 hover:border-stone-500 bg-white'
                        }`}
                        title={
                          isPast
                            ? item.completed
                              ? 'Completed on this day (past date cannot be modified)'
                              : 'Saved as uncompleted on this day (past date cannot be modified)'
                            : isFuture
                            ? 'Future occurrences cannot be completed before their date'
                            : item.completed
                            ? 'Mark uncompleted'
                            : 'Mark completed'
                        }
                        aria-label={
                          isPast
                            ? item.completed
                              ? 'Completed on this day'
                              : 'Saved as uncompleted on this day'
                            : item.completed
                            ? 'Mark uncompleted'
                            : 'Mark completed'
                        }
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
                    <div className="flex items-center justify-between sm:justify-end space-x-2 w-full sm:w-auto pt-2 border-t border-stone-100/80 sm:pt-0 sm:border-0 shrink-0">
                      {/* Focus Mode Button */}
                      {isToday && onStartFocus && !item.completed && (
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

                      {/* Actions (hidden for past historical records) */}
                      {!item.isHabit && !isPast && (
                        <div className="flex items-center space-x-1 opacity-80 group-hover:opacity-100 transition-opacity">
                          <button
                            id={`edit-task-${item.id}`}
                            onClick={() => onEditTask(item.id, selectedDate)}
                            className="p-1.5 text-stone-400 hover:text-stone-800 hover:bg-stone-100 rounded-md transition-colors"
                            title="Edit task"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            id={`delete-task-${item.id}`}
                            onClick={() => onDeleteTask(item.id, selectedDate)}
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
    </>
  )}
    </div>
  );
};
