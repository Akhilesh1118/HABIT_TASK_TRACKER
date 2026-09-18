import { useState, useEffect, useCallback, useRef } from 'react';
import { ActiveFocusTimerState, FocusPresetMode, FocusSession, FocusTimerStatus, TaskCategory } from '../types';
import { storageService } from '../services/storageService';
import { playFocusChime } from '../utils/focusSound';
import { getCurrentIST } from '../utils/timeUtils';

// Mode duration constants in minutes: [focusMinutes, breakMinutes]
export const PRESET_MODES: Record<'25/5' | '50/10' | '90/15', { focus: number; break: number; label: string }> = {
  '25/5': { focus: 25, break: 5, label: '25 / 5 (Standard Pomodoro)' },
  '50/10': { focus: 50, break: 10, label: '50 / 10 (Deep Focus)' },
  '90/15': { focus: 90, break: 15, label: '90 / 15 (Ultradian Cycle)' },
};

export interface StartSessionOptions {
  taskId?: string;
  taskTitle: string;
  taskCategory?: TaskCategory;
  isHabit?: boolean;
  autoMarkTaskComplete?: boolean;
  mode?: FocusPresetMode;
  customFocusMinutes?: number;
  customBreakMinutes?: number;
  date?: string;
}

// Module-level interval to strictly prevent multiple concurrent timers across re-renders
let globalTimerInterval: any = null;

function clearGlobalTimer(): void {
  if (globalTimerInterval) {
    clearInterval(globalTimerInterval);
    globalTimerInterval = null;
  }
}

