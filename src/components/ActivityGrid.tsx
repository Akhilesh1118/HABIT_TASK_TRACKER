import React from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { DayActivity } from '../types';
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
      base += 'ring-2 ring-stone-900 dark:ring-stone-100 ring-offset-2 dark:ring-offset-stone-900 z-10 ';
    } else {
      base += 'hover:ring-1 hover:ring-stone-400 dark:hover:ring-stone-600 ';
    }

    // Faded if not current month
    if (!day.isCurrentMonth) {
      base += 'opacity-40 hover:opacity-75 ';
    }

    // Level colors
    switch (day.level) {
      case 'high': // 100%
        base += 'bg-emerald-600 dark:bg-emerald-500 text-white font-semibold shadow-xs';
        break;
      case 'medium': // 50-99%
        base += 'bg-emerald-400 dark:bg-emerald-600 text-emerald-950 dark:text-white font-medium';
        break;
      case 'low': // 1-49%
        base += 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/60';
        break;
      case 'empty': // 0% completed of scheduled tasks
        base += 'bg-stone-100 dark:bg-stone-800/80 text-stone-700 dark:text-stone-300 border border-dashed border-stone-300 dark:border-stone-700';
        break;
      case 'none': // no tasks scheduled
      default:
        base += 'bg-stone-50 dark:bg-stone-800/60 text-stone-600 dark:text-stone-400 border border-stone-200/70 dark:border-stone-800 hover:bg-stone-100 dark:hover:bg-stone-800';
        break;
    }

    return base;
  };

  return (
    <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/90 dark:border-stone-800 shadow-xs p-3.5 sm:p-6 transition-colors">
      {/* Month Navigation Header */}
      <div className="flex items-center justify-between mb-3.5 sm:mb-5">
        <div className="flex items-center space-x-2 sm:space-x-2.5">
          <CalendarIcon className="w-4.5 h-4.5 sm:w-6 sm:h-6 text-stone-700 dark:text-stone-300 shrink-0" />
          <h2 className="text-base sm:text-xl font-bold text-stone-900 dark:text-stone-100 truncate">
            {monthName} {year}
          </h2>
        </div>

        <div className="flex items-center space-x-1 sm:space-x-2 shrink-0">
          <button
            id="prev-month-btn"
            onClick={onPrevMonth}
            aria-label="Previous Month"
            className="p-1.5 sm:p-2 rounded-xl text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <button
            id="today-month-btn"
            onClick={onCurrentMonth}
            className="text-xs sm:text-sm font-semibold px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            Today
          </button>
          <button
            id="next-month-btn"
            onClick={onNextMonth}
            aria-label="Next Month"
            className="p-1.5 sm:p-2 rounded-xl text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>

      {/* Weekday Column Headers (Mon to Sun) */}
      <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-1.5 sm:mb-2.5">
        {WEEKDAY_NAMES.map((w) => (
          <div
            key={w}
            className="text-center text-[10px] sm:text-xs font-bold uppercase tracking-wider text-stone-400 py-0.5 sm:py-1 truncate"
          >
            {w}
          </div>
        ))}
      </div>

      {/* Calendar / Activity Cells */}
      <div className="grid grid-cols-7 gap-1 sm:gap-2 lg:gap-2.5">
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
              className={`${getCellClasses(day)} h-13 sm:h-18 lg:h-20 p-1 sm:p-2 lg:p-2.5 rounded-lg sm:rounded-xl`}
            >
              {/* Day Number and Today Marker */}
              <div className="w-full flex items-center justify-between">
                <span className={`text-[11px] sm:text-sm leading-none ${isTod ? 'font-black' : 'font-semibold'}`}>
                  {day.dayOfMonth}
                </span>

                {isTod && (
                  <span
                    className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-orange-500 ring-1 sm:ring-2 ring-white"
                    title="Today"
                  />
                )}
              </div>

              {/* Progress summary or mini indicator */}
              <div className="w-full flex items-center justify-end text-[9px] sm:text-xs font-medium mt-auto">
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
      <div className="mt-4 sm:mt-5 pt-3 sm:pt-4 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500">
        <span className="font-medium text-stone-600 text-[11px] sm:text-xs">Activity Level:</span>
        <div className="flex flex-wrap items-center gap-2 sm:space-x-3">
          <div className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-stone-50 border border-stone-200" />
            <span className="text-[10px] sm:text-[11px]">No tasks</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-stone-100 border border-dashed border-stone-300" />
            <span className="text-[10px] sm:text-[11px]">0%</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-emerald-100 border border-emerald-300" />
            <span className="text-[10px] sm:text-[11px]">1–49%</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-emerald-400" />
            <span className="text-[10px] sm:text-[11px]">50–99%</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-emerald-600" />
            <span className="text-[10px] sm:text-[11px]">100%</span>
          </div>
        </div>
      </div>
    </div>
  );
};
