import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, Tag, AlignLeft, Star, Repeat, CheckCircle2 } from 'lucide-react';
import { Task, TaskCategory, RecurrenceType } from '../types';
import { formatTime12Hour, getCurrentIST } from '../utils/timeUtils';
import { storageService } from '../services/storageService';
import { CategorySelector } from './CategorySelector';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: {
    id?: string;
    title: string;
    category: TaskCategory;
    date: string;
    duration?: string;
    description?: string;
    dueTime?: string;
    recurringSchedule?: RecurrenceType;
    isTopPriority?: boolean;
    completed: boolean;
    isStudySession?: boolean;
    studySubject?: string;
    studyTopic?: string;
    studyDurationMinutes?: number;
    questionsAttempted?: number;
    questionsCorrect?: number;
    accuracy?: number;
    recurringEditScope?: 'this_only' | 'all';
    targetOccurrenceDate?: string;
  }) => void;
  initialTask?: Task | null;
  defaultDate: string;
  targetOccurrenceDate?: string;
}

const CATEGORIES: TaskCategory[] = [
  'SSC CGL',
  'Technical',
  'English',
  'Health/Fitness',
  'Personal Learning',
  'Other',
];

const TIME_PRESETS = [
  { label: '7:00 PM', value: '19:00' },
  { label: '8:00 PM', value: '20:00' },
  { label: '9:00 PM', value: '21:00' },
  { label: '10:00 PM', value: '22:00' },
];

