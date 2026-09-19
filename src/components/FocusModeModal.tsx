import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  CheckCircle2,
  Square,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  X,
  Coffee,
  Sparkles,
  ChevronDown,
  History,
  RotateCcw,
  Sliders,
  Check,
} from 'lucide-react';
import { ActiveFocusTimerState, DailySummaryItem, FocusPresetMode, FocusSession, TaskCategory } from '../types';
import { PRESET_MODES } from '../hooks/useFocusTimer';
import { storageService } from '../services/storageService';

interface FocusModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  timerState: ActiveFocusTimerState;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onComplete: (markTaskDone?: boolean) => void;
  onStartBreak: () => void;
  onSelectMode: (mode: FocusPresetMode, customFocus?: number, customBreak?: number) => void;
  onSelectTask: (task: { id?: string; title: string; category?: TaskCategory; isHabit?: boolean }) => void;
  onToggleAutoMarkTaskComplete?: (enabled: boolean) => void;
  todayTasks: DailySummaryItem[];
  todayDate: string;
}

export const FocusModeModal: React.FC<FocusModeModalProps> = ({
  isOpen,
  onClose,
  timerState,
  soundEnabled,
  onToggleSound,
  onStart,
  onPause,
  onResume,
  onStop,
  onComplete,
  onStartBreak,
  onSelectMode,
  onSelectTask,
  onToggleAutoMarkTaskComplete,
  todayTasks,
  todayDate,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showTaskPicker, setShowTaskPicker] = useState(false);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customFocusInput, setCustomFocusInput] = useState('45');
  const [customBreakInput, setCustomBreakInput] = useState('10');
  const [showHistory, setShowHistory] = useState(false);
  const [customTaskInput, setCustomTaskInput] = useState('');
  const [markTaskCompleteCheckbox, setMarkTaskCompleteCheckbox] = useState(
    timerState.autoMarkTaskComplete !== false
  );

  useEffect(() => {
    if (timerState.autoMarkTaskComplete !== undefined) {
      setMarkTaskCompleteCheckbox(timerState.autoMarkTaskComplete);
    }
  }, [timerState.autoMarkTaskComplete]);

  // Completed sessions for today
  const [todaySessions, setTodaySessions] = useState<FocusSession[]>([]);

  const refreshSessions = () => {
    const list = storageService.getFocusSessionsForDate(todayDate);
    setTodaySessions(list);
  };

  useEffect(() => {
    if (isOpen) {
      refreshSessions();
    }
  }, [isOpen, todayDate, timerState.status]);

  if (!isOpen) return null;

  // Format MM:SS or HH:MM:SS
  const formatTime = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    if (hrs > 0) {
      return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Calculate percentage of elapsed progress
  const progressPercent =
    timerState.totalSeconds > 0
      ? Math.min(100, Math.round((timerState.elapsedSeconds / timerState.totalSeconds) * 100))
      : 0;

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
      }
    }
  };

  const handleApplyCustom = () => {
    const fMins = Math.max(1, Math.min(240, parseInt(customFocusInput, 10) || 25));
    const bMins = Math.max(1, Math.min(60, parseInt(customBreakInput, 10) || 5));
    onSelectMode('custom', fMins, bMins);
    setShowCustomModal(false);
  };

  const handleSelectTaskItem = (item: DailySummaryItem) => {
    onSelectTask({
      id: item.id,
      title: item.title,
      category: item.category,
      isHabit: item.isHabit,
    });
    setShowTaskPicker(false);
  };

  const handleApplyCustomTask = () => {
    if (!customTaskInput.trim()) return;
    onSelectTask({
      title: customTaskInput.trim(),
      category: 'Other',
    });
    setCustomTaskInput('');
    setShowTaskPicker(false);
  };

  const totalFocusSecondsToday = todaySessions.reduce((sum, s) => sum + s.actualSecondsSpent, 0);
  const totalFocusMinutesToday = Math.round(totalFocusSecondsToday / 60);

  return (
    <div
      id="focus-mode-backdrop"
      className="fixed inset-0 z-50 flex flex-col bg-stone-950 text-stone-100 selection:bg-emerald-800 selection:text-white overflow-y-auto"
    >
      {/* Top Bar Navigation */}
      <header className="w-full max-w-5xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between shrink-0">
        {/* Brand / Mode Badge */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          <div className="flex items-center space-x-1.5 sm:space-x-2 px-2.5 sm:px-3 py-1 rounded-full bg-stone-900 border border-stone-800 text-[11px] sm:text-xs font-semibold text-emerald-400">
            <span className={`w-2 h-2 rounded-full ${timerState.status === 'running' ? 'bg-emerald-400 animate-pulse' : 'bg-stone-500'}`} />
            <span>
              {timerState.isBreakPhase
                ? '☕ Break Phase'
                : timerState.status === 'running'
                ? '🎯 Active Focus'
                : timerState.status === 'paused'
                ? '⏸ Paused'
                : timerState.status === 'completed'
                ? '🎉 Session Finished'
                : 'Distraction-Free Focus'}
            </span>
          </div>

          <span className="hidden sm:inline-block text-xs text-stone-500 font-mono">
            {todaySessions.length} session{todaySessions.length === 1 ? '' : 's'} today ({totalFocusMinutesToday}m)
          </span>
        </div>

        {/* Right utility buttons */}
        <div className="flex items-center space-x-1.5 sm:space-x-2">
          {/* History Toggle */}
          <button
            id="focus-history-btn"
            onClick={() => setShowHistory(!showHistory)}
            className={`p-1.5 sm:p-2 rounded-lg text-xs font-medium border transition-colors flex items-center space-x-1 ${
              showHistory
                ? 'bg-stone-800 text-emerald-400 border-stone-700'
                : 'bg-stone-900 hover:bg-stone-800 text-stone-400 border-stone-800'
            }`}
            title="View today's focus session history"
          >
            <History className="w-4 h-4" />
            <span className="hidden md:inline">History</span>
          </button>

          {/* Sound Toggle */}
          <button
            id="focus-sound-btn"
            onClick={onToggleSound}
            className="p-1.5 sm:p-2 rounded-lg bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-stone-200 border border-stone-800 transition-colors"
            title={soundEnabled ? 'Chime sound enabled' : 'Chime muted'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Fullscreen Toggle */}
          <button
            id="focus-fullscreen-btn"
            onClick={toggleFullscreen}
            className="p-1.5 sm:p-2 rounded-lg bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-stone-200 border border-stone-800 transition-colors hidden sm:inline-flex"
            title="Toggle fullscreen distraction-free mode"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Minimize / Close */}
          <button
            id="focus-minimize-btn"
            onClick={onClose}
            className="p-1.5 sm:p-2 rounded-lg bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-white border border-stone-800 transition-colors flex items-center space-x-1"
            title="Minimize focus mode to background"
          >
            <X className="w-4 h-4" />
            <span className="text-xs hidden sm:inline">Minimize</span>
          </button>
        </div>
      </header>

      {/* Main Distraction-Free Center Stage */}
      <main className="flex-1 flex flex-col items-center justify-center px-3 sm:px-4 py-4 sm:py-8 max-w-3xl w-full mx-auto text-center">
        {/* Task Selector Banner */}
        <div className="relative mb-4 sm:mb-6 w-full max-w-xl">
          <button
            id="focus-task-select-trigger"
            onClick={() => setShowTaskPicker(!showTaskPicker)}
            disabled={timerState.status === 'running'}
            className={`w-full group px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl border transition-all flex items-center justify-between ${
              timerState.status === 'running'
                ? 'bg-stone-900/70 border-stone-800/80 cursor-default'
                : 'bg-stone-900 hover:bg-stone-850 border-stone-800 hover:border-stone-700 cursor-pointer shadow-lg'
            }`}
          >
            <div className="text-left flex-1 min-w-0 pr-2 sm:pr-3">
              <span className="text-[10px] sm:text-[11px] font-semibold tracking-wider text-emerald-400 uppercase block mb-0.5">
                Current Objective
              </span>
              <h2 className="text-base sm:text-xl font-bold text-white tracking-tight truncate">
                {timerState.taskTitle}
              </h2>
            </div>

            {timerState.status !== 'running' && (
              <div className="flex items-center space-x-1 text-xs text-stone-400 group-hover:text-stone-200 shrink-0">
                <span>Switch</span>
                <ChevronDown className="w-4 h-4" />
              </div>
            )}
          </button>

          {/* Task Picker Dropdown */}
          {showTaskPicker && timerState.status !== 'running' && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-stone-900 border border-stone-800 rounded-2xl shadow-2xl z-30 p-3 text-left max-h-80 overflow-y-auto">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-stone-800">
                <span className="text-xs font-semibold text-stone-400">Select Today&apos;s Task or Habit</span>
                <button
                  onClick={() => setShowTaskPicker(false)}
                  className="text-stone-500 hover:text-stone-300 text-xs"
                >
                  Close
                </button>
              </div>

              {/* Tasks List */}
              <div className="space-y-1 mb-3">
                {todayTasks.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleSelectTaskItem(item)}
                    className="w-full text-left px-3 py-2 rounded-xl text-sm hover:bg-stone-800 transition-colors flex items-center justify-between group"
                  >
                    <div className="truncate pr-2">
                      <span className="text-stone-200 font-medium group-hover:text-white">
                        {item.title}
                      </span>
                      <span className="text-[10px] text-stone-500 block">
                        {item.category} {item.isHabit ? '• Habit' : ''}
                      </span>
                    </div>
                    {timerState.taskId === item.id && (
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    )}
                  </button>
                ))}
              </div>

              {/* Custom Objective Input */}
              <div className="pt-2 border-t border-stone-800">
                <span className="text-[11px] text-stone-400 font-semibold block mb-1.5">
                  Or Enter Custom Focus Title:
                </span>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={customTaskInput}
                    onChange={(e) => setCustomTaskInput(e.target.value)}
                    placeholder="e.g. SSC CGL Math Mock Test"
                    className="flex-1 bg-stone-950 border border-stone-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-stone-600 focus:outline-none focus:border-emerald-500"
                    onKeyDown={(e) => e.key === 'Enter' && handleApplyCustomTask()}
                  />
                  <button
                    onClick={handleApplyCustomTask}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl"
                  >
                    Set
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Large Timer Display Card */}
        <div className="relative flex flex-col items-center justify-center p-5 sm:p-10 w-full max-w-lg rounded-3xl bg-stone-900/40 border border-stone-800/80 shadow-2xl backdrop-blur-sm">
          {/* Circular / Line Progress Track */}
          <div className="w-full h-1.5 bg-stone-800 rounded-full mb-6 sm:mb-8 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                timerState.isBreakPhase ? 'bg-sky-400' : 'bg-emerald-500'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Time Display */}
          <div
            id="focus-timer-clock-display"
            className="text-5xl sm:text-8xl font-black font-mono tracking-tight text-white mb-3 sm:mb-4 select-none drop-shadow-sm"
          >
            {formatTime(timerState.remainingSeconds)}
          </div>

          {/* Elapsed / Target Context */}
          <div className="flex items-center space-x-2 text-xs sm:text-sm text-stone-400 font-mono mb-8">
            <span>Elapsed: {formatTime(timerState.elapsedSeconds)}</span>
            <span>•</span>
            <span>Target: {timerState.focusMinutes}m</span>
            <span>•</span>
            <span className="text-emerald-400 font-semibold">{progressPercent}%</span>
          </div>

          {/* Primary Controls Row */}
          <div className="flex flex-wrap items-center justify-center gap-3 w-full">
            {/* Start Button (Idle) */}
            {timerState.status === 'idle' && (
              <button
                id="focus-start-btn"
                onClick={onStart}
                className="flex items-center justify-center space-x-2 px-8 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold text-base shadow-lg shadow-emerald-950/50 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <Play className="w-5 h-5 fill-stone-950" />
                <span>Start</span>
              </button>
            )}

            {/* Pause Button (Running) */}
            {timerState.status === 'running' && (
              <button
                id="focus-pause-btn"
                onClick={onPause}
                className="flex items-center justify-center space-x-2 px-7 py-3.5 rounded-2xl bg-stone-800 hover:bg-stone-750 text-white font-bold text-base border border-stone-700 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <Pause className="w-5 h-5 fill-white" />
                <span>Pause</span>
              </button>
            )}

            {/* Resume Button (Paused) */}
            {timerState.status === 'paused' && (
              <button
                id="focus-resume-btn"
                onClick={onResume}
                className="flex items-center justify-center space-x-2 px-7 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold text-base shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <Play className="w-5 h-5 fill-stone-950" />
                <span>Resume</span>
              </button>
            )}

            {/* Complete Button (Available during running, paused or when finished) */}
            {(timerState.status === 'running' || timerState.status === 'paused') && (
              <button
                id="focus-complete-btn"
                onClick={() => onComplete(markTaskCompleteCheckbox)}
                className="flex items-center justify-center space-x-2 px-6 py-3.5 rounded-2xl bg-stone-900 hover:bg-emerald-950/70 text-emerald-400 hover:text-emerald-300 font-bold text-base border border-emerald-800/60 transition-all"
                title="Save completed focus session"
              >
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span>Complete</span>
              </button>
            )}

            {/* Stop Button (Running or Paused) */}
            {(timerState.status === 'running' || timerState.status === 'paused') && (
              <button
                id="focus-stop-btn"
                onClick={onStop}
                className="flex items-center justify-center space-x-1.5 px-4 py-3.5 rounded-2xl bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-stone-200 text-sm font-semibold border border-stone-800 transition-colors"
                title="Stop and reset session"
              >
                <Square className="w-4 h-4" />
                <span>Stop</span>
              </button>
            )}

            {/* Session Completed Phase Controls */}
            {timerState.status === 'completed' && (
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full justify-center">
                <button
                  id="focus-break-btn"
                  onClick={onStartBreak}
                  className="w-full sm:w-auto flex items-center justify-center space-x-2 px-6 py-3 rounded-2xl bg-sky-500 hover:bg-sky-400 text-stone-950 font-bold text-sm shadow-md transition-all"
                >
                  <Coffee className="w-4 h-4" />
                  <span>Start {timerState.breakMinutes}m Break</span>
                </button>
                <button
                  id="focus-new-session-btn"
                  onClick={onStart}
                  className="w-full sm:w-auto flex items-center justify-center space-x-2 px-6 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold text-sm shadow-md transition-all"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Start Next Session</span>
                </button>
              </div>
            )}
          </div>

          {/* Option: Check off task upon complete */}
          {timerState.taskId && (timerState.status === 'running' || timerState.status === 'paused') && (
            <label className="mt-5 flex items-center space-x-2 text-xs text-stone-400 cursor-pointer hover:text-stone-300 select-none">
              <input
                type="checkbox"
                checked={markTaskCompleteCheckbox}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setMarkTaskCompleteCheckbox(checked);
                  if (onToggleAutoMarkTaskComplete) {
                    onToggleAutoMarkTaskComplete(checked);
                  }
                }}
                className="w-3.5 h-3.5 rounded border-stone-700 bg-stone-900 text-emerald-500 focus:ring-emerald-500/20"
              />
              <span>Also mark &quot;{timerState.taskTitle}&quot; as completed when finished</span>
            </label>
          )}
        </div>

        {/* Mode Selector Row */}
        <div className="mt-8 flex flex-col items-center space-y-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
            Selectable Duration Modes
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {/* 25 / 5 */}
            <button
              id="mode-25-5-btn"
              disabled={timerState.status === 'running'}
              onClick={() => onSelectMode('25/5')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all border ${
                timerState.mode === '25/5'
                  ? 'bg-stone-800 text-emerald-400 border-emerald-500/50 shadow-sm'
                  : 'bg-stone-900 text-stone-400 border-stone-800 hover:bg-stone-850 hover:text-stone-200'
              } ${timerState.status === 'running' ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              25 / 5
            </button>

            {/* 50 / 10 */}
            <button
              id="mode-50-10-btn"
              disabled={timerState.status === 'running'}
              onClick={() => onSelectMode('50/10')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all border ${
                timerState.mode === '50/10'
                  ? 'bg-stone-800 text-emerald-400 border-emerald-500/50 shadow-sm'
                  : 'bg-stone-900 text-stone-400 border-stone-800 hover:bg-stone-850 hover:text-stone-200'
              } ${timerState.status === 'running' ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              50 / 10
            </button>

            {/* 90 / 15 */}
            <button
              id="mode-90-15-btn"
              disabled={timerState.status === 'running'}
              onClick={() => onSelectMode('90/15')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all border ${
                timerState.mode === '90/15'
                  ? 'bg-stone-800 text-emerald-400 border-emerald-500/50 shadow-sm'
                  : 'bg-stone-900 text-stone-400 border-stone-800 hover:bg-stone-850 hover:text-stone-200'
              } ${timerState.status === 'running' ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              90 / 15
            </button>

            {/* Custom Mode */}
            <button
              id="mode-custom-btn"
              disabled={timerState.status === 'running'}
              onClick={() => setShowCustomModal(true)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all border flex items-center space-x-1.5 ${
                timerState.mode === 'custom'
                  ? 'bg-stone-800 text-emerald-400 border-emerald-500/50 shadow-sm'
                  : 'bg-stone-900 text-stone-400 border-stone-800 hover:bg-stone-850 hover:text-stone-200'
              } ${timerState.status === 'running' ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>
                {timerState.mode === 'custom'
                  ? `${timerState.focusMinutes} / ${timerState.breakMinutes} (Custom)`
                  : 'Custom'}
              </span>
            </button>
          </div>

          <p className="text-[11px] text-stone-600 max-w-sm">
            {timerState.mode === '25/5' && 'Standard Pomodoro technique for quick sprint tasks.'}
            {timerState.mode === '50/10' && 'Deep Work block ideal for SSC CGL syllabus & complex coding.'}
            {timerState.mode === '90/15' && 'Ultradian rhythm session for full-length mock exams.'}
            {timerState.mode === 'custom' && `Custom focus: ${timerState.focusMinutes}m, break: ${timerState.breakMinutes}m.`}
          </p>
        </div>

        {/* Custom Duration Config Dialog */}
        {showCustomModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-stone-950/80 backdrop-blur-xs">
            <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 max-w-xs w-full text-left shadow-2xl">
              <h3 className="text-sm font-bold text-white mb-3">Custom Focus Duration</h3>
              <div className="space-y-3 mb-4">
                <div>
                  <label className="block text-xs text-stone-400 mb-1">Focus Duration (Minutes):</label>
                  <input
                    type="number"
                    min="1"
                    max="240"
                    value={customFocusInput}
                    onChange={(e) => setCustomFocusInput(e.target.value)}
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-stone-400 mb-1">Break Duration (Minutes):</label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={customBreakInput}
                    onChange={(e) => setCustomBreakInput(e.target.value)}
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setShowCustomModal(false)}
                  className="px-3 py-1.5 text-xs text-stone-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApplyCustom}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl"
                >
                  Apply Mode
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* History Slide-Out / Bottom Panel */}
      {showHistory && (
        <aside className="w-full max-w-3xl mx-auto px-4 pb-8 shrink-0 border-t border-stone-900 pt-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <h4 className="text-xs font-bold text-stone-300 uppercase tracking-wider">
                Today&apos;s Completed Focus Sessions ({todayDate})
              </h4>
            </div>
            <span className="text-xs text-emerald-400 font-mono font-semibold">
              Total: {totalFocusMinutesToday} mins
            </span>
          </div>

          {todaySessions.length === 0 ? (
            <div className="p-4 rounded-xl bg-stone-900/50 border border-stone-900 text-center text-xs text-stone-500">
              No completed focus sessions logged today yet. Complete a session above to record it!
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {todaySessions.map((session) => (
                <div
                  key={session.id}
                  className="p-3 rounded-xl bg-stone-900/60 border border-stone-850 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-semibold text-white block">{session.taskTitle}</span>
                    <span className="text-stone-500 text-[10px]">
                      Mode: {session.mode} • Target: {session.targetFocusMinutes}m •{' '}
                      {new Date(session.completedAt).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-mono text-emerald-400 font-semibold">
                      +{Math.round(session.actualSecondsSpent / 60)} mins
                    </span>
                    <span className="block text-[10px] text-stone-500">
                      {session.wasCompletedNaturally ? 'Full Target' : 'Partial'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>
      )}
    </div>
  );
};
