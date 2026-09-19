import React from 'react';
import { Play, Pause, Maximize2, CheckCircle2 } from 'lucide-react';
import { ActiveFocusTimerState } from '../types';

interface MiniFocusBarProps {
  timerState: ActiveFocusTimerState;
  onOpenFocusModal: () => void;
  onPause: () => void;
  onResume: () => void;
  onComplete: () => void;
}

export const MiniFocusBar: React.FC<MiniFocusBarProps> = ({
  timerState,
  onOpenFocusModal,
  onPause,
  onResume,
  onComplete,
}) => {
  // Only show if session is running or paused
  if (timerState.status !== 'running' && timerState.status !== 'paused') {
    return null;
  }

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const isRunning = timerState.status === 'running';

  return (
    <div
      id="mini-focus-bar"
      className="fixed bottom-3 sm:bottom-4 left-3 right-3 sm:left-auto sm:right-4 z-40 bg-stone-950 text-white rounded-2xl shadow-2xl border border-stone-800 p-2.5 sm:px-4 sm:py-3 flex items-center justify-between sm:justify-start space-x-2 sm:space-x-4 animate-in slide-in-from-bottom-5 duration-200 backdrop-blur-md"
    >
      {/* Status Pulse */}
      <div className="flex items-center space-x-2 min-w-0">
        <span
          className={`w-2.5 h-2.5 rounded-full shrink-0 ${
            isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
          }`}
        />
        <div className="max-w-[110px] sm:max-w-[200px] truncate">
          <span className="text-[10px] text-stone-400 block leading-tight uppercase font-mono">
            {timerState.isBreakPhase ? 'Break' : 'Focus Session'}
          </span>
          <span className="text-xs font-semibold text-stone-100 truncate block">
            {timerState.taskTitle}
          </span>
        </div>
      </div>

      {/* Countdown Timer */}
      <div className="font-mono font-bold text-xs sm:text-base text-emerald-400 px-2 py-0.5 rounded-lg bg-stone-900 border border-stone-800 shrink-0">
        {formatTime(timerState.remainingSeconds)}
      </div>

      {/* Quick Controls */}
      <div className="flex items-center space-x-1 sm:space-x-1.5 shrink-0">
        {isRunning ? (
          <button
            onClick={onPause}
            className="p-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-stone-300 hover:text-white transition-colors"
            title="Pause Focus Session"
          >
            <Pause className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button
            onClick={onResume}
            className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-stone-950 font-bold transition-colors"
            title="Resume Focus Session"
          >
            <Play className="w-3.5 h-3.5 fill-stone-950" />
          </button>
        )}

        <button
          onClick={() => onComplete()}
          className="p-1.5 rounded-lg bg-stone-900 hover:bg-emerald-950 text-emerald-400 transition-colors hidden sm:inline-flex"
          title="Mark Session Complete"
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={onOpenFocusModal}
          className="p-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-stone-300 hover:text-white transition-colors flex items-center space-x-1"
          title="Open Full Distraction-Free Focus Mode"
        >
          <Maximize2 className="w-3.5 h-3.5" />
          <span className="text-[11px] font-medium hidden sm:inline">Open</span>
        </button>
      </div>
    </div>
  );
};
