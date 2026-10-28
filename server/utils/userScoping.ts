export function scopeRecordsToUser<T extends { userId?: string }>(records: T[], authenticatedUserId: string): Array<T & { userId: string }> {
  return records.map((record) => ({ ...record, userId: authenticatedUserId }));
}