export function useFocusTimer(
  todayDate: string,
  onTaskCompleteRequested?: (taskId: string, isHabit: boolean) => void,
  onSessionSaved?: (session: FocusSession) => void
) {
  const [timerState, setTimerState] = useState<ActiveFocusTimerState>(() => {
    // 1. Attempt to restore active session from localStorage
    const saved = storageService.getActiveTimerState();
    if (saved) {
      // Avoid incorrect time calculations on restore:
      if (saved.status === 'running' && saved.targetEndTime) {
        const now = Date.now();
        if (saved.targetEndTime > now) {
          // Timer was running while tab was closed/reloaded; compute exact remaining seconds without drift
          const remaining = Math.max(0, Math.ceil((saved.targetEndTime - now) / 1000));
          const elapsed = Math.max(0, saved.totalSeconds - remaining);
          return {
            ...saved,
            remainingSeconds: remaining,
            elapsedSeconds: elapsed,
            lastTickAt: now,
          };
        } else {
          // Timer expired while page was away
          return {
            ...saved,
            remainingSeconds: 0,
            elapsedSeconds: saved.totalSeconds,
            status: 'completed',
            targetEndTime: null,
            lastTickAt: now,
          };
        }
      }
      return saved;
    }

    // Default initial idle state
    const defaultMode: FocusPresetMode = '50/10';
    const focusMins = PRESET_MODES['50/10'].focus;
    return {
      sessionId: `foc_${Date.now()}`,
      taskTitle: '📚 CGL General Awareness',
      taskCategory: 'SSC CGL',
      isHabit: false,
      autoMarkTaskComplete: true,
      mode: defaultMode,
      focusMinutes: focusMins,
      breakMinutes: PRESET_MODES['50/10'].break,
      isBreakPhase: false,
      totalSeconds: focusMins * 60,
      remainingSeconds: focusMins * 60,
      targetEndTime: null,
      status: 'idle',
      lastTickAt: Date.now(),
      elapsedSeconds: 0,
      startedAt: new Date().toISOString(),
    };
  });

  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const stateRef = useRef(timerState);
  stateRef.current = timerState;

  // Persist state changes to storage
  useEffect(() => {
    storageService.saveActiveTimerState(timerState);
  }, [timerState]);

  // Main timer tick engine: Accurate wall-clock calculation
  const tick = useCallback(() => {
    const curr = stateRef.current;
    if (curr.status !== 'running' || !curr.targetEndTime) return;

    const now = Date.now();
    const remaining = Math.max(0, Math.ceil((curr.targetEndTime - now) / 1000));
    const elapsed = Math.max(0, curr.totalSeconds - remaining);

    if (remaining <= 0) {
      clearGlobalTimer();

      // Phase completion handling
      if (!curr.isBreakPhase) {
        // Focus session finished!
        if (soundEnabled) {
          playFocusChime('focus_complete');
        }

        // Record completed focus session in permanent storage
        const sessionDate = curr.startedAt ? getCurrentIST(new Date(curr.startedAt)).dateStr : todayDate;
        const completedRecord: FocusSession = {
          id: curr.sessionId,
          taskId: curr.taskId,
          taskTitle: curr.taskTitle,
          taskCategory: curr.taskCategory,
          isHabit: curr.isHabit,
          mode: curr.mode,
          targetFocusMinutes: curr.focusMinutes,
          actualSecondsSpent: curr.totalSeconds,
          date: sessionDate,
          startedAt: curr.startedAt,
          completedAt: new Date().toISOString(),
          wasCompletedNaturally: true,
        };
        storageService.saveFocusSession(completedRecord);
        if (onSessionSaved) {
          onSessionSaved(completedRecord);
        }

        // Auto-complete linked task if option is enabled (default true) and taskId exists
        if (curr.autoMarkTaskComplete !== false && curr.taskId && onTaskCompleteRequested) {
          onTaskCompleteRequested(curr.taskId, Boolean(curr.isHabit));
        }

        setTimerState((prev) => ({
          ...prev,
          remainingSeconds: 0,
          elapsedSeconds: prev.totalSeconds,
          targetEndTime: null,
          status: 'completed',
          lastTickAt: now,
        }));
      } else {
        // Break phase finished!
        if (soundEnabled) {
          playFocusChime('break_complete');
        }
        setTimerState((prev) => ({
          ...prev,
          remainingSeconds: 0,
          elapsedSeconds: prev.totalSeconds,
          targetEndTime: null,
          status: 'completed',
          lastTickAt: now,
        }));
      }
    } else {
      setTimerState((prev) => ({
        ...prev,
        remainingSeconds: remaining,
        elapsedSeconds: elapsed,
        lastTickAt: now,
      }));
    }
  }, [soundEnabled, todayDate, onSessionSaved, onTaskCompleteRequested]);

  // Setup interval when running, guarantee only 1 interval exists
  useEffect(() => {
    if (timerState.status === 'running') {
      clearGlobalTimer();
      // Tick every 250ms for responsive display and smooth accuracy without CPU overhead
      globalTimerInterval = setInterval(tick, 250);
    } else {
      clearGlobalTimer();
    }

    return () => {
      clearGlobalTimer();
    };
  }, [timerState.status, tick]);

  // Actions: Start
  const start = useCallback((options?: StartSessionOptions) => {
    clearGlobalTimer();

    setTimerState((prev) => {
      const mode = options?.mode || prev.mode;
      let focusMins = prev.focusMinutes;
      let breakMins = prev.breakMinutes;

      if (mode === 'custom') {
        focusMins = options?.customFocusMinutes || prev.focusMinutes || 50;
        breakMins = options?.customBreakMinutes || prev.breakMinutes || 10;
      } else if (mode in PRESET_MODES) {
        focusMins = PRESET_MODES[mode as keyof typeof PRESET_MODES].focus;
        breakMins = PRESET_MODES[mode as keyof typeof PRESET_MODES].break;
      }

      const totalSecs = focusMins * 60;
      const now = Date.now();
      const targetEnd = now + totalSecs * 1000;

      if (soundEnabled) {
        playFocusChime('start');
      }

      return {
        sessionId: `foc_${now}`,
        taskId: options?.taskId !== undefined ? options.taskId : prev.taskId,
        taskTitle: options?.taskTitle || prev.taskTitle || '📚 CGL General Awareness',
        taskCategory: options?.taskCategory || prev.taskCategory || 'SSC CGL',
        isHabit: options?.isHabit !== undefined ? options.isHabit : prev.isHabit,
        autoMarkTaskComplete: options?.autoMarkTaskComplete !== undefined ? options.autoMarkTaskComplete : (prev.autoMarkTaskComplete !== undefined ? prev.autoMarkTaskComplete : true),
        mode,
        focusMinutes: focusMins,
        breakMinutes: breakMins,
        isBreakPhase: false,
        totalSeconds: totalSecs,
        remainingSeconds: totalSecs,
        targetEndTime: targetEnd,
        status: 'running',
        lastTickAt: now,
        elapsedSeconds: 0,
        startedAt: new Date().toISOString(),
      };
    });
  }, [soundEnabled]);

  // Actions: Pause
  const pause = useCallback(() => {
    clearGlobalTimer();
    setTimerState((prev) => {
      if (prev.status !== 'running') return prev;
      return {
        ...prev,
        status: 'paused',
        targetEndTime: null,
        lastTickAt: Date.now(),
      };
    });
  }, []);

  // Actions: Resume
  const resume = useCallback(() => {
    clearGlobalTimer();
    setTimerState((prev) => {
      if (prev.status !== 'paused') return prev;
      const now = Date.now();
      const targetEnd = now + prev.remainingSeconds * 1000;
      return {
        ...prev,
        status: 'running',
        targetEndTime: targetEnd,
        lastTickAt: now,
      };
    });
  }, []);

  // Actions: Stop
  const stop = useCallback((confirmPrompt: boolean = false) => {
    const curr = stateRef.current;
    if (confirmPrompt && timerState.status === 'running') {
      const ok = window.confirm('Are you sure you want to stop this focus session?');
      if (!ok) return;
    }

    clearGlobalTimer();

    // If session had meaningful elapsed time spent (>= 10 seconds) and was not a break phase, save the focus session!
    if (!curr.isBreakPhase && curr.elapsedSeconds >= 10) {
      const sessionDate = curr.startedAt ? getCurrentIST(new Date(curr.startedAt)).dateStr : todayDate;
      const stoppedRecord: FocusSession = {
        id: curr.sessionId,
        taskId: curr.taskId,
        taskTitle: curr.taskTitle,
        taskCategory: curr.taskCategory,
        isHabit: curr.isHabit,
        mode: curr.mode,
        targetFocusMinutes: curr.focusMinutes,
        actualSecondsSpent: curr.elapsedSeconds,
        date: sessionDate,
        startedAt: curr.startedAt,
        completedAt: new Date().toISOString(),
        wasCompletedNaturally: false,
      };
      storageService.saveFocusSession(stoppedRecord);
      if (onSessionSaved) {
        onSessionSaved(stoppedRecord);
      }
    }

    setTimerState((prev) => {
      const defaultSecs = prev.focusMinutes * 60;
      return {
        ...prev,
        status: 'idle',
        isBreakPhase: false,
        totalSeconds: defaultSecs,
        remainingSeconds: defaultSecs,
        elapsedSeconds: 0,
        targetEndTime: null,
        lastTickAt: Date.now(),
      };
    });
    storageService.clearActiveTimerState();
  }, [timerState.status, todayDate, onSessionSaved]);

  // Actions: Complete session early or finalize
  const complete = useCallback((markTaskDone: boolean = true) => {
    clearGlobalTimer();
    const curr = stateRef.current;
    const now = Date.now();

    const actualSecs = curr.isBreakPhase ? 0 : Math.max(1, curr.elapsedSeconds);

    // Save completed session if not in break phase
    if (!curr.isBreakPhase && actualSecs > 0) {
      const sessionDate = curr.startedAt ? getCurrentIST(new Date(curr.startedAt)).dateStr : todayDate;
      const completedRecord: FocusSession = {
        id: curr.sessionId,
        taskId: curr.taskId,
        taskTitle: curr.taskTitle,
        taskCategory: curr.taskCategory,
        isHabit: curr.isHabit,
        mode: curr.mode,
        targetFocusMinutes: curr.focusMinutes,
        actualSecondsSpent: actualSecs,
        date: sessionDate,
        startedAt: curr.startedAt,
        completedAt: new Date().toISOString(),
        wasCompletedNaturally: curr.remainingSeconds === 0,
      };
      storageService.saveFocusSession(completedRecord);
      if (onSessionSaved) {
        onSessionSaved(completedRecord);
      }
    }

    if (soundEnabled) {
      playFocusChime('focus_complete');
    }

    // If requested, mark associated task / habit completed in parent
    if (markTaskDone && curr.taskId && onTaskCompleteRequested) {
      onTaskCompleteRequested(curr.taskId, Boolean(curr.isHabit));
    }

    setTimerState((prev) => ({
      ...prev,
      status: 'completed',
      remainingSeconds: 0,
      targetEndTime: null,
      lastTickAt: now,
    }));
  }, [soundEnabled, todayDate, onTaskCompleteRequested, onSessionSaved]);

  // Start break phase
  const startBreak = useCallback(() => {
    clearGlobalTimer();
    setTimerState((prev) => {
      const breakSecs = (prev.breakMinutes || 5) * 60;
      const now = Date.now();
      const targetEnd = now + breakSecs * 1000;
      return {
        ...prev,
        isBreakPhase: true,
        totalSeconds: breakSecs,
        remainingSeconds: breakSecs,
        elapsedSeconds: 0,
        targetEndTime: targetEnd,
        status: 'running',
        lastTickAt: now,
      };
    });
  }, []);

  // Mode Selection
  const setMode = useCallback((mode: FocusPresetMode, customFocus?: number, customBreak?: number) => {
    setTimerState((prev) => {
      // If timer is running, prompt or reset
      let focusMins = prev.focusMinutes;
      let breakMins = prev.breakMinutes;

      if (mode === 'custom') {
        focusMins = customFocus || prev.focusMinutes || 50;
        breakMins = customBreak || prev.breakMinutes || 10;
      } else if (mode in PRESET_MODES) {
        focusMins = PRESET_MODES[mode as keyof typeof PRESET_MODES].focus;
        breakMins = PRESET_MODES[mode as keyof typeof PRESET_MODES].break;
      }

      const totalSecs = focusMins * 60;

      // If idle, update duration directly
      if (prev.status === 'idle' || prev.status === 'completed') {
        return {
          ...prev,
          mode,
          focusMinutes: focusMins,
          breakMinutes: breakMins,
          isBreakPhase: false,
          totalSeconds: totalSecs,
          remainingSeconds: totalSecs,
          elapsedSeconds: 0,
          status: 'idle',
          targetEndTime: null,
        };
      }

      // If paused or running, update config mode
      return {
        ...prev,
        mode,
        focusMinutes: focusMins,
        breakMinutes: breakMins,
      };
    });
  }, []);

  // Associate task with session
  const setTask = useCallback((task: { id?: string; title: string; category?: TaskCategory; isHabit?: boolean }) => {
    setTimerState((prev) => ({
      ...prev,
      taskId: task.id,
      taskTitle: task.title,
      taskCategory: task.category || prev.taskCategory,
      isHabit: task.isHabit,
      autoMarkTaskComplete: true,
    }));
  }, []);

  // Update auto-mark complete preference
  const setAutoMarkTaskComplete = useCallback((enabled: boolean) => {
    setTimerState((prev) => ({
      ...prev,
      autoMarkTaskComplete: enabled,
    }));
  }, []);

  return {
    timerState,
    soundEnabled,
    setSoundEnabled,
    start,
    pause,
    resume,
    stop,
    complete,
    startBreak,
    setMode,
    setTask,
    setAutoMarkTaskComplete,
  };
}
