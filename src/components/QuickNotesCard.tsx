import React, { useState, useEffect } from 'react';
import { StickyNote, Check, Copy, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { storageService } from '../services/storageService';
import { formatFriendlyDate } from '../utils/calendarUtils';
import { getCurrentIST } from '../utils/timeUtils';

interface QuickNotesCardProps {
  selectedDate: string;
  todayDate: string;
  userId: string;
}

// Debounce delay: Wait 60 seconds after user finishes typing before persisting to localStorage
const DEBOUNCE_DELAY_MS = 60000;

export const QuickNotesCard: React.FC<QuickNotesCardProps> = ({
  selectedDate,
  todayDate,
  userId,
}) => {
  const [quickNotes, setQuickNotes] = useState<string>(() =>
    storageService.getDailyNotes(selectedDate, userId)
  );
  const [notesSaveStatus, setNotesSaveStatus] = useState<'idle' | 'editing' | 'saving' | 'saved'>('idle');
  const [copiedNotes, setCopiedNotes] = useState(false);
  const [isNotesExpanded, setIsNotesExpanded] = useState(true);

  const saveTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const latestNotesRef = React.useRef<string>(quickNotes);
  const selectedDateRef = React.useRef<string>(selectedDate);

  // Keep latestNotesRef in sync
  useEffect(() => {
    latestNotesRef.current = quickNotes;
  }, [quickNotes]);

  // Synchronize Quick Notes when selectedDate changes (flush any pending edits first)
  useEffect(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
      storageService.setDailyNotes(selectedDateRef.current, latestNotesRef.current, userId);
    }
    selectedDateRef.current = selectedDate;
    const notesForDate = storageService.getDailyNotes(selectedDate, userId);
    setQuickNotes(notesForDate);
    latestNotesRef.current = notesForDate;
    setNotesSaveStatus('idle');
  }, [selectedDate, userId]);

  // Flush pending changes on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        storageService.setDailyNotes(selectedDateRef.current, latestNotesRef.current, userId);
      }
    };
  }, [userId]);

  // Reactive listener for storage updates
  useEffect(() => {
    const handleNotesUpdated = (e: any) => {
      if (e?.detail?.date === selectedDate && notesSaveStatus !== 'editing') {
        setQuickNotes(e.detail.notes || '');
      }
    };
    window.addEventListener('habits:daily_notes_updated', handleNotesUpdated);
    return () => {
      window.removeEventListener('habits:daily_notes_updated', handleNotesUpdated);
    };
  }, [selectedDate, notesSaveStatus]);

  const flushSave = (valToSave = latestNotesRef.current) => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    setNotesSaveStatus('saving');
    storageService.setDailyNotes(selectedDateRef.current, valToSave, userId);
    setTimeout(() => {
      setNotesSaveStatus('saved');
      setTimeout(() => setNotesSaveStatus('idle'), 2500);
    }, 350);
  };

  const handleNotesChange = (val: string) => {
    setQuickNotes(val);
    latestNotesRef.current = val;
    setNotesSaveStatus('editing');

    // Clear existing timer and wait 60 seconds after user finishes typing thoughts
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      flushSave(val);
    }, DEBOUNCE_DELAY_MS);
  };

  const handleInsertSnippet = (snippet: string) => {
    const updated = quickNotes ? `${quickNotes}\n${snippet}` : snippet;
    handleNotesChange(updated);
  };

  const handleCopyNotes = async () => {
    if (!quickNotes) return;
    try {
      await navigator.clipboard.writeText(quickNotes);
      setCopiedNotes(true);
      setTimeout(() => setCopiedNotes(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleClearNotes = () => {
    if (!quickNotes) return;
    if (window.confirm('Clear all quick notes for this date?')) {
      handleNotesChange('');
    }
  };

  const friendlyDate = formatFriendlyDate(selectedDate, todayDate);

  return (
    <div
      id="quick-notes-card"
      className="bg-white rounded-2xl border border-stone-200/90 p-4 sm:p-5 shadow-xs transition-all space-y-3"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-stone-100">
        <div className="flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-900 flex items-center justify-center font-bold text-sm shadow-2xs">
            <StickyNote className="w-4 h-4 text-amber-700" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-wide text-stone-900 flex items-center gap-2">
              <span>Quick Notes</span>
              {quickNotes.trim().length > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                  Active
                </span>
              )}
            </h3>
            <p className="text-[11px] text-stone-500">
              Ephemeral thoughts, scratchpad &amp; reminders for {friendlyDate}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-1.5">
          {notesSaveStatus === 'editing' && (
            <span className="inline-flex items-center space-x-1.5 text-[11px] font-medium text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              <span>Autosaves after 60s pause</span>
              <button
                type="button"
                onClick={() => flushSave()}
                className="underline font-bold text-amber-900 hover:text-amber-950 ml-0.5 cursor-pointer"
                title="Save thoughts right now"
              >
                Save now
              </button>
            </span>
          )}
          {notesSaveStatus === 'saving' && (
            <span className="text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full animate-pulse">
              Saving...
            </span>
          )}
          {notesSaveStatus === 'saved' && (
            <span className="inline-flex items-center space-x-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
              <Check className="w-3 h-3 text-emerald-600" />
              <span>Saved</span>
            </span>
          )}

          {quickNotes.trim().length > 0 && (
            <>
              <button
                id="copy-quick-notes-btn"
                type="button"
                onClick={handleCopyNotes}
                className="p-1.5 text-stone-400 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-colors text-xs inline-flex items-center space-x-1 cursor-pointer"
                title="Copy notes to clipboard"
              >
                {copiedNotes ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
              <button
                id="clear-quick-notes-btn"
                type="button"
                onClick={handleClearNotes}
                className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                title="Clear notes"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          <button
            id="toggle-quick-notes-btn"
            type="button"
            onClick={() => setIsNotesExpanded(!isNotesExpanded)}
            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
            title={isNotesExpanded ? 'Collapse notes' : 'Expand notes'}
          >
            {isNotesExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Editor Body */}
      {isNotesExpanded && (
        <div className="space-y-2.5">
          <div className="relative">
            <textarea
              id="daily-quick-notes-textarea"
              value={quickNotes}
              onChange={(e) => handleNotesChange(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                  e.preventDefault();
                  flushSave();
                }
              }}
              placeholder="Jot down quick thoughts, phone numbers, review checkpoints, or daily reflections for this date..."
              rows={4}
              className="w-full p-3 text-xs sm:text-sm font-medium text-stone-800 placeholder:text-stone-400 bg-stone-50/50 hover:bg-white focus:bg-white rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-stone-900 transition-all resize-y min-h-[100px] leading-relaxed shadow-2xs font-mono sm:font-sans"
            />
          </div>

          {/* Quick Snippet Buttons & Footer Meta */}
          <div className="flex items-center justify-between flex-wrap gap-2 pt-1 text-[11px] text-stone-500">
            <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
              <span className="text-stone-400 font-medium">Quick insert:</span>
              <button
                type="button"
                onClick={() => {
                  const now = getCurrentIST();
                  handleInsertSnippet(`[${now.timeStr}] `);
                }}
                className="px-2 py-0.5 rounded-md bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium transition-colors cursor-pointer"
                title="Insert current IST timestamp"
              >
                ⏱️ Time
              </button>
              <button
                type="button"
                onClick={() => handleInsertSnippet('• ')}
                className="px-2 py-0.5 rounded-md bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium transition-colors cursor-pointer"
                title="Insert bullet point"
              >
                • Bullet
              </button>
              <button
                type="button"
                onClick={() => handleInsertSnippet('[ ] ')}
                className="px-2 py-0.5 rounded-md bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium transition-colors cursor-pointer"
                title="Insert checkbox"
              >
                ☑ Checkbox
              </button>
            </div>

            <div className="flex items-center space-x-2 text-stone-400">
              <span>
                {quickNotes.trim() ? quickNotes.trim().split(/\s+/).length : 0} words
              </span>
              <span>•</span>
              <span>{quickNotes.length} chars</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
