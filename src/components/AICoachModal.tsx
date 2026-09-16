import React, { useEffect } from 'react';
import { X, Sparkles, Brain } from 'lucide-react';
import { AICoachCard } from './AICoachCard';

interface AICoachModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetDateStr?: string;
}

export const AICoachModal: React.FC<AICoachModalProps> = ({
  isOpen,
  onClose,
  targetDateStr = '2026-09-15',
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      id="ai-coach-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-coach-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 md:p-6"
    >
      <div
        id="ai-coach-modal-container"
        className="relative bg-white dark:bg-slate-900 rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-indigo-100 dark:border-indigo-900/50 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Modal Top Bar */}
        <div className="px-6 py-4 border-b border-stone-200 dark:border-slate-800 flex items-center justify-between bg-stone-50/70 dark:bg-slate-900/80">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Brain className="w-4 h-4" />
            </div>
            <div>
              <h2 id="ai-coach-modal-title" className="text-sm font-bold text-stone-900 dark:text-white leading-tight">
                AI Productivity Coach
              </h2>
              <p className="text-[11px] text-stone-500 dark:text-slate-400">
                Data-grounded weekly synthesis & tactical recommendations
              </p>
            </div>
          </div>

          <button
            type="button"
            id="btn-close-ai-coach-modal"
            onClick={onClose}
            aria-label="Close AI Coach modal"
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-200/60 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <AICoachCard targetDateStr={targetDateStr} className="border-0 shadow-none" />
        </div>
      </div>
    </div>
  );
};
