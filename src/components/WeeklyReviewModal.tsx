import React, { useState } from 'react';
import {
  X,
  Calendar,
  CheckCircle2,
  Clock,
  Flame,
  Award,
  AlertTriangle,
  BookOpen,
  Copy,
  Check,
  Download,
  Share2,
  Sparkles,
  Info,
  TrendingUp,
  ArrowRight,
  BarChart2,
  Brain,
} from 'lucide-react';
import { WeeklyReviewSummary } from '../types';
import { AICoachCard } from './AICoachCard';

interface WeeklyReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  review: WeeklyReviewSummary;
  initialTab?: 'overview' | 'coach';
}

export const WeeklyReviewModal: React.FC<WeeklyReviewModalProps> = ({
  isOpen,
  onClose,
  review,
  initialTab = 'overview',
}) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'coach'>(initialTab);

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCopyReview = () => {
    const text = `WEEKLY REVIEW
-------------------------
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

Practical Insights:
${review.insights.map((ins) => `• "${ins.text}"\n  Evidence: ${ins.evidence}`).join('\n\n')}
`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(review, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `weekly-review-${review.weekStartDate}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="weekly-review-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-slate-900/60 backdrop-blur-sm animate-fade-in"
    >
      <div
        id="weekly-review-modal-container"
        className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-4 sm:my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-4 sm:px-6 py-4 sm:py-5 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 text-[10px] sm:text-[11px] font-bold tracking-wider uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full">
                Productivity Analysis
              </span>
              <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                {review.weekLabel}
              </span>
            </div>
            <h1 id="weekly-review-title" className="text-xl sm:text-3xl font-black tracking-tight text-white mt-1">
              WEEKLY REVIEW
            </h1>
            <p className="text-xs text-slate-300 mt-1 max-w-md">
              A comprehensive distillation of your past 7 days of tasks, habits, and subject focus.
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer shrink-0"
            title="Close review"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="bg-slate-100 px-4 sm:px-6 py-2 sm:py-2.5 border-b border-slate-200 flex flex-wrap gap-2 items-center justify-between">
          <div className="flex items-center space-x-1.5 sm:space-x-2 flex-wrap gap-y-1">
            <button
              type="button"
              id="modal-tab-weekly-overview"
              onClick={() => setActiveTab('overview')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'overview'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Weekly Overview
            </button>
            <button
              type="button"
              id="modal-tab-ai-coach"
              onClick={() => setActiveTab('coach')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'coach'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-indigo-700 bg-indigo-50/80 hover:bg-indigo-100'
              }`}
            >
              <Brain className="w-3.5 h-3.5" />
              <span>AI Productivity Coach</span>
              <span className="text-[10px] bg-indigo-500 text-white px-1.5 py-0.2 rounded-full font-black">
                AI
              </span>
            </button>
          </div>

          {activeTab === 'overview' && (
            <div className="flex items-center space-x-2">
              <button
                onClick={handleCopyReview}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-md transition-colors cursor-pointer"
                title="Copy Weekly Review"
              >
                {copied ? (
                  <Check className="w-3 h-3 text-emerald-600" />
                ) : (
                  <Copy className="w-3 h-3 text-slate-500" />
                )}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-h-[76vh] overflow-y-auto">
          {activeTab === 'coach' ? (
            <AICoachCard targetDateStr={review.weekEndDate} className="border-0 shadow-none p-0" />
          ) : (
            <>
              {/* Quick AI Coach Promo Callout */}
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                    <Sparkles className="w-4 h-4 text-yellow-300" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">
                      AI Productivity Coach is ready with your weekly breakdown
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Analyzes your 42 planned tasks, strongest 7-11 AM window & postponement patterns.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('coach')}
                  className="shrink-0 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs cursor-pointer flex items-center justify-center gap-1 w-full sm:w-auto"
                >
                  <span>View Analysis</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              {/* Key Metrics Section */}
              <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              Performance Overview
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-3.5">
              {/* Tasks completed */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                  <span>Tasks completed:</span>
                  <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="text-2xl font-black text-slate-900 mt-1 font-mono">
                  {review.tasksCompleted} / {review.tasksTotal}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {review.tasksTotal - review.tasksCompleted} pending or postponed
                </div>
              </div>

              {/* Completion */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                  <span>Completion:</span>
                  <Award className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-2xl font-black text-emerald-600 mt-1 font-mono">
                  {review.completionRate}%
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Overall execution consistency
                </div>
              </div>

              {/* Focus time */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                  <span>Focus time:</span>
                  <Clock className="w-4 h-4 text-blue-600" />
                </div>
                <div className="text-2xl font-black text-blue-600 mt-1 font-mono">
                  {review.formattedFocusTime}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Deep focus timer logs
                </div>
              </div>

              {/* Best day */}
              <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-4">
                <div className="flex items-center justify-between text-xs font-medium text-emerald-800">
                  <span>Best day:</span>
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-xl font-black text-emerald-950 mt-1">
                  {review.bestDay.dayName}
                </div>
                <div className="text-[11px] text-emerald-700 mt-1">
                  {review.bestDay.completed}/{review.bestDay.total} completed ({review.bestDay.rate}%)
                </div>
              </div>

              {/* Weakest day */}
              <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-4">
                <div className="flex items-center justify-between text-xs font-medium text-amber-800">
                  <span>Weakest day:</span>
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                </div>
                <div className="text-xl font-black text-amber-950 mt-1">
                  {review.weakestDay.dayName}
                </div>
                <div className="text-[11px] text-amber-700 mt-1">
                  {review.weakestDay.completed}/{review.weakestDay.total} completed ({review.weakestDay.rate}%)
                </div>
              </div>

              {/* Top habit */}
              <div className="bg-orange-50/60 border border-orange-200 rounded-xl p-4">
                <div className="flex items-center justify-between text-xs font-medium text-orange-800">
                  <span>Top habit:</span>
                  <Flame className="w-4 h-4 text-orange-600" />
                </div>
                <div className="text-xl font-black text-orange-950 mt-1 truncate">
                  {review.topHabit.name}
                </div>
                <div className="text-[11px] text-orange-700 mt-1">
                  {review.topHabit.completedCount}/{review.topHabit.totalDays} days recorded
                </div>
              </div>
            </div>
          </div>

          {/* Subject Breakdown */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-indigo-600" />
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Subject breakdown:
                </h3>
              </div>
              <span className="text-xs text-slate-500 font-mono">
                {review.formattedFocusTime}
              </span>
            </div>

            <div className="space-y-2.5">
              {review.subjectBreakdown.map((subj) => (
                <div
                  key={subj.subject}
                  className="bg-white border border-slate-200/80 rounded-lg p-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: subj.color }}
                    />
                    <span className="text-sm font-bold text-slate-800">
                      {subj.subject}
                    </span>
                    {subj.tasksCount && (
                      <span className="text-[11px] text-slate-400 font-medium">
                        ({subj.tasksCount} sessions)
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-black text-slate-900 font-mono">
                    {subj.formattedDuration}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Practical Data Insights */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Practical Insights (Stored Data Patterns)
              </h3>
            </div>

            <div className="space-y-3">
              {review.insights.map((ins) => (
                <div
                  key={ins.id}
                  className={`p-4 rounded-xl border transition-colors ${
                    ins.type === 'time_of_day'
                      ? 'bg-amber-50/40 border-amber-200'
                      : ins.type === 'postponed_tasks'
                      ? 'bg-indigo-50/40 border-indigo-200'
                      : ins.type === 'subject_imbalance'
                      ? 'bg-rose-50/40 border-rose-200'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      {ins.title}
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

                  <p className="text-base font-black text-slate-900 tracking-tight mb-2">
                    "{ins.text}"
                  </p>

                  <div className="flex items-start gap-1.5 text-xs text-slate-600 bg-white/80 p-2.5 rounded-lg border border-slate-200/60">
                    <Info className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-slate-700 font-semibold">Evidence:</strong> {ins.evidence}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500 text-center sm:text-left">
            Derived strictly from verified user logs in local persistent storage.
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              onClick={handleExportJson}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Export JSON</span>
            </button>

            <button
              onClick={handleCopyReview}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors cursor-pointer shadow-xs"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-white" />
                  <span>Copied to Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-white" />
                  <span>Copy Formatted Review</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
