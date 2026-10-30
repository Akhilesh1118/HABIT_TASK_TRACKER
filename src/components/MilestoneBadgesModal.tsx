import React, { useState } from 'react';
import { Trophy, Award, Sparkles, Check, Lock, Star, Flame, Target, X, RefreshCw } from 'lucide-react';
import { MilestoneBadge, BadgeCategory } from '../types';
import { triggerConfetti, playCelebrationFanfare } from '../utils/celebration';

interface MilestoneBadgesModalProps {
  isOpen: boolean;
  onClose: () => void;
  badges: MilestoneBadge[];
  onTriggerBadgeCelebration?: (badge: MilestoneBadge) => void;
}

export const MilestoneBadgesModal: React.FC<MilestoneBadgesModalProps> = ({
  isOpen,
  onClose,
  badges,
  onTriggerBadgeCelebration,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<'all' | BadgeCategory>('all');

  if (!isOpen) return null;

  const unlockedCount = badges.filter((b) => b.unlocked).length;
  const totalCount = badges.length;
  const overallPercentage = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;

  const filteredBadges = selectedCategory === 'all' ? badges : badges.filter((b) => b.category === selectedCategory);

  const categories: Array<{ key: 'all' | BadgeCategory; label: string }> = [
    { key: 'all', label: 'All Badges' },
    { key: 'streak', label: 'Streaks' },
    { key: 'daily_target', label: 'Daily Targets' },
    { key: 'top3', label: 'Top 3 Focus' },
    { key: 'focus', label: 'Deep Work' },
    { key: 'revision', label: 'Spaced Memory' },
  ];

  const handleCelebrateBadge = (badge: MilestoneBadge) => {
    triggerConfetti(140, 3000);
    playCelebrationFanfare();
    if (onTriggerBadgeCelebration) {
      onTriggerBadgeCelebration(badge);
    }
  };

  const streakMasterBadge = badges.find((b) => b.id === 'streak_7_day');

  return (
    <div
      id="milestones-showcase-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-stone-950/70 backdrop-blur-sm animate-in fade-in duration-150 select-none overflow-y-auto"
      onClick={onClose}
    >
      <div
        id="milestones-showcase-modal"
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-2xl max-w-3xl w-full p-4 sm:p-7 space-y-5 animate-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-stone-100 dark:border-stone-800 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight">Milestones & Unlock Badges</h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Unlock achievements through consistent habits, deep focus, and daily target mastery.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-500 dark:text-stone-400 transition-colors cursor-pointer"
            title="Close showcase"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Featured Hero Banner: 7-Day Streak Master Spotlight */}
        {streakMasterBadge && (
          <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent dark:from-amber-500/15 dark:via-amber-500/5 border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
            <div className="flex items-center space-x-3.5">
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-md ${
                  streakMasterBadge.unlocked
                    ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-white ring-2 ring-amber-400/50'
                    : 'bg-stone-100 dark:bg-stone-800 text-stone-400 border border-stone-200 dark:border-stone-700'
                }`}
              >
                🔥
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-100/60 dark:bg-amber-950/60 px-2 py-0.5 rounded-full">
                    Featured Milestone
                  </span>
                  {streakMasterBadge.unlocked && (
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center space-x-1">
                      <Check className="w-3 h-3" />
                      <span>Unlocked</span>
                    </span>
                  )}
                </div>
                <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 mt-0.5">
                  7-Day Streak Master
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  {streakMasterBadge.unlocked
                    ? 'Earned +1 Streak Freeze Safeguard for unbreakable consistency.'
                    : 'Build momentum for 7 consecutive days to claim this badge & streak protection.'}
                </p>
              </div>
            </div>

            <div className="shrink-0 flex items-center space-x-2 w-full sm:w-auto justify-end">
              {streakMasterBadge.unlocked ? (
                <button
                  onClick={() => handleCelebrateBadge(streakMasterBadge)}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold transition-all shadow-sm flex items-center space-x-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Celebrate 🎊</span>
                </button>
              ) : (
                <div className="text-right">
                  <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400 block">
                    {streakMasterBadge.progressLabel}
                  </span>
                  <div className="w-28 h-1.5 bg-stone-200 dark:bg-stone-800 rounded-full overflow-hidden mt-1">
                    <div
                      className="h-full bg-amber-500 rounded-full"
                      style={{ width: `${streakMasterBadge.progressPercent}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Overall Progress & Categories Filter */}
        <div className="space-y-3 shrink-0">
          <div className="flex items-center justify-between text-xs">
            <span className="text-stone-500 dark:text-stone-400 font-medium">
              Collection Progress: <strong className="text-stone-900 dark:text-stone-100">{unlockedCount}</strong> of{' '}
              {totalCount} Badges ({overallPercentage}%)
            </span>
            <div className="w-36 h-2 bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${overallPercentage}%` }}
              />
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center space-x-1 overflow-x-auto pb-1 scrollbar-none">
            {categories.map((c) => (
              <button
                key={c.key}
                onClick={() => setSelectedCategory(c.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  selectedCategory === c.key
                    ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-950'
                    : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-750'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Badges Grid */}
        <div className="overflow-y-auto pr-1 flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 pb-2">
          {filteredBadges.map((badge) => {
            const isUnlocked = badge.unlocked;

            return (
              <div
                key={badge.id}
                className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between ${
                  isUnlocked
                    ? 'bg-stone-50/60 dark:bg-stone-850/60 border-stone-200 dark:border-stone-800 shadow-2xs'
                    : 'bg-stone-50/20 dark:bg-stone-900/40 border-stone-200/60 dark:border-stone-800/50 opacity-75'
                }`}
              >
                <div className="flex items-start space-x-3">
                  <div
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center text-2xl shrink-0 shadow-2xs ${
                      isUnlocked
                        ? 'bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700'
                        : 'bg-stone-100 dark:bg-stone-850 text-stone-400 border border-stone-200/60 dark:border-stone-800'
                    }`}
                  >
                    {badge.icon}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100 truncate">
                        {badge.title}
                      </h4>
                      {isUnlocked ? (
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100/60 dark:bg-emerald-950/60 px-1.5 py-0.2 rounded-md shrink-0">
                          Unlocked
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-stone-400 dark:text-stone-500 flex items-center space-x-0.5 shrink-0">
                          <Lock className="w-2.5 h-2.5" />
                          <span>Locked</span>
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5 line-clamp-2">
                      {badge.description}
                    </p>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-stone-100 dark:border-stone-800/80 flex items-center justify-between">
                  {isUnlocked ? (
                    <>
                      <span className="text-[10px] text-stone-400 font-mono">
                        {badge.rewardText || 'Milestone Achieved'}
                      </span>
                      <button
                        onClick={() => handleCelebrateBadge(badge)}
                        className="text-[10px] font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center space-x-1 cursor-pointer"
                      >
                        <Sparkles className="w-2.5 h-2.5" />
                        <span>Replay Celebration</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="text-[10px] font-mono text-stone-400 dark:text-stone-500">
                        {badge.progressLabel}
                      </span>
                      <div className="w-24 h-1.5 bg-stone-200 dark:bg-stone-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${badge.progressPercent}%` }}
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
