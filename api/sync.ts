import type { Request, Response } from 'express';
import { dbService } from '../server/services/dbService';
import { verifyRequestAuth } from '../server/middleware/authMiddleware';

export default async function handler(req: Request, res: Response) {
  const user = verifyRequestAuth(req);
  if (!user) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Personal authentication required.',
    });
  }

  if (req.method === 'GET') {
    return res.status(200).json({
      success: true,
      tasks: dbService.getTasks().filter((t) => t.userId === user.userId),
      habits: dbService.getHabits().filter((h) => h.userId === user.userId),
      habitCompletions: dbService.getHabitCompletions().filter((c) => c.userId === user.userId),
      dailyPriorities: dbService.getDailyPriorities(),
      source: 'serverless',
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed: Use GET or POST.' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        // use raw body
      }
    }

    const { tasks, habits, habitCompletions, dailyPriorities } = body || {};
    const result = dbService.syncData({ tasks, habits, habitCompletions, dailyPriorities });

    return res.status(200).json({
      success: true,
      syncedAt: new Date().toISOString(),
      changed: result.changed,
      counts: {
        tasks: result.tasksCount,
        habits: result.habitsCount,
        habitCompletions: result.completionsCount,
      },
    });
  } catch (err: any) {
    console.error('[Sync API Error]', err);
    return res.status(500).json({ error: err?.message || 'Failed to sync data' });
  }
}
