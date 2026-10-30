import { MilestoneBadge, BadgeTier, BadgeCategory } from '../types';

export interface MilestoneEvaluationContext {
  currentStreak: number;
  longestStreak: number;
  completedTasksToday: number;
  totalTasksToday: number;
  top3CompletedCount: number;
  top3TotalCount: number;
  targetHours: number;
  actualFocusMinutesToday: number;
  isStudyTargetAchieved: boolean;
  revisionsCompletedCount?: number;
  hasLongFocusSession?: boolean;
}

const STORAGE_KEY = 'user_milestone_badges_v1';

// Base badge definitions
const BADGE_DEFINITIONS: Array<{
  id: string;
  title: string;
  description: string;
  icon: string;
  category: BadgeCategory;
  tier: BadgeTier;
  targetValue: number;
  rewardText?: string;
  evaluate: (ctx: MilestoneEvaluationContext) => { currentValue: number; unlocked: boolean; progressLabel: string };
}> = [
  {
    id: 'streak_3_day',
    title: '3-Day Momentum',
    description: 'Achieved a 3-day continuous habit & task consistency streak.',
    icon: '⚡',
    category: 'streak',
    tier: 'bronze',
    targetValue: 3,
    rewardText: 'Unlocked habit momentum multiplier',
    evaluate: (ctx) => {
      const best = Math.max(ctx.currentStreak, ctx.longestStreak);
      const val = Math.min(3, best);
      return {
        currentValue: val,
        unlocked: best >= 3,
        progressLabel: `${val} / 3 Days`,
      };
    },
  },
  {
    id: 'streak_7_day',
    title: '7-Day Streak Master',
    description: 'Maintained an unbroken 7-day consistency streak without skipping a beat.',
    icon: '🔥',
    category: 'streak',
    tier: 'gold',
    targetValue: 7,
    rewardText: 'Earned +1 Streak Freeze Safeguard',
    evaluate: (ctx) => {
      const best = Math.max(ctx.currentStreak, ctx.longestStreak);
      const val = Math.min(7, best);
      return {
        currentValue: val,
        unlocked: best >= 7,
        progressLabel: `${val} / 7 Days`,
      };
    },
  },
  {
    id: 'streak_14_day',
    title: 'Consistency Titan (14-Day Streak)',
    description: 'Phenomenal 14-day unbreakable dedication to daily syllabus mastery.',
    icon: '👑',
    category: 'streak',
    tier: 'platinum',
    targetValue: 14,
    rewardText: 'VIP Consistency Badge & Profile Seal',
    evaluate: (ctx) => {
      const best = Math.max(ctx.currentStreak, ctx.longestStreak);
      const val = Math.min(14, best);
      return {
        currentValue: val,
        unlocked: best >= 14,
        progressLabel: `${val} / 14 Days`,
      };
    },
  },
  {
    id: 'daily_target_crusher',
    title: 'Daily Target Crusher',
    description: 'Hit 100% completion of your daily target tasks and study goals today.',
    icon: '🎯',
    category: 'daily_target',
    tier: 'gold',
    targetValue: 100,
    rewardText: '+25 Productivity Index Bonus',
    evaluate: (ctx) => {
      const taskDone = ctx.totalTasksToday > 0 && ctx.completedTasksToday === ctx.totalTasksToday && ctx.completedTasksToday >= 2;
      const targetDone = ctx.isStudyTargetAchieved;
      const isComplete = taskDone || (targetDone && ctx.completedTasksToday >= 1);
      const pct = ctx.totalTasksToday > 0 ? Math.round((ctx.completedTasksToday / ctx.totalTasksToday) * 100) : 0;
      return {
        currentValue: isComplete ? 100 : pct,
        unlocked: isComplete,
        progressLabel: isComplete ? '100% Completed' : `${pct}% Completed`,
      };
    },
  },
  {
    id: 'top_3_conqueror',
    title: 'Top 3 Conqueror',
    description: 'Conquered all 3 high-impact daily priorities in a single day.',
    icon: '⭐',
    category: 'top3',
    tier: 'silver',
    targetValue: 3,
    rewardText: 'Master of High-Impact Focus',
    evaluate: (ctx) => {
      const count = Math.min(3, ctx.top3CompletedCount);
      const unlocked = ctx.top3TotalCount >= 2 && ctx.top3CompletedCount >= ctx.top3TotalCount;
      return {
        currentValue: count,
        unlocked: unlocked || ctx.top3CompletedCount >= 3,
        progressLabel: `${count} / 3 Priorities`,
      };
    },
  },
  {
    id: 'centurion_focus',
    title: 'Centurion of Focus',
    description: 'Logged 100+ minutes of deep work focus sessions in a single day.',
    icon: '⏱️',
    category: 'focus',
    tier: 'silver',
    targetValue: 100,
    rewardText: 'Deep Work Endurance Title',
    evaluate: (ctx) => {
      const mins = Math.min(100, ctx.actualFocusMinutesToday);
      return {
        currentValue: mins,
        unlocked: ctx.actualFocusMinutesToday >= 100,
        progressLabel: `${mins} / 100 Mins`,
      };
    },
  },
  {
    id: 'deep_work_master',
    title: 'Deep Work Master',
    description: 'Successfully completed an uninterrupted 50+ minute deep focus block.',
    icon: '🧘',
    category: 'focus',
    tier: 'gold',
    targetValue: 50,
    rewardText: 'Zen Flow Champion',
    evaluate: (ctx) => {
      const unlocked = !!ctx.hasLongFocusSession || ctx.actualFocusMinutesToday >= 50;
      return {
        currentValue: unlocked ? 50 : Math.min(50, ctx.actualFocusMinutesToday),
        unlocked,
        progressLabel: unlocked ? '50+ Min Completed' : `${Math.min(50, ctx.actualFocusMinutesToday)} / 50 Mins`,
      };
    },
  },
  {
    id: 'spaced_revision_scholar',
    title: 'Spaced Revision Scholar',
    description: 'Reviewed and retained critical subjects using the Spaced Repetition engine.',
    icon: '🧠',
    category: 'revision',
    tier: 'silver',
    targetValue: 3,
    rewardText: 'Active Memory Retention Master',
    evaluate: (ctx) => {
      const revs = Math.min(3, ctx.revisionsCompletedCount || 0);
      return {
        currentValue: revs,
        unlocked: revs >= 3,
        progressLabel: `${revs} / 3 Revisions`,
      };
    },
  },
];

