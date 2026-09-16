import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { storageService, formatDateKey, parseDateKey } from './services/storageService';
import { buildMonthGrid } from './utils/calendarUtils';
import { Header } from './components/Header';
import { StatsBanner } from './components/StatsBanner';
import { ActivityGrid } from './components/ActivityGrid';
import { DailyTaskPanel } from './components/DailyTaskPanel';
import { TaskModal } from './components/TaskModal';
import { HabitManagerModal } from './components/HabitManagerModal';
import { FocusModeModal } from './components/FocusModeModal';
import { MiniFocusBar } from './components/MiniFocusBar';
import { ProductivityDashboard } from './components/ProductivityDashboard';
import { SpacedRevisionModal } from './components/SpacedRevisionModal';
import { StreakProtectionModal } from './components/StreakProtectionModal';
import { WeeklyReviewModal } from './components/WeeklyReviewModal';
import { AICoachModal } from './components/AICoachModal';
import { LoginPage } from './components/LoginPage';
import { Loader2 } from 'lucide-react';
import { useFocusTimer } from './hooks/useFocusTimer';
import { Task, Habit, ProductivityStats, DailySummaryItem, WeeklyReviewSummary } from './types';
import { authenticatedFetch, clearAuthToken, getAuthToken } from './utils/authClient';
import { getCurrentIST } from './utils/timeUtils';

