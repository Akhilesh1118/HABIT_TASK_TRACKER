import React from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { DayActivity, ActivityLevel } from '../types';
import { WEEKDAY_NAMES } from '../utils/calendarUtils';

interface ActivityGridProps {
  monthName: string;
  year: number;
  days: DayActivity[];
  selectedDate: string;
  todayDate: string;
  onSelectDate: (date: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onCurrentMonth: () => void;
}

export const ActivityGrid: React.FC<ActivityGridProps> = ({
  monthName,
  year,
  days,
  selectedDate,
  todayDate,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
  onCurrentMonth,
}) => {
  // Map level to styling
  const getCellClasses = (day: DayActivity) => {
    const isSel = day.date === selectedDate;
    const isTod = day.date === todayDate;

    let base = 'relative flex flex-col items-center justify-between rounded-lg p-1 sm:p-2 transition-all cursor-pointer select-none text-xs ';

    // Selection ring
    if (isSel) {
      base += 'ring-2 ring-stone-900 ring-offset-2 z-10 ';
    } else {
      base += 'hover:ring-1 hover:ring-stone-400 ';
    }

    // Faded if not current month
    if (!day.isCurrentMonth) {
      base += 'opacity-40 hover:opacity-75 ';
    }

    // Level colors
    switch (day.level) {
      case 'high': // 100%
        base += 'bg-emerald-600 text-white font-semibold shadow-xs';
        break;
      case 'medium': // 50-99%
        base += 'bg-emerald-400 text-emerald-950 font-medium';
        break;
      case 'low': // 1-49%
        base += 'bg-emerald-100 text-emerald-900 border border-emerald-300';
        break;
      case 'empty': // 0% completed of scheduled tasks
        base += 'bg-stone-100 text-stone-700 border border-dashed border-stone-300';
        break;
      case 'none': // no tasks scheduled
      default:
        base += 'bg-stone-50 text-stone-600 border border-stone-200/70 hover:bg-stone-100';
        break;
    }

    return base;
  };

  return (
    <div className="bg-white rounded-2xl border border-stone-200/90 shadow-xs p-4 sm:p-5">
      {/* Month Navigation Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <CalendarIcon className="w-5 h-5 text-stone-700" />
          <h2 className="text-base sm:text-lg font-bold text-stone-900">
            {monthName} {year}
          </h2>
        </div>

        <div className="flex items-center space-x-1.5">
          <button
            id="prev-month-btn"
            onClick={onPrevMonth}
            aria-label="Previous Month"
            className="p-1.5 rounded-lg text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            id="today-month-btn"
            onClick={onCurrentMonth}
            className="text-xs font-semibold px-2.5 py-1 rounded-md text-stone-700 hover:bg-stone-100 transition-colors"
          >
            Today
          </button>
          <button
            id="next-month-btn"
            onClick={onNextMonth}
            aria-label="Next Month"
            className="p-1.5 rounded-lg text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Weekday Column Headers (Mon to Sun) */}
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2 mb-2">
        {WEEKDAY_NAMES.map((w) => (
          <div
            key={w}
            className="text-center text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-stone-400 py-1"
          >
            {w}
          </div>
        ))}
      </div>

      {/* Calendar / Activity Cells */}
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {days.map((day) => {
          const isTod = day.date === todayDate;
          const tooltipText = day.totalItems > 0
            ? `${day.date}: ${day.completedItems}/${day.totalItems} tasks completed (${day.percentage}%)`
            : `${day.date}: No tasks scheduled`;

          return (
            <button
              key={day.date}
              id={`cell-${day.date}`}
              onClick={() => onSelectDate(day.date)}
              title={tooltipText}
              className={`${getCellClasses(day)} h-14 sm:h-16`}
            >
              {/* Day Number and Today Marker */}
              <div className="w-full flex items-center justify-between">
                <span className={`text-[11px] sm:text-xs leading-none ${isTod ? 'font-black' : 'font-medium'}`}>
                  {day.dayOfMonth}
                </span>

                {isTod && (
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-orange-500 ring-2 ring-white"
                    title="Today"
                  />
                )}
              </div>

              {/* Progress summary or mini indicator */}
              <div className="w-full flex items-center justify-end text-[10px] sm:text-[11px] mt-auto">
                {day.totalItems > 0 ? (
                  <span className="leading-none opacity-90">
                    {day.completedItems}/{day.totalItems}
                  </span>
                ) : (
                  <span className="text-stone-300 leading-none">·</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Activity Intensity Legend */}
      <div className="mt-5 pt-4 border-t border-stone-100 flex flex-wrap items-center justify-between gap-3 text-xs text-stone-500">
        <span className="font-medium text-stone-600">Activity Level:</span>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded bg-stone-50 border border-stone-200" />
            <span className="text-[11px]">No tasks</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded bg-stone-100 border border-dashed border-stone-300" />
            <span className="text-[11px]">0%</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300" />
            <span className="text-[11px]">1–49%</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded bg-emerald-400" />
            <span className="text-[11px]">50–99%</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded bg-emerald-600" />
            <span className="text-[11px]">100%</span>
          </div>
        </div>
      </div>
    </div>
  );
};
