import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Flame,
  X,
  AlertTriangle,
  Snowflake,
  ShieldCheck,
  RotateCcw,
  Clock,
  Info,
  CheckCircle2,
  Lock,
  Sparkles,
  HelpCircle,
  Calendar,
  Zap,
} from 'lucide-react';
import { StreakStatusInfo, StreakProtectionState } from '../types';
import { storageService, formatDateKey } from '../services/storageService';

interface StreakProtectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  todayDate: string;
  onStreakUpdated?: () => void;
}

export const StreakProtectionModal: React.FC<StreakProtectionModalProps> = ({
  isOpen,
  onClose,
  todayDate,
  onStreakUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'status' | 'freeze' | 'recovery' | 'rules'>('status');
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const streakState: StreakProtectionState = storageService.getStreakProtectionState();
  const streakStatus: StreakStatusInfo = storageService.getStreakStatus(todayDate);

  const handleEquipFreeze = () => {
    const res = storageService.equipStreakFreeze(todayDate);
    if (res.success) {
      setActionMessage({
        type: 'success',
        text: `❄️ Streak Freeze equipped for today (${todayDate})! Your streak is protected from breaking at midnight.`,
      });
      if (onStreakUpdated) onStreakUpdated();
    } else {
      setActionMessage({
        type: 'error',
        text: res.error || 'Failed to equip streak freeze.',
      });
    }
  };

  const handleUnequipFreeze = () => {
    const res = storageService.unequipStreakFreeze(todayDate);
    if (res.success) {
      setActionMessage({
        type: 'success',
        text: 'Streak freeze removed and refunded to your inventory.',
      });
      if (onStreakUpdated) onStreakUpdated();
    } else {
      setActionMessage({
        type: 'error',
        text: res.error || 'Failed to unequip streak freeze.',
      });
    }
  };

  const handleRecoverStreak = () => {
    const res = storageService.recoverBrokenStreak(todayDate);
    if (res.success) {
      setActionMessage({
        type: 'success',
        text: `🎉 Streak recovered! Your ${res.newStreak}-day streak is now officially restored.`,
      });
      if (onStreakUpdated) onStreakUpdated();
    } else {
      setActionMessage({
        type: 'error',
        text: res.error || 'Cannot recover streak at this time.',
      });
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-xs overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-white rounded-2xl border border-stone-200 shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col my-auto max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 sm:p-5 border-b border-stone-100 bg-gradient-to-r from-orange-50/70 via-white to-amber-50/40">
            <div className="flex items-center space-x-2.5">
              <div className="w-10 h-10 rounded-xl bg-orange-100 border border-orange-200 flex items-center justify-center text-orange-600 shadow-2xs">
                <Flame className="w-6 h-6 fill-orange-500 text-orange-500" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-stone-900 leading-tight">
                  Streak Protection & Recovery
                </h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  Real-time streak safeguards, anti-abuse freezes & continuity rules
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-stone-100 px-4 pt-2 bg-stone-50/70 text-xs font-semibold overflow-x-auto gap-2">
            <button
              onClick={() => setActiveTab('status')}
              className={`pb-2.5 px-3 border-b-2 transition-colors whitespace-nowrap flex items-center space-x-1.5 ${
                activeTab === 'status'
                  ? 'border-orange-600 text-orange-700'
                  : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-orange-500" />
              <span>Current Status</span>
            </button>
            <button
              onClick={() => setActiveTab('freeze')}
              className={`pb-2.5 px-3 border-b-2 transition-colors whitespace-nowrap flex items-center space-x-1.5 ${
                activeTab === 'freeze'
                  ? 'border-sky-600 text-sky-700'
                  : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              <Snowflake className="w-3.5 h-3.5 text-sky-500" />
              <span>Streak Freeze ({streakStatus.availableFreezes})</span>
            </button>
            <button
              onClick={() => setActiveTab('recovery')}
              className={`pb-2.5 px-3 border-b-2 transition-colors whitespace-nowrap flex items-center space-x-1.5 ${
                activeTab === 'recovery'
                  ? 'border-purple-600 text-purple-700'
                  : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5 text-purple-500" />
              <span>Recovery {streakStatus.isBrokenStreakDetected && '⚠️'}</span>
            </button>
            <button
              onClick={() => setActiveTab('rules')}
              className={`pb-2.5 px-3 border-b-2 transition-colors whitespace-nowrap flex items-center space-x-1.5 ${
                activeTab === 'rules'
                  ? 'border-stone-800 text-stone-900'
                  : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5 text-stone-500" />
              <span>How Streaks Work</span>
            </button>
          </div>

          {/* Action Message Alert */}
          {actionMessage && (
            <div
              className={`mx-4 sm:mx-6 mt-4 p-3 rounded-xl text-xs border flex items-start justify-between ${
                actionMessage.type === 'success'
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                  : 'bg-rose-50 text-rose-900 border-rose-200'
              }`}
            >
              <span>{actionMessage.text}</span>
              <button
                onClick={() => setActionMessage(null)}
                className="text-stone-400 hover:text-stone-600 ml-2"
              >
                ✕
              </button>
            </div>
          )}

          {/* Modal Body */}
          <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
            {/* HERO STREAK CARD (ALWAYS VISIBLE OR STATUS TAB) */}
            <div
              className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                streakStatus.isAtRisk
                  ? 'bg-amber-50/70 border-amber-300 ring-2 ring-amber-400/20'
                  : streakStatus.isTodayFrozen
                  ? 'bg-sky-50/70 border-sky-300 ring-2 ring-sky-400/20'
                  : 'bg-gradient-to-br from-stone-900 to-stone-800 text-white border-stone-800 shadow-md'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center space-x-1.5">
                      <span className="text-orange-500 animate-pulse">🔥</span>
                      <span className={streakStatus.isAtRisk || streakStatus.isTodayFrozen ? 'text-stone-900' : 'text-white'}>
                        {streakStatus.currentStreak} DAY STREAK
                      </span>
                    </span>
                  </div>

                  {/* Status subtitle message matching example */}
                  <div className="flex items-center space-x-2 pt-0.5">
                    {streakStatus.isAtRisk && (
                      <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-200/90 text-amber-950 border border-amber-400/80 shadow-2xs animate-pulse">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                        <span>⚠️ Today's streak is at risk.</span>
                      </span>
                    )}

                    {streakStatus.isTodayFrozen && (
                      <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-sky-200/90 text-sky-950 border border-sky-400/80 shadow-2xs">
                        <Snowflake className="w-3.5 h-3.5 text-sky-700" />
                        <span>❄️ Today is protected by Streak Freeze.</span>
                      </span>
                    )}

                    {streakStatus.isTodayActive && (
                      <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-2xs">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>✅ Safe & extended for today!</span>
                      </span>
                    )}

                    {!streakStatus.isTodayActive && !streakStatus.isAtRisk && streakStatus.currentStreak === 0 && (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-stone-200 text-stone-800">
                        <span>No active streak yet</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Freeze Status Pill in Hero */}
                <div
                  className={`p-3 rounded-xl border flex flex-col justify-center min-w-[140px] ${
                    streakStatus.isAtRisk || streakStatus.isTodayFrozen
                      ? 'bg-white/80 border-stone-200/80'
                      : 'bg-stone-800/80 border-stone-700'
                  }`}
                >
                  <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
                    Streak Freeze:
                  </span>
                  <div className="flex items-center space-x-1.5 mt-0.5">
                    <Snowflake className="w-4 h-4 text-sky-500" />
                    <span
                      className={`text-sm font-bold ${
                        streakStatus.isAtRisk || streakStatus.isTodayFrozen ? 'text-stone-900' : 'text-white'
                      }`}
                    >
                      {streakStatus.availableFreezes} available
                    </span>
                  </div>
                </div>
              </div>

              {/* Status explanation bar */}
              <p
                className={`mt-3 text-xs leading-relaxed pt-2.5 border-t ${
                  streakStatus.isAtRisk
                    ? 'text-amber-900 border-amber-200'
                    : streakStatus.isTodayFrozen
                    ? 'text-sky-900 border-sky-200'
                    : 'text-stone-300 border-stone-700/60'
                }`}
              >
                {streakStatus.riskMessage}
              </p>
            </div>

            {/* TAB: STATUS */}
            {activeTab === 'status' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 flex items-start space-x-3">
                    <div className="p-2 rounded-lg bg-orange-100 text-orange-600 shrink-0">
                      <Flame className="w-4 h-4 fill-orange-500 text-orange-500" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-stone-900">Streak Metric</h4>
                      <p className="text-xs text-stone-600 mt-0.5">
                        Current: <strong className="text-stone-900">{streakStatus.currentStreak} days</strong> • Longest: <strong className="text-stone-900">{streakStatus.longestStreak} days</strong>
                      </p>
                      <p className="text-[11px] text-stone-500 mt-1">
                        Active days require at least 1 completed task or habit before 23:59 IST.
                      </p>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 flex items-start space-x-3">
                    <div className="p-2 rounded-lg bg-sky-100 text-sky-600 shrink-0">
                      <Snowflake className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-stone-900">Freeze Inventory</h4>
                      <p className="text-xs text-stone-600 mt-0.5">
                        <strong className="text-stone-900">{streakStatus.availableFreezes} of {streakStatus.maxFreezes}</strong> freezes banked
                      </p>
                      <p className="text-[11px] text-stone-500 mt-1">
                        Freezes pause your streak without artificially inflating it.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Quick Action Prompt based on state */}
                {streakStatus.isAtRisk && (
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start space-x-2.5">
                      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-xs font-bold text-amber-950">Action Needed Today</h4>
                        <p className="text-xs text-amber-800 mt-0.5">
                          Complete any task or habit today, or equip your available Streak Freeze to protect your {streakStatus.currentStreak}-day streak.
                        </p>
                      </div>
                    </div>
                    {streakStatus.availableFreezes > 0 && !streakStatus.isTodayFrozen && (
                      <button
                        onClick={handleEquipFreeze}
                        className="px-3.5 py-2 rounded-lg text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 shadow-xs transition-colors shrink-0 flex items-center space-x-1.5 self-start sm:self-auto"
                      >
                        <Snowflake className="w-3.5 h-3.5" />
                        <span>Equip Streak Freeze</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB: STREAK FREEZE */}
            {activeTab === 'freeze' && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-sky-50/50 border border-sky-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <Snowflake className="w-5 h-5 text-sky-600" />
                      <h3 className="text-sm font-bold text-stone-900">Optional Streak Freeze</h3>
                    </div>
                    <span className="text-xs font-bold text-sky-900 bg-sky-100 px-2.5 py-1 rounded-full border border-sky-200">
                      {streakStatus.availableFreezes} / {streakStatus.maxFreezes} Banked
                    </span>
                  </div>

                  <p className="text-xs text-stone-600 leading-relaxed">
                    A Streak Freeze shields your streak for 1 day if you are unable to complete tasks due to rest, travel, or illness. When active, your streak does not reset to 0 at midnight.
                  </p>

                  <div className="mt-4 p-3 bg-white rounded-lg border border-sky-100 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4 text-stone-400" />
                      <span className="text-xs font-semibold text-stone-800">
                        Protection for Today ({todayDate})
                      </span>
                    </div>

                    {streakStatus.isTodayFrozen ? (
                      <button
                        onClick={handleUnequipFreeze}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 transition-colors"
                      >
                        Unequip & Refund Freeze
                      </button>
                    ) : streakStatus.availableFreezes > 0 ? (
                      <button
                        onClick={handleEquipFreeze}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 shadow-xs transition-colors flex items-center space-x-1.5"
                      >
                        <Snowflake className="w-3.5 h-3.5" />
                        <span>Equip for Today</span>
                      </button>
                    ) : (
                      <span className="text-xs text-stone-400 font-medium">0 Freezes Available</span>
                    )}
                  </div>
                </div>

                {/* Freeze Anti-Abuse Rules Card */}
                <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-2">
                  <h4 className="text-xs font-bold text-stone-900 flex items-center space-x-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Anti-Abuse Safeguards for Freezes</span>
                  </h4>
                  <ul className="text-xs text-stone-600 space-y-1.5 list-disc list-inside">
                    <li>
                      <strong>No Artificial Inflation:</strong> A freeze pauses your streak count; it does <em>not</em> add +1 day to your streak.
                    </li>
                    <li>
                      <strong>Inventory Cap (Max 2):</strong> You can hold at most 2 banked freezes at any time to prevent infinite hoarding.
                    </li>
                    <li>
                      <strong>Earned Through Consistency:</strong> Earn +1 freeze automatically whenever you reach a 7-day streak milestone.
                    </li>
                  </ul>
                </div>
              </div>
            )}

            {/* TAB: RECOVERY MECHANISM */}
            {activeTab === 'recovery' && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl border bg-stone-50 border-stone-200">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <RotateCcw className="w-5 h-5 text-purple-600" />
                      <h3 className="text-sm font-bold text-stone-900">Streak Recovery Mechanism</h3>
                    </div>
                    {streakStatus.isBrokenStreakDetected ? (
                      <span className="text-xs font-bold text-rose-800 bg-rose-100 px-2.5 py-0.5 rounded-full border border-rose-200">
                        Broken Streak Detected
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-200">
                        Streak Intact
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-stone-600 leading-relaxed">
                    Life happens! If you accidentally broke a streak of 2+ days yesterday, you have a 48-hour grace window to recover your past streak by proving your consistency today.
                  </p>

                  {/* Recovery Status Box */}
                  {streakStatus.isBrokenStreakDetected ? (
                    <div className="mt-4 p-4 rounded-xl bg-white border border-purple-200 shadow-2xs space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-xs font-bold text-stone-900">
                            Lost Streak: {streakStatus.brokenStreakDays} Days
                          </p>
                          <p className="text-xs text-stone-500">
                            Missed date: {streakStatus.missedDateToRecover}
                          </p>
                        </div>
                        <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200">
                          {streakStatus.todayCompletedCount} / {streakStatus.requiredCompletedCount} Tasks Completed Today
                        </span>
                      </div>

                      {/* Work verification progress */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] font-semibold text-stone-600">
                          <span>Recovery Requirement Progress</span>
                          <span>{Math.min(100, Math.round((streakStatus.todayCompletedCount / streakStatus.requiredCompletedCount) * 100))}%</span>
                        </div>
                        <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-purple-600 rounded-full transition-all"
                            style={{
                              width: `${Math.min(100, (streakStatus.todayCompletedCount / streakStatus.requiredCompletedCount) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>

                      {streakStatus.canRecover ? (
                        <button
                          onClick={handleRecoverStreak}
                          className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 shadow-xs transition-colors flex items-center justify-center space-x-2"
                        >
                          <RotateCcw className="w-4 h-4" />
                          <span>Recover {streakStatus.brokenStreakDays}-Day Streak Now</span>
                        </button>
                      ) : (
                        <div className="p-2.5 rounded-lg bg-stone-50 text-[11px] text-stone-600 border border-stone-200 flex items-center space-x-2">
                          <Lock className="w-4 h-4 text-stone-400 shrink-0" />
                          <span>{streakStatus.reasonNotRecoverable}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-4 p-4 rounded-xl bg-white border border-stone-200 text-center space-y-1">
                      <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto" />
                      <p className="text-xs font-bold text-stone-800">Your Streak is Active and Healthy</p>
                      <p className="text-xs text-stone-500">
                        No broken streak detected from yesterday. Recovery is only triggered when a prior streak of 2+ days is lost.
                      </p>
                    </div>
                  )}
                </div>

                {/* Anti-Abuse Rules for Recovery */}
                <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-2">
                  <h4 className="text-xs font-bold text-stone-900 flex items-center space-x-1.5">
                    <ShieldCheck className="w-4 h-4 text-purple-600" />
                    <span>Anti-Abuse Safeguards for Recovery</span>
                  </h4>
                  <ul className="text-xs text-stone-600 space-y-1.5 list-disc list-inside">
                    <li>
                      <strong>14-Day Cooldown:</strong> Recovery can only be used once every 14 days to prevent chronic abuse.
                    </li>
                    <li>
                      <strong>Single Missed Day Only:</strong> Can only bridge 1 missed day. If you miss 2+ consecutive days, the streak is lost.
                    </li>
                    <li>
                      <strong>Real Work Required:</strong> Must complete at least 2 real tasks today before recovery unlocks.
                    </li>
                    <li>
                      <strong>No Artificial Inflation:</strong> Recovery restores the exact prior streak count without adding fake bonus days.
                    </li>
                  </ul>
                </div>
              </div>
            )}

            {/* TAB: HOW STREAKS WORK */}
            {activeTab === 'rules' && (
              <div className="space-y-4 text-xs text-stone-700">
                <div className="border border-stone-200 rounded-xl divide-y divide-stone-100 bg-white overflow-hidden">
                  <div className="p-3.5 flex items-start space-x-3">
                    <div className="p-2 rounded-lg bg-orange-100 text-orange-700 font-bold shrink-0">
                      🔥 1
                    </div>
                    <div>
                      <h4 className="font-bold text-stone-900">How Streaks Grow (+1 Day)</h4>
                      <p className="text-stone-600 mt-0.5 leading-relaxed">
                        Complete at least 1 task or habit anytime during the calendar day (before 23:59). Your streak counter increases by +1 day every consecutive day you maintain activity.
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 flex items-start space-x-3">
                    <div className="p-2 rounded-lg bg-amber-100 text-amber-700 font-bold shrink-0">
                      ⚠️ 2
                    </div>
                    <div>
                      <h4 className="font-bold text-stone-900">When Streaks Are At Risk</h4>
                      <p className="text-stone-600 mt-0.5 leading-relaxed">
                        If you have an active streak from yesterday but 0 completions recorded today, your streak enters the <strong>"At Risk"</strong> state. Complete 1 item or equip a Streak Freeze before midnight to keep it alive.
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 flex items-start space-x-3">
                    <div className="p-2 rounded-lg bg-sky-100 text-sky-700 font-bold shrink-0">
                      ❄️ 3
                    </div>
                    <div>
                      <h4 className="font-bold text-stone-900">Optional Streak Freeze (Pauses, Never Inflates)</h4>
                      <p className="text-stone-600 mt-0.5 leading-relaxed">
                        Streak Freeze shields a day off from resetting your counter. It keeps your streak alive without adding false days to the count. Bank up to 2 freezes by achieving 7-day consistency milestones.
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 flex items-start space-x-3">
                    <div className="p-2 rounded-lg bg-purple-100 text-purple-700 font-bold shrink-0">
                      🩹 4
                    </div>
                    <div>
                      <h4 className="font-bold text-stone-900">Recovery Mechanism (Emergency Rescue)</h4>
                      <p className="text-stone-600 mt-0.5 leading-relaxed">
                        If an unexpected emergency breaks your streak yesterday, you can recover it within 48 hours by completing 2 tasks today. Subject to a strict 14-day anti-abuse cooldown.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-stone-100 bg-stone-50 flex items-center justify-between text-xs">
            <span className="text-stone-500 font-medium">
              Streak system operates in your local timezone ({todayDate})
            </span>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-700 bg-white hover:bg-stone-100 border border-stone-200 transition-colors shadow-2xs"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
