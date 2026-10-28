import React, { useState, useEffect, useMemo } from 'react';
import {
  Award,
  Plus,
  Trash2,
  X,
  TrendingUp,
  Target,
  CheckCircle2,
  Clock,
  BookOpen,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { MockTestRecord } from '../types';
import { storageService } from '../services/storageService';
import { formatFriendlyDate } from '../utils/calendarUtils';

interface MockTestTrackerModalProps {
  isOpen: boolean;
  onClose: () => void;
  todayDate: string;
  userId: string;
}

export const MockTestTrackerModal: React.FC<MockTestTrackerModalProps> = ({
  isOpen,
  onClose,
  todayDate,
  userId,
}) => {
  const [mockTests, setMockTests] = useState<MockTestRecord[]>(() =>
    storageService.getMockTests(userId)
  );

  const [showAddForm, setShowAddForm] = useState(false);
  const [title, setTitle] = useState('');
  const [examType, setExamType] = useState('SSC CGL');
  const [date, setDate] = useState(todayDate);
  const [totalScore, setTotalScore] = useState('');
  const [maxScore, setMaxScore] = useState('200');
  const [accuracy, setAccuracy] = useState('');
  const [quantScore, setQuantScore] = useState('');
  const [reasoningScore, setReasoningScore] = useState('');
  const [englishScore, setEnglishScore] = useState('');
  const [gaScore, setGaScore] = useState('');
  const [timeSpentMinutes, setTimeSpentMinutes] = useState('60');
  const [notes, setNotes] = useState('');

  // Refresh tests on open or storage update
  useEffect(() => {
    if (isOpen) {
      setMockTests(storageService.getMockTests(userId));
    }
    const handleUpdate = (e: any) => {
      setMockTests(e?.detail || storageService.getMockTests(userId));
    };
    window.addEventListener('tracker:mock_tests_updated', handleUpdate);
    return () => {
      window.removeEventListener('tracker:mock_tests_updated', handleUpdate);
    };
  }, [isOpen, userId]);

  // Aggregate Stats
  const stats = useMemo(() => {
    if (mockTests.length === 0) {
      return { totalCount: 0, avgScore: 0, highestScore: 0, avgAccuracy: 0 };
    }
    const totalScoreSum = mockTests.reduce((sum, m) => sum + m.totalScore, 0);
    const avgScore = Math.round(totalScoreSum / mockTests.length);
    const highestScore = Math.max(...mockTests.map((m) => m.totalScore));
    const totalAccuracySum = mockTests.reduce((sum, m) => sum + (m.accuracy || 0), 0);
    const avgAccuracy = Math.round(totalAccuracySum / mockTests.length);

    return {
      totalCount: mockTests.length,
      avgScore,
      highestScore,
      avgAccuracy,
    };
  }, [mockTests]);

  if (!isOpen) return null;

  const handleSaveMock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !totalScore) return;

    const parsedTotal = parseFloat(totalScore) || 0;
    const parsedMax = parseFloat(maxScore) || 200;
    const parsedAcc = accuracy ? parseFloat(accuracy) : Math.round((parsedTotal / parsedMax) * 100);

    const newRecord: MockTestRecord = {
      id: `mock_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId,
      date: date || todayDate,
      title: title.trim(),
      examType: examType || 'SSC CGL',
      totalScore: parsedTotal,
      maxScore: parsedMax,
      accuracy: parsedAcc,
      quantScore: quantScore ? parseFloat(quantScore) : undefined,
      reasoningScore: reasoningScore ? parseFloat(reasoningScore) : undefined,
      englishScore: englishScore ? parseFloat(englishScore) : undefined,
      generalAwarenessScore: gaScore ? parseFloat(gaScore) : undefined,
      timeSpentMinutes: timeSpentMinutes ? parseInt(timeSpentMinutes, 10) : undefined,
      notes: notes.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    storageService.saveMockTest(newRecord, userId);
    setMockTests(storageService.getMockTests(userId));

    // Reset form
    setTitle('');
    setTotalScore('');
    setAccuracy('');
    setQuantScore('');
    setReasoningScore('');
    setEnglishScore('');
    setGaScore('');
    setNotes('');
    setShowAddForm(false);
  };

  const handleDeleteMock = (id: string) => {
    storageService.deleteMockTest(id, userId);
    setMockTests(storageService.getMockTests(userId));
  };

  return (
    <div
      id="mock-test-tracker-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/80 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto"
    >
      <div
        className="bg-white rounded-3xl border border-stone-200 shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/60 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-stone-900 tracking-tight">
                Mock Test &amp; Exam Performance
              </h2>
              <p className="text-xs text-stone-500">
                Record mock scores, accuracy % and section breakdowns
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Top Performance Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 rounded-2xl bg-stone-50 border border-stone-200/80">
              <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">
                Total Mocks
              </span>
              <span className="text-xl sm:text-2xl font-black text-stone-900">
                {stats.totalCount}
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-indigo-50/70 border border-indigo-100">
              <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block">
                Average Score
              </span>
              <span className="text-xl sm:text-2xl font-black text-indigo-900">
                {stats.avgScore} <span className="text-xs font-semibold text-indigo-600">pts</span>
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-100">
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
                Avg Accuracy
              </span>
              <span className="text-xl sm:text-2xl font-black text-emerald-900">
                {stats.avgAccuracy}%
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-100">
              <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">
                Best Score
              </span>
              <span className="text-xl sm:text-2xl font-black text-amber-900">
                {stats.highestScore} <span className="text-xs font-semibold text-amber-600">pts</span>
              </span>
            </div>
          </div>

          {/* Toggle Add Mock Test Form */}
          <div className="flex items-center justify-between pt-1">
            <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-wide text-stone-800">
              Logged Mock Tests ({mockTests.length})
            </h3>
            <button
              id="add-mock-test-toggle-btn"
              type="button"
              onClick={() => setShowAddForm(!showAddForm)}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{showAddForm ? 'Cancel' : 'Log New Mock'}</span>
            </button>
          </div>

          {/* Expandable Add Form */}
          {showAddForm && (
            <form
              onSubmit={handleSaveMock}
              className="p-4 rounded-2xl bg-stone-50 border border-stone-200/90 space-y-3.5 animate-in fade-in duration-150"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Mock Test Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. SSC CGL Tier-1 Full Mock #05"
                    className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Exam Category
                  </label>
                  <select
                    value={examType}
                    onChange={(e) => setExamType(e.target.value)}
                    className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="SSC CGL">SSC CGL</option>
                    <option value="SSC CHSL">SSC CHSL</option>
                    <option value="Banking / IBPS">Banking / IBPS</option>
                    <option value="Railways RRB">Railways RRB</option>
                    <option value="State PSC">State PSC</option>
                    <option value="General Studies">General Studies</option>
                    <option value="Technical">Technical</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Score *
                  </label>
                  <input
                    type="number"
                    step="0.25"
                    required
                    value={totalScore}
                    onChange={(e) => setTotalScore(e.target.value)}
                    placeholder="145"
                    className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Max Marks
                  </label>
                  <input
                    type="number"
                    value={maxScore}
                    onChange={(e) => setMaxScore(e.target.value)}
                    placeholder="200"
                    className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Accuracy %
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={accuracy}
                    onChange={(e) => setAccuracy(e.target.value)}
                    placeholder="88.5"
                    className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-white border border-stone-200 rounded-xl px-2.5 py-2 text-xs font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Optional Section Breakdowns */}
              <div className="pt-1">
                <span className="text-[11px] font-semibold text-stone-500 block mb-1">
                  Optional Section Scores (out of 50 each):
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <input
                    type="number"
                    step="0.5"
                    value={quantScore}
                    onChange={(e) => setQuantScore(e.target.value)}
                    placeholder="Quant (e.g. 42.5)"
                    className="bg-white border border-stone-200 rounded-xl px-2.5 py-1.5 text-xs text-stone-800"
                  />
                  <input
                    type="number"
                    step="0.5"
                    value={reasoningScore}
                    onChange={(e) => setReasoningScore(e.target.value)}
                    placeholder="Reasoning (e.g. 46)"
                    className="bg-white border border-stone-200 rounded-xl px-2.5 py-1.5 text-xs text-stone-800"
                  />
                  <input
                    type="number"
                    step="0.5"
                    value={englishScore}
                    onChange={(e) => setEnglishScore(e.target.value)}
                    placeholder="English (e.g. 40)"
                    className="bg-white border border-stone-200 rounded-xl px-2.5 py-1.5 text-xs text-stone-800"
                  />
                  <input
                    type="number"
                    step="0.5"
                    value={gaScore}
                    onChange={(e) => setGaScore(e.target.value)}
                    placeholder="GA (e.g. 24)"
                    className="bg-white border border-stone-200 rounded-xl px-2.5 py-1.5 text-xs text-stone-800"
                  />
                </div>
              </div>

              <div>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notes: e.g. Weak in Trigonometry & Indian Polity, missed 4 negative marks"
                  className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs font-medium text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-stone-600 hover:bg-stone-200/60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs active:scale-95 cursor-pointer"
                >
                  Save Mock Result
                </button>
              </div>
            </form>
          )}

          {/* List of Mock Tests */}
          {mockTests.length === 0 ? (
            <div className="p-8 rounded-2xl bg-stone-50 border border-stone-200/70 text-center space-y-2">
              <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center mx-auto mb-2">
                <Target className="w-5 h-5" />
              </div>
              <p className="text-sm font-bold text-stone-800">No mock tests recorded yet</p>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                Track full-length and sectional mocks to monitor your accuracy, section scores, and cut-off readiness over time.
              </p>
              <button
                type="button"
                onClick={() => setShowAddForm(true)}
                className="mt-2 inline-flex items-center space-x-1 px-3.5 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Log Your First Mock</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {mockTests.map((mock) => {
                const scorePercent = Math.round((mock.totalScore / mock.maxScore) * 100);
                return (
                  <div
                    key={mock.id}
                    className="p-3.5 sm:p-4 rounded-2xl bg-white border border-stone-200 shadow-2xs hover:border-stone-300 transition-all space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                          <h4 className="text-xs sm:text-sm font-bold text-stone-900 truncate">
                            {mock.title}
                          </h4>
                          <span className="text-[10px] font-semibold text-stone-500 bg-stone-100 px-2 py-0.5 rounded-md">
                            {mock.examType}
                          </span>
                          <span className="text-[10px] text-stone-400">
                            {mock.date}
                          </span>
                        </div>

                        {mock.notes && (
                          <p className="text-[11px] text-stone-600 mt-1 italic">
                            &quot;{mock.notes}&quot;
                          </p>
                        )}
                      </div>

                      {/* Right Score & Delete Button */}
                      <div className="flex items-center space-x-3 shrink-0">
                        <div className="text-right">
                          <span className="text-base sm:text-lg font-black text-indigo-700">
                            {mock.totalScore}
                            <span className="text-xs font-semibold text-stone-400">/{mock.maxScore}</span>
                          </span>
                          <div className="flex items-center justify-end space-x-1.5 text-[10px]">
                            <span className="font-semibold text-stone-600">{scorePercent}%</span>
                            <span>•</span>
                            <span className="font-bold text-emerald-600">{mock.accuracy}% Acc</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteMock(mock.id)}
                          className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete mock test"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Section Breakdown Pills */}
                    {(mock.quantScore !== undefined ||
                      mock.reasoningScore !== undefined ||
                      mock.englishScore !== undefined ||
                      mock.generalAwarenessScore !== undefined) && (
                      <div className="pt-2 border-t border-stone-100 flex items-center gap-2 flex-wrap text-[10px] text-stone-600">
                        <span className="font-semibold text-stone-400">Sections:</span>
                        {mock.quantScore !== undefined && (
                          <span className="bg-stone-50 border border-stone-200 px-2 py-0.5 rounded-md">
                            Quant: <strong className="text-stone-900">{mock.quantScore}</strong>
                          </span>
                        )}
                        {mock.reasoningScore !== undefined && (
                          <span className="bg-stone-50 border border-stone-200 px-2 py-0.5 rounded-md">
                            Reasoning: <strong className="text-stone-900">{mock.reasoningScore}</strong>
                          </span>
                        )}
                        {mock.englishScore !== undefined && (
                          <span className="bg-stone-50 border border-stone-200 px-2 py-0.5 rounded-md">
                            English: <strong className="text-stone-900">{mock.englishScore}</strong>
                          </span>
                        )}
                        {mock.generalAwarenessScore !== undefined && (
                          <span className="bg-stone-50 border border-stone-200 px-2 py-0.5 rounded-md">
                            GA: <strong className="text-stone-900">{mock.generalAwarenessScore}</strong>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-stone-100 bg-stone-50/60 flex items-center justify-between shrink-0 text-xs">
          <span className="text-stone-500">
            {stats.totalCount} test{stats.totalCount === 1 ? '' : 's'} recorded
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white font-bold rounded-xl text-xs transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
