import { isValidDateKey } from './dateValidation.ts';

export function isValidDailyPriorities(value: unknown): value is Record<string, string[]> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.entries(value).every(([date, ids]) =>
    isValidDateKey(date) && Array.isArray(ids) && ids.length <= 3 && ids.every((id) => typeof id === 'string')
  );
}

export function mergeDailyPriorities(
  current: Record<string, string[]> | undefined,
  incoming: Record<string, string[]>
): Record<string, string[]> {
  // Each date is an independent value; [] is the explicit cleared value.
  return { ...(current || {}), ...incoming };
}
