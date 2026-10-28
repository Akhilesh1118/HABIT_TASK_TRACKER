export interface CompletedStudyOccurrence {
  occurrenceId: string;
  completed: boolean;
  subject?: string;
  minutes?: number;
}

export function isUniqueMorningPeak(counts: [number, number, number, number], minimumSample = 5): boolean {
  const total = counts.reduce((sum, count) => sum + count, 0);
  if (total < minimumSample) return false;
  const peak = Math.max(...counts);
  return counts[0] === peak && counts.filter((count) => count === peak).length === 1;
}

export function aggregateCompletedStudyMinutes(
  occurrences: CompletedStudyOccurrence[]
): Map<string, number> {
  const unique = new Map<string, CompletedStudyOccurrence>();
  for (const occurrence of occurrences) {
    if (occurrence.completed && occurrence.subject && occurrence.minutes && occurrence.minutes > 0) {
      unique.set(occurrence.occurrenceId, occurrence);
    }
  }
  const totals = new Map<string, number>();
  for (const occurrence of unique.values()) {
    totals.set(occurrence.subject!, (totals.get(occurrence.subject!) || 0) + occurrence.minutes!);
  }
  return totals;
}
