import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  CheckCircle2,
  X,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Coffee,
  RotateCcw,
  Sparkles,
  Wind,
  Headphones,
  Sliders,
  ChevronDown,
  Plus,
  Check,
  Star,
  Compass,
} from 'lucide-react';
import { ActiveFocusTimerState, DailySummaryItem, TaskCategory } from '../types';
import { ambientAudio, AmbientSoundType } from '../utils/ambientAudio';
import { screenWakeLock } from '../utils/screenWakeLock';

export type ZenTheme = 'obsidian' | 'forest' | 'indigo' | 'candle';

interface ZenFocusModeProps {
  isOpen: boolean;
  onClose: () => void;
  timerState: ActiveFocusTimerState;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onComplete: (markTaskDone?: boolean) => void;
  onStartBreak: () => void;
  onAddTime?: (minutes: number) => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  todayTasks?: DailySummaryItem[];
  onSelectTask?: (task: { id?: string; title: string; category?: TaskCategory; isHabit?: boolean }) => void;
}

const THEME_STYLES: Record<
  ZenTheme,
  {
    name: string;
    bg: string;
    glow: string;
    accent: string;
    accentText: string;
    timerColor: string;
    border: string;
    cardBg: string;
  }
> = {
  obsidian: {
    name: 'Obsidian Void',
    bg: 'bg-stone-950',
    glow: 'from-emerald-950/20 via-stone-950 to-stone-950',
    accent: 'bg-emerald-500 hover:bg-emerald-400 text-stone-950',
    accentText: 'text-emerald-400',
    timerColor: 'text-emerald-400',
    border: 'border-stone-800/80',
    cardBg: 'bg-stone-900/60',
  },
  forest: {
    name: 'Deep Forest',
    bg: 'bg-[#06140d]',
    glow: 'from-emerald-950/30 via-[#06140d] to-[#040e09]',
    accent: 'bg-emerald-400 hover:bg-emerald-300 text-emerald-950',
    accentText: 'text-emerald-300',
    timerColor: 'text-emerald-300',
    border: 'border-emerald-900/50',
    cardBg: 'bg-[#0a1e14]/60',
  },
  indigo: {
    name: 'Starlit Indigo',
    bg: 'bg-[#080b16]',
    glow: 'from-indigo-950/30 via-[#080b16] to-[#05070e]',
    accent: 'bg-indigo-400 hover:bg-indigo-300 text-indigo-950',
    accentText: 'text-indigo-300',
    timerColor: 'text-indigo-300',
    border: 'border-indigo-900/50',
    cardBg: 'bg-[#0f152b]/60',
  },
  candle: {
    name: 'Warm Hearth',
    bg: 'bg-[#120a05]',
    glow: 'from-amber-950/30 via-[#120a05] to-[#0a0502]',
    accent: 'bg-amber-500 hover:bg-amber-400 text-amber-950',
    accentText: 'text-amber-400',
    timerColor: 'text-amber-400',
    border: 'border-amber-900/50',
    cardBg: 'bg-[#1d1209]/60',
  },
};

const SOUND_OPTIONS: Array<{
  type: AmbientSoundType;
  label: string;
  subtitle: string;
}> = [
  { type: 'off', label: 'Muted', subtitle: 'Silence' },
  { type: 'flute', label: 'Bamboo Flute', subtitle: 'Bansuri & Tanpura' },
  { type: 'tibetanBowls', label: 'Singing Bowls', subtitle: 'Resonant Bronze' },
  { type: 'thetaMeditation', label: '432Hz Theta', subtitle: 'Zen Mind Wave' },
  { type: 'rain', label: 'Gentle Rain', subtitle: 'Soft Downpour' },
  { type: 'brownNoise', label: 'Brown Noise', subtitle: 'Deep Focus Masking' },
  { type: 'binaural', label: '10Hz Alpha', subtitle: 'Binaural Flow' },
];

