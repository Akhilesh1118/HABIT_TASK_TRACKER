import React, { lazy, Suspense, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { storageService, parseDateKey } from './services/storageService';
import { buildMonthGrid } from './utils/calendarUtils';
import { Header } from './components/Header';
import { StatsBanner } from './components/StatsBanner';
import { ActivityGrid } from './components/ActivityGrid';
import { DailyTaskPanel } from './components/DailyTaskPanel';
import { QuickNotesCard } from './components/QuickNotesCard';
import { MiniFocusBar } from './components/MiniFocusBar';
import { FeatureErrorBoundary } from './components/FeatureErrorBoundary';
import { LoginPage } from './components/LoginPage';
import { Loader2 } from 'lucide-react';
import { useFocusTimer } from './hooks/useFocusTimer';
import { useTheme } from './hooks/useTheme';
import { Task, Habit, ProductivityStats, DailySummaryItem } from './types';
import { authenticatedFetch, clearAuthToken, getAuthToken } from './utils/authClient';
import { getCurrentIST } from './utils/timeUtils';

const ProductivityDashboard = lazy(() =>
  import('./components/ProductivityDashboard').then((module) => ({ default: module.ProductivityDashboard }))
);
const FocusModeModal = lazy(() => import('./components/FocusModeModal').then((module) => ({ default: module.FocusModeModal })));
const TaskModal = lazy(() => import('./components/TaskModal').then((module) => ({ default: module.TaskModal })));
const HabitManagerModal = lazy(() => import('./components/HabitManagerModal').then((module) => ({ default: module.HabitManagerModal })));
const SpacedRevisionModal = lazy(() => import('./components/SpacedRevisionModal').then((module) => ({ default: module.SpacedRevisionModal })));
const StreakProtectionModal = lazy(() => import('./components/StreakProtectionModal').then((module) => ({ default: module.StreakProtectionModal })));
const WeeklyReviewModal = lazy(() => import('./components/WeeklyReviewModal').then((module) => ({ default: module.WeeklyReviewModal })));
const AICoachModal = lazy(() => import('./components/AICoachModal').then((module) => ({ default: module.AICoachModal })));
const MockTestTrackerModal = lazy(() => import('./components/MockTestTrackerModal').then((module) => ({ default: module.MockTestTrackerModal })));
const ZenFocusMode = lazy(() => import('./components/ZenFocusMode').then((module) => ({ default: module.ZenFocusMode })));

export default function App() {
  const { theme, toggleTheme } = useTheme();

  // Use today's date from environment or client (Asia/Kolkata timezone)
  const [todayDate, setTodayDate] = useState<string>(() => {
    return getCurrentIST().dateStr;
  });

  const [selectedDate, setSelectedDate] = useState<string>(todayDate);
  const [activeTab, setActiveTab] = useState<'schedule' | 'analytics'>('schedule');

  // Month and Year state for the calendar navigation
  const [calendarYear, setCalendarYear] = useState<number>(() => {
    return parseDateKey(todayDate).getFullYear();
  });
  const [calendarMonth, setCalendarMonth] = useState<number>(() => {
    return parseDateKey(todayDate).getMonth();
  });

  // Synchronized refs to track live dates for reliable midnight rollover
  const todayDateRef = useRef(todayDate);
  const selectedDateRef = useRef(selectedDate);

  useEffect(() => {
    todayDateRef.current = todayDate;
  }, [todayDate]);

  useEffect(() => {
    selectedDateRef.current = selectedDate;
  }, [selectedDate]);

  // Midnight rollover & active day synchronization (Asia/Kolkata)
  useEffect(() => {
    const checkRollover = () => {
      const currentToday = getCurrentIST().dateStr;
      const prevToday = todayDateRef.current;

      if (currentToday !== prevToday) {
        // Date has rolled over in Asia/Kolkata
        todayDateRef.current = currentToday;
        setTodayDate(currentToday);

        // If the user was viewing the previous "Today", automatically roll selectedDate over to the new Today
        if (selectedDateRef.current === prevToday) {
          selectedDateRef.current = currentToday;
          setSelectedDate(currentToday);
          const d = parseDateKey(currentToday);
          setCalendarYear(d.getFullYear());
          setCalendarMonth(d.getMonth());
        }
      }
    };

    // Run immediately on mount
    checkRollover();

    // Check periodically so rollover happens immediately when midnight arrives
    const intervalId = setInterval(checkRollover, 1000);

    // Also check on window focus and visibility change (e.g. laptop wake or tab switch after midnight)
    window.addEventListener('focus', checkRollover);
    document.addEventListener('visibilitychange', checkRollover);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', checkRollover);
      document.removeEventListener('visibilitychange', checkRollover);
    };
  }, []);

  // Data state
  const [user, setUser] = useState(() => storageService.getUser());
  const [habits, setHabits] = useState<Habit[]>(() => storageService.getHabits());
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Modals state
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editingTaskDate, setEditingTaskDate] = useState<string>(todayDate);
  const [isHabitModalOpen, setIsHabitModalOpen] = useState(false);
  const [isFocusModalOpen, setIsFocusModalOpen] = useState(false);
  const [isZenModeOpen, setIsZenModeOpen] = useState(false);
  const [isRevisionModalOpen, setIsRevisionModalOpen] = useState(false);
  const [isStreakProtectionOpen, setIsStreakProtectionOpen] = useState(false);
  const [isWeeklyReviewModalOpen, setIsWeeklyReviewModalOpen] = useState(false);
  const [isAICoachModalOpen, setIsAICoachModalOpen] = useState(false);
  const [isMockTestModalOpen, setIsMockTestModalOpen] = useState(false);

  // Spaced revision due count for today
  const revisionsDueTodayCount = useMemo(() => {
    return storageService.getRevisionsDueOnDate(todayDate).length;
  }, [todayDate, refreshTrigger]);

  // Compute Weekly Productivity Review
  const weeklyReview = useMemo(() => {
    return storageService.getWeeklyProductivityReview(selectedDate, 'trailing7');
  }, [selectedDate, refreshTrigger]);

  // Authentication state for multi-user personal access
  const [authState, setAuthState] = useState<'checking' | 'unauthenticated' | 'authenticated'>('checking');
  const [authUser, setAuthUser] = useState<{ email: string; userId: string; name?: string; role?: string } | null>(null);

  // Check personal session on startup
  useEffect(() => {
    let isMounted = true;
    async function checkSession() {
      try {
        const res = await authenticatedFetch('/api/auth/me');
        if (!res.ok) {
          if (isMounted) {
            clearAuthToken();
            setAuthState('unauthenticated');
          }
          return;
        }
        const data = await res.json();
        if (isMounted) {
          if (data.authenticated && data.user) {
            setAuthUser(data.user);
            storageService.setCurrentUser({
              id: data.user.userId,
              email: data.user.email,
              name: data.user.name || 'User',
              role: data.user.role,
            });
            await storageService.loadFromServer();
            setUser(storageService.getUser());
            setHabits(storageService.getHabits());
            setRefreshTrigger((prev) => prev + 1);
            setAuthState('authenticated');
          } else {
            clearAuthToken();
            storageService.clearUserData();
            setAuthState('unauthenticated');
          }
        }
      } catch {
        if (isMounted) {
          // If a stored token exists, do not immediately drop session on transient network errors
          const token = getAuthToken();
          if (!token) {
            setAuthState('unauthenticated');
          }
        }
      }
    }
    checkSession();

    const handleSessionExpired = () => {
      clearAuthToken();
      storageService.clearUserData();
      setAuthUser(null);
      setAuthState('unauthenticated');
    };
    window.addEventListener('auth:session_expired', handleSessionExpired);

    return () => {
      isMounted = false;
      window.removeEventListener('auth:session_expired', handleSessionExpired);
    };
  }, []);

  const handleLoginSuccess = useCallback(async (user: { email: string; userId: string; name?: string; role?: string }) => {
    setAuthState('checking');
    setAuthUser(user);
    storageService.setCurrentUser({
      id: user.userId,
      email: user.email,
      name: user.name || 'User',
      role: user.role,
    });
    await storageService.loadFromServer();
    setUser(storageService.getUser());
    setHabits(storageService.getHabits());
    setRefreshTrigger((prev) => prev + 1);
    setAuthState('authenticated');
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      // 1. Flush active Quick Notes to local storage & server while still authenticated
      if (authUser?.userId) {
        window.dispatchEvent(new CustomEvent('app:flush_notes'));
        await storageService.syncAllDailyNotesToServer(authUser.userId).catch(() => {});
      }
      await authenticatedFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors on logout
    }
    clearAuthToken();
    storageService.clearUserData();
    setAuthUser(null);
    setAuthState('unauthenticated');
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [authUser?.userId]);

  // Trigger state refresh
  const triggerRefresh = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  // Completion callback when focus session completes
  const handleFocusTaskComplete = useCallback(
    (taskId: string, isHabit: boolean) => {
      if (isHabit) {
        storageService.toggleHabitCompletion(taskId, todayDate);
      } else {
        const allTasks = storageService.getTasks();
        const task = allTasks.find((t) => t.id === taskId);
        if (task && !storageService.isTaskCompletedOnDate(task, todayDate)) {
          storageService.setTaskCompletion(taskId, true, todayDate);
        }
      }
      triggerRefresh();
    },
    [todayDate, triggerRefresh]
  );

  // Focus Timer Hook
  const focusTimer = useFocusTimer(todayDate, handleFocusTaskComplete, triggerRefresh);

  // Total Focus Minutes Today
  const focusMinutesToday = useMemo(() => {
    const secs = storageService.getTotalFocusSecondsForDate(todayDate);
    return Math.round(secs / 60);
  }, [todayDate, refreshTrigger, focusTimer.timerState.status]);

  // Total Focus Minutes for the currently selected date (e.g. yesterday or past archive)
  const focusMinutesSelectedDate = useMemo(() => {
    const secs = storageService.getTotalFocusSecondsForDate(selectedDate);
    return Math.round(secs / 60);
  }, [selectedDate, refreshTrigger, focusTimer.timerState.status]);

  // Compute stats based on current database state
  const stats: ProductivityStats = useMemo(() => {
    return storageService.calculateStats(todayDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayDate, refreshTrigger]);

  // Calculate today's multi-factor productivity score
  const todayProductivityScore = useMemo(() => {
    return storageService.calculateDailyProductivityScore(todayDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayDate, refreshTrigger, focusMinutesToday]);

  // Compute month grid data
  const gridData = useMemo(() => {
    return buildMonthGrid(calendarYear, calendarMonth, selectedDate, todayDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendarYear, calendarMonth, selectedDate, todayDate, refreshTrigger]);

  // Compute items for the selected day
  const dayItems = useMemo(() => {
    return storageService.getDayItems(selectedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, refreshTrigger]);

  // Items for today (for focus mode quick picker)
  const todayItems = useMemo(() => {
    return storageService.getDayItems(todayDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayDate, refreshTrigger]);

  // Event handlers
  const handleSelectDate = (date: string) => {
    setSelectedDate(date);
    const d = parseDateKey(date);
    setCalendarYear(d.getFullYear());
    setCalendarMonth(d.getMonth());
  };

  const handleGoToToday = () => {
    const currentToday = getCurrentIST().dateStr;
    setTodayDate(currentToday);
    setSelectedDate(currentToday);
    const d = parseDateKey(currentToday);
    setCalendarYear(d.getFullYear());
    setCalendarMonth(d.getMonth());
  };

  const handlePrevMonth = () => {
    if (calendarMonth === 0) {
      setCalendarMonth(11);
      setCalendarYear((y) => y - 1);
    } else {
      setCalendarMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (calendarMonth === 11) {
      setCalendarMonth(0);
      setCalendarYear((y) => y + 1);
    } else {
      setCalendarMonth((m) => m + 1);
    }
  };

  const handleCurrentMonth = () => {
    const currentToday = getCurrentIST().dateStr;
    setTodayDate(currentToday);
    setSelectedDate(currentToday);
    const d = parseDateKey(currentToday);
    setCalendarYear(d.getFullYear());
    setCalendarMonth(d.getMonth());
  };

  // Toggle task or habit completion
  const handleToggleTask = (id: string, isHabit: boolean, habitId?: string) => {
    const currentToday = getCurrentIST().dateStr;
    if (selectedDate > currentToday) {
      console.warn('Cannot complete occurrences on future dates');
      return;
    }
    if (selectedDate < currentToday) {
      console.warn('Cannot complete occurrences on previous dates (historical record is read-only)');
      return;
    }
    if (isHabit && habitId) {
      storageService.toggleHabitCompletion(habitId, selectedDate);
    } else {
      storageService.toggleTaskCompletion(id, selectedDate);
    }
    triggerRefresh();
  };

  // Add or edit task with deadline and recurring schedule
  const handleSaveTask = (taskData: {
    id?: string;
    title: string;
    category: any;
    date: string;
    duration?: string;
    description?: string;
    dueTime?: string;
    recurringSchedule?: any;
    isTopPriority?: boolean;
    completed: boolean;
    isStudySession?: boolean;
    studySubject?: string;
    studyTopic?: string;
    studyDurationMinutes?: number;
    questionsAttempted?: number;
    questionsCorrect?: number;
    accuracy?: number;
    enableSpacedRevision?: boolean;
    recurringEditScope?: 'this_only' | 'all';
    targetOccurrenceDate?: string;
  }) => {
    const currentUserId = authUser?.userId || user.id || storageService.getUser().id;
    storageService.saveTask({
      id: taskData.id,
      userId: currentUserId,
      title: taskData.title,
      category: taskData.category,
      date: taskData.date,
      duration: taskData.duration,
      description: taskData.description,
      dueTime: taskData.dueTime,
      recurringSchedule: taskData.recurringSchedule,
      isTopPriority: taskData.isTopPriority,
      completed: taskData.completed,
      isStudySession: taskData.isStudySession,
      studySubject: taskData.studySubject,
      studyTopic: taskData.studyTopic,
      studyDurationMinutes: taskData.studyDurationMinutes,
      questionsAttempted: taskData.questionsAttempted,
      questionsCorrect: taskData.questionsCorrect,
      accuracy: taskData.accuracy,
      enableSpacedRevision: taskData.enableSpacedRevision,
      recurringEditScope: taskData.recurringEditScope,
      targetOccurrenceDate: taskData.targetOccurrenceDate || editingTaskDate,
    });
    // Ensure selected date focuses on the date being viewed/saved
    const targetFocusDate = taskData.targetOccurrenceDate || taskData.date;
    setSelectedDate(targetFocusDate);
    const d = parseDateKey(targetFocusDate);
    setCalendarYear(d.getFullYear());
    setCalendarMonth(d.getMonth());
    triggerRefresh();
  };

  // Toggle Top 3 Priority handler
  const handleTogglePriority = (itemId: string) => {
    const res = storageService.toggleDailyPriority(selectedDate, itemId);
    triggerRefresh();
    return res;
  };

  // Auto-pick Top 3 handler
  const handleAutoPickTop3 = () => {
    storageService.autoSelectTop3(selectedDate);
    triggerRefresh();
  };

  const handleEditTask = (id: string, targetDate?: string) => {
    const allTasks = storageService.getTasks();
    const task = allTasks.find((t) => t.id === id);
    if (task) {
      setEditingTask(task);
      setEditingTaskDate(targetDate || selectedDate);
      setIsTaskModalOpen(true);
    }
  };

  const handleDeleteTask = (id: string, targetDate?: string) => {
    storageService.deleteTask(id, targetDate || selectedDate);
    triggerRefresh();
  };

  // Habit management handlers
  const handleSaveHabit = (habitData: Omit<Habit, 'id' | 'createdAt'> & { id?: string }) => {
    storageService.saveHabit(habitData);
    setHabits(storageService.getHabits());
    triggerRefresh();
  };

  const handleToggleHabitActive = (habitId: string) => {
    storageService.toggleHabitActive(habitId);
    setHabits(storageService.getHabits());
    triggerRefresh();
  };

  const handleDeleteHabit = (habitId: string) => {
    storageService.deleteHabit(habitId);
    setHabits(storageService.getHabits());
    triggerRefresh();
  };

  const handleResetData = () => {
    if (window.confirm('Reset schedule to default B.Tech CSE & SSC CGL sample data?')) {
      storageService.resetToSampleData();
      setUser(storageService.getUser());
      setHabits(storageService.getHabits());
      const currentToday = getCurrentIST().dateStr;
      setTodayDate(currentToday);
      setSelectedDate(currentToday);
      const d = parseDateKey(currentToday);
      setCalendarYear(d.getFullYear());
      setCalendarMonth(d.getMonth());
      triggerRefresh();
    }
  };

  // Launch focus mode directly from a task or habit row
  const handleStartFocusForTask = (item: DailySummaryItem) => {
    focusTimer.setTask({
      id: item.id,
      title: item.title,
      category: item.category,
      isHabit: item.isHabit,
    });
    setIsFocusModalOpen(true);
  };

  // Format short remaining time for header badge
  const focusTimeRemainingStr = useMemo(() => {
    const mins = Math.floor(focusTimer.timerState.remainingSeconds / 60);
    const secs = focusTimer.timerState.remainingSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }, [focusTimer.timerState.remainingSeconds]);

  const isFocusActive =
    focusTimer.timerState.status === 'running' || focusTimer.timerState.status === 'paused';

  if (authState === 'checking') {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center gap-3 text-stone-600">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        <p className="text-sm font-medium">Loading your personal tasks and priorities...</p>
      </div>
    );
  }

  if (authState === 'unauthenticated') {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-stone-100/60 dark:bg-stone-950 text-stone-900 dark:text-stone-100 flex flex-col font-sans antialiased selection:bg-emerald-500/20 selection:text-emerald-300 transition-colors duration-200">
      {/* Top Navigation */}
      <Header
        user={user}
        currentStreak={stats.currentStreak}
        streakStatus={stats.streakStatus}
        onOpenStreakProtection={() => setIsStreakProtectionOpen(true)}
        onOpenWeeklyReview={() => setIsWeeklyReviewModalOpen(true)}
        onOpenAICoach={() => setIsAICoachModalOpen(true)}
        onOpenMockTests={() => setIsMockTestModalOpen(true)}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        productivityScore={todayProductivityScore.totalScore}
        onGoToToday={handleGoToToday}
        onOpenHabitManager={() => setIsHabitModalOpen(true)}
        onOpenFocusMode={() => setIsFocusModalOpen(true)}
        onOpenZenMode={() => setIsZenModeOpen(true)}
        isFocusActive={isFocusActive}
        focusTimeRemaining={focusTimeRemainingStr}
        onOpenRevisionModal={() => setIsRevisionModalOpen(true)}
        revisionsDueCount={revisionsDueTodayCount}
        onResetData={handleResetData}
        onLogout={handleLogout}
        authUser={authUser}
        userEmail={authUser?.email}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl 2xl:max-w-[1536px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Statistics & Streaks Overview Banner */}
        <StatsBanner
          stats={stats}
          focusMinutesToday={focusMinutesToday}
          productivityScore={todayProductivityScore.totalScore}
          productivityGrade={todayProductivityScore.grade}
          onOpenFocus={() => setIsFocusModalOpen(true)}
          onOpenAnalytics={() => setActiveTab('analytics')}
          onOpenStreakModal={() => setIsStreakProtectionOpen(true)}
          onOpenWeeklyReview={() => setIsWeeklyReviewModalOpen(true)}
        />

        {/* View Switcher: Daily Schedule & Habits vs Productivity Dashboard */}
        {activeTab === 'schedule' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Calendar / Activity Grid: 5 columns on desktop */}
            <div className="lg:col-span-5 space-y-4">
              <ActivityGrid
                monthName={gridData.monthName}
                year={gridData.year}
                days={gridData.days}
                selectedDate={selectedDate}
                todayDate={todayDate}
                onSelectDate={handleSelectDate}
                onPrevMonth={handlePrevMonth}
                onNextMonth={handleNextMonth}
                onCurrentMonth={handleCurrentMonth}
              />

              {/* Student Context & Consistency Advice */}
              <div className="bg-white dark:bg-stone-900 rounded-xl p-4 border border-stone-200/80 dark:border-stone-800 text-xs text-stone-500 dark:text-stone-400 shadow-xs transition-colors">
                <div className="flex items-center space-x-2 font-semibold text-stone-800 dark:text-stone-200 mb-1">
                  <span>🎯 Consistency Rule</span>
                </div>
                <p className="leading-relaxed">
                  Completing at least 1 task or habit keeps your streak alive. The activity cell
                  intensity changes from neutral (no tasks) to empty (0%), low (1-49%), medium (50-99%),
                  and deep green (100% complete).
                </p>
              </div>

              {/* Quick Notes for the selected date - fills the white space below the calendar */}
              <QuickNotesCard
                key={authUser?.userId || storageService.getUser().id}
                selectedDate={selectedDate}
                todayDate={todayDate}
                userId={authUser?.userId || storageService.getUser().id}
              />
            </div>

            {/* Daily Tasks and Habit Panel: 7 columns on desktop */}
            <div className="lg:col-span-7">
              <DailyTaskPanel
                selectedDate={selectedDate}
                todayDate={todayDate}
                items={dayItems}
                userName={authUser?.name || user?.name}
                streakStatus={stats.streakStatus}
                focusMinutesToday={focusMinutesToday}
                focusMinutesSelectedDate={focusMinutesSelectedDate}
                onOpenStreakModal={() => setIsStreakProtectionOpen(true)}
                onOpenFocusModal={() => setIsFocusModalOpen(true)}
                onToggleTask={handleToggleTask}
                onTogglePriority={handleTogglePriority}
                onAddTask={() => {
                  setEditingTask(null);
                  setIsTaskModalOpen(true);
                }}
                onEditTask={handleEditTask}
                onDeleteTask={handleDeleteTask}
                onStartFocus={handleStartFocusForTask}
                revisionsDueTodayCount={revisionsDueTodayCount}
                onOpenRevisionModal={() => setIsRevisionModalOpen(true)}
                onAutoPickTop3={handleAutoPickTop3}
              />
            </div>
          </div>
        ) : (
          <FeatureErrorBoundary>
            <Suspense fallback={<div className="flex min-h-64 items-center justify-center text-slate-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading analytics…</div>}>
              <ProductivityDashboard
                selectedDate={selectedDate}
                todayDate={todayDate}
                onSelectDate={handleSelectDate}
                onStartFocusSession={() => setIsFocusModalOpen(true)}
                onSwitchToTasksView={() => setActiveTab('schedule')}
                refreshTrigger={refreshTrigger}
              />
            </Suspense>
          </FeatureErrorBoundary>
        )}
      </main>

      {/* Mini Focus Bar (when minimized while running or paused and Zen mode is not open) */}
      {!isFocusModalOpen && !isZenModeOpen && (
        <MiniFocusBar
          timerState={focusTimer.timerState}
          onOpenFocusModal={() => setIsFocusModalOpen(true)}
          onOpenZenMode={() => setIsZenModeOpen(true)}
          onPause={focusTimer.pause}
          onResume={focusTimer.resume}
          onComplete={() => focusTimer.complete(true)}
        />
      )}

      {/* Full Distraction-Free Focus Mode Modal */}
      {isFocusModalOpen && <Suspense fallback={null}><FocusModeModal
        isOpen={isFocusModalOpen}
        onClose={() => setIsFocusModalOpen(false)}
        timerState={focusTimer.timerState}
        soundEnabled={focusTimer.soundEnabled}
        onToggleSound={() => focusTimer.setSoundEnabled(!focusTimer.soundEnabled)}
        onStart={focusTimer.start}
        onPause={focusTimer.pause}
        onResume={focusTimer.resume}
        onStop={() => focusTimer.stop(true)}
        onComplete={(markDone) => focusTimer.complete(markDone)}
        onStartBreak={focusTimer.startBreak}
        onSelectMode={focusTimer.setMode}
        onSelectTask={focusTimer.setTask}
        onToggleAutoMarkTaskComplete={focusTimer.setAutoMarkTaskComplete}
        onOpenZenMode={() => {
          setIsFocusModalOpen(false);
          setIsZenModeOpen(true);
        }}
        todayTasks={todayItems}
        todayDate={todayDate}
      /></Suspense>}

      {/* Zen Fullscreen Deep Work Mode */}
      {isZenModeOpen && (
        <Suspense fallback={null}>
          <ZenFocusMode
            isOpen={isZenModeOpen}
            onClose={() => setIsZenModeOpen(false)}
            timerState={focusTimer.timerState}
            onStart={focusTimer.start}
            onPause={focusTimer.pause}
            onResume={focusTimer.resume}
            onStop={() => focusTimer.stop(true)}
            onComplete={(markDone) => {
              focusTimer.complete(markDone);
              setIsZenModeOpen(false);
            }}
            onStartBreak={focusTimer.startBreak}
            onAddTime={focusTimer.addMinutes}
            soundEnabled={focusTimer.soundEnabled}
            onToggleSound={() => focusTimer.setSoundEnabled(!focusTimer.soundEnabled)}
            todayTasks={todayItems}
            onSelectTask={focusTimer.setTask}
          />
        </Suspense>
      )}

      {/* Task Add/Edit Modal */}
      {isTaskModalOpen && <Suspense fallback={null}><TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => {
          setIsTaskModalOpen(false);
          setEditingTask(null);
        }}
        onSave={handleSaveTask}
        initialTask={editingTask}
        defaultDate={selectedDate}
        targetOccurrenceDate={editingTaskDate}
      /></Suspense>}

      {/* Habit Manager Modal */}
      {isHabitModalOpen && <Suspense fallback={null}><HabitManagerModal
        isOpen={isHabitModalOpen}
        onClose={() => setIsHabitModalOpen(false)}
        habits={habits}
        onSaveHabit={handleSaveHabit}
        onToggleActive={handleToggleHabitActive}
        onDeleteHabit={handleDeleteHabit}
        todayDate={todayDate}
      /></Suspense>}

      {/* Spaced Revision System Modal */}
      {isRevisionModalOpen && <Suspense fallback={null}><SpacedRevisionModal
        isOpen={isRevisionModalOpen}
        onClose={() => setIsRevisionModalOpen(false)}
        todayDate={todayDate}
        onScheduleUpdated={triggerRefresh}
      /></Suspense>}

      {/* Streak Protection & Recovery Modal */}
      {isStreakProtectionOpen && <Suspense fallback={null}><StreakProtectionModal
        isOpen={isStreakProtectionOpen}
        onClose={() => setIsStreakProtectionOpen(false)}
        todayDate={todayDate}
        onStreakUpdated={triggerRefresh}
      /></Suspense>}

      {/* Weekly Productivity Review Modal */}
      {isWeeklyReviewModalOpen && <Suspense fallback={null}><WeeklyReviewModal
        isOpen={isWeeklyReviewModalOpen}
        onClose={() => setIsWeeklyReviewModalOpen(false)}
        review={weeklyReview}
      /></Suspense>}

      {/* AI Productivity Coach Modal */}
      {isAICoachModalOpen && <Suspense fallback={null}><AICoachModal
        isOpen={isAICoachModalOpen}
        onClose={() => setIsAICoachModalOpen(false)}
        targetDateStr={selectedDate}
      /></Suspense>}

      {/* Mock Test & Exam Performance Tracker Modal */}
      {isMockTestModalOpen && (
        <Suspense fallback={null}>
          <MockTestTrackerModal
            isOpen={isMockTestModalOpen}
            onClose={() => setIsMockTestModalOpen(false)}
            todayDate={todayDate}
            userId={authUser?.userId || user.id}
          />
        </Suspense>
      )}
    </div>
  );
}
