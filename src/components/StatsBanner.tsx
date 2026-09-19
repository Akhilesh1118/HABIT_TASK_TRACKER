import React from 'react';
import { Flame, Trophy, CheckCircle, Calendar, Target, Award, Timer, TrendingUp, AlertTriangle, Snowflake } from 'lucide-react';
import { ProductivityStats } from '../types';

interface StatsBannerProps {
  stats: ProductivityStats;
  focusMinutesToday?: number;
  productivityScore?: number;
  productivityGrade?: string;
  onOpenFocus?: () => void;
  onOpenAnalytics?: () => void;
  onOpenStreakModal?: () => void;
  onOpenWeeklyReview?: () => void;
}

export const StatsBanner: React.FC<StatsBannerProps> = ({
  stats,
  focusMinutesToday = 0,
  productivityScore = 87,
  productivityGrade = 'A',
  onOpenFocus,
  onOpenAnalytics,
  onOpenStreakModal,
  onOpenWeeklyReview,
}) => {
  const isAtRisk = stats.streakStatus?.isAtRisk;
  const isFrozen = stats.streakStatus?.isTodayFrozen;
  const availableFreezes = stats.streakStatus?.availableFreezes ?? 1;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2.5 sm:gap-4 mb-5 sm:mb-8">
      {/* Productivity Score */}
      <div
        id="stat-productivity-score"
        onClick={onOpenAnalytics}
        className={`bg-white rounded-2xl p-3 sm:p-4 lg:p-5 border shadow-xs flex flex-col justify-between transition-colors min-h-[96px] sm:min-h-[108px] ${
          onOpenAnalytics ? 'hover:border-emerald-500 hover:bg-emerald-50/20 cursor-pointer' : 'border-stone-200/80'
        }`}
        title="Click to view Transparent Productivity Score & Analytics Dashboard"
      >
        <div className="flex items-center justify-between text-stone-500 mb-1">
          <span className="text-[11px] sm:text-xs lg:text-[13px] font-bold uppercase tracking-wider text-emerald-800 truncate">Productivity</span>
          <TrendingUp className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-emerald-600 shrink-0" />
        </div>
        <div className="flex items-baseline space-x-1.5 sm:space-x-2">
          <span className="text-xl sm:text-2xl lg:text-3xl font-black text-stone-900 tracking-tight">{productivityScore}%</span>
          <span className="text-[10px] sm:text-xs font-bold text-emerald-700 bg-emerald-100/70 px-1.5 sm:px-2 py-0.5 rounded">
            {productivityGrade}
          </span>
        </div>
      </div>

      {/* Focus Time Today */}
      <div
        id="stat-focus-time"
        onClick={onOpenFocus}
        className={`bg-white rounded-2xl p-3 sm:p-4 lg:p-5 border shadow-xs flex flex-col justify-between transition-colors min-h-[96px] sm:min-h-[108px] ${
          onOpenFocus ? 'hover:border-emerald-400 hover:bg-emerald-50/20 cursor-pointer' : 'border-stone-200/80'
        }`}
        title="Click to launch Focus Mode & Timer"
      >
        <div className="flex items-center justify-between text-stone-500 mb-1">
          <span className="text-[11px] sm:text-xs lg:text-[13px] font-bold uppercase tracking-wider text-emerald-800 truncate">Focus Today</span>
          <Timer className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-emerald-600 shrink-0" />
        </div>
        <div className="flex items-baseline space-x-1 sm:space-x-1.5">
          <span className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-stone-900 tracking-tight">
            {focusMinutesToday >= 60
              ? `${Math.floor(focusMinutesToday / 60)}h ${focusMinutesToday % 60}m`
              : `${focusMinutesToday}m`}
          </span>
          <span className="text-[11px] sm:text-xs text-stone-500 font-medium">logged</span>
        </div>
      </div>

      {/* Current Streak */}
      <div
        id="stat-current-streak"
        onClick={onOpenStreakModal}
        className={`rounded-2xl p-3 sm:p-4 lg:p-5 border shadow-xs flex flex-col justify-between transition-all cursor-pointer group hover:shadow-md min-h-[96px] sm:min-h-[108px] ${
          isAtRisk
            ? 'bg-amber-50/70 border-amber-300 ring-1 ring-amber-400/40'
            : isFrozen
            ? 'bg-sky-50/70 border-sky-300 ring-1 ring-sky-400/40'
            : 'bg-white border-stone-200/80 hover:border-orange-200'
        }`}
        title="Click to manage Streak Protection & Recovery"
      >
        <div className="flex items-center justify-between text-stone-500 mb-1">
          <span className="text-[11px] sm:text-xs lg:text-[13px] font-bold uppercase tracking-wider group-hover:text-stone-900 transition-colors truncate">
            Streak
          </span>
          <div className="flex items-center space-x-1 shrink-0">
            {isAtRisk && <AlertTriangle className="w-3.5 h-3.5 text-amber-600 animate-pulse" />}
            {isFrozen && <Snowflake className="w-3.5 h-3.5 text-sky-600" />}
            <Flame
              className={`w-4 h-4 sm:w-4.5 sm:h-4.5 transition-transform group-hover:scale-110 ${
                isAtRisk
                  ? 'text-amber-600 fill-amber-500'
                  : 'text-orange-500 fill-orange-500'
              }`}
            />
          </div>
        </div>
        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline space-x-1 sm:space-x-1.5">
            <span className={`text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight ${isAtRisk ? 'text-amber-950' : isFrozen ? 'text-sky-950' : 'text-stone-900'}`}>
              {stats.currentStreak}
            </span>
            <span className="text-[11px] sm:text-xs text-stone-500 font-medium">days</span>
          </div>
          <span className="text-[10px] sm:text-[11px] font-semibold text-stone-400 group-hover:text-stone-700 transition-colors">
            🛡️ {availableFreezes}
          </span>
        </div>
        {isAtRisk && (
          <div className="mt-1 text-[10px] sm:text-[11px] font-bold text-amber-800 flex items-center space-x-1">
            <span>⚠️ At risk</span>
          </div>
        )}
        {isFrozen && (
          <div className="mt-1 text-[10px] sm:text-[11px] font-bold text-sky-800 flex items-center space-x-1">
            <span>❄️ Protected</span>
          </div>
        )}
      </div>

      {/* Completed Today */}
      <div
        id="stat-completed-today"
        className="bg-white rounded-2xl p-3 sm:p-4 lg:p-5 border border-stone-200/80 shadow-xs flex flex-col justify-between min-h-[96px] sm:min-h-[108px]"
      >
        <div className="flex items-center justify-between text-stone-500 mb-1">
          <span className="text-[11px] sm:text-xs lg:text-[13px] font-bold uppercase tracking-wider truncate">Done Today</span>
          <CheckCircle className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-emerald-600 shrink-0" />
        </div>
        <div className="flex items-baseline space-x-1 sm:space-x-1.5">
          <span className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-stone-900 tracking-tight">{stats.completedToday}</span>
          <span className="text-[11px] sm:text-xs text-stone-500 font-medium">items</span>
        </div>
      </div>

      {/* Completed This Week / Weekly Review */}
      <div
        id="stat-completed-week"
        onClick={onOpenWeeklyReview}
        className={`bg-white rounded-2xl p-3 sm:p-4 lg:p-5 border shadow-xs flex flex-col justify-between transition-colors min-h-[96px] sm:min-h-[108px] ${
          onOpenWeeklyReview ? 'hover:border-indigo-500 hover:bg-indigo-50/20 cursor-pointer' : 'border-stone-200/80'
        }`}
        title="Click to open Weekly Productivity Review"
      >
        <div className="flex items-center justify-between text-stone-500 mb-1">
          <span className="text-[11px] sm:text-xs lg:text-[13px] font-bold uppercase tracking-wider text-indigo-900 truncate">This Week</span>
          <Calendar className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-indigo-600 shrink-0" />
        </div>
        <div className="flex items-baseline space-x-1 sm:space-x-1.5">
          <span className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-stone-900 tracking-tight">{stats.completedThisWeek}</span>
          <span className="text-[11px] sm:text-xs text-stone-500 font-medium">items</span>
        </div>
      </div>

      {/* Longest Streak */}
      <div
        id="stat-longest-streak"
        className="bg-white rounded-2xl p-3 sm:p-4 lg:p-5 border border-stone-200/80 shadow-xs flex flex-col justify-between min-h-[96px] sm:min-h-[108px]"
      >
        <div className="flex items-center justify-between text-stone-500 mb-1">
          <span className="text-[11px] sm:text-xs lg:text-[13px] font-bold uppercase tracking-wider truncate">Longest Streak</span>
          <Trophy className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-amber-500 shrink-0" />
        </div>
        <div className="flex items-baseline space-x-1 sm:space-x-1.5">
          <span className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-stone-900 tracking-tight">{stats.longestStreak}</span>
          <span className="text-[11px] sm:text-xs text-stone-500 font-medium">days</span>
        </div>
      </div>

      {/* Most Consistent Habit */}
      <div
        id="stat-top-habit"
        className="bg-white rounded-2xl p-3 sm:p-4 lg:p-5 border border-stone-200/80 shadow-xs flex flex-col justify-between col-span-2 sm:col-span-1 lg:col-span-1 min-h-[96px] sm:min-h-[108px]"
      >
        <div className="flex items-center justify-between text-stone-500 mb-1">
          <span className="text-[11px] sm:text-xs lg:text-[13px] font-bold uppercase tracking-wider truncate">Top Habit</span>
          <Award className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-purple-500 shrink-0" />
        </div>
        {stats.mostConsistentHabit ? (
          <div className="truncate">
            <p className="text-xs sm:text-sm font-bold text-stone-800 truncate" title={stats.mostConsistentHabit.name}>
              {stats.mostConsistentHabit.name}
            </p>
            <p className="text-[10px] sm:text-xs text-emerald-600 font-medium mt-0.5 truncate">
              {stats.mostConsistentHabit.completionCount} completions
            </p>
          </div>
        ) : (
          <span className="text-xs text-stone-400">Tracking started</span>
        )}
      </div>
    </div>
  );
};
