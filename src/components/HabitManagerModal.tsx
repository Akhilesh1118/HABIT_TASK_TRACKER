import React, { useState } from 'react';
import { X, Plus, Trash2, Clock, Power } from 'lucide-react';
import { Habit, TaskCategory } from '../types';
import { CATEGORY_DETAILS } from '../utils/calendarUtils';
import { formatTime12Hour } from '../utils/timeUtils';

interface HabitManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  habits: Habit[];
  onSaveHabit: (habit: Omit<Habit, 'id' | 'createdAt'> & { id?: string }) => void;
  onToggleActive: (id: string) => void;
  onDeleteHabit: (id: string) => void;
  todayDate: string;
}

const CATEGORIES: TaskCategory[] = [
  'SSC CGL',
  'Technical',
  'English',
  'Health/Fitness',
  'Personal Learning',
  'Other',
];

export const HabitManagerModal: React.FC<HabitManagerModalProps> = ({
  isOpen,
  onClose,
  habits,
  onSaveHabit,
  onToggleActive,
  onDeleteHabit,
  todayDate,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TaskCategory>('SSC CGL');
  const [frequency, setFrequency] = useState<'daily' | 'weekly'>('daily');
  const [target, setTarget] = useState('');
  const [startDate, setStartDate] = useState(todayDate);
  const [dueTime, setDueTime] = useState('20:00');

  if (!isOpen) return null;

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSaveHabit({
      userId: 'usr_1',
      name: name.trim(),
      description: description.trim() || undefined,
      category,
      frequency,
      target: target.trim() || undefined,
      startDate,
      dueTime,
      active: true,
    });

    setName('');
    setDescription('');
    setTarget('');
    setDueTime('20:00');
    setIsCreating(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-xs">
      <div
        id="habits-manager-modal"
        className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-stone-200 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-stone-100">
          <div>
            <h3 className="text-xl font-bold text-stone-900 tracking-tight">
              Habit System
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Recurring daily and weekly habits that build your routine and activity grid
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
          {/* Create Button or Form */}
          {!isCreating ? (
            <button
              id="new-habit-prompt-btn"
              onClick={() => setIsCreating(true)}
              className="w-full py-3 px-4 border-2 border-dashed border-stone-300 hover:border-stone-400 rounded-xl text-stone-700 font-semibold text-sm flex items-center justify-center space-x-2 bg-stone-50/50 hover:bg-stone-50 transition-colors"
            >
              <Plus className="w-4 h-4 text-emerald-600" />
              <span>Create New Recurring Habit</span>
            </button>
          ) : (
            <form
              onSubmit={handleCreateSubmit}
              className="bg-stone-50 rounded-xl p-4 border border-stone-200 space-y-3"
            >
              <div className="flex items-center justify-between pb-2 border-b border-stone-200/60">
                <span className="text-xs font-bold uppercase tracking-wider text-stone-700">
                  New Habit Definition
                </span>
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="text-xs text-stone-400 hover:text-stone-700 font-medium"
                >
                  Cancel
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">
                  Habit Name (with emoji) <span className="text-red-500">*</span>
                </label>
                <input
                  id="habit-name-input"
                  type="text"
                  required
                  placeholder="e.g. 📚 CGL Study, 💻 Coding, 🗣️ English Speaking"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-white rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">
                    Category
                  </label>
                  <select
                    id="habit-category-select"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as TaskCategory)}
                    className="w-full px-2.5 py-1.5 bg-white rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">
                    Frequency
                  </label>
                  <select
                    id="habit-frequency-select"
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as 'daily' | 'weekly')}
                    className="w-full px-2.5 py-1.5 bg-white rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">
                    Target Duration
                  </label>
                  <input
                    id="habit-target-input"
                    type="text"
                    placeholder="e.g. 1 hour, 30 min"
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">
                  Description / Method
                </label>
                <input
                  id="habit-desc-input"
                  type="text"
                  placeholder="e.g. Solve 20 quantitative problems, or 1 mock section"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900"
                />
              </div>

              {/* Deadline */}
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-stone-700 flex items-center">
                    <Clock className="w-3.5 h-3.5 mr-1 text-stone-500" />
                    Deadline Time ({formatTime12Hour(dueTime)})
                  </label>
                  <span className="text-[10px] font-semibold text-stone-600 bg-stone-200/70 px-1.5 py-0.5 rounded">
                    Asia/Kolkata
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    id="habit-due-time-input"
                    type="time"
                    value={dueTime}
                    onChange={(e) => setDueTime(e.target.value)}
                    className="px-2.5 py-1.5 bg-white rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  id="save-habit-submit-btn"
                  type="submit"
                  className="px-4 py-2 bg-stone-900 text-white rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-stone-800 transition-colors shadow-xs"
                >
                  Save Habit
                </button>
              </div>
            </form>
          )}

          {/* List of Habits */}
          <div className="space-y-2.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500 block">
              Configured Habits ({habits.length})
            </span>

            {habits.map((habit) => {
              const catMeta = CATEGORY_DETAILS[habit.category] || CATEGORY_DETAILS.Other;

              return (
                <div
                  key={habit.id}
                  id={`habit-card-${habit.id}`}
                  className={`p-3.5 rounded-xl border flex items-center justify-between transition-all ${
                    habit.active
                      ? 'bg-white border-stone-200 shadow-xs'
                      : 'bg-stone-50 border-stone-200/60 opacity-60'
                  }`}
                >
                  <div className="flex items-start space-x-3 flex-1 min-w-0 mr-3">
                    <div className="pt-0.5">
                      <span className="text-xl leading-none">{catMeta.icon}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        <h4 className="text-sm font-bold text-stone-900 tracking-tight">
                          {habit.name}
                        </h4>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-stone-100 text-stone-600 border border-stone-200">
                          {habit.frequency}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${catMeta.bg} ${catMeta.text} ${catMeta.border}`}
                        >
                          {habit.category}
                        </span>

                        {/* Due Time Badge */}
                        {habit.dueTime && (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-stone-100 text-stone-700 border border-stone-200">
                            <Clock className="w-2.5 h-2.5 text-stone-500" />
                            <span>{formatTime12Hour(habit.dueTime)}</span>
                          </span>
                        )}
                      </div>

                      {habit.description && (
                        <p className="text-xs text-stone-500 mt-0.5 truncate">
                          {habit.description}
                        </p>
                      )}

                      {habit.target && (
                        <div className="flex items-center space-x-1 text-xs text-stone-400 mt-1">
                          <Clock className="w-3 h-3 text-stone-400" />
                          <span>Target: {habit.target}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-2 shrink-0">
                    <button
                      id={`toggle-habit-active-${habit.id}`}
                      onClick={() => onToggleActive(habit.id)}
                      className={`p-2 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-colors ${
                        habit.active
                          ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          : 'bg-stone-200 text-stone-600 hover:bg-stone-300'
                      }`}
                      title={habit.active ? 'Habit is active' : 'Habit is paused'}
                    >
                      <Power className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">{habit.active ? 'Active' : 'Paused'}</span>
                    </button>

                    <button
                      id={`delete-habit-${habit.id}`}
                      onClick={() => onDeleteHabit(habit.id)}
                      className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete habit"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-stone-100 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-xl transition-colors shadow-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