interface StoredBadgeState {
  id: string;
  unlocked: boolean;
  unlockedAt: string | null;
  hasCelebrated: boolean;
}

class MilestoneService {
  private getStoredStates(): Record<string, StoredBadgeState> {
    if (typeof window === 'undefined') return {};
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  private saveStoredStates(states: Record<string, StoredBadgeState>): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(states));
    } catch {
      // Storage error handled
    }
  }

  /**
   * Evaluate all badges against current user activity and detect any newly unlocked badges.
   */
  public evaluateMilestones(context: MilestoneEvaluationContext): {
    newlyUnlocked: MilestoneBadge[];
    allBadges: MilestoneBadge[];
  } {
    const stored = this.getStoredStates();
    const updatedStored: Record<string, StoredBadgeState> = { ...stored };
    const newlyUnlocked: MilestoneBadge[] = [];

    const allBadges: MilestoneBadge[] = BADGE_DEFINITIONS.map((def) => {
      const evalResult = def.evaluate(context);
      const prev = stored[def.id];

      const isNowUnlocked = Boolean(prev?.unlocked || evalResult.unlocked);
      const isNewlyUnlocked = isNowUnlocked && !prev?.unlocked;

      let unlockedAt = prev?.unlockedAt || null;
      if (isNewlyUnlocked) {
        unlockedAt = new Date().toISOString();
      }

      const hasCelebrated = prev ? prev.hasCelebrated : false;

      updatedStored[def.id] = {
        id: def.id,
        unlocked: isNowUnlocked,
        unlockedAt,
        hasCelebrated,
      };

      const progressPercent = Math.min(
        100,
        Math.round((evalResult.currentValue / def.targetValue) * 100)
      );

      const badgeObj: MilestoneBadge = {
        id: def.id,
        title: def.title,
        description: def.description,
        icon: def.icon,
        category: def.category,
        tier: def.tier,
        targetValue: def.targetValue,
        currentValue: evalResult.currentValue,
        unlocked: isNowUnlocked,
        unlockedAt,
        hasCelebrated,
        rewardText: def.rewardText,
        progressPercent: isNowUnlocked ? 100 : progressPercent,
        progressLabel: isNowUnlocked ? 'Unlocked' : evalResult.progressLabel,
      };

      if (isNewlyUnlocked || (isNowUnlocked && !hasCelebrated)) {
        newlyUnlocked.push(badgeObj);
      }

      return badgeObj;
    });

    this.saveStoredStates(updatedStored);

    return {
      newlyUnlocked,
      allBadges,
    };
  }

  /**
   * Retrieve all badges in their current persisted state.
   */
  public getAllBadges(): MilestoneBadge[] {
    const stored = this.getStoredStates();

    return BADGE_DEFINITIONS.map((def) => {
      const prev = stored[def.id];
      const isUnlocked = Boolean(prev?.unlocked);
      return {
        id: def.id,
        title: def.title,
        description: def.description,
        icon: def.icon,
        category: def.category,
        tier: def.tier,
        targetValue: def.targetValue,
        currentValue: isUnlocked ? def.targetValue : 0,
        unlocked: isUnlocked,
        unlockedAt: prev?.unlockedAt || null,
        hasCelebrated: prev?.hasCelebrated || false,
        rewardText: def.rewardText,
        progressPercent: isUnlocked ? 100 : 0,
        progressLabel: isUnlocked ? 'Unlocked' : `0 / ${def.targetValue}`,
      };
    });
  }

  /**
   * Mark celebration as seen so the modal doesn't pop up repeatedly for the same badge.
   */
  public markCelebrationSeen(badgeId: string): void {
    const stored = this.getStoredStates();
    if (stored[badgeId]) {
      stored[badgeId].hasCelebrated = true;
      this.saveStoredStates(stored);
    }
  }

  /**
   * Reset badges (e.g., during testing or clear data)
   */
  public resetMilestones(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEY);
  }
}

export const milestoneService = new MilestoneService();