export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialTask,
  defaultDate,
  targetOccurrenceDate,
}) => {
  const isEditingRecurring = Boolean(
    initialTask &&
    initialTask.recurringSchedule &&
    initialTask.recurringSchedule !== 'none'
  );
  const [recurringEditScope, setRecurringEditScope] = useState<'this_only' | 'all'>('this_only');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<TaskCategory>(
    () => storageService.getCategories()[0]?.name || 'Personal Learning'
  );
  const [date, setDate] = useState(defaultDate);
  const [duration, setDuration] = useState('');
  const [description, setDescription] = useState('');
  const [dueTime, setDueTime] = useState('20:00');
  const [recurringSchedule, setRecurringSchedule] = useState<RecurrenceType>('none');
  const [isTopPriority, setIsTopPriority] = useState(false);
  const [completed, setCompleted] = useState(false);

  // Study-Specific Tracking State (Optional)
  const [isStudySession, setIsStudySession] = useState(false);
  const [studySubject, setStudySubject] = useState('GK');
  const [studyTopic, setStudyTopic] = useState('');
  const [studyHours, setStudyHours] = useState('1');
  const [studyMins, setStudyMins] = useState('20');
  const [questionsAttempted, setQuestionsAttempted] = useState('80');
  const [questionsCorrect, setQuestionsCorrect] = useState('64');
  const [enableSpacedRevision, setEnableSpacedRevision] = useState(false);

  useEffect(() => {
    if (initialTask) {
      setTitle(initialTask.title);
      setCategory(initialTask.category);
      const effectiveDate = targetOccurrenceDate || initialTask.date || defaultDate;
      setDate(effectiveDate);
      setDuration(initialTask.duration || '');
      setDescription(initialTask.description || '');
      const taskDue = initialTask.dueTime || '20:00';
      setDueTime(taskDue);
      setRecurringSchedule(initialTask.recurringSchedule || 'none');
      setRecurringEditScope('this_only');
      setIsTopPriority(initialTask.isTopPriority ?? false);
      setCompleted(Boolean(initialTask.completed || initialTask.status === 'completed'));
      
      // Study fields
      setIsStudySession(initialTask.isStudySession ?? false);
      setStudySubject(initialTask.studySubject || 'GK');
      setStudyTopic(initialTask.studyTopic || '');
      setEnableSpacedRevision(initialTask.enableSpacedRevision ?? false);
      if (initialTask.studyDurationMinutes) {
        setStudyHours(String(Math.floor(initialTask.studyDurationMinutes / 60)));
        setStudyMins(String(initialTask.studyDurationMinutes % 60));
      } else {
        setStudyHours('1');
        setStudyMins('20');
      }
      setQuestionsAttempted(
        initialTask.questionsAttempted !== undefined ? String(initialTask.questionsAttempted) : '80'
      );
      setQuestionsCorrect(
        initialTask.questionsCorrect !== undefined ? String(initialTask.questionsCorrect) : '64'
      );
    } else {
      setTitle('');
      setCategory(storageService.getCategories()[0]?.name || 'Personal Learning');
      setDate(defaultDate);
      setDuration('');
      setDescription('');
      setDueTime('20:00');
      setRecurringSchedule('none');
      setIsTopPriority(false);
      setCompleted(false);
      
      // Reset study fields
      setIsStudySession(false);
      setStudySubject('GK');
      setStudyTopic('');
      setStudyHours('1');
      setStudyMins('20');
      setQuestionsAttempted('80');
      setQuestionsCorrect('64');
      setEnableSpacedRevision(false);
    }
  }, [initialTask, defaultDate, isOpen]);

  if (!isOpen) return null;

  const handleDueTimeChange = (newDueTime: string) => {
    setDueTime(newDueTime);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const qAtt = parseInt(questionsAttempted, 10);
    const qCorr = parseInt(questionsCorrect, 10);
    const validAtt = !isNaN(qAtt) && qAtt > 0 ? qAtt : undefined;
    const validCorr =
      !isNaN(qCorr) && validAtt !== undefined ? Math.min(validAtt, Math.max(0, qCorr)) : undefined;
    const computedAccuracy =
      validAtt && validCorr !== undefined ? Math.round((validCorr / validAtt) * 100) : undefined;
    const sHours = parseInt(studyHours, 10) || 0;
    const sMins = parseInt(studyMins, 10) || 0;
    const totalStudyMins = sHours * 60 + sMins;

    const formattedStudyDuration =
      totalStudyMins > 0
        ? (sHours > 0 ? `${sHours}h ${sMins > 0 ? `${sMins}m` : ''}`.trim() : `${sMins}m`)
        : undefined;

    onSave({
      id: initialTask?.id,
      title: title.trim(),
      category,
      date: isEditingRecurring && recurringEditScope === 'this_only' ? (targetOccurrenceDate || date) : date,
      duration: duration.trim() || (isStudySession ? formattedStudyDuration : undefined),
      description: description.trim() || undefined,
      dueTime,
      recurringSchedule: isEditingRecurring && recurringEditScope === 'this_only' ? 'none' : recurringSchedule,
      isTopPriority,
      completed,
      isStudySession,
      studySubject: isStudySession ? studySubject : undefined,
      studyTopic: isStudySession ? studyTopic.trim() || undefined : undefined,
      studyDurationMinutes: isStudySession && totalStudyMins > 0 ? totalStudyMins : undefined,
      questionsAttempted: isStudySession ? validAtt : undefined,
      questionsCorrect: isStudySession ? validCorr : undefined,
      accuracy: isStudySession ? computedAccuracy : undefined,
      enableSpacedRevision: isStudySession ? enableSpacedRevision : false,
      recurringEditScope: isEditingRecurring ? recurringEditScope : undefined,
      targetOccurrenceDate: targetOccurrenceDate || defaultDate,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/50 backdrop-blur-xs">
      <div
        id="task-modal-content"
        className="bg-white rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-stone-200 animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-stone-100">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-stone-900">
              {initialTask ? 'Edit Task Schedule' : 'New Scheduled Task'}
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Configure deadline and optional recurring cadence
            </p>
          </div>
          <button
            id="close-task-modal-btn"
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Recurring Occurrence Scope Selection */}
          {isEditingRecurring && (
            <div className="p-3 bg-amber-50/90 border border-amber-200/90 rounded-xl space-y-2">
              <div className="flex items-center space-x-1.5 text-xs font-bold text-amber-900">
                <Repeat className="w-4 h-4 text-amber-600" />
                <span>Editing Recurring Task ({initialTask?.recurringSchedule})</span>
              </div>
              <p className="text-[11px] text-amber-800">
                Choose how to apply your changes:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
                <label
                  className={`flex items-start space-x-2 p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                    recurringEditScope === 'this_only'
                      ? 'bg-white border-amber-500 shadow-2xs font-semibold text-stone-900 ring-1 ring-amber-400'
                      : 'bg-amber-100/40 border-amber-200 text-stone-600 hover:bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="recurringEditScope"
                    value="this_only"
                    checked={recurringEditScope === 'this_only'}
                    onChange={() => setRecurringEditScope('this_only')}
                    className="mt-0.5 text-amber-600 focus:ring-amber-500"
                  />
                  <div>
                    <span className="block font-bold">This date only ({targetOccurrenceDate || defaultDate})</span>
                    <span className="block text-[10px] text-stone-500 font-normal mt-0.5">
                      Won't affect yesterday or future days
                    </span>
                  </div>
                </label>
                <label
                  className={`flex items-start space-x-2 p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                    recurringEditScope === 'all'
                      ? 'bg-white border-amber-500 shadow-2xs font-semibold text-stone-900 ring-1 ring-amber-400'
                      : 'bg-amber-100/40 border-amber-200 text-stone-600 hover:bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="recurringEditScope"
                    value="all"
                    checked={recurringEditScope === 'all'}
                    onChange={() => setRecurringEditScope('all')}
                    className="mt-0.5 text-amber-600 focus:ring-amber-500"
                  />
                  <div>
                    <span className="block font-bold">All occurrences</span>
                    <span className="block text-[10px] text-stone-500 font-normal mt-0.5">
                      Updates the recurrence rule across all days
                    </span>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Completion Status Toggle (only mutable on today) */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-stone-200 bg-stone-50/80">
            <div className="flex items-center space-x-2.5">
              <CheckCircle2 className={`w-4 h-4 shrink-0 ${completed ? 'text-emerald-600' : 'text-stone-400'}`} />
              <div>
                <label htmlFor="task-modal-completed-toggle" className="text-xs font-bold text-stone-800 block cursor-pointer">
                  Task Completion Status
                </label>
                <p className="text-[11px] text-stone-500">
                  {completed ? 'Marked as completed for scheduled date' : 'Currently pending / incomplete'}
                </p>
              </div>
            </div>
            <button
              type="button"
              id="task-modal-completed-toggle"
              disabled={(targetOccurrenceDate || defaultDate) !== getCurrentIST().dateStr}
              onClick={() => {
                if ((targetOccurrenceDate || defaultDate) === getCurrentIST().dateStr) {
                  setCompleted(!completed);
                }
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all active:scale-95 ${
                (targetOccurrenceDate || defaultDate) !== getCurrentIST().dateStr
                  ? completed
                    ? 'bg-emerald-600/70 text-white border-emerald-700 cursor-not-allowed opacity-80'
                    : 'bg-stone-100 text-stone-400 border-stone-200 cursor-not-allowed opacity-60'
                  : completed
                  ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs cursor-pointer'
                  : 'bg-white text-stone-700 border-stone-300 hover:border-stone-400 hover:bg-stone-50 cursor-pointer'
              }`}
              title={(targetOccurrenceDate || defaultDate) !== getCurrentIST().dateStr ? 'Completion status can only be toggled on current day' : undefined}
            >
              {completed ? 'Completed ✅' : 'Mark Completed'}
            </button>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
              Task Title <span className="text-red-500">*</span>
            </label>
            <input
              id="task-title-input"
              type="text"
              required
              placeholder="e.g. CGL Study — Modern Indian History"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-900 text-sm placeholder:text-stone-400 font-medium"
              autoFocus
            />
          </div>

          {/* Category & Due Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1 flex items-center justify-between">
                <span className="flex items-center">
                  <Tag className="w-3.5 h-3.5 mr-1 text-stone-400" />
                  Category
                </span>
                <span className="text-[10px] text-stone-400 lowercase font-normal">edit / add / delete</span>
              </label>
              <CategorySelector
                id="task-category-selector"
                value={category}
                onChange={(newCat) => setCategory(newCat)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1 flex items-center">
                <Calendar className="w-3.5 h-3.5 mr-1 text-stone-400" />
                Due Date
              </label>
              <input
                id="task-date-input"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-900 text-sm bg-white font-medium"
              />
            </div>
          </div>

          {/* DEADLINE (DUE TIME) SECTION */}
          <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-3.5">
            {/* Header with Timezone */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-800 flex items-center">
                <Clock className="w-3.5 h-3.5 mr-1.5 text-stone-600" />
                Task Deadline
              </span>
              <span className="text-[10px] font-bold text-stone-700 bg-stone-200/80 border border-stone-300 px-2 py-0.5 rounded-full">
                Asia/Kolkata (IST)
              </span>
            </div>

            {/* Due Time Row */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-stone-800 flex items-center">
                  Due Time:
                  <span className="ml-1.5 font-bold text-stone-800 bg-stone-200/70 px-1.5 py-0.5 rounded text-xs">
                    {formatTime12Hour(dueTime)}
                  </span>
                </label>
                <span className="text-[11px] text-stone-500">Passing this marks task overdue</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <input
                  id="task-duetime-input"
                  type="time"
                  value={dueTime}
                  onChange={(e) => handleDueTimeChange(e.target.value)}
                  className="px-3 py-1.5 bg-white rounded-lg border border-stone-300 text-sm font-semibold text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900 w-full sm:w-auto"
                />
                <div className="flex items-center gap-1.5 flex-wrap">
                  {TIME_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => handleDueTimeChange(preset.value)}
                      className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                        dueTime === preset.value
                          ? 'bg-stone-900 text-white font-bold shadow-2xs'
                          : 'bg-white border border-stone-200 text-stone-700 hover:bg-stone-50'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* OPTIONAL RECURRING SCHEDULE */}
          <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-stone-700 flex items-center">
                <Repeat className="w-3.5 h-3.5 mr-1.5 text-stone-500" />
                Recurring Schedule (Optional)
              </label>
              <span className="text-[11px] font-medium text-stone-500">
                {recurringSchedule === 'none' ? 'One-time' : 'Repeating'}
              </span>
            </div>

            <select
              id="task-recurring-select"
              value={recurringSchedule}
              onChange={(e) => setRecurringSchedule(e.target.value as RecurrenceType)}
              className="w-full px-3 py-2 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-900 text-sm bg-white font-medium"
            >
              <option value="none">Does not repeat (One-time task)</option>
              <option value="daily">Daily — Every day</option>
              <option value="weekdays">Weekdays — Monday to Friday</option>
              <option value="weekly">Weekly — Every week on this day</option>
            </select>
            <p className="text-[11px] text-stone-500">
              Each task can maintain its own independent schedule across days.
            </p>
          </div>

          {/* Daily Top 3 Priority Toggle */}
          <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/90 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600">
                <Star className="w-4 h-4 fill-amber-400 text-amber-500" />
              </div>
              <div>
                <span className="text-xs font-bold text-stone-900 block">
                  Top 3 Priority
                </span>
                <span className="text-[11px] text-stone-500 block">
                  Pin as one of your 3 primary focus commitments for this day
                </span>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                id="task-top-priority-toggle"
                type="checkbox"
                checked={isTopPriority}
                onChange={(e) => setIsTopPriority(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-stone-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
            </label>
          </div>



          {/* Duration / Target */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1 flex items-center">
              <Clock className="w-3.5 h-3.5 mr-1 text-stone-400" />
              Target / Duration (Optional)
            </label>
            <input
              id="task-duration-input"
              type="text"
              placeholder="e.g. 2 hours, 45 minutes, 30 questions"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-900 text-sm placeholder:text-stone-400"
            />
          </div>

          {/* Description / Notes */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1 flex items-center">
              <AlignLeft className="w-3.5 h-3.5 mr-1 text-stone-400" />
              Notes / Subtopics (Optional)
            </label>
            <textarea
              id="task-desc-input"
              rows={2}
              placeholder="e.g. Modern Indian History Chapter 4, Leetcode #15"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-900 text-sm placeholder:text-stone-400 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-stone-100">
            <button
              type="button"
              id="cancel-task-btn"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              id="save-task-submit-btn"
              type="submit"
              className="px-5 py-2 text-sm font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-xl transition-colors shadow-xs"
            >
              {initialTask ? 'Update Task' : 'Save Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
