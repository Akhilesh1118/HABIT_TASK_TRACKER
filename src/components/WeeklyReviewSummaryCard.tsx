import React, { useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Flame,
  Award,
  AlertTriangle,
  BookOpen,
  Sun,
  Moon,
  Calculator,
  TrendingUp,
  AlertCircle,
  Copy,
  Check,
  Maximize2,
  Sparkles,
  Info,
  Layers,
  ArrowRight,
  Brain,
} from 'lucide-react';
import { WeeklyReviewSummary, WeeklyReviewInsight } from '../types';

interface WeeklyReviewSummaryCardProps {
  review: WeeklyReviewSummary;
  onOpenFullModal?: () => void;
  className?: string;
  showExpandButton?: boolean;
}

export const WeeklyReviewSummaryCard: React.FC<WeeklyReviewSummaryCardProps> = ({
  review,
  onOpenFullModal,
  className = '',
  showExpandButton = true,
}) => {
  const [copied, setCopied] = useState(false);
  const [selectedInsightTab, setSelectedInsightTab] = useState<'all' | 'strength' | 'recommendation'>('all');

  const handleCopyReview = () => {
    const text = `WEEKLY REVIEW
--------------------
Tasks completed:
${review.tasksCompleted} / ${review.tasksTotal}

Completion:
${review.completionRate}%

Focus time:
${review.formattedFocusTime}

Best day:
${review.bestDay.dayName}

Weakest day:
${review.weakestDay.dayName}

Top habit:
${review.topHabit.name}

Subject breakdown:
${review.subjectBreakdown.map((s) => `${s.subject} ${s.formattedDuration}`).join('\n')}

Key Insights:
${review.insights.map((ins) => `• "${ins.text}" (${ins.evidence})`).join('\n')}
`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getInsightIcon = (ins: WeeklyReviewInsight) => {
    switch (ins.type) {
      case 'time_of_day':
        return <Sun className="w-4 h-4 text-amber-500" />;
      case 'postponed_tasks':
        return <Moon className="w-4 h-4 text-indigo-400" />;
      case 'subject_imbalance':
        return <Calculator className="w-4 h-4 text-rose-500" />;
      case 'best_day':
        return <TrendingUp className="w-4 h-4 text-emerald-500" />;
      case 'weakest_day':
        return <AlertCircle className="w-4 h-4 text-amber-500" />;
      case 'habit_consistency':
        return <Flame className="w-4 h-4 text-orange-500" />;
      default:
        return <Sparkles className="w-4 h-4 text-indigo-500" />;
    }
  };

  const filteredInsights = review.insights.filter((ins) => {
    if (selectedInsightTab === 'all') return true;
    return ins.category === selectedInsightTab;
  });

  // Calculate total subject minutes for the visual proportional bar
  const totalSubjectMins = review.subjectBreakdown.reduce((sum, s) => sum + s.studyMinutes, 0) || 1;

  return (
    <div
      id="weekly-productivity-review-card"
      className={`bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden transition-all duration-200 ${className}`}
    >
      {/* Top Banner & Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-5 py-4 sm:px-6 sm:py-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-[11px] font-semibold tracking-wider uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full">
                7-Day Performance Review
              </span>
              <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                {review.weekLabel}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white mt-1">
              WEEKLY REVIEW
            </h2>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={handleCopyReview}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 hover:text-white bg-white/10 hover:bg-white/20 border border-white/10 rounded-lg transition-colors cursor-pointer"
              title="Copy formatted summary to clipboard"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-300" />
                  <span>Copy Summary</span>
                </>
              )}
            </button>

            {showExpandButton && onOpenFullModal && (
              <>
                <button
                  type="button"
                  id="btn-open-coach-from-card"
                  onClick={onOpenFullModal}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 rounded-lg transition-colors cursor-pointer shadow-sm border border-purple-400/30"
                  title="Open AI Productivity Coach Analysis"
                >
                  <Brain className="w-3.5 h-3.5 text-yellow-300" />
                  <span>AI Coach</span>
                </button>

                <button
                  onClick={onOpenFullModal}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-950 bg-indigo-200 hover:bg-white rounded-lg transition-colors cursor-pointer shadow-sm"
                  title="Expand full breakdown modal"
                >
                  <Maximize2 className="w-3.5 h-3.5 text-indigo-900" />
                  <span>Drilldown</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Core Summary Metrics Grid */}
      <div className="p-5 sm:p-6 space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {/* 1. Tasks completed */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-1">
              <span>Tasks completed</span>
              <CheckCircle2 className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {review.tasksCompleted} <span className="text-sm font-semibold text-slate-400">/ {review.tasksTotal}</span>
            </div>
            <div className="mt-2 w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-indigo-600 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, review.completionRate)}%` }}
              />
            </div>
          </div>

          {/* 2. Completion */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-1">
              <span>Completion</span>
              <Award className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-emerald-600 tracking-tight">
              {review.completionRate}%
            </div>
            <div className="text-[11px] text-slate-500 font-medium mt-1">
              {review.completionRate >= 80 ? '🎯 High Execution' : '⚡ Moderate Target'}
            </div>
          </div>

          {/* 3. Focus time */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-1">
              <span>Focus time</span>
              <Clock className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-blue-600 tracking-tight">
              {review.formattedFocusTime}
            </div>
            <div className="text-[11px] text-slate-500 font-medium mt-1">
              {Math.round(review.focusSeconds / 3600)}h total deep work
            </div>
          </div>

          {/* 4. Best day */}
          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-medium text-emerald-800 mb-1">
              <span>Best day</span>
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-lg sm:text-xl font-black text-emerald-900 tracking-tight truncate">
              {review.bestDay.dayName}
            </div>
            <div className="text-[11px] text-emerald-700 font-medium mt-1">
              {review.bestDay.completed}/{review.bestDay.total} tasks • {review.bestDay.rate}%
            </div>
          </div>

          {/* 5. Weakest day */}
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-medium text-amber-800 mb-1">
              <span>Weakest day</span>
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-lg sm:text-xl font-black text-amber-900 tracking-tight truncate">
              {review.weakestDay.dayName}
            </div>
            <div className="text-[11px] text-amber-700 font-medium mt-1">
              {review.weakestDay.completed}/{review.weakestDay.total} tasks • {review.weakestDay.rate}%
            </div>
          </div>

          {/* 6. Top habit */}
          <div className="bg-orange-50/70 border border-orange-200/80 rounded-xl p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-medium text-orange-800 mb-1">
              <span>Top habit</span>
              <Flame className="w-4 h-4 text-orange-600" />
            </div>
            <div className="text-lg sm:text-xl font-black text-orange-950 tracking-tight truncate">
              {review.topHabit.name}
            </div>
            <div className="text-[11px] text-orange-700 font-medium mt-1">
              {review.topHabit.completedCount}/{review.topHabit.totalDays} days completed
            </div>
          </div>
        </div>

        {/* Subject Breakdown Section */}
        <div className="bg-slate-50/90 border border-slate-200/80 rounded-xl p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-bold tracking-tight text-slate-900 uppercase">
                Subject Breakdown
              </h3>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              Total Recorded Study Time: {review.formattedFocusTime}
            </span>
          </div>

          {/* Stacked Proportional Bar */}
          <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden flex gap-0.5 mb-4">
            {review.subjectBreakdown.map((subj) => {
              const widthPct = Math.max(3, Math.round((subj.studyMinutes / totalSubjectMins) * 100));
              return (
                <div
                  key={subj.subject}
                  className="h-full first:rounded-l-full last:rounded-r-full transition-all duration-300"
                  style={{ width: `${widthPct}%`, backgroundColor: subj.color }}
                  title={`${subj.subject}: ${subj.formattedDuration} (${widthPct}%)`}
                />
              );
            })}
          </div>

          {/* Subject Pills Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {review.subjectBreakdown.map((subj) => (
              <div
                key={subj.subject}
                className="bg-white border border-slate-200/70 rounded-lg p-2.5 flex items-center justify-between"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: subj.color }}
                  />
                  <span className="text-xs font-semibold text-slate-700 truncate">
                    {subj.subject}
                  </span>
                </div>
                <span className="text-xs font-bold text-slate-900 font-mono ml-2 flex-shrink-0">
                  {subj.formattedDuration}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Practical Stored-Data Insights */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold tracking-tight text-slate-900 uppercase">
                  Practical Data Insights
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Observed directly from your stored task timestamps, completion logs, and focus sessions.
              </p>
            </div>

            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg self-start sm:self-auto text-xs font-medium text-slate-600">
              <button
                onClick={() => setSelectedInsightTab('all')}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  selectedInsightTab === 'all'
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'hover:text-slate-900'
                }`}
              >
                All Patterns ({review.insights.length})
              </button>
              <button
                onClick={() => setSelectedInsightTab('strength')}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  selectedInsightTab === 'strength'
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'hover:text-slate-900'
                }`}
              >
                Strengths
              </button>
              <button
                onClick={() => setSelectedInsightTab('recommendation')}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  selectedInsightTab === 'recommendation'
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'hover:text-slate-900'
                }`}
              >
                Actionable
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {filteredInsights.map((ins) => (
              <div
                key={ins.id}
                className={`rounded-xl p-4 border transition-all duration-200 flex flex-col justify-between ${
                  ins.type === 'time_of_day'
                    ? 'bg-amber-50/50 border-amber-200/70 hover:border-amber-300'
                    : ins.type === 'postponed_tasks'
                    ? 'bg-indigo-50/50 border-indigo-200/70 hover:border-indigo-300'
                    : ins.type === 'subject_imbalance'
                    ? 'bg-rose-50/50 border-rose-200/70 hover:border-rose-300'
                    : ins.category === 'strength'
                    ? 'bg-emerald-50/50 border-emerald-200/70 hover:border-emerald-300'
                    : 'bg-slate-50 border-slate-200/70 hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="p-1.5 rounded-lg bg-white shadow-xs border border-slate-200/60">
                      {getInsightIcon(ins)}
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        ins.category === 'strength'
                          ? 'bg-emerald-100 text-emerald-800'
                          : ins.category === 'recommendation'
                          ? 'bg-indigo-100 text-indigo-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {ins.category}
                    </span>
                  </div>

                  {/* Primary Quote matching prompt specifications */}
                  <div className="text-sm font-black text-slate-900 tracking-tight leading-snug mb-2">
                    "{ins.text}"
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-200/60">
                  <div className="text-[11px] text-slate-600 font-medium leading-relaxed flex items-start gap-1.5">
                    <Info className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                    <span>{ins.evidence}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
