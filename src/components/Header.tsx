import React from 'react';
import {
  Flame,
  Calendar as CalendarIcon,
  CheckCircle2,
  ListPlus,
  RotateCcw,
  Timer,
  BarChart3,
  ListTodo,
  AlertTriangle,
  Snowflake,
  CalendarDays,
  Brain,
  LogOut,
} from 'lucide-react';
import { User, StreakStatusInfo } from '../types';

interface HeaderProps {
  user: User;
  currentStreak: number;
  streakStatus?: StreakStatusInfo;
  onOpenStreakProtection?: () => void;
  onOpenWeeklyReview?: () => void;
  onOpenAICoach?: () => void;
  activeTab?: 'schedule' | 'analytics';
  onSelectTab?: (tab: 'schedule' | 'analytics') => void;
  productivityScore?: number;
  onGoToToday: () => void;
  onOpenHabitManager: () => void;
  onOpenFocusMode?: () => void;
  isFocusActive?: boolean;
  focusTimeRemaining?: string;
  onOpenRevisionModal?: () => void;
  revisionsDueCount?: number;
  onResetData: () => void;
  onLogout?: () => void;
  userEmail?: string;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  currentStreak,
  streakStatus,
  onOpenStreakProtection,
  onOpenWeeklyReview,
  onOpenAICoach,
  activeTab = 'schedule',
  onSelectTab,
  productivityScore = 87,
  onGoToToday,
  onOpenHabitManager,
  onOpenFocusMode,
  isFocusActive,
  focusTimeRemaining,
  onOpenRevisionModal,
  revisionsDueCount,
  onResetData,
  onLogout,
  userEmail,
}) => {
  return (
    <header className="border-b border-stone-200 bg-white/80 backdrop-blur-md sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand & Identity + Main Tab Switcher */}
        <div className="flex items-center space-x-4 sm:space-x-6">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-stone-900 text-white flex items-center justify-center shadow-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-base sm:text-lg font-bold text-stone-900 tracking-tight leading-none">
                  Habit & Task Tracker
                </h1>
                <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-stone-100 text-stone-600 border border-stone-200">
                  CSE Prep
                </span>
              </div>
            </div>
          </div>

          {/* Core View Switcher Tabs */}
          {onSelectTab && (
            <div className="hidden sm:flex items-center p-1 bg-stone-100 rounded-lg text-xs font-semibold">
              <button
                id="nav-tab-schedule"
                onClick={() => onSelectTab('schedule')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md transition-all ${
                  activeTab === 'schedule'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <ListTodo className="w-3.5 h-3.5 text-stone-600" />
                <span>Daily Schedule</span>
              </button>
              <button
                id="nav-tab-analytics"
                onClick={() => onSelectTab('analytics')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md transition-all ${
                  activeTab === 'analytics'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Analytics</span>
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  {productivityScore}%
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Action Controls & Badges */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Mobile Tab Toggle Button */}
          {onSelectTab && (
            <button
              id="mobile-nav-analytics-btn"
              onClick={() => onSelectTab(activeTab === 'schedule' ? 'analytics' : 'schedule')}
              className="sm:hidden flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-stone-100 text-stone-800"
            >
              <BarChart3 className="w-3.5 h-3.5 text-emerald-600" />
              <span>{activeTab === 'schedule' ? 'Score' : 'Tasks'}</span>
            </button>
          )}

          {/* Streak Badge */}
          <button
            id="streak-badge"
            onClick={onOpenStreakProtection}
            className={`flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold shadow-xs transition-all cursor-pointer hover:shadow-md ${
              streakStatus?.isAtRisk
                ? 'bg-amber-100 text-amber-950 border border-amber-300 ring-2 ring-amber-400/30 animate-pulse'
                : streakStatus?.isTodayFrozen
                ? 'bg-sky-100 text-sky-950 border border-sky-300 ring-1 ring-sky-400/30'
                : 'bg-orange-50 border border-orange-200 text-orange-800 hover:bg-orange-100'
            }`}
            title="Streak Protection & Recovery — Click to inspect and manage"
          >
            {streakStatus?.isAtRisk ? (
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            ) : streakStatus?.isTodayFrozen ? (
              <Snowflake className="w-3.5 h-3.5 text-sky-600" />
            ) : (
              <Flame className="w-4 h-4 text-orange-500 fill-orange-500 animate-pulse" />
            )}
            <span>{currentStreak}d</span>
            {streakStatus?.isAtRisk && (
              <span className="hidden lg:inline text-[10px] font-bold text-amber-700 bg-amber-200/80 px-1 rounded">
                At Risk
              </span>
            )}
            {streakStatus?.isTodayFrozen && (
              <span className="hidden lg:inline text-[10px] font-bold text-sky-700 bg-sky-200/80 px-1 rounded">
                Frozen
              </span>
            )}
          </button>

          {/* Jump to Today Button */}
          <button
            id="jump-today-btn"
            onClick={onGoToToday}
            className="hidden md:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 transition-colors"
          >
            <CalendarIcon className="w-3.5 h-3.5 text-stone-500" />
            <span>Today</span>
          </button>

          {/* Weekly Review Quick Button */}
          {onOpenWeeklyReview && (
            <button
              id="header-weekly-review-btn"
              onClick={onOpenWeeklyReview}
              className="flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-950 border border-indigo-200/80 transition-colors shadow-2xs"
              title="Open Weekly Productivity Review & insights"
            >
              <CalendarDays className="w-3.5 h-3.5 text-indigo-600" />
              <span className="hidden sm:inline">Weekly Review</span>
              <span className="sm:hidden">Review</span>
            </button>
          )}

          {/* AI Productivity Coach Button */}
          {onOpenAICoach && (
            <button
              id="header-ai-coach-btn"
              onClick={onOpenAICoach}
              className="flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold bg-gradient-to-r from-purple-50 to-indigo-50 hover:from-purple-100 hover:to-indigo-100 text-indigo-950 border border-purple-200/90 transition-all shadow-2xs cursor-pointer"
              title="Open AI Productivity Coach (Weekly analysis, strongest performance period & recommendations)"
            >
              <Brain className="w-3.5 h-3.5 text-purple-600" />
              <span className="hidden sm:inline">AI Coach</span>
              <span className="sm:hidden">AI</span>
            </button>
          )}

          {/* Focus Mode Button */}
          {onOpenFocusMode && (
            <button
              id="focus-mode-nav-btn"
              onClick={onOpenFocusMode}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all shadow-xs ${
                isFocusActive
                  ? 'bg-stone-900 text-emerald-400 border border-emerald-500/50 ring-2 ring-emerald-500/20'
                  : 'bg-stone-900 hover:bg-stone-800 text-white'
              }`}
              title="Open Distraction-Free Focus Mode & Timer"
            >
              <Timer className={`w-4 h-4 text-emerald-400 ${isFocusActive ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">
                {isFocusActive && focusTimeRemaining ? `Focus: ${focusTimeRemaining}` : 'Focus'}
              </span>
              <span className="sm:hidden">
                {isFocusActive && focusTimeRemaining ? focusTimeRemaining : 'Timer'}
              </span>
              {isFocusActive && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </button>
          )}

          {/* Spaced Revision System Button */}
          {onOpenRevisionModal && (
            <button
              id="spaced-revision-nav-btn"
              onClick={onOpenRevisionModal}
              className="flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 transition-colors shadow-2xs"
              title="Open Spaced Revision System (Day 0, 1, 3, 7, 14, 30)"
            >
              <span className="text-sm">🧠</span>
              <span className="hidden sm:inline">Revisions</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-purple-200 text-purple-900">
                {revisionsDueCount !== undefined ? revisionsDueCount : 12}
              </span>
            </button>
          )}

          {/* Habits Manager Button */}
          <button
            id="manage-habits-btn"
            onClick={onOpenHabitManager}
            className="hidden lg:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium bg-stone-100 hover:bg-stone-200 text-stone-800 transition-colors"
          >
            <ListPlus className="w-4 h-4 text-emerald-600" />
            <span>Habits</span>
          </button>

          {/* Reset Demo Data Button */}
          <button
            id="reset-demo-btn"
            onClick={onResetData}
            title="Reset to initial sample schedule"
            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Single-User Personal Account / Logout */}
          {onLogout && (
            <div className="flex items-center gap-2 pl-1 border-l border-stone-200">
              {userEmail && (
                <span className="hidden xl:inline-block text-xs text-stone-500 font-medium max-w-[140px] truncate" title={userEmail}>
                  {userEmail}
                </span>
              )}
              <button
                id="logout-btn"
                onClick={onLogout}
                title="Sign out of personal account"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-stone-100 hover:bg-rose-50 hover:text-rose-700 text-stone-700 border border-stone-200 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
