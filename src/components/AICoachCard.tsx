import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  RotateCw,
  Copy,
  Check,
  Brain,
  Sun,
  Clock,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Award,
  CheckCircle2,
  FileText,
  HelpCircle,
  Zap,
} from 'lucide-react';
import { AICoachAnalysisResult } from '../types';
import { storageService } from '../services/storageService';

interface AICoachCardProps {
  targetDateStr?: string;
  className?: string;
  onOpenModal?: () => void;
}

export const AICoachCard: React.FC<AICoachCardProps> = ({
  targetDateStr = '2026-09-15',
  className = '',
  onOpenModal,
}) => {
  const [analysis, setAnalysis] = useState<AICoachAnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'card' | 'raw'>('card');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadAnalysis = async (force: boolean = false) => {
    try {
      if (force) setRegenerating(true);
      else setLoading(true);
      setErrorMsg(null);

      const res = await storageService.fetchAICoachAnalysis(targetDateStr, force);
      setAnalysis(res);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to load AI coach analysis');
    } finally {
      setLoading(false);
      setRegenerating(false);
    }
  };

  useEffect(() => {
    loadAnalysis(false);
  }, [targetDateStr]);

  const handleCopy = () => {
    if (!analysis) return;
    navigator.clipboard.writeText(analysis.formattedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getSubjectColor = (subject: string): string => {
    const s = subject.toLowerCase();
    if (s.includes('gk')) return 'bg-emerald-500';
    if (s.includes('quant')) return 'bg-blue-600';
    if (s.includes('reason')) return 'bg-purple-600';
    if (s.includes('eng')) return 'bg-amber-500';
    return 'bg-indigo-500';
  };

  const getSubjectTextColor = (subject: string): string => {
    const s = subject.toLowerCase();
    if (s.includes('gk')) return 'text-emerald-700 dark:text-emerald-300';
    if (s.includes('quant')) return 'text-blue-700 dark:text-blue-300';
    if (s.includes('reason')) return 'text-purple-700 dark:text-purple-300';
    if (s.includes('eng')) return 'text-amber-700 dark:text-amber-300';
    return 'text-indigo-700 dark:text-indigo-300';
  };

  return (
    <div
      id="ai-productivity-coach-card"
      className={`bg-white dark:bg-slate-900 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 shadow-sm hover:shadow-md transition-all overflow-hidden ${className}`}
    >
      {/* Top Header Banner */}
      <div className="bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 dark:from-indigo-950/40 dark:via-purple-950/30 dark:to-slate-900 px-6 py-5 border-b border-indigo-100 dark:border-indigo-900/30">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
              <Sparkles className="w-5 h-5 text-yellow-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                  AI PRODUCTIVITY COACH
                </h2>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800">
                  <Brain className="w-3 h-3" />
                  {analysis?.isAiGenerated ? (analysis.modelUsed ? analysis.modelUsed.replace('models/', '') : 'Gemini AI') : 'Ground-Truth Engine'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Analyzed from verified application tracking data • No simulated statistics
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {/* View Mode Switcher */}
            <div className="flex items-center bg-white/80 dark:bg-slate-800 rounded-lg p-0.5 border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                id="btn-coach-view-card"
                onClick={() => setViewMode('card')}
                className={`text-xs px-2.5 py-1 rounded font-medium transition-colors ${
                  viewMode === 'card'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Visual Card View"
              >
                Card
              </button>
              <button
                type="button"
                id="btn-coach-view-raw"
                onClick={() => setViewMode('raw')}
                className={`text-xs px-2.5 py-1 rounded font-medium transition-colors ${
                  viewMode === 'raw'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Exact Canonical Text View"
              >
                Raw Text
              </button>
            </div>

            {/* Copy Button */}
            <button
              type="button"
              id="btn-copy-ai-coach"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors shadow-xs"
              title="Copy analysis text to clipboard"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-600 font-semibold">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>

            {/* Regenerate Button */}
            <button
              type="button"
              id="btn-regenerate-ai-coach"
              onClick={() => loadAnalysis(true)}
              disabled={regenerating || loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 active:scale-98 rounded-lg shadow-xs transition-all disabled:opacity-50"
              title="Regenerate analysis with latest application data"
            >
              <RotateCw className={`w-3.5 h-3.5 ${regenerating ? 'animate-spin' : ''}`} />
              <span>{regenerating ? 'Analyzing...' : 'Regenerate'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-10 h-10 rounded-full border-3 border-indigo-200 border-t-indigo-600 animate-spin mb-4" />
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Synthesizing weekly tasks and focus metrics...
            </p>
            <p className="text-xs text-slate-400 mt-1">Grounding analysis in real application data</p>
          </div>
        ) : errorMsg && !analysis ? (
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
            <div className="text-xs">
              <p className="font-semibold text-sm">Failed to generate AI Coach analysis</p>
              <p className="mt-1">{errorMsg}</p>
              <button
                type="button"
                onClick={() => loadAnalysis(true)}
                className="mt-3 px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded font-medium text-xs transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        ) : analysis && viewMode === 'raw' ? (
          /* Raw Canonical Text View matching exact prompt structure */
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-500 pb-1 border-b border-slate-100 dark:border-slate-800">
              <span className="font-medium">Raw Analysis Output</span>
              <span>Updated {new Date(analysis.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <pre className="p-5 rounded-xl bg-slate-900 text-slate-100 font-mono text-sm leading-relaxed whitespace-pre-wrap overflow-x-auto shadow-inner border border-slate-800">
              {analysis.formattedText}
            </pre>
            <p className="text-xs text-slate-400 italic">
              Exact format matching specification: YOUR WEEK + RECOMMENDATIONS
            </p>
          </div>
        ) : analysis ? (
          /* Visual Structured Card View */
          <div className="space-y-6">
            {/* Section 1: YOUR WEEK */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  YOUR WEEK
                </h3>
                <span className="text-xs font-medium text-slate-400">
                  {analysis.completionRate}% Completion Rate
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Task Execution Block */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                        You planned <span className="font-bold text-slate-900 dark:text-white">{analysis.plannedTasks}</span> tasks.
                      </p>
                      <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
                        You completed <span className="font-bold">{analysis.completedTasks}</span>.
                      </p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs">
                      {Math.round((analysis.completedTasks / Math.max(1, analysis.plannedTasks)) * 100)}%
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-3 w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, Math.round((analysis.completedTasks / Math.max(1, analysis.plannedTasks)) * 100))}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Performance Period & Friction */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 space-y-3">
                  <div>
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                      Your strongest performance period:
                    </span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Sun className="w-4 h-4 text-amber-500 shrink-0" />
                      <p className="text-sm font-bold text-slate-900 dark:text-white">
                        {analysis.strongestPeriod}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                      You frequently postponed:
                    </span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Clock className="w-4 h-4 text-rose-500 shrink-0" />
                      <p className="text-sm font-bold text-rose-600 dark:text-rose-400">
                        {analysis.frequentlyPostponed}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Study Distribution */}
              <div className="mt-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-3">
                  Study distribution:
                </span>

                {/* Progress bar visualizer */}
                <div className="flex h-2.5 rounded-full overflow-hidden w-full mb-3 bg-slate-200 dark:bg-slate-700">
                  {analysis.studyDistribution.map((item, idx) => (
                    <div
                      key={idx}
                      className={`${getSubjectColor(item.subject)} h-full transition-all`}
                      style={{ width: `${item.percentage}%` }}
                      title={`${item.subject}: ${item.percentage}%`}
                    />
                  ))}
                </div>

                {/* Subject items */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {analysis.studyDistribution.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/80 flex items-center justify-between shadow-2xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${getSubjectColor(item.subject)}`} />
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          {item.subject}
                        </span>
                      </div>
                      <span className={`text-xs font-extrabold ${getSubjectTextColor(item.subject)}`}>
                        {item.percentage}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Section 2: RECOMMENDATIONS */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-purple-600 dark:text-purple-400">
                  RECOMMENDATIONS
                </h3>
                <span className="text-xs text-slate-400 font-medium">• High-Impact Next Steps</span>
              </div>

              <div className="space-y-2.5">
                {analysis.recommendations.map((rec, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-gradient-to-r from-purple-50/50 to-indigo-50/30 dark:from-purple-950/20 dark:to-indigo-950/20 border border-purple-100/80 dark:border-purple-900/30 flex items-start gap-3 transition-colors hover:border-purple-200 dark:hover:border-purple-800"
                  >
                    <div className="w-6 h-6 rounded-full bg-purple-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-snug">
                        {rec}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Coach's Motivation Note */}
            {analysis.coachNote && (
              <div className="p-3.5 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                <p className="text-xs text-indigo-900 dark:text-indigo-200 leading-relaxed italic">
                  &ldquo;{analysis.coachNote}&rdquo;
                </p>
              </div>
            )}

            {/* Fallback Notice (if running on rule engine) */}
            {analysis.fallbackReason && (
              <div className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
                <span>{analysis.fallbackReason}</span>
                <button
                  type="button"
                  onClick={() => loadAnalysis(true)}
                  className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                >
                  Retry AI
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
};
