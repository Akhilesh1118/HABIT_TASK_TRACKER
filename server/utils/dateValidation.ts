export function isValidDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function isTodayDateKey(value: unknown): value is string {
  if (!isValidDateKey(value)) return false;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const today = `${parts.find((part) => part.type === 'year')?.value}-${parts.find((part) => part.type === 'month')?.value}-${parts.find((part) => part.type === 'day')?.value}`;
  return value === today;
}

export function validateSyncCompletionDates<T extends { date?: unknown }>(
  records: Array<T & { completed?: boolean; completedAt?: string | null }> | undefined,
  existingRecords: Array<T & { completed?: boolean; completedAt?: string | null }>,
  keyFor: (record: T) => string,
  today: string
): boolean {
  if (!records) return true;
  const existing = new Map(existingRecords.map((record) => [keyFor(record), record]));
  return records.every((record) => {
    if (!isValidDateKey(record.date)) return false;
    if (record.date === today) return true;
    const old = existing.get(keyFor(record));
    // Full-state syncs resend history. Permit only idempotent historical rows;
    // a new row or a completion-state change is a mutation and must be rejected.
    return Boolean(old && old.completed === record.completed &&
      (record.completedAt === undefined || old.completedAt === record.completedAt));
  });
}

export function validateTaskCompletionSync(
  tasks: Array<{ id?: string; date?: string; scheduledDate?: string; completed?: boolean; status?: string; completedAt?: string | null }> | undefined,
  existingTasks: Array<{ id?: string; date?: string; scheduledDate?: string; completed?: boolean; status?: string; completedAt?: string | null }>,
  today: string
): boolean {
  if (!tasks) return true;
  const existing = new Map(existingTasks.map((task) => [task.id, task]));
  return tasks.every((task) => {
    if (!task.id) return false;
    const old = existing.get(task.id);
    const incomingCompleted = Boolean(task.completed || task.status === 'completed');
    const oldCompleted = Boolean(old?.completed || old?.status === 'completed');
    const date = task.scheduledDate || task.date;
    if (incomingCompleted === oldCompleted &&
        (task.completedAt === undefined || task.completedAt === old?.completedAt)) return true;
    return date === today && isValidDateKey(date);
  });
}
