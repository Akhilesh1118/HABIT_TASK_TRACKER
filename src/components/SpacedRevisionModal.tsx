import React, { useState, useMemo } from 'react';
import {
  X,
  Brain,
  CheckCircle2,
  Clock,
  Calendar,
  ChevronRight,
  Plus,
  Edit2,
  Trash2,
  Check,
  AlertCircle,
  Sparkles,
  ArrowRight,
  History,
  Target,
  GraduationCap,
  RotateCcw,
  CalendarDays,
} from 'lucide-react';
import { TopicRevisionSchedule, RevisionStep } from '../types';
import { storageService, DEFAULT_REVISION_INTERVALS, addDaysToDateKey, getRevisionStepLabel } from '../services/storageService';

interface SpacedRevisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  todayDate: string;
  onScheduleUpdated?: () => void;
}

const COMMON_SUBJECTS = ['GK', 'Quant', 'Reasoning', 'English', 'Technical', 'General Studies'];

export const SpacedRevisionModal: React.FC<SpacedRevisionModalProps> = ({
  isOpen,
  onClose,
  todayDate,
  onScheduleUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'due_today' | 'all_topics' | 'history' | 'add_new'>('due_today');
  const [refreshKey, setRefreshKey] = useState(0);

  // Quick completion modal/state for a specific step
  const [completingStep, setCompletingStep] = useState<{
    schedule: TopicRevisionSchedule;
    stepIndex: number;
  } | null>(null);
  const [completeNotes, setCompleteNotes] = useState('');
  const [completeQuestions, setCompleteQuestions] = useState('');
  const [completeCorrect, setCompleteCorrect] = useState('');

  // Adjust Schedule State
  const [adjustingSchedule, setAdjustingSchedule] = useState<TopicRevisionSchedule | null>(null);
  const [customIntervalsStr, setCustomIntervalsStr] = useState('');
  const [rescheduleStepIndex, setRescheduleStepIndex] = useState<number | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');

  // Add New Topic State
  const [newSubject, setNewSubject] = useState('GK');
  const [newTopic, setNewTopic] = useState('');
  const [newLearnedDate, setNewLearnedDate] = useState(todayDate);
  const [newIntervalsStr, setNewIntervalsStr] = useState('0, 1, 3, 7, 14, 30');
  const [newNotes, setNewNotes] = useState('');
  const [newQuestions, setNewQuestions] = useState('80');
  const [newCorrect, setNewCorrect] = useState('64');
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch data
  const schedules = useMemo(() => {
    return storageService.getRevisionSchedules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey, isOpen]);

  const dueToday = useMemo(() => {
    return storageService.getRevisionsDueOnDate(todayDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedules, todayDate, refreshKey]);

  const history = useMemo(() => {
    return storageService.getRevisionHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedules, refreshKey]);

  if (!isOpen) return null;

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1);
    if (onScheduleUpdated) onScheduleUpdated();
  };

  const showNotification = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  // Quick 1-click complete or with stats
  const handleConfirmComplete = (scheduleId: string, stepIndex: number) => {
    const qAttempted = completeQuestions ? parseInt(completeQuestions, 10) : undefined;
    const qCorrect = completeCorrect ? parseInt(completeCorrect, 10) : undefined;
    const accuracy =
      qAttempted && qCorrect !== undefined && qAttempted > 0
        ? Math.round((qCorrect / qAttempted) * 100)
        : undefined;

    const res = storageService.markRevisionStepComplete(scheduleId, stepIndex, {
      notes: completeNotes || undefined,
      questionsAttempted: qAttempted,
      questionsCorrect: qCorrect,
      accuracy,
    });

    setCompletingStep(null);
    setCompleteNotes('');
    setCompleteQuestions('');
    setCompleteCorrect('');
    handleRefresh();

    if (res.nextStep) {
      showNotification(
        `Revision completed! Next revision automatically scheduled for ${res.nextStep.scheduledDate} (${res.nextStep.label}).`
      );
    } else {
      showNotification(`Revision complete! All scheduled revisions for this topic are now finished! 🎉`);
    }
  };

  // Handle Adjust Schedule Save
  const handleSaveAdjustedSchedule = () => {
    if (!adjustingSchedule) return;

    let intervals: number[] | undefined;
    if (customIntervalsStr.trim()) {
      const parts = customIntervalsStr.split(',').map((p) => parseInt(p.trim(), 10)).filter((n) => !isNaN(n));
      if (parts.length > 0) {
        intervals = parts;
      }
    }

    storageService.adjustRevisionSchedule(adjustingSchedule.id, {
      intervals,
      rescheduleStep:
        rescheduleStepIndex !== null && rescheduleDate
          ? { stepIndex: rescheduleStepIndex, newDate: rescheduleDate }
          : undefined,
    });

    setAdjustingSchedule(null);
    setRescheduleStepIndex(null);
    setRescheduleDate('');
    setCustomIntervalsStr('');
    handleRefresh();
    showNotification('Revision schedule adjusted successfully.');
  };

  // Push revision by +1 or +2 days
  const handlePushRevision = (scheduleId: string, stepIndex: number, daysToAdd: number) => {
    const sched = schedules.find((s) => s.id === scheduleId);
    if (!sched || !sched.steps[stepIndex]) return;
    const currentScheduled = sched.steps[stepIndex].scheduledDate;
    const newDate = addDaysToDateKey(currentScheduled, daysToAdd);

    storageService.adjustRevisionSchedule(scheduleId, {
      rescheduleStep: { stepIndex, newDate },
    });
    handleRefresh();
    showNotification(`Revision pushed by +${daysToAdd} day(s) to ${newDate}.`);
  };

  // Add new topic revision
  const handleCreateNewRevision = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!newTopic.trim()) {
      setFormError('Please provide a topic name.');
      return;
    }

    let intervals = DEFAULT_REVISION_INTERVALS;
    if (newIntervalsStr.trim()) {
      const parsed = newIntervalsStr.split(',').map((p) => parseInt(p.trim(), 10)).filter((n) => !isNaN(n));
      if (parsed.length > 0) {
        intervals = parsed;
      }
    }

    const qAttempted = newQuestions ? parseInt(newQuestions, 10) : undefined;
    const qCorrect = newCorrect ? parseInt(newCorrect, 10) : undefined;
    const accuracy =
      qAttempted && qCorrect !== undefined && qAttempted > 0
        ? Math.round((qCorrect / qAttempted) * 100)
        : undefined;

    const created = storageService.createTopicRevision({
      subject: newSubject.trim(),
      topic: newTopic.trim(),
      learnedDate: newLearnedDate || todayDate,
      customIntervals: intervals,
      notes: newNotes || undefined,
      questionsAttempted: qAttempted,
      questionsCorrect: qCorrect,
      accuracy,
    });

    setNewTopic('');
    setNewNotes('');
    setActiveTab('all_topics');
    handleRefresh();
    showNotification(`Revision schedule created for "${created.topic}". Next revision: ${created.nextRevisionDate || 'Scheduled'}`);
  };

  const handleDeleteSchedule = (id: string, topic: string) => {
    if (window.confirm(`Delete revision schedule for "${topic}"?`)) {
      storageService.deleteRevisionSchedule(id);
      handleRefresh();
      showNotification(`Schedule for "${topic}" deleted.`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl border border-stone-200 my-auto flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-stone-200 bg-gradient-to-r from-stone-900 via-stone-850 to-stone-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-xl">
              🧠
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h2 className="text-lg font-bold text-white tracking-tight">Spaced Revision System</h2>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-500/30 text-purple-200 border border-purple-400/40">
                  Day 0 • 1 • 3 • 7 • 14 • 30
                </span>
              </div>
              <p className="text-xs text-stone-300 mt-0.5">
                Scientific retention schedule for SSC CGL topics & material
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-white hover:bg-stone-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Due Today Banner Highlight */}
        <div className="px-5 py-3 bg-purple-50 border-b border-purple-100 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center space-x-2">
            <span className="text-lg">🧠</span>
            <span className="text-sm font-bold text-purple-950">
              {dueToday.length} revisions due today
            </span>
            <span className="text-xs text-purple-700">({todayDate})</span>
          </div>
          <div className="flex items-center space-x-2 text-xs">
            <span className="text-purple-800 font-medium">
              Total Topics Monitored: <strong>{schedules.length}</strong>
            </span>
          </div>
        </div>

        {/* Notifications */}
        {successMessage && (
          <div className="mx-5 mt-3 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium flex items-center space-x-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="px-5 pt-3 border-b border-stone-200 flex items-center space-x-2 overflow-x-auto text-xs font-semibold">
          <button
            onClick={() => setActiveTab('due_today')}
            className={`pb-2.5 px-3 border-b-2 transition-all flex items-center space-x-1.5 ${
              activeTab === 'due_today'
                ? 'border-purple-600 text-purple-900 font-bold'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <span>Due Today</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-purple-100 text-purple-900 font-bold">
              {dueToday.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('all_topics')}
            className={`pb-2.5 px-3 border-b-2 transition-all flex items-center space-x-1.5 ${
              activeTab === 'all_topics'
                ? 'border-purple-600 text-purple-900 font-bold'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <span>All Schedules</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-stone-200 text-stone-800 font-bold">
              {schedules.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`pb-2.5 px-3 border-b-2 transition-all flex items-center space-x-1.5 ${
              activeTab === 'history'
                ? 'border-purple-600 text-purple-900 font-bold'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <History className="w-3.5 h-3.5 text-stone-500" />
            <span>Revision History</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-stone-100 text-stone-700">
              {history.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('add_new')}
            className={`pb-2.5 px-3 border-b-2 transition-all flex items-center space-x-1.5 ${
              activeTab === 'add_new'
                ? 'border-purple-600 text-purple-900 font-bold'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Plus className="w-3.5 h-3.5 text-purple-600" />
            <span>+ Add Topic</span>
          </button>
        </div>

        {/* Tab Content Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* TAB 1: DUE TODAY */}
          {activeTab === 'due_today' && (
            <div className="space-y-3">
              {dueToday.length === 0 ? (
                <div className="text-center py-12 px-4 rounded-xl border border-dashed border-stone-200 bg-stone-50">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center text-xl mb-3">
                    ✨
                  </div>
                  <h3 className="text-sm font-bold text-stone-900">All Revisions Up to Date!</h3>
                  <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
                    You have no outstanding revisions scheduled for today. Great job keeping your retention cycle consistent!
                  </p>
                  <button
                    onClick={() => setActiveTab('all_topics')}
                    className="mt-4 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-stone-900 text-white hover:bg-stone-800 transition-colors"
                  >
                    View All Schedules
                  </button>
                </div>
              ) : (
                dueToday.map(({ schedule, step }) => {
                  const isCompletingThis =
                    completingStep?.schedule.id === schedule.id && completingStep?.stepIndex === step.stepIndex;

                  return (
                    <div
                      key={`${schedule.id}_${step.stepIndex}`}
                      className="p-4 rounded-xl border border-purple-200/80 bg-white shadow-xs hover:border-purple-300 transition-all space-y-3"
                    >
                      <div className="flex items-start justify-between flex-wrap gap-2">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-purple-100 text-purple-900 border border-purple-200">
                              {schedule.subject}
                            </span>
                            <h3 className="text-sm font-bold text-stone-900">{schedule.topic}</h3>
                          </div>
                          <p className="text-xs text-stone-500 mt-1">
                            Learned: <span className="font-semibold text-stone-700">{schedule.learnedDate}</span> • Current Stage:{' '}
                            <span className="font-bold text-purple-700">{step.label}</span> (+{step.dayOffset} days)
                          </p>
                        </div>

                        {/* Step progress badge */}
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-900 border border-amber-300">
                          <Clock className="w-3 h-3 text-amber-600" />
                          <span>Due Today</span>
                        </span>
                      </div>

                      {/* Full schedule steps pipeline indicator */}
                      <div className="p-2.5 bg-stone-50 rounded-lg border border-stone-200/70">
                        <div className="text-[11px] font-semibold text-stone-600 mb-1.5 flex items-center justify-between">
                          <span>Revision Pipeline</span>
                          <span className="text-[10px] text-stone-400">
                            {schedule.steps.filter((s) => s.completed).length} of {schedule.steps.length} completed
                          </span>
                        </div>
                        <div className="grid grid-cols-6 gap-1.5">
                          {schedule.steps.map((s, idx) => {
                            const isCurrent = s.stepIndex === step.stepIndex;
                            return (
                              <div
                                key={idx}
                                className={`text-center p-1.5 rounded-md border text-[10px] font-semibold transition-all ${
                                  s.completed
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                    : isCurrent
                                    ? 'bg-purple-100 border-purple-300 text-purple-900 ring-2 ring-purple-400/50'
                                    : 'bg-white border-stone-200 text-stone-400'
                                }`}
                                title={`${s.label}: Scheduled for ${s.scheduledDate}`}
                              >
                                <div>{s.label}</div>
                                <div className="text-[9px] font-mono mt-0.5">
                                  {s.completed ? '✓ Done' : s.scheduledDate.substring(5)}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Actions: Mark Complete / Log questions / Reschedule */}
                      {!isCompletingThis ? (
                        <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() =>
                                setCompletingStep({
                                  schedule,
                                  stepIndex: step.stepIndex,
                                })
                              }
                              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white transition-colors shadow-2xs"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Mark Complete</span>
                            </button>

                            <button
                              onClick={() => handleConfirmComplete(schedule.id, step.stepIndex)}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors"
                              title="1-Click fast complete without question stats"
                            >
                              Fast 1-Click
                            </button>
                          </div>

                          <div className="flex items-center space-x-1.5">
                            <button
                              onClick={() => handlePushRevision(schedule.id, step.stepIndex, 1)}
                              className="px-2 py-1 rounded-md text-[11px] font-medium bg-stone-100 hover:bg-stone-200 text-stone-600 transition-colors"
                              title="Postpone this revision by 1 day"
                            >
                              +1 Day
                            </button>
                            <button
                              onClick={() => {
                                setAdjustingSchedule(schedule);
                                setCustomIntervalsStr(schedule.customIntervals.join(', '));
                                setRescheduleStepIndex(step.stepIndex);
                                setRescheduleDate(step.scheduledDate);
                              }}
                              className="p-1 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-md transition-colors"
                              title="Adjust schedule"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Expanded completion log */
                        <div className="p-3 bg-purple-50/70 rounded-xl border border-purple-200 space-y-2.5 animate-fadeIn">
                          <div className="flex items-center justify-between text-xs font-bold text-purple-950">
                            <span>Log Revision Performance (Optional)</span>
                            <button
                              onClick={() => setCompletingStep(null)}
                              className="text-stone-400 hover:text-stone-600 text-xs"
                            >
                              Cancel
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            <div>
                              <label className="block text-stone-600 font-medium mb-1">Questions Attempted</label>
                              <input
                                type="number"
                                min="0"
                                value={completeQuestions}
                                onChange={(e) => setCompleteQuestions(e.target.value)}
                                placeholder="e.g. 50"
                                className="w-full px-2.5 py-1.5 rounded-lg border border-stone-200 bg-white text-xs"
                              />
                            </div>
                            <div>
                              <label className="block text-stone-600 font-medium mb-1">Questions Correct</label>
                              <input
                                type="number"
                                min="0"
                                value={completeCorrect}
                                onChange={(e) => setCompleteCorrect(e.target.value)}
                                placeholder="e.g. 42"
                                className="w-full px-2.5 py-1.5 rounded-lg border border-stone-200 bg-white text-xs"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-stone-600 font-medium text-xs mb-1">Revision Notes</label>
                            <input
                              type="text"
                              value={completeNotes}
                              onChange={(e) => setCompleteNotes(e.target.value)}
                              placeholder="Key formulas or weak points reviewed..."
                              className="w-full px-2.5 py-1.5 rounded-lg border border-stone-200 bg-white text-xs"
                            />
                          </div>

                          <div className="flex items-center justify-end space-x-2 pt-1">
                            <button
                              onClick={() => setCompletingStep(null)}
                              className="px-3 py-1.5 rounded-lg text-xs text-stone-600 hover:bg-stone-200 transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleConfirmComplete(schedule.id, step.stepIndex)}
                              className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white transition-colors shadow-2xs"
                            >
                              Confirm & Advance Next Revision
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 2: ALL SCHEDULES */}
          {activeTab === 'all_topics' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-stone-500 pb-1">
                <span>All active and historical topic revision schedules</span>
                <button
                  onClick={() => setActiveTab('add_new')}
                  className="inline-flex items-center space-x-1 text-purple-700 hover:text-purple-900 font-bold"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add New Topic</span>
                </button>
              </div>

              {schedules.map((schedule) => {
                const nextStep = schedule.steps.find((s) => !s.completed);
                const isDueToday = schedule.nextRevisionDate === todayDate;

                return (
                  <div
                    key={schedule.id}
                    className="p-4 rounded-xl border border-stone-200 bg-white shadow-xs space-y-3"
                  >
                    <div className="flex items-start justify-between flex-wrap gap-2">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-stone-100 text-stone-800 border border-stone-200">
                            {schedule.subject}
                          </span>
                          <h3 className="text-sm font-bold text-stone-900">{schedule.topic}</h3>
                          {schedule.status === 'completed' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              Completed 🏆
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-stone-500 mt-1">
                          Learned: <strong className="text-stone-700">{schedule.learnedDate}</strong> • Revisions Done:{' '}
                          <strong className="text-emerald-700">{schedule.totalRevisionsCompleted}</strong> of{' '}
                          {schedule.steps.length}
                        </p>
                      </div>

                      <div className="flex items-center space-x-2">
                        {nextStep && (
                          <span
                            className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                              isDueToday
                                ? 'bg-purple-50 text-purple-900 border-purple-300 font-bold'
                                : 'bg-stone-100 text-stone-700 border-stone-200'
                            }`}
                          >
                            <CalendarDays className="w-3 h-3 text-stone-500" />
                            <span>Next: {nextStep.label} ({nextStep.scheduledDate})</span>
                          </span>
                        )}

                        <button
                          onClick={() => {
                            setAdjustingSchedule(schedule);
                            setCustomIntervalsStr(schedule.customIntervals.join(', '));
                          }}
                          className="p-1.5 text-stone-400 hover:text-stone-800 hover:bg-stone-100 rounded-md transition-colors"
                          title="Adjust schedule intervals or dates"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleDeleteSchedule(schedule.id, schedule.topic)}
                          className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-stone-100 rounded-md transition-colors"
                          title="Delete schedule"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Step Pipeline */}
                    <div className="p-2.5 bg-stone-50 rounded-lg border border-stone-200/70">
                      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                        {schedule.steps.map((step, idx) => {
                          const isNext = nextStep?.stepIndex === step.stepIndex;

                          return (
                            <div
                              key={idx}
                              className={`p-2 rounded-lg border text-center text-xs transition-all ${
                                step.completed
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                                  : isNext
                                  ? 'bg-purple-50 border-purple-300 text-purple-900 ring-2 ring-purple-400/40'
                                  : 'bg-white border-stone-200 text-stone-500'
                              }`}
                            >
                              <div className="font-bold flex items-center justify-center space-x-1">
                                <span>{step.label}</span>
                                {step.completed && <Check className="w-3 h-3 text-emerald-600" />}
                              </div>
                              <div className="text-[10px] text-stone-500 font-mono mt-0.5">
                                {step.scheduledDate}
                              </div>

                              {step.completed && step.accuracy !== undefined && (
                                <div className="text-[10px] font-bold text-emerald-700 mt-1">
                                  {step.accuracy}% Acc
                                </div>
                              )}

                              {!step.completed && (
                                <button
                                  onClick={() => handleConfirmComplete(schedule.id, step.stepIndex)}
                                  className="mt-1.5 w-full py-0.5 text-[10px] font-bold rounded bg-white hover:bg-purple-600 hover:text-white text-purple-700 border border-purple-200 transition-colors shadow-2xs"
                                >
                                  Complete
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 3: REVISION HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              <div className="text-xs text-stone-500 pb-1">
                Completed spaced revisions archive preserving all questions & accuracy metrics:
              </div>

              {history.length === 0 ? (
                <div className="text-center py-10 text-xs text-stone-400">
                  No completed revisions in history yet.
                </div>
              ) : (
                history.map(({ schedule, step }, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl border border-stone-200 bg-white shadow-2xs flex items-center justify-between flex-wrap gap-2 text-xs"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                        ✓
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-stone-900">{schedule.topic}</span>
                          <span className="px-1.5 py-0.2 rounded text-[10px] bg-stone-100 text-stone-600">
                            {schedule.subject}
                          </span>
                          <span className="font-bold text-purple-700">{step.label}</span>
                        </div>
                        <div className="text-stone-400 text-[11px] mt-0.5">
                          Completed on: {step.completedAt ? step.completedAt.substring(0, 10) : step.scheduledDate}
                          {step.notes && ` • "${step.notes}"`}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 text-right">
                      {step.questionsAttempted !== undefined && (
                        <div>
                          <div className="font-semibold text-stone-800">
                            {step.questionsCorrect ?? '-'}/{step.questionsAttempted} Qs
                          </div>
                          {step.accuracy !== undefined && (
                            <div className="text-[11px] font-bold text-emerald-600">{step.accuracy}% accuracy</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 4: ADD NEW TOPIC */}
          {activeTab === 'add_new' && (
            <form onSubmit={handleCreateNewRevision} className="space-y-4 max-w-xl mx-auto">
              <div className="p-3.5 bg-purple-50/60 rounded-xl border border-purple-200/80 text-xs text-purple-900">
                <p className="font-bold">Add Topic to Spaced Revision Schedule</p>
                <p className="text-purple-700 mt-0.5">
                  Default schedule automatically sequences Day 0, Day 1, Day 3, Day 7, Day 14, and Day 30 revisions.
                </p>
              </div>

              {formError && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-stone-700 font-semibold mb-1">Subject</label>
                  <select
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-white text-xs font-medium"
                  >
                    {COMMON_SUBJECTS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-stone-700 font-semibold mb-1">Learned Date</label>
                  <input
                    type="date"
                    value={newLearnedDate}
                    onChange={(e) => setNewLearnedDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-white text-xs font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-stone-700 font-semibold text-xs mb-1">Topic Name</label>
                <input
                  type="text"
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                  placeholder="e.g. Indian Polity (Fundamental Rights)"
                  required
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-white text-xs font-medium"
                />
              </div>

              <div>
                <label className="block text-stone-700 font-semibold text-xs mb-1">
                  Revision Intervals (days from learned date)
                </label>
                <input
                  type="text"
                  value={newIntervalsStr}
                  onChange={(e) => setNewIntervalsStr(e.target.value)}
                  placeholder="0, 1, 3, 7, 14, 30"
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-white text-xs font-mono"
                />
                <p className="text-[11px] text-stone-400 mt-1">
                  Day 0 (Learned today), Day 1 (Tomorrow), Day 3 (+3 days), Day 7, Day 14, Day 30
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-stone-700 font-semibold mb-1">Initial Questions Attempted</label>
                  <input
                    type="number"
                    min="0"
                    value={newQuestions}
                    onChange={(e) => setNewQuestions(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-stone-700 font-semibold mb-1">Questions Correct</label>
                  <input
                    type="number"
                    min="0"
                    value={newCorrect}
                    onChange={(e) => setNewCorrect(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-white text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-stone-700 font-semibold text-xs mb-1">Study Notes (Optional)</label>
                <input
                  type="text"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Summary, weak areas, or key memory hooks..."
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-white text-xs"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl font-bold text-xs bg-purple-600 hover:bg-purple-700 text-white transition-colors shadow-sm"
                >
                  Create Spaced Revision Schedule
                </button>
              </div>
            </form>
          )}

          {/* ADJUST SCHEDULE MODAL OVERLAY */}
          {adjustingSchedule && (
            <div className="p-4 bg-stone-50 rounded-xl border border-stone-300 space-y-3 text-xs animate-fadeIn">
              <div className="flex items-center justify-between font-bold text-stone-900">
                <span>Adjust Schedule: {adjustingSchedule.topic}</span>
                <button
                  onClick={() => setAdjustingSchedule(null)}
                  className="text-stone-400 hover:text-stone-600"
                >
                  Cancel
                </button>
              </div>

              <div>
                <label className="block text-stone-700 font-semibold mb-1">Custom Day Intervals</label>
                <input
                  type="text"
                  value={customIntervalsStr}
                  onChange={(e) => setCustomIntervalsStr(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-stone-200 bg-white text-xs font-mono"
                  placeholder="0, 1, 3, 7, 14, 30"
                />
                <span className="text-[10px] text-stone-400">Comma-separated day offsets (e.g. 0, 1, 3, 7, 14, 30)</span>
              </div>

              {rescheduleStepIndex !== null && (
                <div>
                  <label className="block text-stone-700 font-semibold mb-1">
                    Reschedule Step {rescheduleStepIndex} Date
                  </label>
                  <input
                    type="date"
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-stone-200 bg-white text-xs"
                  />
                </div>
              )}

              <div className="flex items-center justify-end space-x-2 pt-1">
                <button
                  onClick={() => setAdjustingSchedule(null)}
                  className="px-3 py-1.5 rounded-lg text-stone-600 hover:bg-stone-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveAdjustedSchedule}
                  className="px-3.5 py-1.5 rounded-lg font-bold bg-purple-600 hover:bg-purple-700 text-white transition-colors"
                >
                  Save Schedule Adjustments
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-stone-200 bg-stone-50 flex items-center justify-between text-xs text-stone-500">
          <div className="flex items-center space-x-1.5">
            <span>🧠</span>
            <span className="font-semibold text-stone-800">
              {dueToday.length} revisions due today
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-white font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
