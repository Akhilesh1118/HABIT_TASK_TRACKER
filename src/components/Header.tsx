import React, { useState, useRef, useEffect } from 'react';
import {
  Flame,
  Calendar as CalendarIcon,
  CheckCircle2,
  ListPlus,
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
import { AppLogo } from './AppLogo';

interface HeaderProps {
  user: User;
  authUser?: { email: string; userId: string; name?: string; role?: string } | null;
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
  onResetData?: () => void;
  onLogout?: () => void;
  userEmail?: string;
}

function getInitials(name?: string, email?: string): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    if (parts.length === 1 && parts[0].length > 0) {
      return parts[0][0].toUpperCase();
    }
  }
  if (email && email.trim()) {
    return email.trim()[0].toUpperCase();
  }
  return 'U';
}

export const Header: React.FC<HeaderProps> = ({
  user,
  authUser,
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
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const displayEmail = authUser?.email || userEmail || user.email || 'user@example.com';
  const displayName = authUser?.name || user.name || displayEmail.split('@')[0] || 'User';
  const initials = getInitials(displayName, displayEmail);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsProfileOpen(false);
      }
    }

    if (isProfileOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isProfileOpen]);

  const handleLogoClick = () => {
    if (onSelectTab && activeTab !== 'schedule') {
      onSelectTab('schedule');
    }
    onGoToToday();
  };

  return (
    <header className="border-b border-stone-200 bg-white/80 backdrop-blur-md sticky top-0 z-30">
      <div className="max-w-7xl 2xl:max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8 h-18 sm:h-20 flex items-center justify-between gap-4">
        {/* Brand & Identity + Main Tab Switcher */}
        <div className="flex items-center gap-3 sm:gap-6 flex-shrink-0 min-w-0">
          <button
            id="app-home-logo-btn"
            type="button"
            onClick={handleLogoClick}
            aria-label="Habit & Task Tracker - Go to Home and Today"
            title="Go to Today's Dashboard"
            className="group flex items-center gap-2.5 sm:gap-3 text-left p-1 rounded-xl hover:bg-stone-100/80 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:ring-offset-2 transition-all cursor-pointer select-none flex-shrink-0"
          >
            {/* Simple Clean Productivity Brand Logo */}
            <AppLogo size={42} />

            <div className="flex flex-col text-left leading-none flex-shrink-0">
              <span className="text-[14px] sm:text-[16px] font-extrabold text-stone-900 tracking-tight leading-tight group-hover:text-stone-950 transition-colors whitespace-nowrap">
                Habit &amp;
              </span>
              <span className="text-[14px] sm:text-[16px] font-extrabold text-stone-900 tracking-tight leading-tight group-hover:text-stone-950 transition-colors whitespace-nowrap">
                Task Tracker
              </span>
              <span className="text-[8px] sm:text-[9px] font-semibold text-stone-400 tracking-[0.16em] uppercase mt-0.5 leading-none group-hover:text-stone-600 transition-colors whitespace-nowrap">
                PLAN • FOCUS • GROW
              </span>
            </div>
          </button>

          {/* Core View Switcher Tabs */}
          {onSelectTab && (
            <div className="hidden sm:flex items-center p-1 bg-stone-100 rounded-xl text-xs sm:text-sm font-semibold flex-shrink-0">
              <button
                id="nav-tab-schedule"
                onClick={() => onSelectTab('schedule')}
                className={`flex items-center space-x-2 px-3.5 sm:px-4 py-2 rounded-lg transition-all ${
                  activeTab === 'schedule'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <ListTodo className="w-4 h-4 text-stone-600" />
                <span>Daily Schedule</span>
              </button>
              <button
                id="nav-tab-analytics"
                onClick={() => onSelectTab('analytics')}
                className={`flex items-center space-x-2 px-3.5 sm:px-4 py-2 rounded-lg transition-all ${
                  activeTab === 'analytics'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <BarChart3 className="w-4 h-4 text-emerald-600" />
                <span>Analytics</span>
                <span className="ml-1.5 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                  {productivityScore}%
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Action Controls & Badges */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          {/* Mobile Tab Toggle Button */}
          {onSelectTab && (
            <button
              id="mobile-nav-analytics-btn"
              onClick={() => onSelectTab(activeTab === 'schedule' ? 'analytics' : 'schedule')}
              className="sm:hidden flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-stone-100 text-stone-800"
            >
              <BarChart3 className="w-4 h-4 text-emerald-600" />
              <span>{activeTab === 'schedule' ? 'Score' : 'Tasks'}</span>
            </button>
          )}

          {/* Streak Badge */}
          <button
            id="streak-badge"
            onClick={onOpenStreakProtection}
            className={`flex items-center space-x-2 px-3 sm:px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-all cursor-pointer hover:shadow-md ${
              streakStatus?.isAtRisk
                ? 'bg-amber-100 text-amber-950 border border-amber-300 ring-2 ring-amber-400/30 animate-pulse'
                : streakStatus?.isTodayFrozen
                ? 'bg-sky-100 text-sky-950 border border-sky-300 ring-1 ring-sky-400/30'
                : 'bg-orange-50 border border-orange-200 text-orange-800 hover:bg-orange-100'
            }`}
            title="Streak Protection & Recovery — Click to inspect and manage"
          >
            {streakStatus?.isAtRisk ? (
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            ) : streakStatus?.isTodayFrozen ? (
              <Snowflake className="w-4 h-4 text-sky-600" />
            ) : (
              <Flame className="w-4.5 h-4.5 text-orange-500 fill-orange-500 animate-pulse" />
            )}
            <span>{currentStreak}d</span>
            {streakStatus?.isAtRisk && (
              <span className="hidden lg:inline text-[11px] font-bold text-amber-700 bg-amber-200/80 px-1.5 py-0.5 rounded">
                At Risk
              </span>
            )}
            {streakStatus?.isTodayFrozen && (
              <span className="hidden lg:inline text-[11px] font-bold text-sky-700 bg-sky-200/80 px-1.5 py-0.5 rounded">
                Frozen
              </span>
            )}
          </button>

          {/* Jump to Today Button */}
          <button
            id="jump-today-btn"
            onClick={onGoToToday}
            className="hidden md:flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 transition-colors"
          >
            <CalendarIcon className="w-4 h-4 text-stone-500" />
            <span>Today</span>
          </button>

          {/* Weekly Review Quick Button */}
          {onOpenWeeklyReview && (
            <button
              id="header-weekly-review-btn"
              onClick={onOpenWeeklyReview}
              className="flex items-center space-x-2 px-3 sm:px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-950 border border-indigo-200/80 transition-colors shadow-2xs"
              title="Open Weekly Productivity Review & insights"
            >
              <CalendarDays className="w-4 h-4 text-indigo-600" />
              <span className="hidden sm:inline">Weekly Review</span>
              <span className="sm:hidden">Review</span>
            </button>
          )}

          {/* AI Productivity Coach Button */}
          {onOpenAICoach && (
            <button
              id="header-ai-coach-btn"
              onClick={onOpenAICoach}
              className="flex items-center space-x-2 px-3 sm:px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-gradient-to-r from-purple-50 to-indigo-50 hover:from-purple-100 hover:to-indigo-100 text-indigo-950 border border-purple-200/90 transition-all shadow-2xs cursor-pointer"
              title="Open AI Productivity Coach (Weekly analysis, strongest performance period & recommendations)"
            >
              <Brain className="w-4 h-4 text-purple-600" />
              <span className="hidden sm:inline">AI Coach</span>
              <span className="sm:hidden">AI</span>
            </button>
          )}

          {/* Focus Mode Button */}
          {onOpenFocusMode && (
            <button
              id="focus-mode-nav-btn"
              onClick={onOpenFocusMode}
              className={`flex items-center space-x-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-xs ${
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
              className="flex items-center space-x-2 px-3 sm:px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 transition-colors shadow-2xs"
              title="Open Spaced Revision System (Day 0, 1, 3, 7, 14, 30)"
            >
              <span className="text-base">🧠</span>
              <span className="hidden sm:inline">Revisions</span>
              <span className="px-1.5 py-0.2 rounded-full text-xs font-bold bg-purple-200 text-purple-900">
                {revisionsDueCount !== undefined ? revisionsDueCount : 12}
              </span>
            </button>
          )}

          {/* Habits Manager Button */}
          <button
            id="manage-habits-btn"
            onClick={onOpenHabitManager}
            className="hidden lg:flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-stone-100 hover:bg-stone-200 text-stone-800 transition-colors"
          >
            <ListPlus className="w-4 h-4 text-emerald-600" />
            <span>Habits</span>
          </button>

          {/* User Profile Avatar & Dropdown */}
          {onLogout && (
            <div className="relative pl-1 border-l border-stone-200" ref={dropdownRef}>
              <button
                id="user-profile-menu-btn"
                type="button"
                onClick={() => setIsProfileOpen((prev) => !prev)}
                aria-label={`User profile for ${displayName}`}
                aria-haspopup="true"
                aria-expanded={isProfileOpen}
                title={displayName}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-stone-900 hover:bg-stone-800 text-white font-bold text-sm flex items-center justify-center shadow-xs ring-1 ring-stone-900/10 hover:ring-2 hover:ring-emerald-500/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 transition-all cursor-pointer select-none flex-shrink-0"
              >
                {initials}
              </button>

              {/* Profile Dropdown Popover */}
              {isProfileOpen && (
                <div
                  id="user-profile-popover"
                  role="dialog"
                  aria-label="User Profile Details"
                  className="absolute right-0 mt-2 w-64 bg-white border border-stone-200 shadow-xl rounded-2xl p-3.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                >
                  {/* Top Header with Avatar, Name, Email */}
                  <div className="flex items-center gap-3 pb-3 border-b border-stone-100">
                    <div className="w-10 h-10 rounded-full bg-stone-900 text-white font-bold text-sm flex items-center justify-center ring-4 ring-stone-100 flex-shrink-0">
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-bold text-stone-900 truncate" title={displayName}>
                        {displayName}
                      </h3>
                      <p className="text-xs text-stone-500 truncate" title={displayEmail}>
                        {displayEmail}
                      </p>
                    </div>
                  </div>

                  {/* Actions / Logout */}
                  <div className="pt-2.5">
                    <button
                      id="logout-btn"
                      type="button"
                      onClick={() => {
                        setIsProfileOpen(false);
                        onLogout();
                      }}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-stone-50 hover:bg-rose-50 text-stone-700 hover:text-rose-700 border border-stone-200 hover:border-rose-200 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Logout</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
