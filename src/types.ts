export type TaskCategory =
  | 'SSC CGL'
  | 'Technical'
  | 'English'
  | 'Health/Fitness'
  | 'Personal Learning'
  | 'Other';

export interface User {
  id: string;
  name: string;
  email: string;
  roleDescription?: string;
  createdAt: string;
}

export type RecurrenceType = 'none' | 'daily' | 'weekdays' | 'weekly';

export interface Task {
  id: string;
  userId: string;
  title: string;
  description?: string;
  category: TaskCategory;
  date: string; // ISO Date string (YYYY-MM-DD)
  scheduledDate?: string; // Scheduled date (YYYY-MM-DD) for daily view filtering
  status?: 'pending' | 'completed' | 'in_progress';
  completedAt?: string | null; // Timestamp when completed
  dueDate?: string; // Explicit Due Date (YYYY-MM-DD)
  completed: boolean;
  duration?: string;
  dueTime?: string; // e.g. "20:00" for 8:00 PM -> Due time
  recurringSchedule?: RecurrenceType; // Optional recurring schedule
  isTopPriority?: boolean; // FEATURE 1: Daily Top 3 Priority System
  priorityRank?: 1 | 2 | 3; // 1 = P1, 2 = P2, 3 = P3
  // Study-Specific Tracking (Optional)
  isStudySession?: boolean;
  studySubject?: string; // e.g. "GK", "Quant", "Reasoning", "English", "Technical"
  studyTopic?: string; // e.g. "Indian Polity", "Ratio & Proportion"
  studyDurationMinutes?: number; // e.g. 80 for 1h 20m
  questionsAttempted?: number; // e.g. 80
  questionsCorrect?: number; // e.g. 64
  accuracy?: number; // e.g. 80 (%)
  // Spaced Revision System (Optional)
  isRevisionTask?: boolean;
  revisionScheduleId?: string;
  revisionStepIndex?: number;
  revisionDayOffset?: number;
  revisionTopic?: string;
  revisionSubject?: string;
  enableSpacedRevision?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Habit {
  id: string;
  userId: string;
  name: string;
  description?: string;
  category: TaskCategory;
  frequency: 'daily' | 'weekly';
  target?: string;
  dueTime?: string; // e.g. "20:00"
  startDate: string; // YYYY-MM-DD
  active: boolean;
  createdAt: string;
}

export interface HabitCompletion {
  id: string;
  habitId: string;
  userId: string;
  date: string; // YYYY-MM-DD
  completed: boolean;
}

export type ActivityLevel = 'none' | 'empty' | 'low' | 'medium' | 'high';

export interface DayActivity {
  date: string; // YYYY-MM-DD
  dayOfMonth: number;
  dayOfWeek: number; // 0 (Sun) to 6 (Sat)
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  totalItems: number;
  completedItems: number;
  percentage: number;
  level: ActivityLevel;
}

export interface DailySummaryItem {
  id: string;
  title: string;
  category: TaskCategory;
  completed: boolean;
  scheduledDate?: string;
  status?: 'pending' | 'completed' | 'in_progress';
  completedAt?: string | null;
  isHabit: boolean;
  habitId?: string;
  duration?: string;
  description?: string;
  dueDate?: string; // YYYY-MM-DD
  dueTime?: string;
  recurringSchedule?: RecurrenceType;
  isOverdue?: boolean;
  isTopPriority?: boolean; // FEATURE 1: Daily Top 3 Priority System
  priorityRank?: 1 | 2 | 3;
  // Study-Specific Tracking (Optional)
  isStudySession?: boolean;
  studySubject?: string;
  studyTopic?: string;
  studyDurationMinutes?: number;
  questionsAttempted?: number;
  questionsCorrect?: number;
  accuracy?: number;
  // Spaced Revision System (Optional)
  isRevisionTask?: boolean;
  revisionScheduleId?: string;
  revisionStepIndex?: number;
  revisionDayOffset?: number;
  revisionTopic?: string;
  revisionSubject?: string;
}

export interface RevisionStep {
  stepIndex: number; // 0 for Day 0, 1 for Day 1, etc.
  dayOffset: number; // 0, 1, 3, 7, 14, 30
  label: string; // 'Day 0', 'Day 1 (Tomorrow)', 'Day 3', 'Day 7', 'Day 14', 'Day 30'
  scheduledDate: string; // YYYY-MM-DD
  completed: boolean;
  completedAt?: string; // ISO string
  taskId?: string; // ID of linked daily task
  notes?: string;
  questionsAttempted?: number;
  questionsCorrect?: number;
  accuracy?: number;
}

export interface TopicRevisionSchedule {
  id: string; // e.g. "rev_polity_1"
  userId: string;
  subject: string; // e.g. "GK", "Quant", "Reasoning", "English"
  topic: string; // e.g. "Indian Polity"
  learnedDate: string; // YYYY-MM-DD (Day 0)
  customIntervals: number[]; // e.g. [0, 1, 3, 7, 14, 30]
  steps: RevisionStep[];
  currentStepIndex: number;
  nextRevisionDate?: string; // YYYY-MM-DD
  status: 'active' | 'completed' | 'paused';
  totalRevisionsCompleted: number;
  createdAt: string;
  updatedAt: string;
}

export interface StreakFreezeRecord {
  date: string; // YYYY-MM-DD
  usedAt: string; // ISO string
  reason?: string;
}

export interface StreakRecoveryRecord {
  id: string;
  recoveredDate: string; // Missed date that was bridged (e.g. "2026-09-14")
  recoveredAt: string; // ISO timestamp
  previousStreak: number; // Streak count preserved
  newStreak: number; // Resulting streak
  tasksCompletedCount: number; // Verification of real work
}

export interface StreakProtectionState {
  availableFreezes: number; // Default 1, max 2
  maxFreezes: number; // 2
  activeFreezeDate: string | null; // e.g. "2026-09-15" if freeze equipped for today
  frozenDates: string[]; // Dates protected by freeze
  lastFreezeUsedAt: string | null;
  lastRecoveryAt: string | null; // ISO string to enforce 14-day cooldown
  recoveryCooldownDays: number; // 14 days
  recoveredDates: string[]; // Missed dates successfully recovered
  recoveredHistory: StreakRecoveryRecord[];
  lastMilestoneAwardedStreak: number; // Streak count where freeze was last rewarded
}

export interface StreakStatusInfo {
  currentStreak: number;
  longestStreak: number;
  isTodayActive: boolean; // >= 1 item completed today
  isTodayFrozen: boolean; // Freeze currently active on today
  isAtRisk: boolean; // Streak is active from yesterday, but today has 0 items and is not frozen
  riskMessage: string;
  availableFreezes: number;
  maxFreezes: number;
  activeFreezeDate: string | null;
  // Recovery details
  canRecover: boolean; // True if eligible to recover right now
  isBrokenStreakDetected: boolean; // A broken streak of >= 2 days exists from yesterday
  brokenStreakDays: number; // Number of days in the lost streak
  missedDateToRecover: string | null; // e.g. yesterday "2026-09-14"
  todayCompletedCount: number;
  requiredCompletedCount: number; // 2 tasks needed today to recover
  recoveryRequirementsMet: boolean; // todayCompletedCount >= requiredCompletedCount
  recoveryCooldownRemainingDays: number; // 0 if ready, or 1-14 days remaining
  reasonNotRecoverable?: string;
}

export interface ProductivityStats {
  completedToday: number;
  completedThisWeek: number;
  completedThisMonth: number;
  overallCompletionPercentage: number;
  currentStreak: number;
  longestStreak: number;
  mostConsistentHabit: {
    id: string;
    name: string;
    completionCount: number;
    completionRate: number;
  } | null;
  streakStatus?: StreakStatusInfo;
}

export type FocusPresetMode = '25/5' | '50/10' | '90/15' | 'custom';

export type FocusTimerStatus = 'idle' | 'running' | 'paused' | 'break' | 'completed';

export interface FocusSession {
  id: string;
  taskId?: string;
  taskTitle: string;
  taskCategory?: TaskCategory;
  isHabit?: boolean;
  mode: FocusPresetMode;
  targetFocusMinutes: number;
  actualSecondsSpent: number;
  date: string; // YYYY-MM-DD
  startedAt: string; // ISO string
  completedAt: string; // ISO string
  wasCompletedNaturally: boolean;
  notes?: string;
}

export interface ActiveFocusTimerState {
  sessionId: string;
  taskId?: string;
  taskTitle: string;
  taskCategory?: TaskCategory;
  isHabit?: boolean;
  mode: FocusPresetMode;
  focusMinutes: number;
  breakMinutes: number;
  isBreakPhase: boolean;
  totalSeconds: number;
  remainingSeconds: number;
  targetEndTime: number | null; // Unix timestamp in ms
  status: FocusTimerStatus;
  lastTickAt: number; // Unix timestamp in ms
  elapsedSeconds: number;
  startedAt: string;
}

export interface ProductivityFactor {
  id: string;
  name: string;
  weight: number; // 0.20 = 20%
  score: number; // 0 to 100
  pointsEarned: number; // weight * score
  rawValueDisplay: string; // e.g. "5/6", "2/3", "3h 20m", "92%"
  targetDisplay: string; // e.g. "Target: 6 planned", "Target: 3/3 daily", "Goal: 3h 20m"
  status: 'excellent' | 'good' | 'average' | 'needs_attention';
  description: string;
}

export interface ProductivityScoreDetail {
  date: string;
  totalScore: number; // 0 to 100
  grade: string; // 'A+' | 'A' | 'B+' | 'B' | 'C'
  gradeColor: string;
  summaryPhrase: string;
  isWeekly: boolean;
  factors: ProductivityFactor[];
  tasksCompleted: number;
  tasksTotal: number;
  top3Completed: number;
  top3Total: number;
  focusSeconds: number;
  targetFocusSeconds: number;
  consistencyPercentage: number;
  plannedVsCompletedPercentage: number;
  priorityScorePercentage: number;
}

export interface WeeklyDayScore {
  date: string;
  dayName: string; // 'Mon', 'Tue', etc.
  fullDateLabel: string;
  score: number;
  tasksCompleted: number;
  tasksTotal: number;
  top3Completed: number;
  top3Total: number;
  focusMinutes: number;
  consistency: number;
  isToday: boolean;
}

export interface CategoryPerformance {
  category: TaskCategory;
  tasksCompleted: number;
  tasksTotal: number;
  focusMinutes: number;
  color: string;
}

export interface SubjectStudyTime {
  subject: string; // e.g. "GK", "Quant", "Reasoning", "English"
  studyMinutes: number; // in minutes
  formattedDuration: string; // e.g. "5h 20m"
  questionsAttempted: number; // e.g. 80
  questionsCorrect: number; // e.g. 64
  accuracy: number; // e.g. 80 (%)
  color: string;
  tasksCount: number;
  topics: string[];
}

export interface WeeklyProductivityData {
  weekStartDate: string;
  weekEndDate: string;
  weekLabel: string;
  averageScore: number;
  totalFocusSeconds: number;
  totalTasksCompleted: number;
  totalTasksPlanned: number;
  totalTop3Completed: number;
  totalTop3Planned: number;
  overallConsistency: number;
  bestDay: { date: string; dayName: string; score: number };
  dailyBreakdown: WeeklyDayScore[];
  categoryDistribution: CategoryPerformance[];
  subjectStudyTimes: SubjectStudyTime[];
}

export interface WeeklyReviewInsight {
  id: string;
  type: 'time_of_day' | 'postponed_tasks' | 'subject_imbalance' | 'best_day' | 'weakest_day' | 'habit_consistency' | 'focus_depth' | 'priority_execution';
  icon: string;
  title: string;
  text: string; // e.g. "You complete more tasks in the morning."
  evidence: string; // e.g. "23/37 tasks completed before 12:00 PM vs 6 in the afternoon/evening."
  category: 'strength' | 'observation' | 'recommendation';
}

export interface WeeklyReviewSummary {
  weekStartDate: string;
  weekEndDate: string;
  weekLabel: string;
  tasksCompleted: number; // e.g. 37
  tasksTotal: number; // e.g. 42
  completionRate: number; // e.g. 88%
  focusSeconds: number;
  formattedFocusTime: string; // e.g. "18h 25m"
  bestDay: {
    dayName: string; // e.g. "Tuesday"
    date: string;
    completed: number;
    total: number;
    rate: number;
    score: number;
  };
  weakestDay: {
    dayName: string; // e.g. "Saturday"
    date: string;
    completed: number;
    total: number;
    rate: number;
    score: number;
  };
  topHabit: {
    id: string;
    name: string; // e.g. "CGL Study"
    completedCount: number;
    totalDays: number;
    rate: number;
  };
  subjectBreakdown: Array<{
    subject: string; // e.g. "GK", "Quant", "Reasoning", "English"
    studyMinutes: number;
    formattedDuration: string; // e.g. "5h 20m"
    questionsAttempted?: number;
    questionsCorrect?: number;
    accuracy?: number;
    color: string;
  }>;
  insights: WeeklyReviewInsight[];
}

export interface AICoachInputData {
  weekLabel: string;
  weekStartDate: string;
  weekEndDate: string;
  tasksPlanned: number; // e.g. 42
  tasksCompleted: number; // e.g. 37
  completionRate: number; // e.g. 88
  dailyAvgPlanned: number; // e.g. 6
  dailyAvgCompleted: number; // e.g. 4
  strongestPeriod: string; // e.g. "7 AM – 11 AM"
  strongestPeriodEvidence: string; // e.g. "18/20 tasks completed (90%) during morning focus sessions"
  frequentlyPostponedTask: string; // e.g. "Quant Practice"
  frequentlyPostponedEvidence: string; // e.g. "3 tasks delayed or uncompleted when scheduled after 7 PM"
  studyDistribution: Array<{
    subject: string;
    percentage: number;
    studyMinutes: number;
    formattedDuration: string;
    color?: string;
  }>;
  bestDay: { dayName: string; completed: number; total: number; rate: number };
  weakestDay: { dayName: string; completed: number; total: number; rate: number };
  topHabit: { name: string; completedCount: number; totalDays: number; rate: number };
  focusHoursFormatted: string; // e.g. "18h 25m"
  pendingRevisionsCount: number;
}

export interface AICoachAnalysisResult {
  plannedTasks: number;
  completedTasks: number;
  completionRate: number;
  strongestPeriod: string; // "7 AM – 11 AM"
  frequentlyPostponed: string; // "Quant Practice"
  studyDistribution: Array<{
    subject: string;
    percentage: number;
    color?: string;
  }>;
  recommendations: string[];
  coachNote?: string;
  isAiGenerated: boolean;
  modelUsed?: string;
  generatedAt: string;
  formattedText: string;
  fallbackReason?: string;
}

export interface StorageLoadResult {
  success: boolean;
  source?: string;
  tasksCount: number;
  habitsCount: number;
  habitCompletionsCount: number;
  durationMs: number;
  error?: string;
  timedOut?: boolean;
}


