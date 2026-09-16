/**
 * Time and Timezone utility for Indian Standard Time (Asia/Kolkata, UTC+05:30)
 */

export const IST_TIMEZONE = 'Asia/Kolkata';

export interface ISTDateTime {
  dateStr: string; // YYYY-MM-DD
  timeStr: string; // HH:MM (24-hour)
  hours: number;
  minutes: number;
  formatted12h: string; // e.g. "8:00 PM"
}

/**
 * Gets the current date and time in Indian Standard Time (Asia/Kolkata).
 * Uses Intl.DateTimeFormat with hourCycle: 'h23' and includes a guaranteed
 * mathematical UTC+05:30 fallback that prevents midnight rollover bugs on any runtime.
 */
export function getCurrentIST(): ISTDateTime {
  const now = new Date();

  try {
    const formatter = new Intl.DateTimeFormat('en-IN', {
      timeZone: IST_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });

    const parts = formatter.formatToParts(now);
    let year = '';
    let month = '';
    let day = '';
    let hourStr = '';
    let minuteStr = '';

    for (const p of parts) {
      if (p.type === 'year') year = p.value;
      if (p.type === 'month') month = p.value;
      if (p.type === 'day') day = p.value;
      if (p.type === 'hour') hourStr = p.value;
      if (p.type === 'minute') minuteStr = p.value;
    }

    if (year && month && day && hourStr && minuteStr) {
      let hours = parseInt(hourStr, 10);
      if (hours === 24) hours = 0;
      const minutes = parseInt(minuteStr, 10);
      const normalizedHourStr = String(hours).padStart(2, '0');
      const normalizedMinuteStr = String(minutes).padStart(2, '0');
      const timeStr = `${normalizedHourStr}:${normalizedMinuteStr}`;
      const dateStr = `${year}-${month}-${day}`;

      return {
        dateStr,
        timeStr,
        hours,
        minutes,
        formatted12h: formatTime12Hour(timeStr),
      };
    }
  } catch {
    // Fallback to pure UTC+05:30 offset below
  }

  // Pure mathematical UTC+05:30 fallback (immune to host system timezone)
  const istOffsetMs = 330 * 60 * 1000;
  const istDate = new Date(now.getTime() + istOffsetMs);
  const y = istDate.getUTCFullYear();
  const m = String(istDate.getUTCMonth() + 1).padStart(2, '0');
  const d = String(istDate.getUTCDate()).padStart(2, '0');
  const h = istDate.getUTCHours();
  const min = istDate.getUTCMinutes();
  const timeStr = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  const dateStr = `${y}-${m}-${d}`;

  return {
    dateStr,
    timeStr,
    hours: h,
    minutes: min,
    formatted12h: formatTime12Hour(timeStr),
  };
}

/**
 * Converts "20:00" to "8:00 PM"
 */
export function formatTime12Hour(time24?: string): string {
  if (!time24) return '';
  const [hStr, mStr = '00'] = time24.split(':');
  let h = parseInt(hStr, 10);
  if (isNaN(h)) return time24;
  if (h === 24) h = 0;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${mStr.padStart(2, '0')} ${ampm}`;
}

/**
 * Checks if targetTime (HH:MM 24hr) has arrived or passed compared to currentTime (HH:MM)
 */
export function isTimeArrivedOrPast(targetTime: string, currentTimeStr?: string): boolean {
  if (!targetTime) return false;
  const current = currentTimeStr || getCurrentIST().timeStr;
  const [tHStr, tMStr = '00'] = targetTime.split(':');
  const [cHStr, cMStr = '00'] = current.split(':');
  const tH = parseInt(tHStr, 10);
  const tM = parseInt(tMStr, 10);
  const cH = parseInt(cHStr, 10);
  const cM = parseInt(cMStr, 10);

  if (isNaN(tH) || isNaN(cH)) return false;

  if (cH > tH) return true;
  if (cH === tH && cM >= (isNaN(tM) ? 0 : tM)) return true;
  return false;
}

/**
 * Subtracts minutes from a 24-hour time string ("20:00" - 30 min -> "19:30")
 */
export function subtractMinutesFromTime(time24: string, minutesToSubtract: number): string {
  if (!time24) return '20:00';
  const [hStr, mStr = '00'] = time24.split(':');
  let h = parseInt(hStr, 10);
  let m = parseInt(mStr, 10);
  if (isNaN(h) || isNaN(m)) return time24;

  let totalMinutes = h * 60 + m - minutesToSubtract;
  if (totalMinutes < 0) {
    totalMinutes = (24 * 60 + (totalMinutes % (24 * 60))) % (24 * 60);
  }

  const newH = Math.floor(totalMinutes / 60) % 24;
  const newM = totalMinutes % 60;

  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

export type TaskScheduleStatus = 'completed' | 'overdue' | 'pending';

/**
 * Determines task schedule status according to Asia/Kolkata timezone:
 * - Completed ('completed')
 * - Incomplete + deadline passed -> overdue ('overdue')
 * - Incomplete + before deadline -> pending ('pending')
 */
export function evaluateTaskScheduleStatus(params: {
  completed: boolean;
  dueDate: string;
  dueTime?: string;
  currentTimeIST?: string;
  currentDateIST?: string;
}): {
  status: TaskScheduleStatus;
  isOverdue: boolean;
} {
  const { completed, dueDate, dueTime } = params;
  if (completed) {
    return { status: 'completed', isOverdue: false };
  }

  const ist = getCurrentIST();
  const currentDate = params.currentDateIST || ist.dateStr;
  const currentTime = params.currentTimeIST || ist.timeStr;

  // Check: Incomplete + deadline passed -> Overdue
  const effectiveDueTime = dueTime || '23:59';
  const isPastDate = dueDate < currentDate;
  const isPastDueTime = dueDate === currentDate && isTimeArrivedOrPast(effectiveDueTime, currentTime);
  const isOverdue = isPastDate || isPastDueTime;

  if (isOverdue) {
    return { status: 'overdue', isOverdue: true };
  }

  return { status: 'pending', isOverdue: false };
}