export default function App() {
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
  const [isHabitModalOpen, setIsHabitModalOpen] = useState(false);
  const [isFocusModalOpen, setIsFocusModalOpen] = useState(false);
  const [isRevisionModalOpen, setIsRevisionModalOpen] = useState(false);
  const [isStreakProtectionOpen, setIsStreakProtectionOpen] = useState(false);
  const [isWeeklyReviewModalOpen, setIsWeeklyReviewModalOpen] = useState(false);
  const [isAICoachModalOpen, setIsAICoachModalOpen] = useState(false);

  // Spaced revision due count for today
  const revisionsDueTodayCount = useMemo(() => {
    return storageService.getRevisionsDueOnDate(todayDate).length;
  }, [todayDate, refreshTrigger]);

  // Compute Weekly Productivity Review
  const weeklyReview = useMemo(() => {
    return storageService.getWeeklyProductivityReview(selectedDate, 'trailing7');
  }, [selectedDate, refreshTrigger]);

  // Authentication state for single-user personal access
  const [authState, setAuthState] = useState<'checking' | 'unauthenticated' | 'authenticated'>('checking');
  const [authUser, setAuthUser] = useState<{ email: string; userId: string } | null>(null);

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
            setAuthState('authenticated');
            await storageService.loadFromServer();
            setUser(storageService.getUser());
            setHabits(storageService.getHabits());
            setRefreshTrigger((prev) => prev + 1);
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

  const handleLoginSuccess = useCallback(async (user: { email: string; userId: string }) => {
    setAuthUser(user);
    setAuthState('authenticated');
    await storageService.loadFromServer();
    setUser(storageService.getUser());
    setHabits(storageService.getHabits());
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  const handleLogout = useCallback(async () => {
    try {
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
  }, []);

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
        if (task && !task.completed) {
          storageService.toggleTaskCompletion(taskId);
        }
      }
      triggerRefresh();
    },
    [todayDate, triggerRefresh]
  );

  // Focus Timer Hook
  const focusTimer = useFocusTimer(todayDate, handleFocusTaskComplete);

  // Total Focus Minutes Today
  const focusMinutesToday = useMemo(() => {
    const secs = storageService.getTotalFocusSecondsForDate(todayDate);
    return Math.round(secs / 60);
  }, [todayDate, refreshTrigger, focusTimer.timerState.status]);

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
    if (isHabit && habitId) {
      storageService.toggleHabitCompletion(habitId, selectedDate);
    } else {
      storageService.toggleTaskCompletion(id);
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
  }) => {
    storageService.saveTask({
      id: taskData.id,
      userId: user.id,
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
    });
    // Ensure selected date focuses on the task date
    setSelectedDate(taskData.date);
    const d = parseDateKey(taskData.date);
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

  const handleEditTask = (id: string) => {
    const allTasks = storageService.getTasks();
    const task = allTasks.find((t) => t.id === id);
    if (task) {
      setEditingTask(task);
      setIsTaskModalOpen(true);
    }
  };

  const handleDeleteTask = (id: string) => {
    storageService.deleteTask(id);
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
        <p className="text-sm font-medium">Checking personal authentication...</p>
      </div>
    );
  }

  if (authState === 'unauthenticated') {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-stone-100/60 text-stone-900 flex flex-col font-sans antialiased selection:bg-emerald-100 selection:text-emerald-900">
      {/* Top Navigation */}
      <Header
        user={user}
        currentStreak={stats.currentStreak}
        streakStatus={stats.streakStatus}
        onOpenStreakProtection={() => setIsStreakProtectionOpen(true)}
        onOpenWeeklyReview={() => setIsWeeklyReviewModalOpen(true)}
        onOpenAICoach={() => setIsAICoachModalOpen(true)}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        productivityScore={todayProductivityScore.totalScore}
        onGoToToday={handleGoToToday}
        onOpenHabitManager={() => setIsHabitModalOpen(true)}
        onOpenFocusMode={() => setIsFocusModalOpen(true)}
        isFocusActive={isFocusActive}
        focusTimeRemaining={focusTimeRemainingStr}
        onOpenRevisionModal={() => setIsRevisionModalOpen(true)}
        revisionsDueCount={revisionsDueTodayCount}
        onResetData={handleResetData}
        onLogout={handleLogout}
        userEmail={authUser?.email}
      />

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
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
              <div className="bg-white rounded-xl p-4 border border-stone-200/80 text-xs text-stone-500 shadow-xs">
                <div className="flex items-center space-x-2 font-semibold text-stone-800 mb-1">
                  <span>🎯 Consistency Rule</span>
                </div>
                <p className="leading-relaxed">
                  Completing at least 1 task or habit keeps your streak alive. The activity cell
                  intensity changes from neutral (no tasks) to empty (0%), low (1-49%), medium (50-99%),
                  and deep green (100% complete).
                </p>
              </div>
            </div>

            {/* Daily Tasks and Habit Panel: 7 columns on desktop */}
            <div className="lg:col-span-7">
              <DailyTaskPanel
                selectedDate={selectedDate}
                todayDate={todayDate}
                items={dayItems}
                streakStatus={stats.streakStatus}
                onOpenStreakModal={() => setIsStreakProtectionOpen(true)}
                onToggleTask={handleToggleTask}
                onTogglePriority={handleTogglePriority}
                onAutoPickTop3={handleAutoPickTop3}
                onAddTask={() => {
                  setEditingTask(null);
                  setIsTaskModalOpen(true);
                }}
                onEditTask={handleEditTask}
                onDeleteTask={handleDeleteTask}
                onStartFocus={handleStartFocusForTask}
                revisionsDueTodayCount={revisionsDueTodayCount}
                onOpenRevisionModal={() => setIsRevisionModalOpen(true)}
              />
            </div>
          </div>
        ) : (
          <ProductivityDashboard
            selectedDate={selectedDate}
            todayDate={todayDate}
            onSelectDate={handleSelectDate}
            onStartFocusSession={() => setIsFocusModalOpen(true)}
            onSwitchToTasksView={() => setActiveTab('schedule')}
            refreshTrigger={refreshTrigger}
          />
        )}
      </main>

      {/* Mini Focus Bar (when minimized while running or paused) */}
      {!isFocusModalOpen && (
        <MiniFocusBar
          timerState={focusTimer.timerState}
          onOpenFocusModal={() => setIsFocusModalOpen(true)}
          onPause={focusTimer.pause}
          onResume={focusTimer.resume}
          onComplete={() => focusTimer.complete(true)}
        />
      )}

      {/* Full Distraction-Free Focus Mode Modal */}
      <FocusModeModal
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
        todayTasks={todayItems}
        todayDate={todayDate}
      />

      {/* Task Add/Edit Modal */}
      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => {
          setIsTaskModalOpen(false);
          setEditingTask(null);
        }}
        onSave={handleSaveTask}
        initialTask={editingTask}
        defaultDate={selectedDate}
      />

      {/* Habit Manager Modal */}
      <HabitManagerModal
        isOpen={isHabitModalOpen}
        onClose={() => setIsHabitModalOpen(false)}
        habits={habits}
        onSaveHabit={handleSaveHabit}
        onToggleActive={handleToggleHabitActive}
        onDeleteHabit={handleDeleteHabit}
        todayDate={todayDate}
      />

      {/* Spaced Revision System Modal */}
      <SpacedRevisionModal
        isOpen={isRevisionModalOpen}
        onClose={() => setIsRevisionModalOpen(false)}
        todayDate={todayDate}
        onScheduleUpdated={triggerRefresh}
      />

      {/* Streak Protection & Recovery Modal */}
      <StreakProtectionModal
        isOpen={isStreakProtectionOpen}
        onClose={() => setIsStreakProtectionOpen(false)}
        todayDate={todayDate}
        onStreakUpdated={triggerRefresh}
      />

      {/* Weekly Productivity Review Modal */}
      <WeeklyReviewModal
        isOpen={isWeeklyReviewModalOpen}
        onClose={() => setIsWeeklyReviewModalOpen(false)}
        review={weeklyReview}
      />

      {/* AI Productivity Coach Modal */}
      <AICoachModal
        isOpen={isAICoachModalOpen}
        onClose={() => setIsAICoachModalOpen(false)}
        targetDateStr={selectedDate}
      />
    </div>
  );
}
