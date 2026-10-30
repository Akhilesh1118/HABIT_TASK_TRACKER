import React, { useEffect } from 'react';
import { Trophy, Sparkles, Star, Award, CheckCircle2, ArrowRight, X } from 'lucide-react';
import { MilestoneBadge } from '../types';
import { triggerConfetti, playCelebrationFanfare } from '../utils/celebration';

interface CelebrationMomentModalProps {
  badge: MilestoneBadge | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenBadgesShowcase?: () => void;
}

export const CelebrationMomentModal: React.FC<CelebrationMomentModalProps> = ({
  badge,
  isOpen,
  onClose,
  onOpenBadgesShowcase,
}) => {
  useEffect(() => {
    if (isOpen && badge) {
      // Trigger canvas confetti particles and fanfare
      triggerConfetti(160, 3600);
      playCelebrationFanfare();
    }
  }, [isOpen, badge]);

  if (!isOpen || !badge) return null;

  const tierColors: Record<string, { ring: string; bg: string; text: string; label: string }> = {
    gold: {
      ring: 'ring-4 ring-amber-400/80 shadow-amber-400/30',
      bg: 'bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600',
      text: 'text-amber-500',
      label: 'Gold Milestone',
    },
    platinum: {
      ring: 'ring-4 ring-purple-400/80 shadow-purple-400/30',
      bg: 'bg-gradient-to-br from-indigo-400 via-purple-500 to-pink-500',
      text: 'text-purple-400',
      label: 'Platinum Legend',
    },
    silver: {
      ring: 'ring-4 ring-slate-300/80 shadow-slate-300/30',
      bg: 'bg-gradient-to-br from-slate-200 via-stone-400 to-slate-500',
      text: 'text-slate-300',
      label: 'Silver Milestone',
    },
    bronze: {
      ring: 'ring-4 ring-amber-700/80 shadow-amber-700/30',
      bg: 'bg-gradient-to-br from-amber-600 via-amber-700 to-stone-800',
      text: 'text-amber-600',
      label: 'Bronze Milestone',
    },
  };

  const currentTier = tierColors[badge.tier] || tierColors.gold;

  return (
    <div
      id="celebration-moment-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/80 backdrop-blur-md animate-in fade-in duration-200 select-none"
      onClick={onClose}
    >
      <div
        id="celebration-moment-card"
        onClick={(e) => e.stopPropagation()}
        className="relative bg-gradient-to-b from-stone-900 via-stone-900 to-stone-950 text-white rounded-3xl border border-stone-800/90 shadow-2xl max-w-md w-full p-6 sm:p-8 text-center space-y-6 animate-in zoom-in-95 duration-200 overflow-hidden"
      >
        {/* Subtle radial ambient background glow */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-72 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-stone-800/80 hover:bg-stone-700 text-stone-400 hover:text-white transition-colors"
          title="Close celebration"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Kicker Tag */}
        <div className="flex items-center justify-center space-x-1.5 text-xs font-bold uppercase tracking-widest text-amber-400">
          <Sparkles className="w-4 h-4 text-amber-400 animate-spin" />
          <span>Milestone Unlocked!</span>
          <Sparkles className="w-4 h-4 text-amber-400 animate-spin" />
        </div>

        {/* Big Gleaming Badge Medal */}
        <div className="relative flex justify-center my-4">
          <div
            className={`w-28 h-28 sm:w-32 sm:h-32 rounded-3xl flex flex-col items-center justify-center shadow-2xl transition-transform transform hover:scale-105 duration-300 ${currentTier.bg} ${currentTier.ring}`}
          >
            <span className="text-5xl sm:text-6xl drop-shadow-md select-none">{badge.icon}</span>
          </div>

          {/* Floating Ribbon / Crown */}
          <div className="absolute -bottom-3 px-3 py-1 rounded-full bg-stone-950 border border-stone-800 text-[11px] font-extrabold uppercase tracking-wider text-amber-400 shadow-md">
            {currentTier.label}
          </div>
        </div>

        {/* Badge Title & Description */}
        <div className="space-y-2 pt-2">
          <h2 className="text-2xl sm:text-3xl font-black text-stone-100 tracking-tight">
            {badge.title}
          </h2>
          <p className="text-sm text-stone-300 max-w-xs mx-auto leading-relaxed">
            {badge.description}
          </p>
        </div>

        {/* Reward / Perk Banner */}
        {badge.rewardText && (
          <div className="bg-stone-800/70 border border-stone-700/80 rounded-2xl p-3 flex items-center space-x-3 text-left">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
              <Award className="w-5 h-5" />
            </div>
            <div className="text-xs">
              <span className="font-bold text-stone-200 block">Milestone Reward</span>
              <span className="text-stone-400">{badge.rewardText}</span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2">
          {onOpenBadgesShowcase && (
            <button
              onClick={() => {
                onClose();
                onOpenBadgesShowcase();
              }}
              className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-stone-800 hover:bg-stone-750 text-stone-200 text-xs sm:text-sm font-semibold transition-colors flex items-center justify-center space-x-1.5"
            >
              <Trophy className="w-4 h-4 text-amber-400" />
              <span>All Badges</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 text-xs sm:text-sm font-bold transition-all shadow-lg active:scale-98 flex items-center justify-center space-x-1.5"
          >
            <span>Keep Conquering</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
