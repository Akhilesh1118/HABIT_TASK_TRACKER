import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  CheckCircle2,
  Calendar,
  Clock,
  Flame,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Info,
  ChevronDown,
  ChevronUp,
  Sparkles,
  BarChart3,
  ListTodo,
  CalendarDays,
  Check,
  AlertCircle,
  Play,
  RotateCcw,
  GraduationCap,
  Target,
  BookOpen,
} from 'lucide-react';
import {
  ProductivityScoreDetail,
  WeeklyProductivityData,
  TaskCategory,
  ProductivityFactor,
  SubjectStudyTime,
  WeeklyReviewSummary,
} from '../types';
import { storageService, parseDateKey, formatDateKey } from '../services/storageService';
import { getCurrentIST } from '../utils/timeUtils';
import { WeeklyReviewSummaryCard } from './WeeklyReviewSummaryCard';
import { WeeklyReviewModal } from './WeeklyReviewModal';
import { AICoachCard } from './AICoachCard';

interface ProductivityDashboardProps {
  selectedDate: string;
  todayDate: string;
  onSelectDate: (date: string) => void;
  onStartFocusSession?: () => void;
  onSwitchToTasksView?: () => void;
  refreshTrigger: number;
}

export const ProductivityDashboard: React.FC<ProductivityDashboardProps> = ({
  selectedDate,
  todayDate,
  onSelectDate,
  onStartFocusSession,
  onSwitchToTasksView,
  refreshTrigger,
}) => {
  const [viewMode, setViewMode] = useState<'daily' | 'weekly'>('daily');
  const [showFormulaDetails, setShowFormulaDetails] = useState(false);
  const [isWeeklyReviewModalOpen, setIsWeeklyReviewModalOpen] = useState(false);

  // Compute daily score reactively
  const dailyScore: ProductivityScoreDetail = useMemo(() => {
    return storageService.calculateDailyProductivityScore(selectedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, refreshTrigger]);

  // Compute weekly data reactively
  const weeklyData: WeeklyProductivityData = useMemo(() => {
    return storageService.calculateWeeklyProductivity(selectedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, refreshTrigger]);

  // Compute comprehensive Weekly Review summary
  const weeklyReview: WeeklyReviewSummary = useMemo(() => {
    return storageService.getWeeklyProductivityReview(selectedDate, 'trailing7');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, refreshTrigger]);

  // Date Navigation handlers
  const handlePrevDay = () => {
    const d = parseDateKey(selectedDate);
    d.setDate(d.getDate() - 1);
    onSelectDate(formatDateKey(d));
  };

  const handleNextDay = () => {
    const d = parseDateKey(selectedDate);
    d.setDate(d.getDate() + 1);
    onSelectDate(formatDateKey(d));
  };

  const handlePrevWeek = () => {
    const d = parseDateKey(selectedDate);
    d.setDate(d.getDate() - 7);
    onSelectDate(formatDateKey(d));
  };

  const handleNextWeek = () => {
    const d = parseDateKey(selectedDate);
    d.setDate(d.getDate() + 7);
    onSelectDate(formatDateKey(d));
  };

  const currentTodayDate = getCurrentIST().dateStr;
  const isToday = selectedDate === currentTodayDate;

  // Selected date formatted string
  const formattedDateTitle = useMemo(() => {
    const d = parseDateKey(selectedDate);
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }, [selectedDate]);

  // Focus sessions for selected date
  const dayFocusSessions = useMemo(() => {
    return storageService.getFocusSessionsForDate(selectedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, refreshTrigger]);

  // Top 3 priority items for selected date
  const dayItems = useMemo(() => {
    return storageService.getDayItems(selectedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, refreshTrigger]);

  const top3Items = useMemo(() => {
    return dayItems.filter((i) => i.isTopPriority);
  }, [dayItems]);

  // Chart 1 data: Daily scores & focus hours for the week
  const weeklyChartData = useMemo(() => {
    return weeklyData.dailyBreakdown.map((day) => ({
      name: day.dayName,
      fullDate: day.fullDateLabel,
      score: day.score,
      focusHours: Number((day.focusMinutes / 60).toFixed(1)),
      focusMins: day.focusMinutes,
      tasksCompleted: day.tasksCompleted,
      tasksTotal: day.tasksTotal,
      top3Completed: day.top3Completed,
      top3Total: day.top3Total,
      isToday: day.isToday,
      date: day.date,
    }));
  }, [weeklyData]);

  // Chart 2 data: Planned vs Completed for each day
  const plannedVsCompletedData = useMemo(() => {
    return weeklyData.dailyBreakdown.map((day) => ({
      name: day.dayName,
      fullDate: day.fullDateLabel,
      Completed: day.tasksCompleted,
      Pending: Math.max(0, day.tasksTotal - day.tasksCompleted),
      Planned: day.tasksTotal,
      Rate: day.tasksTotal > 0 ? Math.round((day.tasksCompleted / day.tasksTotal) * 100) : 100,
    }));
  }, [weeklyData]);

  // Category Colors
  const categoryColorMap: Record<string, string> = {
    'SSC CGL': '#059669', // emerald
    'Technical': '#4f46e5', // indigo
    'English': '#d97706', // amber
    'Health/Fitness': '#e11d48', // rose
    'Personal Learning': '#7c3aed', // purple
    'Other': '#78716c', // stone
  };

  // Study-Specific Tracking Memos
  const totalWeeklyStudyMinutes = useMemo(() => {
    return weeklyData.subjectStudyTimes.reduce((acc, s) => acc + s.studyMinutes, 0);
  }, [weeklyData.subjectStudyTimes]);

  const totalWeeklyQuestionsAttempted = useMemo(() => {
    return weeklyData.subjectStudyTimes.reduce((acc, s) => acc + s.questionsAttempted, 0);
  }, [weeklyData.subjectStudyTimes]);

  const totalWeeklyQuestionsCorrect = useMemo(() => {
    return weeklyData.subjectStudyTimes.reduce((acc, s) => acc + s.questionsCorrect, 0);
  }, [weeklyData.subjectStudyTimes]);

  const overallStudyAccuracy = useMemo(() => {
    if (totalWeeklyQuestionsAttempted === 0) return 0;
    return Math.round((totalWeeklyQuestionsCorrect / totalWeeklyQuestionsAttempted) * 100);
  }, [totalWeeklyQuestionsAttempted, totalWeeklyQuestionsCorrect]);

  const totalWeeklyStudyFormatted = useMemo(() => {
    const hrs = Math.floor(totalWeeklyStudyMinutes / 60);
    const mins = totalWeeklyStudyMinutes % 60;
    return hrs > 0 ? `${hrs}h ${mins > 0 ? `${mins}m` : ''}`.trim() : `${mins}m`;
  }, [totalWeeklyStudyMinutes]);

  const dailyStudyTasks = useMemo(() => {
    return dayItems.filter((t) => t.isStudySession && t.studySubject);
  }, [dayItems]);

  return (
    <div className="space-y-6">
      {/* Top Controls: View Toggle & Date Stepper */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 sm:p-4 rounded-xl border border-stone-200 shadow-xs">
        {/* Daily vs Weekly Toggle */}
        <div className="flex items-center p-1 bg-stone-100 rounded-lg max-w-fit">
          <button
            id="analytics-daily-toggle-btn"
            onClick={() => setViewMode('daily')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-md text-xs sm:text-sm font-semibold transition-all ${
              viewMode === 'daily'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Calendar className="w-4 h-4 text-emerald-600" />
            <span>Daily View</span>
          </button>
          <button
            id="analytics-weekly-toggle-btn"
            onClick={() => setViewMode('weekly')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-md text-xs sm:text-sm font-semibold transition-all ${
              viewMode === 'weekly'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <CalendarDays className="w-4 h-4 text-indigo-600" />
            <span>Weekly View</span>
          </button>
        </div>

        {/* Date Navigation Stepper */}
        <div className="flex items-center justify-between sm:justify-end space-x-2">
          {viewMode === 'daily' ? (
            <>
              <button
                id="analytics-prev-day-btn"
                onClick={handlePrevDay}
                className="p-1.5 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 transition-colors"
                title="Previous Day"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="text-center px-2">
                <div className="text-xs sm:text-sm font-semibold text-stone-900">
                  {formattedDateTitle}
                </div>
                {isToday && (
                  <span className="inline-block text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
                    Today
                  </span>
                )}
              </div>
              <button
                id="analytics-next-day-btn"
                onClick={handleNextDay}
                className="p-1.5 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 transition-colors"
                title="Next Day"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              {!isToday && (
                <button
                  id="analytics-jump-today-btn"
                  onClick={() => onSelectDate(currentTodayDate)}
                  className="ml-2 px-2 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition-colors"
                >
                  Today
                </button>
              )}
            </>
          ) : (
            <>
              <button
                id="analytics-prev-week-btn"
                onClick={handlePrevWeek}
                className="p-1.5 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 transition-colors"
                title="Previous Week"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="text-center px-2">
                <div className="text-xs sm:text-sm font-semibold text-stone-900">
                  {weeklyData.weekLabel}
                </div>
                <span className="inline-block text-[10px] text-stone-500 font-medium">
                  7-Day Aggregate
                </span>
              </div>
              <button
                id="analytics-next-week-btn"
                onClick={handleNextWeek}
                className="p-1.5 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 transition-colors"
                title="Next Week"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* =========================================================================
          VIEW 1: DAILY PRODUCTIVITY VIEW
          ========================================================================= */}
      {viewMode === 'daily' && (
        <div className="space-y-6">
          {/* Main Hero Productivity Card (Matching User Example & Format) */}
          <div className="bg-white rounded-2xl border border-stone-200 p-5 sm:p-6 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-stone-100">
              <div className="flex items-start sm:items-center space-x-4">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-stone-900 text-white flex flex-col items-center justify-center shadow-sm shrink-0">
                  <span className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                    {dailyScore.totalScore}%
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-stone-400 font-medium">
                    Score
                  </span>
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-extrabold text-stone-500 uppercase tracking-widest">
                      PRODUCTIVITY
                    </span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border ${dailyScore.gradeColor}`}
                    >
                      Grade {dailyScore.grade}
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight mt-0.5">
                    {dailyScore.summaryPhrase}
                  </h2>
                  <p className="text-xs text-stone-500 mt-1">
                    Multi-factor index balancing completion, Top 3 focus, time spent, and consistency.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-2 shrink-0">
                <button
                  id="toggle-transparent-formula-btn"
                  onClick={() => setShowFormulaDetails(!showFormulaDetails)}
                  className="flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-stone-100 hover:bg-stone-200 text-stone-800 transition-colors"
                >
                  <Info className="w-3.5 h-3.5 text-stone-600" />
                  <span>{showFormulaDetails ? 'Hide Formula' : 'Transparent Scoring'}</span>
                  {showFormulaDetails ? (
                    <ChevronUp className="w-3.5 h-3.5 text-stone-500" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-stone-500" />
                  )}
                </button>
                {onStartFocusSession && (
                  <button
                    id="daily-hero-start-focus-btn"
                    onClick={onStartFocusSession}
                    className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors"
                  >
                    <Play className="w-3.5 h-3.5 fill-white" />
                    <span>Focus Timer</span>
                  </button>
                )}
              </div>
            </div>

            {/* Exact Factors Matrix (Prompt Example Format) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 pt-5">
              {dailyScore.factors.map((factor) => {
                const getFactorIcon = (id: string) => {
                  switch (id) {
                    case 'task_completion':
                      return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
                    case 'top3_completion':
                      return <Sparkles className="w-4 h-4 text-amber-500" />;
                    case 'focus_time':
                      return <Clock className="w-4 h-4 text-blue-600" />;
                    case 'consistency':
                      return <Flame className="w-4 h-4 text-orange-500" />;
                    case 'priority_execution':
                      return <TrendingUp className="w-4 h-4 text-indigo-600" />;
                    default:
                      return <CheckCircle2 className="w-4 h-4 text-stone-500" />;
                  }
                };

                return (
                  <div
                    key={factor.id}
                    id={`factor-card-${factor.id}`}
                    className="bg-stone-50/70 rounded-xl p-3.5 border border-stone-200/70 flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between text-stone-500 mb-1.5">
                      <span className="text-xs font-semibold tracking-tight">{factor.name}</span>
                      {getFactorIcon(factor.id)}
                    </div>
                    <div className="my-1">
                      <div className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">
                        {factor.rawValueDisplay}
                      </div>
                      <div className="text-[11px] text-stone-500 truncate mt-0.5">
                        {factor.targetDisplay}
                      </div>
                    </div>
                    {/* Mini progress & weight badge */}
                    <div className="pt-2 border-t border-stone-200/60 flex items-center justify-between text-[11px]">
                      <span className="text-stone-500">Weight: {Math.round(factor.weight * 100)}%</span>
                      <span className="font-bold text-stone-800">
                        +{factor.pointsEarned.toFixed(1)} pts
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Transparent Scoring Formula Breakdown Drawer */}
            <AnimatePresence>
              {showFormulaDetails && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-5 pt-5 border-t border-stone-200 overflow-hidden"
                >
                  <div className="bg-stone-900 text-stone-100 rounded-xl p-4 sm:p-5">
                    <div className="flex items-center space-x-2 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2">
                      <Info className="w-4 h-4" />
                      <span>Why This Scoring Prevents Vanity Metrics</span>
                    </div>
                    <p className="text-xs sm:text-sm text-stone-300 leading-relaxed mb-4">
                      Simple task completion percentages (completed ÷ total) fail because checking off
                      5 trivial checkboxes gives 100% while major exam preparation tasks are ignored.
                      Our transparent formula weights your high-leverage Top 3 priorities, verified
                      timer focus hours, and 7-day streak consistency:
                    </p>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-stone-700 text-stone-400">
                            <th className="py-2 pr-3">Factor</th>
                            <th className="py-2 pr-3">Formula / Metric</th>
                            <th className="py-2 pr-3">Weight</th>
                            <th className="py-2 pr-3">Score</th>
                            <th className="py-2 text-right">Points Earned</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-800">
                          {dailyScore.factors.map((f) => (
                            <tr key={f.id} className="text-stone-200">
                              <td className="py-2.5 pr-3 font-semibold text-white">{f.name}</td>
                              <td className="py-2.5 pr-3 text-stone-400">{f.description}</td>
                              <td className="py-2.5 pr-3 font-mono">{Math.round(f.weight * 100)}%</td>
                              <td className="py-2.5 pr-3 font-mono">{f.score}%</td>
                              <td className="py-2.5 text-right font-mono font-bold text-emerald-400">
                                {f.pointsEarned.toFixed(1)} / {(f.weight * 100).toFixed(1)}
                              </td>
                            </tr>
                          ))}
                          <tr className="border-t border-stone-700 text-white font-bold">
                            <td colSpan={2} className="py-3 pr-3 text-emerald-400 uppercase tracking-wide">
                              Total Composite Score
                            </td>
                            <td className="py-3 pr-3 font-mono">100%</td>
                            <td className="py-3 pr-3 font-mono">—</td>
                            <td className="py-3 text-right font-mono text-emerald-400 text-sm">
                              {dailyScore.totalScore} / 100 pts
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Daily Visualizations Row */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Study Sessions, Top 3 Priorities Status & Focus Sessions (7 cols) */}
            <div className="lg:col-span-7 space-y-6">
              {/* Daily Study Session Tracking Card (GK, Indian Polity, 1h 20m, 80 Q, 64 Corr, 80% Acc) */}
              {dailyStudyTasks.length > 0 && (
                <div className="bg-white rounded-2xl border border-indigo-200/90 p-5 shadow-xs bg-gradient-to-br from-indigo-50/40 via-white to-white">
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-indigo-100">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                        <GraduationCap className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-stone-900 tracking-tight">
                          Study Session Tracking
                        </h3>
                        <p className="text-[11px] text-stone-500">
                          Academic study log with subject, topic, question stats and accuracy.
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-800 border border-indigo-200 font-mono">
                      {dailyStudyTasks.length} Tracked Session{dailyStudyTasks.length > 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {dailyStudyTasks.map((task) => (
                      <div
                        key={task.id}
                        className="p-4 rounded-xl border border-indigo-200/80 bg-white space-y-3 shadow-2xs"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-600">
                                {task.category || 'Study'}
                              </span>
                              <span className="text-stone-300">•</span>
                              <h4 className="text-sm font-bold text-stone-900">
                                {task.title}
                              </h4>
                            </div>
                            <div className="flex items-center space-x-2 mt-1.5 flex-wrap gap-y-1">
                              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-md font-extrabold bg-indigo-600 text-white text-xs shadow-2xs">
                                <span>Subject:</span>
                                <span className="underline decoration-indigo-300">{task.studySubject}</span>
                              </span>
                              {task.studyTopic && (
                                <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-950 border border-indigo-200">
                                  <span className="text-indigo-600 font-normal">Topic:</span>
                                  <strong className="font-bold">{task.studyTopic}</strong>
                                </span>
                              )}
                            </div>
                          </div>

                          {task.studyDurationMinutes && (
                            <div className="text-right shrink-0">
                              <div className="text-[10px] uppercase font-bold text-stone-400">Study Time</div>
                              <span className="text-sm sm:text-base font-black font-mono text-stone-900 bg-stone-100 px-2.5 py-1 rounded-lg border border-stone-200">
                                {Math.floor(task.studyDurationMinutes / 60) > 0 ? `${Math.floor(task.studyDurationMinutes / 60)}h ` : ''}
                                {task.studyDurationMinutes % 60 > 0 ? `${task.studyDurationMinutes % 60}m` : ''}
                              </span>
                            </div>
                          )}
                        </div>

                        {(task.questionsAttempted !== undefined || task.accuracy !== undefined) && (
                          <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-xs flex-wrap gap-2">
                            <div className="flex items-center space-x-3">
                              <span className="text-stone-600">
                                Questions: <strong className="text-stone-900 font-bold">{task.questionsAttempted}</strong>
                              </span>
                              {task.questionsCorrect !== undefined && (
                                <span className="text-stone-600">
                                  Correct: <strong className="text-emerald-700 font-bold">{task.questionsCorrect}</strong>
                                </span>
                              )}
                            </div>
                            {task.accuracy !== undefined && (
                              <div className="flex items-center space-x-1.5">
                                <span className="text-stone-500 font-medium">Accuracy:</span>
                                <span
                                  className={`px-2.5 py-0.5 rounded-md text-xs font-black border ${
                                    task.accuracy >= 80
                                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                      : task.accuracy >= 60
                                      ? 'bg-amber-50 text-amber-800 border-amber-300'
                                      : 'bg-rose-50 text-rose-800 border-rose-300'
                                  }`}
                                >
                                  {task.accuracy}%
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Daily Top 3 Execution Card */}
              <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-5 h-5 text-amber-500" />
                    <h3 className="text-sm font-bold text-stone-900 tracking-tight">
                      Top 3 Non-Negotiable Priorities Execution
                    </h3>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                    {dailyScore.top3Completed}/{dailyScore.top3Total} Done
                  </span>
                </div>

                {top3Items.length === 0 ? (
                  <div className="text-center py-6 text-stone-400 text-xs">
                    No Top 3 priorities tagged for this date. Go to Daily Tasks to set your top 3.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {top3Items.map((item, idx) => (
                      <div
                        key={item.id}
                        className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                          item.completed
                            ? 'bg-emerald-50/40 border-emerald-200/80 text-stone-700'
                            : 'bg-stone-50/60 border-stone-200 text-stone-900'
                        }`}
                      >
                        <div className="flex items-center space-x-3 min-w-0">
                          <span
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                              item.completed
                                ? 'bg-emerald-600 text-white'
                                : 'bg-amber-100 text-amber-800 border border-amber-300'
                            }`}
                          >
                            {item.completed ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                          </span>
                          <div className="min-w-0">
                            <p
                              className={`text-xs sm:text-sm font-medium truncate ${
                                item.completed ? 'line-through text-stone-400' : 'text-stone-900'
                              }`}
                            >
                              {item.title}
                            </p>
                            <span className="text-[10px] text-stone-500">{item.category}</span>
                          </div>
                        </div>

                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                            item.completed
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-stone-200/80 text-stone-600'
                          }`}
                        >
                          {item.completed ? 'Achieved' : 'Pending'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Verified Focus Sessions for Today */}
              <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <Clock className="w-5 h-5 text-blue-600" />
                    <h3 className="text-sm font-bold text-stone-900 tracking-tight">
                      Focus Sessions Logged ({dailyScore.factors.find((f) => f.id === 'focus_time')?.rawValueDisplay})
                    </h3>
                  </div>
                  <span className="text-xs text-stone-500 font-medium">
                    Goal: 3h 20m deep study
                  </span>
                </div>

                {dayFocusSessions.length === 0 ? (
                  <div className="text-center py-6 text-stone-400 text-xs">
                    No focus sessions recorded on this date. Use Focus Mode to log timed deep work.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {dayFocusSessions.map((session) => {
                      const mins = Math.round((session.actualSecondsSpent || 0) / 60);
                      const hrs = Math.floor(mins / 60);
                      const remM = mins % 60;
                      const timeStr = hrs > 0 ? `${hrs}h ${remM}m` : `${remM}m`;

                      return (
                        <div
                          key={session.id}
                          className="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-200 text-xs"
                        >
                          <div className="flex items-center space-x-2.5 min-w-0">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                            <div className="min-w-0">
                              <p className="font-semibold text-stone-900 truncate">
                                {session.taskTitle}
                              </p>
                              <div className="flex items-center space-x-2 text-[10px] text-stone-500 mt-0.5">
                                <span>{session.taskCategory || 'General'}</span>
                                <span>•</span>
                                <span>Mode: {session.mode}</span>
                                {session.notes && (
                                  <>
                                    <span>•</span>
                                    <span className="italic truncate max-w-xs">{session.notes}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0 pl-2">
                            <span className="font-mono font-bold text-stone-900 text-xs sm:text-sm">
                              {timeStr}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Category Distribution & Planned vs Completed (5 cols) */}
            <div className="lg:col-span-5 space-y-6">
              {/* Category Time Allocation Donut/List */}
              <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-stone-900 tracking-tight">
                    Subject / Category Focus
                  </h3>
                  <span className="text-xs text-stone-500">Balance Metric</span>
                </div>

                <div className="space-y-3">
                  {weeklyData.categoryDistribution.map((cat) => {
                    const totalFocus = weeklyData.totalFocusSeconds > 0 ? weeklyData.totalFocusSeconds / 60 : 1;
                    const catPct = Math.round((cat.focusMinutes / totalFocus) * 100);

                    return (
                      <div key={cat.category} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-stone-800">{cat.category}</span>
                          <span className="text-stone-500 font-mono">
                            {cat.focusMinutes >= 60
                              ? `${Math.floor(cat.focusMinutes / 60)}h ${cat.focusMinutes % 60}m`
                              : `${cat.focusMinutes}m`}
                            {' '}({catPct}%)
                          </span>
                        </div>
                        <div className="w-full bg-stone-100 rounded-full h-2 overflow-hidden">
                          <div
                            className="h-2 rounded-full transition-all"
                            style={{
                              width: `${Math.min(100, Math.max(5, catPct))}%`,
                              backgroundColor: cat.color || '#059669',
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Planned vs Completed Breakdown */}
              <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-stone-900 tracking-tight">
                    Planned vs Completed Tasks
                  </h3>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                    {dailyScore.tasksCompleted}/{dailyScore.tasksTotal} Items
                  </span>
                </div>

                <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-stone-600">Completion Fulfillment:</span>
                    <span className="font-bold text-stone-900 font-mono">
                      {dailyScore.plannedVsCompletedPercentage}%
                    </span>
                  </div>
                  <div className="w-full bg-stone-200 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="h-2.5 rounded-full bg-emerald-600 transition-all"
                      style={{ width: `${dailyScore.plannedVsCompletedPercentage}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-stone-500 pt-1">
                    <span>{dailyScore.tasksCompleted} Completed</span>
                    <span>{Math.max(0, dailyScore.tasksTotal - dailyScore.tasksCompleted)} Remaining</span>
                  </div>
                </div>

                {onSwitchToTasksView && (
                  <button
                    id="switch-to-tasks-btn"
                    onClick={onSwitchToTasksView}
                    className="w-full mt-4 flex items-center justify-center space-x-1.5 py-2 px-3 rounded-lg border border-stone-200 text-xs font-semibold text-stone-700 hover:bg-stone-50 transition-colors"
                  >
                    <ListTodo className="w-3.5 h-3.5 text-stone-500" />
                    <span>View & Edit Daily Tasks</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 2: WEEKLY PRODUCTIVITY VIEW
          ========================================================================= */}
      {viewMode === 'weekly' && (
        <div className="space-y-6">
          {/* Main Weekly Productivity Review Section */}
          <WeeklyReviewSummaryCard
            review={weeklyReview}
            onOpenFullModal={() => setIsWeeklyReviewModalOpen(true)}
          />

          {/* AI Productivity Coach Section */}
          <AICoachCard
            targetDateStr={selectedDate}
          />

          {/* Weekly Summary Cards Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Average Productivity */}
            <div className="bg-white rounded-xl p-4 border border-stone-200 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-stone-500 mb-1">
                <span className="text-xs font-medium uppercase tracking-wider">Avg Score</span>
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="flex items-baseline space-x-1">
                <span className="text-2xl font-extrabold text-stone-900">{weeklyData.averageScore}%</span>
                <span className="text-xs text-stone-500">weekly</span>
              </div>
            </div>

            {/* Total Deep Focus */}
            <div className="bg-white rounded-xl p-4 border border-stone-200 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-stone-500 mb-1">
                <span className="text-xs font-medium uppercase tracking-wider">Total Focus</span>
                <Clock className="w-4 h-4 text-blue-600" />
              </div>
              <div className="flex items-baseline space-x-1">
                <span className="text-2xl font-extrabold text-stone-900">
                  {Math.floor(weeklyData.totalFocusSeconds / 3600)}h {Math.round((weeklyData.totalFocusSeconds % 3600) / 60)}m
                </span>
              </div>
            </div>

            {/* Tasks Completed */}
            <div className="bg-white rounded-xl p-4 border border-stone-200 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-stone-500 mb-1">
                <span className="text-xs font-medium uppercase tracking-wider">Tasks Done</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="flex items-baseline space-x-1">
                <span className="text-2xl font-extrabold text-stone-900">
                  {weeklyData.totalTasksCompleted}
                </span>
                <span className="text-xs text-stone-500">/ {weeklyData.totalTasksPlanned}</span>
              </div>
            </div>

            {/* Top 3 Execution */}
            <div className="bg-white rounded-xl p-4 border border-stone-200 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-stone-500 mb-1">
                <span className="text-xs font-medium uppercase tracking-wider">Top 3 Ratio</span>
                <Sparkles className="w-4 h-4 text-amber-500" />
              </div>
              <div className="flex items-baseline space-x-1">
                <span className="text-2xl font-extrabold text-stone-900">
                  {weeklyData.totalTop3Completed}
                </span>
                <span className="text-xs text-stone-500">/ {weeklyData.totalTop3Planned}</span>
              </div>
            </div>

            {/* Weekly Consistency */}
            <div className="bg-white rounded-xl p-4 border border-stone-200 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-stone-500 mb-1">
                <span className="text-xs font-medium uppercase tracking-wider">Consistency</span>
                <Flame className="w-4 h-4 text-orange-500" />
              </div>
              <div className="flex items-baseline space-x-1">
                <span className="text-2xl font-extrabold text-stone-900">{weeklyData.overallConsistency}%</span>
                <span className="text-xs text-stone-500">active</span>
              </div>
            </div>

            {/* Best Day */}
            <div className="bg-white rounded-xl p-4 border border-stone-200 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-stone-500 mb-1">
                <span className="text-xs font-medium uppercase tracking-wider">Peak Day</span>
                <Sparkles className="w-4 h-4 text-purple-600" />
              </div>
              <div className="flex items-baseline space-x-1">
                <span className="text-xl font-extrabold text-stone-900">{weeklyData.bestDay.dayName}</span>
                <span className="text-xs font-semibold text-emerald-600">({weeklyData.bestDay.score}%)</span>
              </div>
            </div>
          </div>

          {/* Chart 1: Daily Productivity Score & Focus Hours Trend */}
          <div className="bg-white rounded-2xl border border-stone-200 p-5 sm:p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
              <div>
                <h3 className="text-base font-bold text-stone-900 tracking-tight">
                  Daily Productivity & Focus Hours Trend
                </h3>
                <p className="text-xs text-stone-500">
                  Dual-axis visualization showing focus hours (bars) vs weighted productivity score (line).
                </p>
              </div>
              <div className="flex items-center space-x-4 text-xs">
                <div className="flex items-center space-x-1.5">
                  <div className="w-3 h-3 rounded-sm bg-indigo-600" />
                  <span className="text-stone-600 font-medium">Focus Hours</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <div className="w-3 h-1 bg-emerald-600 rounded-full" />
                  <span className="text-stone-600 font-medium">Productivity Score (%)</span>
                </div>
              </div>
            </div>

            <div className="w-full h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={weeklyChartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    stroke="#64748b"
                    fontSize={12}
                    tick={{ fill: '#475569' }}
                  />
                  {/* Left Y Axis for Focus Hours */}
                  <YAxis
                    yAxisId="left"
                    orientation="left"
                    stroke="#6366f1"
                    fontSize={11}
                    tickFormatter={(v) => `${v}h`}
                    domain={[0, 'dataMax + 1']}
                  />
                  {/* Right Y Axis for Productivity Score */}
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#059669"
                    fontSize={11}
                    tickFormatter={(v) => `${v}%`}
                    domain={[0, 100]}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="bg-stone-900 text-white rounded-xl p-3 shadow-lg text-xs space-y-1.5 border border-stone-700">
                            <div className="font-bold text-stone-200 border-b border-stone-800 pb-1">
                              {d.fullDate} {d.isToday && '(Today)'}
                            </div>
                            <div className="flex items-center justify-between space-x-4">
                              <span className="text-stone-400">Productivity Score:</span>
                              <span className="font-bold text-emerald-400">{d.score}%</span>
                            </div>
                            <div className="flex items-center justify-between space-x-4">
                              <span className="text-stone-400">Focus Time:</span>
                              <span className="font-bold text-indigo-300">{d.focusHours}h ({d.focusMins}m)</span>
                            </div>
                            <div className="flex items-center justify-between space-x-4">
                              <span className="text-stone-400">Tasks Completed:</span>
                              <span className="font-bold text-stone-200">
                                {d.tasksCompleted}/{d.tasksTotal}
                              </span>
                            </div>
                            <div className="flex items-center justify-between space-x-4">
                              <span className="text-stone-400">Top 3 Executed:</span>
                              <span className="font-bold text-amber-300">
                                {d.top3Completed}/{d.top3Total}
                              </span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="focusHours"
                    name="Focus Hours"
                    fill="#4f46e5"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={40}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="score"
                    name="Productivity Score"
                    stroke="#059669"
                    strokeWidth={3}
                    dot={{ fill: '#059669', r: 4, strokeWidth: 2, stroke: '#ffffff' }}
                    activeDot={{ r: 6, fill: '#10b981' }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Dedicated Section: Weekly Subject-Wise Study Time */}
          <div className="bg-white rounded-2xl border border-indigo-200 p-5 sm:p-6 shadow-xs bg-gradient-to-br from-indigo-50/20 via-white to-white">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-stone-200">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-xs">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-stone-900 tracking-tight flex items-center space-x-2">
                    <span>Weekly Subject-Wise Study Time</span>
                  </h3>
                  <p className="text-xs text-stone-500">
                    CGL & Academic exam preparation breakdown across subjects.
                  </p>
                </div>
              </div>

              {/* Summary Stats Badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="px-3 py-1.5 rounded-xl bg-stone-100 border border-stone-200 flex items-center space-x-2 text-xs">
                  <Clock className="w-3.5 h-3.5 text-stone-500" />
                  <span className="text-stone-600 font-medium">Total Study:</span>
                  <span className="font-mono font-bold text-stone-900">{totalWeeklyStudyFormatted}</span>
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center space-x-2 text-xs">
                  <Target className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-800 font-medium">Questions:</span>
                  <span className="font-mono font-bold text-emerald-900">{totalWeeklyQuestionsAttempted} ({overallStudyAccuracy}% Acc)</span>
                </div>
              </div>
            </div>

            {/* Subject Grid with Canonical User Specification (GK 5h 20m, Quant 4h 10m, Reasoning 3h 40m, English 3h 15m) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {weeklyData.subjectStudyTimes.map((subj) => {
                const pct = totalWeeklyStudyMinutes > 0 ? Math.round((subj.studyMinutes / totalWeeklyStudyMinutes) * 100) : 0;
                return (
                  <div
                    key={subj.subject}
                    className="p-4 rounded-xl border border-stone-200 bg-stone-50/50 hover:bg-stone-50 transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <div
                            className="w-3 h-3 rounded-md shrink-0"
                            style={{ backgroundColor: subj.color }}
                          />
                          <h4 className="text-sm font-bold text-stone-900">
                            {subj.subject}
                          </h4>
                        </div>
                        <span className="text-xs font-mono font-extrabold px-2 py-0.5 rounded-md bg-white border border-stone-200 text-stone-900 shadow-2xs">
                          {subj.formattedDuration}
                        </span>
                      </div>

                      {/* Progress bar proportional to weekly total */}
                      <div className="w-full bg-stone-200/80 rounded-full h-2 mb-3 overflow-hidden">
                        <div
                          className="h-2 rounded-full transition-all"
                          style={{
                            width: `${Math.max(8, pct)}%`,
                            backgroundColor: subj.color,
                          }}
                        />
                      </div>

                      {/* Topic Tags */}
                      {subj.topics && subj.topics.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {subj.topics.slice(0, 3).map((topic) => (
                            <span
                              key={topic}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-white text-stone-600 border border-stone-200 truncate max-w-[120px]"
                              title={topic}
                            >
                              {topic}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Questions & Accuracy Footer */}
                    <div className="pt-2.5 border-t border-stone-200/80 flex items-center justify-between text-xs">
                      <span className="text-stone-500 font-medium">
                        {subj.questionsAttempted} Qs ({subj.questionsCorrect} corr)
                      </span>
                      <span
                        className={`font-mono font-bold px-1.5 py-0.5 rounded text-[11px] ${
                          subj.accuracy >= 80
                            ? 'bg-emerald-100 text-emerald-800'
                            : subj.accuracy >= 70
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-stone-200 text-stone-700'
                        }`}
                      >
                        {subj.accuracy}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quick-Reference Weekly Breakdown matching exact user example */}
            <div className="p-4 bg-stone-900 text-white rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider block">
                  Subject-Wise Time Table
                </span>
                <span className="text-xs text-stone-300">
                  Total aggregated study time across all recorded prep sessions this week.
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                {weeklyData.subjectStudyTimes.map((s) => (
                  <div key={s.subject} className="flex items-baseline space-x-2 bg-stone-800/90 px-3 py-1.5 rounded-lg border border-stone-700">
                    <span className="font-semibold text-stone-300 w-20 truncate">{s.subject}</span>
                    <span className="font-mono font-extrabold text-emerald-400">{s.formattedDuration}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Charts Row: Planned vs Completed & Subject Focus Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Chart 2: Planned vs Completed Tasks Bar Chart (7 cols) */}
            <div className="lg:col-span-7 bg-white rounded-2xl border border-stone-200 p-5 sm:p-6 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-stone-900 tracking-tight">
                    Planned vs. Completed Tasks Comparison
                  </h3>
                  <p className="text-xs text-stone-500">
                    Fulfillment rates day-by-day across the active week.
                  </p>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-stone-100 text-stone-700">
                  {weeklyData.totalTasksCompleted} / {weeklyData.totalTasksPlanned} Total
                </span>
              </div>

              <div className="w-full h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={plannedVsCompletedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" tickLine={false} stroke="#64748b" fontSize={12} />
                    <YAxis allowDecimals={false} fontSize={11} stroke="#64748b" />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const d = payload[0].payload;
                          return (
                            <div className="bg-stone-900 text-white rounded-xl p-3 shadow-lg text-xs space-y-1 border border-stone-700">
                              <div className="font-bold text-stone-200">{d.fullDate}</div>
                              <div className="text-emerald-400 font-semibold">
                                Completed: {d.Completed} items
                              </div>
                              <div className="text-stone-400">Planned Total: {d.Planned} items</div>
                              <div className="text-indigo-300">Completion Rate: {d.Rate}%</div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                    <Bar dataKey="Completed" fill="#059669" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Pending" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 3: Weekly Category & Balance Distribution (5 cols) */}
            <div className="lg:col-span-5 bg-white rounded-2xl border border-stone-200 p-5 sm:p-6 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-stone-900 tracking-tight">
                    Weekly Category & Balance Distribution
                  </h3>
                  <p className="text-xs text-stone-500">
                    Distribution of focus time across categories.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {weeklyData.categoryDistribution.map((cat) => {
                  const totalHrs = (cat.focusMinutes / 60).toFixed(1);
                  const totalWeekMins = weeklyData.totalFocusSeconds > 0 ? weeklyData.totalFocusSeconds / 60 : 1;
                  const pct = Math.round((cat.focusMinutes / totalWeekMins) * 100);

                  return (
                    <div key={cat.category} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-stone-800">{cat.category}</span>
                        <span className="text-stone-500 font-mono">
                          {totalHrs}h ({pct}%) • {cat.tasksCompleted}/{cat.tasksTotal} tasks
                        </span>
                      </div>
                      <div className="w-full bg-stone-100 rounded-full h-2.5 overflow-hidden">
                        <div
                          className="h-2.5 rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, Math.max(4, pct))}%`,
                            backgroundColor: cat.color,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 7-Day Top 3 Execution Matrix */}
              <div className="mt-6 pt-5 border-t border-stone-100">
                <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider mb-2.5">
                  Top 3 Execution Grid
                </h4>
                <div className="grid grid-cols-7 gap-1.5 text-center">
                  {weeklyData.dailyBreakdown.map((d) => {
                    const isPerfect = d.top3Completed === d.top3Total && d.top3Total > 0;
                    return (
                      <button
                        key={d.date}
                        onClick={() => {
                          onSelectDate(d.date);
                          setViewMode('daily');
                        }}
                        className={`p-2 rounded-lg border text-center transition-all ${
                          d.isToday
                            ? 'ring-2 ring-emerald-500/50 border-emerald-500 bg-emerald-50/50'
                            : 'border-stone-200 hover:bg-stone-50'
                        }`}
                        title={`${d.fullDateLabel}: ${d.top3Completed}/${d.top3Total} Top 3 items completed`}
                      >
                        <div className="text-[10px] font-bold text-stone-500">{d.dayName}</div>
                        <div
                          className={`text-xs font-bold mt-0.5 ${
                            isPerfect ? 'text-emerald-700' : 'text-stone-700'
                          }`}
                        >
                          {d.top3Completed}/{d.top3Total}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Weekly Review Deep Drilldown Modal */}
      <WeeklyReviewModal
        isOpen={isWeeklyReviewModalOpen}
        onClose={() => setIsWeeklyReviewModalOpen(false)}
        review={weeklyReview}
      />
    </div>
  );
};