export const ZenFocusMode: React.FC<ZenFocusModeProps> = ({
  isOpen,
  onClose,
  timerState,
  onStart,
  onPause,
  onResume,
  onStop,
  onComplete,
  onStartBreak,
  onAddTime,
  soundEnabled,
  onToggleSound,
  todayTasks = [],
  onSelectTask,
}) => {
  // Theme state
  const [theme, setTheme] = useState<ZenTheme>(() => {
    return (localStorage.getItem('zen_focus_theme') as ZenTheme) || 'obsidian';
  });

  // Soundscape state
  const [ambientSound, setAmbientSound] = useState<AmbientSoundType>(() => ambientAudio.getSoundType());
  const [ambientVolume, setAmbientVolume] = useState<number>(() => ambientAudio.getVolume());
  const [showSoundMenu, setShowSoundMenu] = useState<boolean>(false);
  const [showThemeMenu, setShowThemeMenu] = useState<boolean>(false);
  const [showTaskMenu, setShowTaskMenu] = useState<boolean>(false);

  // Breathing guide state (Box Breathing: 4s inhale, 4s hold, 4s exhale, 4s hold)
  const [showBreathingGuide, setShowBreathingGuide] = useState<boolean>(false);
  const [breathPhase, setBreathPhase] = useState<'inhale' | 'hold-in' | 'exhale' | 'hold-out'>('inhale');
  const [breathSeconds, setBreathSeconds] = useState<number>(4);

  // Fullscreen state
  const [isBrowserFullscreen, setIsBrowserFullscreen] = useState<boolean>(() => !!document.fullscreenElement);

  // Auto-save theme preference
  const handleSelectTheme = (newTheme: ZenTheme) => {
    setTheme(newTheme);
    localStorage.setItem('zen_focus_theme', newTheme);
    setShowThemeMenu(false);
  };

  // Fullscreen toggle
  const toggleBrowserFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsBrowserFullscreen(true)).catch(() => {});
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => setIsBrowserFullscreen(false)).catch(() => {});
      }
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsBrowserFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Screen Wake Lock
  useEffect(() => {
    if (isOpen) {
      screenWakeLock.acquire();
    } else {
      screenWakeLock.release();
    }
    return () => {
      screenWakeLock.release();
    };
  }, [isOpen]);

  // Sync ambient audio with timer state
  useEffect(() => {
    if (!isOpen) return;

    if (timerState.status === 'running' && ambientSound !== 'off') {
      ambientAudio.play(ambientSound);
    } else if (timerState.status === 'paused' || timerState.status === 'idle') {
      // Keep playing softly if user wants, or let it continue
    }
  }, [isOpen, timerState.status, ambientSound]);

  const handleSelectAmbient = (type: AmbientSoundType) => {
    setAmbientSound(type);
    if (type === 'off') {
      ambientAudio.stop();
    } else {
      ambientAudio.play(type);
    }
    setShowSoundMenu(false);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setAmbientVolume(val);
    ambientAudio.setVolume(val);
  };

  // Box Breathing cycle runner
  useEffect(() => {
    if (!isOpen || !showBreathingGuide) return;

    let currentPhase: 'inhale' | 'hold-in' | 'exhale' | 'hold-out' = 'inhale';
    let timeLeft = 4;
    setBreathPhase('inhale');
    setBreathSeconds(4);

    const interval = setInterval(() => {
      timeLeft -= 1;
      if (timeLeft <= 0) {
        if (currentPhase === 'inhale') {
          currentPhase = 'hold-in';
        } else if (currentPhase === 'hold-in') {
          currentPhase = 'exhale';
        } else if (currentPhase === 'exhale') {
          currentPhase = 'hold-out';
        } else {
          currentPhase = 'inhale';
        }
        timeLeft = 4;
      }
      setBreathPhase(currentPhase);
      setBreathSeconds(timeLeft);
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, showBreathingGuide]);

  // Keyboard shortcut listener
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if interacting with inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        if (timerState.status === 'running') {
          onPause();
        } else if (timerState.status === 'paused') {
          onResume();
        } else if (timerState.status === 'idle') {
          onStart();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        setShowBreathingGuide((prev) => !prev);
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        if (ambientSound !== 'off') {
          handleSelectAmbient('off');
        } else {
          handleSelectAmbient('flute');
        }
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleBrowserFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, timerState.status, onPause, onResume, onStart, onClose, ambientSound]);

  if (!isOpen) return null;

  // Format timer
  const formatTime = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    if (hrs > 0) {
      return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Progress percentage
  const progressPercent =
    timerState.totalSeconds > 0
      ? Math.min(100, Math.round((timerState.elapsedSeconds / timerState.totalSeconds) * 100))
      : 0;

  const currentTheme = THEME_STYLES[theme];
  const isRunning = timerState.status === 'running';
  const isBreak = timerState.isBreakPhase;

  // Breathing guide label
  const breathLabels: Record<typeof breathPhase, { text: string; scale: string }> = {
    inhale: { text: 'Breathe In Slowly', scale: 'scale-125' },
    'hold-in': { text: 'Hold Gently', scale: 'scale-125' },
    exhale: { text: 'Exhale Smoothly', scale: 'scale-90' },
    'hold-out': { text: 'Rest & Empty', scale: 'scale-90' },
  };

  return (
    <div
      id="zen-focus-fullscreen-overlay"
      className={`fixed inset-0 z-50 flex flex-col justify-between p-4 sm:p-8 select-none transition-colors duration-700 bg-gradient-to-b ${currentTheme.glow} ${currentTheme.bg} text-stone-100 overflow-y-auto`}
    >
      {/* Top Bar: Quiet Status, Task Info & Controls */}
      <header className="w-full max-w-5xl mx-auto flex items-center justify-between gap-4 shrink-0">
        {/* Left: Mode Title & Theme Switcher */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <span
              className={`inline-block w-2.5 h-2.5 rounded-full ${
                isRunning ? (isBreak ? 'bg-sky-400 animate-pulse' : 'bg-emerald-400 animate-pulse') : 'bg-stone-500'
              }`}
            />
            <span className="text-xs sm:text-sm font-semibold tracking-wider uppercase text-stone-300">
              {isBreak ? 'Restorative Break' : 'Zen Deep Work'}
            </span>
          </div>

          {/* Theme Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setShowThemeMenu(!showThemeMenu);
                setShowSoundMenu(false);
                setShowTaskMenu(false);
              }}
              className="px-2.5 py-1 text-xs font-medium rounded-lg bg-stone-900/60 hover:bg-stone-850 border border-stone-800 text-stone-300 hover:text-white transition-colors flex items-center space-x-1"
              title="Change Zen Ambiance Theme"
            >
              <span>{currentTheme.name}</span>
              <ChevronDown className="w-3 h-3 text-stone-400" />
            </button>

            {showThemeMenu && (
              <div className="absolute left-0 mt-2 w-48 bg-stone-900 border border-stone-800 rounded-xl shadow-2xl z-50 p-1.5 space-y-1">
                {(Object.keys(THEME_STYLES) as ZenTheme[]).map((tKey) => {
                  const t = THEME_STYLES[tKey];
                  return (
                    <button
                      key={tKey}
                      onClick={() => handleSelectTheme(tKey)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between transition-colors ${
                        theme === tKey ? 'bg-stone-800 text-white font-semibold' : 'text-stone-400 hover:bg-stone-850 hover:text-stone-200'
                      }`}
                    >
                      <span>{t.name}</span>
                      {theme === tKey && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Center: Current Task Dropdown / Title */}
        <div className="relative max-w-xs sm:max-w-md hidden md:block text-center">
          <button
            onClick={() => {
              if (timerState.status !== 'running') {
                setShowTaskMenu(!showTaskMenu);
                setShowSoundMenu(false);
                setShowThemeMenu(false);
              }
            }}
            disabled={timerState.status === 'running'}
            className={`px-3 py-1.5 rounded-xl border text-xs max-w-full truncate transition-all flex items-center space-x-2 mx-auto ${
              timerState.status === 'running'
                ? 'bg-stone-900/40 border-stone-800/40 cursor-default text-stone-300'
                : 'bg-stone-900/70 hover:bg-stone-850 border-stone-800 text-stone-200 hover:border-stone-700 cursor-pointer'
            }`}
            title={timerState.status === 'running' ? 'Task locked during active session' : 'Click to select task'}
          >
            {timerState.isHabit ? (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/40 font-mono">
                Habit
              </span>
            ) : timerState.taskCategory ? (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-800 text-stone-300 font-mono">
                {timerState.taskCategory}
              </span>
            ) : null}
            <span className="truncate font-medium">{timerState.taskTitle}</span>
            {timerState.status !== 'running' && <ChevronDown className="w-3 h-3 text-stone-500 shrink-0" />}
          </button>

          {/* Task Picker Menu */}
          {showTaskMenu && onSelectTask && (
            <div className="absolute left-1/2 -translate-x-1/2 mt-2 w-80 max-h-72 overflow-y-auto bg-stone-900 border border-stone-800 rounded-xl shadow-2xl z-50 p-2 text-left space-y-1">
              <div className="px-2 py-1 text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                Select Today's Focus Goal
              </div>
              {todayTasks.length === 0 ? (
                <div className="px-3 py-2 text-xs text-stone-500">No tasks created for today yet.</div>
              ) : (
                todayTasks.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      onSelectTask({
                        id: item.id,
                        title: item.title,
                        category: item.category,
                        isHabit: item.isHabit,
                      });
                      setShowTaskMenu(false);
                    }}
                    className={`w-full text-left px-2.5 py-2 rounded-lg text-xs flex items-center justify-between transition-colors ${
                      timerState.taskId === item.id
                        ? 'bg-stone-800 text-white font-medium'
                        : 'text-stone-300 hover:bg-stone-850'
                    }`}
                  >
                    <div className="truncate pr-2">
                      <div className="truncate flex items-center space-x-1">
                        {item.isTopPriority && <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />}
                        <span>{item.title}</span>
                      </div>
                      <div className="text-[10px] text-stone-500">{item.category}</div>
                    </div>
                    {timerState.taskId === item.id && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Right Controls: Ambient Music, Breathing, Fullscreen, Close */}
        <div className="flex items-center space-x-2">
          {/* Ambient Music Toggle & Menu */}
          <div className="relative">
            <button
              onClick={() => {
                setShowSoundMenu(!showSoundMenu);
                setShowThemeMenu(false);
                setShowTaskMenu(false);
              }}
              className={`p-2 rounded-xl border transition-colors flex items-center space-x-1.5 ${
                ambientSound !== 'off'
                  ? 'bg-sky-950/50 border-sky-800 text-sky-300'
                  : 'bg-stone-900/60 hover:bg-stone-850 border-stone-800 text-stone-400 hover:text-stone-200'
              }`}
              title="Meditation & Focus Ambient Soundscape"
            >
              <Headphones className={`w-4 h-4 ${ambientSound !== 'off' ? 'text-sky-300' : ''}`} />
              <span className="hidden sm:inline text-xs font-medium">
                {ambientSound === 'off' ? 'Audio' : SOUND_OPTIONS.find((s) => s.type === ambientSound)?.label}
              </span>
            </button>

            {/* Sound Menu */}
            {showSoundMenu && (
              <div className="absolute right-0 mt-2 w-72 bg-stone-900 border border-stone-800 rounded-2xl shadow-2xl z-50 p-3 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-stone-800">
                  <span className="text-xs font-bold text-stone-300 uppercase tracking-wide">
                    Ambient Meditation Audio
                  </span>
                  <button
                    onClick={() => setShowSoundMenu(false)}
                    className="text-stone-500 hover:text-stone-300 text-xs"
                  >
                    ✕
                  </button>
                </div>

                {/* Volume Slider */}
                <div className="space-y-1.5 px-1">
                  <div className="flex justify-between text-[11px] text-stone-400">
                    <span>Master Volume</span>
                    <span className="font-mono">{Math.round(ambientVolume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={ambientVolume}
                    onChange={handleVolumeChange}
                    className="w-full accent-sky-400 cursor-pointer h-1.5 bg-stone-800 rounded-lg"
                  />
                </div>

                {/* Sound Types */}
                <div className="space-y-1 max-h-56 overflow-y-auto pr-0.5">
                  {SOUND_OPTIONS.map((s) => (
                    <button
                      key={s.type}
                      onClick={() => handleSelectAmbient(s.type)}
                      className={`w-full text-left px-2.5 py-2 rounded-xl text-xs transition-colors flex items-center justify-between ${
                        ambientSound === s.type
                          ? 'bg-sky-950/60 border border-sky-800 text-sky-200'
                          : 'text-stone-400 hover:bg-stone-850 hover:text-stone-200'
                      }`}
                    >
                      <div>
                        <div className="font-medium">{s.label}</div>
                        <div className="text-[10px] text-stone-500">{s.subtitle}</div>
                      </div>
                      {ambientSound === s.type && <Check className="w-3.5 h-3.5 text-sky-400" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Breathing Guide Button */}
          <button
            onClick={() => setShowBreathingGuide(!showBreathingGuide)}
            className={`p-2 rounded-xl border transition-colors flex items-center space-x-1.5 ${
              showBreathingGuide
                ? 'bg-emerald-950/50 border-emerald-800 text-emerald-300'
                : 'bg-stone-900/60 hover:bg-stone-850 border-stone-800 text-stone-400 hover:text-stone-200'
            }`}
            title="Toggle Box Breathing (Pranayama) visual guide"
          >
            <Wind className="w-4 h-4" />
            <span className="hidden sm:inline text-xs font-medium">Breathe</span>
          </button>

          {/* Chime Sound Toggle */}
          <button
            onClick={onToggleSound}
            className="p-2 rounded-xl bg-stone-900/60 hover:bg-stone-850 border border-stone-800 text-stone-400 hover:text-stone-200 transition-colors"
            title={soundEnabled ? 'Bell chime enabled' : 'Bell chime muted'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Fullscreen Button */}
          <button
            onClick={toggleBrowserFullscreen}
            className="p-2 rounded-xl bg-stone-900/60 hover:bg-stone-850 border border-stone-800 text-stone-400 hover:text-stone-200 transition-colors hidden sm:flex"
            title="Toggle Browser Fullscreen (F)"
          >
            {isBrowserFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Close / Return Button */}
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-stone-900/60 hover:bg-stone-800 border border-stone-800 text-stone-400 hover:text-white transition-colors"
            title="Exit Zen Mode (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Center Stage: Timer & Breathing Circle */}
      <main className="my-auto flex flex-col items-center justify-center text-center py-6 px-4">
        {/* Mobile Task Bar */}
        <div className="md:hidden mb-4 max-w-xs truncate text-xs text-stone-400 bg-stone-900/80 px-3 py-1.5 rounded-full border border-stone-800">
          🎯 {timerState.taskTitle}
        </div>

        {/* Breathing Guide (if active) */}
        {showBreathingGuide ? (
          <div className="flex flex-col items-center justify-center mb-6">
            <div className="relative flex items-center justify-center w-52 h-52 sm:w-64 sm:h-64 my-4">
              {/* Outer pulsing ring */}
              <div
                className={`absolute inset-0 rounded-full border border-emerald-500/20 transition-transform duration-1000 ${
                  breathPhase === 'inhale' || breathPhase === 'hold-in' ? 'scale-110 opacity-70' : 'scale-75 opacity-20'
                }`}
              />

              {/* Core breathing orb */}
              <div
                className={`rounded-full flex flex-col items-center justify-center transition-all duration-1000 shadow-2xl backdrop-blur-md ${
                  breathPhase === 'inhale' || breathPhase === 'hold-in'
                    ? 'w-44 h-44 sm:w-56 sm:h-56 bg-emerald-500/15 border-2 border-emerald-400/60 shadow-emerald-500/20'
                    : 'w-28 h-28 sm:w-36 sm:h-36 bg-emerald-500/5 border border-emerald-500/30 shadow-none'
                }`}
              >
                <span className="text-3xl sm:text-4xl font-mono font-light text-emerald-300 tabular-nums">
                  {breathSeconds}
                </span>
                <span className="text-xs sm:text-sm font-medium tracking-wide text-stone-200 mt-1 uppercase">
                  {breathPhase === 'inhale'
                    ? 'Inhale'
                    : breathPhase === 'hold-in'
                    ? 'Hold'
                    : breathPhase === 'exhale'
                    ? 'Exhale'
                    : 'Hold & Rest'}
                </span>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-stone-400 max-w-sm text-center">
              {breathLabels[breathPhase].text} — Box Breathing for mental clarity & focus
            </p>
          </div>
        ) : null}

        {/* Giant Minimalist Timer */}
        <div className="relative flex flex-col items-center justify-center my-2 sm:my-4">
          <div
            className={`font-mono font-extralight tracking-tighter tabular-nums text-7xl sm:text-9xl md:text-[11rem] leading-none transition-colors duration-500 ${
              isBreak ? 'text-sky-300' : currentTheme.timerColor
            }`}
          >
            {formatTime(timerState.remainingSeconds)}
          </div>

          {/* Subtle Progress Bar */}
          <div className="w-64 sm:w-80 h-1.5 bg-stone-850 rounded-full overflow-hidden mt-4 sm:mt-6 border border-stone-800/80">
            <div
              className={`h-full transition-all duration-1000 rounded-full ${
                isBreak ? 'bg-sky-400' : 'bg-emerald-400'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="flex items-center space-x-3 text-xs text-stone-500 mt-2 font-mono tabular-nums">
            <span>{progressPercent}% Complete</span>
            <span>·</span>
            <span>{Math.floor(timerState.elapsedSeconds / 60)}m Elapsed</span>
          </div>

          {/* Quick Session Extenders */}
          {onAddTime && (
            <div className="flex items-center space-x-2 mt-4">
              <button
                onClick={() => onAddTime(5)}
                className="px-3 py-1 rounded-full text-xs font-mono bg-stone-900/80 hover:bg-stone-800 border border-stone-800 text-stone-300 hover:text-white transition-colors flex items-center space-x-1"
                title="Add 5 minutes to this focus session"
              >
                <Plus className="w-3 h-3 text-emerald-400" />
                <span>+5 min</span>
              </button>
              <button
                onClick={() => onAddTime(10)}
                className="px-3 py-1 rounded-full text-xs font-mono bg-stone-900/80 hover:bg-stone-800 border border-stone-800 text-stone-300 hover:text-white transition-colors flex items-center space-x-1"
                title="Add 10 minutes to this focus session"
              >
                <Plus className="w-3 h-3 text-emerald-400" />
                <span>+10 min</span>
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Bottom Controls Bar: Primary Actions */}
      <footer className="w-full max-w-xl mx-auto flex flex-col items-center space-y-4 shrink-0 pb-2">
        {/* Main Action Buttons */}
        <div className="flex items-center space-x-4">
          {/* Reset / Stop Button */}
          <button
            onClick={onStop}
            className="p-3 sm:p-3.5 rounded-2xl bg-stone-900/80 hover:bg-stone-800 border border-stone-800 text-stone-400 hover:text-stone-200 transition-colors"
            title="Reset timer"
          >
            <RotateCcw className="w-5 h-5" />
          </button>

          {/* Giant Primary Play/Pause Button */}
          {isRunning ? (
            <button
              onClick={onPause}
              className="px-8 py-4 sm:px-10 sm:py-5 rounded-3xl bg-stone-800 hover:bg-stone-750 border border-stone-700 text-stone-100 font-semibold text-base sm:text-lg shadow-2xl transition-all active:scale-95 flex items-center space-x-3 cursor-pointer"
              title="Pause session (Space)"
            >
              <Pause className="w-6 h-6" />
              <span>Pause Focus</span>
            </button>
          ) : (
            <button
              onClick={timerState.status === 'paused' ? onResume : onStart}
              className={`px-8 py-4 sm:px-10 sm:py-5 rounded-3xl font-semibold text-base sm:text-lg shadow-2xl transition-all active:scale-95 flex items-center space-x-3 cursor-pointer ${currentTheme.accent}`}
              title="Resume session (Space)"
            >
              <Play className="w-6 h-6 fill-current" />
              <span>{timerState.status === 'paused' ? 'Resume Deep Focus' : 'Begin Deep Work'}</span>
            </button>
          )}

          {/* Complete Session Button */}
          <button
            onClick={() => onComplete(true)}
            className="p-3 sm:p-3.5 rounded-2xl bg-stone-900/80 hover:bg-emerald-950/80 border border-stone-800 hover:border-emerald-700 text-stone-400 hover:text-emerald-400 transition-colors"
            title="Complete Session & Mark Task Done"
          >
            <CheckCircle2 className="w-5 h-5" />
          </button>

          {/* Take Restorative Break */}
          {!isBreak && (
            <button
              onClick={onStartBreak}
              className="p-3 sm:p-3.5 rounded-2xl bg-stone-900/80 hover:bg-sky-950/80 border border-stone-800 hover:border-sky-700 text-stone-400 hover:text-sky-300 transition-colors"
              title="Switch to Restorative Break"
            >
              <Coffee className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Keyboard Hints */}
        <div className="text-[11px] text-stone-500 font-mono text-center hidden sm:flex items-center space-x-3">
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-stone-900 border border-stone-800 text-stone-400">Space</kbd>{' '}
            Play/Pause
          </span>
          <span>·</span>
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-stone-900 border border-stone-800 text-stone-400">B</kbd> Breathing
          </span>
          <span>·</span>
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-stone-900 border border-stone-800 text-stone-400">M</kbd> Music
          </span>
          <span>·</span>
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-stone-900 border border-stone-800 text-stone-400">F</kbd> Fullscreen
          </span>
          <span>·</span>
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-stone-900 border border-stone-800 text-stone-400">Esc</kbd> Exit
          </span>
        </div>
      </footer>
    </div>
  );
};
