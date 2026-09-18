import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { dbService } from '../server/services/dbService.ts';
import { connectToDatabase, isMongoConnected } from '../server/services/mongoService.ts';
import { TaskModel, HabitModel, HabitCompletionModel, FocusSessionModel } from '../server/models/HabitData.ts';
import { verifyRequestAuth } from '../server/middleware/authMiddleware.ts';
import type { Task, Habit, HabitCompletion, FocusSession } from '../src/types.ts';

// Helper to safely and robustly parse request body across Vercel serverless and Express environments
async function parseRequestBody(req: any): Promise<{ parsed: any; error?: string }> {
  // Case 1: req.body is already a pre-parsed JavaScript object (not null and not a Buffer)
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return { parsed: req.body };
  }

  // Case 2: req.body is a JSON string
  if (typeof req.body === 'string') {
    const trimmed = req.body.trim();
    if (!trimmed) {
      return { parsed: null, error: 'Empty request body string' };
    }
    try {
      return { parsed: JSON.parse(trimmed) };
    } catch (err: any) {
      return { parsed: null, error: `Malformed JSON string: ${err?.message}` };
    }
  }

  // Case 3: req.body is a Buffer
  if (Buffer.isBuffer(req.body)) {
    const str = req.body.toString('utf8').trim();
    if (!str) {
      return { parsed: null, error: 'Empty Buffer in request body' };
    }
    try {
      return { parsed: JSON.parse(str) };
    } catch (err: any) {
      return { parsed: null, error: `Malformed JSON Buffer: ${err?.message}` };
    }
  }

  // Case 4: Fallback for raw streams ONLY if req is an active, unread stream
  if (req.on && typeof req.on === 'function' && !req.readableEnded && !req.complete) {
    return new Promise((resolve) => {
      let data = '';
      req.on('data', (chunk: any) => {
        data += chunk;
      });
      req.on('end', () => {
        const trimmed = data.trim();
        if (!trimmed) {
          return resolve({ parsed: null, error: 'Empty request stream body' });
        }
        try {
          resolve({ parsed: JSON.parse(trimmed) });
        } catch (err: any) {
          resolve({ parsed: null, error: `Malformed JSON stream: ${err?.message}` });
        }
      });
      req.on('error', (err: any) => {
        resolve({ parsed: null, error: `Stream read error: ${err?.message}` });
      });
    });
  }

  return { parsed: null, error: 'Request body is absent or already consumed' };
}

export default async function handler(req: Request, res: Response) {
  // Ensure database connection
  await connectToDatabase();

  const user = verifyRequestAuth(req);
  if (!user) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Personal authentication required.',
    });
  }

  const userId = user.userId;
  const isAdmin = user.role === 'admin' || user.email === (process.env.INITIAL_ADMIN_EMAIL || 'aky9842@gmail.com').toLowerCase().trim();

  if (req.method === 'GET') {
    try {
      let tasks: Task[] = [];
      let habits: Habit[] = [];
      let habitCompletions: HabitCompletion[] = [];
      let focusSessions: FocusSession[] = [];
      let dailyPriorities: Record<string, string[]> = {};

      if (isMongoConnected()) {
        try {
          // If admin, also query any legacy data without userId or with default/admin markers
          const userFilter = isAdmin
            ? {
                $or: [
                  { userId },
                  { userId: { $in: [null, '', 'default_user', 'usr_admin', '6aaa82ad324e4764b161c6dd'] } },
                  { userId: { $exists: false } },
                ],
              }
            : { userId };

          const [mTasks, mHabits, mCompletions, mFocus] = await Promise.all([
            TaskModel.find(userFilter).sort({ createdAt: -1 }).lean(),
            HabitModel.find(userFilter).sort({ createdAt: 1 }).lean(),
            HabitCompletionModel.find(userFilter).lean(),
            FocusSessionModel.find(userFilter).sort({ startedAt: -1 }).lean(),
          ]);

          tasks = (mTasks as any[]).map((t) => ({
            ...t,
            scheduledDate: t.scheduledDate || t.date || t.dueDate || (t.createdAt ? String(t.createdAt).split('T')[0] : ''),
            status: t.status || (t.completed ? 'completed' : 'pending'),
            completed: Boolean(t.completed || t.status === 'completed'),
            completedAt: t.completedAt || (t.completed ? t.updatedAt || t.createdAt : null),
          }));
          habits = mHabits as any[];
          habitCompletions = mCompletions as any[];
          focusSessions = mFocus as any[];

          // If legacy records found for admin, migrate them to the current admin userId
          if (isAdmin) {
            await Promise.all([
              TaskModel.updateMany({ userId: { $in: [null, '', 'default_user', 'usr_admin', '6aaa82ad324e4764b161c6dd'] } }, { $set: { userId } }),
              HabitModel.updateMany({ userId: { $in: [null, '', 'default_user', 'usr_admin', '6aaa82ad324e4764b161c6dd'] } }, { $set: { userId } }),
              HabitCompletionModel.updateMany({ userId: { $in: [null, '', 'default_user', 'usr_admin', '6aaa82ad324e4764b161c6dd'] } }, { $set: { userId } }),
              FocusSessionModel.updateMany({ userId: { $in: [null, '', 'default_user', 'usr_admin', '6aaa82ad324e4764b161c6dd'] } }, { $set: { userId } }),
            ]);
          }
        } catch (err: any) {
          console.warn('[Vercel Sync API] MongoDB query warning, fallback to local store:', err?.message);
          tasks = dbService.getTasks(userId);
          habits = dbService.getHabits(userId);
          habitCompletions = dbService.getHabitCompletions(userId);
          focusSessions = dbService.getFocusSessions(userId);
        }
      } else {
        tasks = dbService.getTasks(userId);
        habits = dbService.getHabits(userId);
        habitCompletions = dbService.getHabitCompletions(userId);
        focusSessions = dbService.getFocusSessions(userId);
      }

      dailyPriorities = dbService.getDailyPriorities();

      return res.status(200).json({
        success: true,
        tasks,
        habits,
        habitCompletions,
        focusSessions,
        dailyPriorities,
        source: isMongoConnected() ? 'mongodb_atlas' : 'local_fallback',
      });
    } catch (err: any) {
      console.error('[Vercel Sync GET Error]', err);
      return res.status(500).json({ success: false, error: err?.message || 'Failed to fetch sync state' });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed: Use GET or POST.' });
  }

  try {
    const { parsed: body, error: parseError } = await parseRequestBody(req);

    // If request body is missing, malformed, or not an object, REJECT with HTTP 400
    if (parseError || !body || typeof body !== 'object' || Array.isArray(body)) {
      const safeUserId = userId ? `${userId.slice(0, 8)}...` : 'unknown';
      console.warn('[Sync API POST Validation Failed: Malformed / Missing Body]', {
        method: req.method,
        contentType: req.headers['content-type'] || 'unknown',
        bodyType: typeof req.body,
        isBuffer: Buffer.isBuffer(req.body),
        parseError: parseError || 'Invalid payload (must be a JSON object)',
        user: safeUserId,
      });

      return res.status(400).json({
        success: false,
        error: 'Invalid or missing sync payload. Expected JSON object with tasks, habits, habitCompletions, or focusSessions.',
      });
    }

    const { tasks, habits, habitCompletions, focusSessions, dailyPriorities } = body;

    const hasTasks = Array.isArray(tasks);
    const hasHabits = Array.isArray(habits);
    const hasCompletions = Array.isArray(habitCompletions);
    const hasFocus = Array.isArray(focusSessions);
    const hasPriorities = dailyPriorities !== undefined && typeof dailyPriorities === 'object' && !Array.isArray(dailyPriorities);

    // Protect against payloads that have no recognizable sync fields
    if (!hasTasks && !hasHabits && !hasCompletions && !hasFocus && !hasPriorities) {
      const safeUserId = userId ? `${userId.slice(0, 8)}...` : 'unknown';
      console.warn('[Sync API POST Validation Failed: No recognized sync fields]', {
        method: req.method,
        contentType: req.headers['content-type'] || 'unknown',
        receivedKeys: Object.keys(body),
        user: safeUserId,
      });

      return res.status(400).json({
        success: false,
        error: 'Malformed sync payload: at least one valid array/field (tasks, habits, habitCompletions, focusSessions, dailyPriorities) must be provided.',
      });
    }

    if (isMongoConnected()) {
      try {
        // Tasks - Non-destructive upsert of incoming tasks
        if (hasTasks && tasks.length > 0) {
          const taskOps = tasks.map((task: Task) => {
            const scheduledDate = task.scheduledDate || task.date || task.dueDate || (task.createdAt ? String(task.createdAt).split('T')[0] : '');
            const isCompleted = Boolean(task.completed || task.status === 'completed');
            const status = task.status || (isCompleted ? 'completed' : 'pending');
            const completedAt = isCompleted ? (task.completedAt || new Date().toISOString()) : null;
            return {
              updateOne: {
                filter: { id: task.id, userId },
                update: {
                  $set: {
                    ...task,
                    scheduledDate,
                    date: scheduledDate,
                    status,
                    completed: isCompleted,
                    completedAt,
                    userId,
                  },
                },
                upsert: true,
              },
            };
          });
          await (TaskModel as any).bulkWrite(taskOps);
        }

        // Habits - Non-destructive upsert of incoming habits
        if (hasHabits && habits.length > 0) {
          const habitOps = habits.map((habit: Habit) => ({
            updateOne: {
              filter: { id: habit.id, userId },
              update: { $set: { ...habit, userId } },
              upsert: true,
            },
          }));
          await (HabitModel as any).bulkWrite(habitOps);
        }

        // Habit Completions - Non-destructive upsert of incoming habit completions
        if (hasCompletions && habitCompletions.length > 0) {
          const compOps = habitCompletions.map((comp: HabitCompletion) => ({
            updateOne: {
              filter: { habitId: comp.habitId, date: comp.date, userId },
              update: { $set: { ...comp, userId } },
              upsert: true,
            },
          }));
          await (HabitCompletionModel as any).bulkWrite(compOps);
        }

        // Focus Sessions - Non-destructive upsert of incoming focus sessions
        if (hasFocus && focusSessions.length > 0) {
          const focusOps = focusSessions.map((session: FocusSession) => ({
            updateOne: {
              filter: { id: session.id, userId },
              update: { $set: { ...session, userId } },
              upsert: true,
            },
          }));
          await (FocusSessionModel as any).bulkWrite(focusOps);
        }
      } catch (mongoErr: any) {
        console.warn('[Vercel Sync POST Warning] MongoDB sync:', mongoErr?.message);
      }
    }

    const syncPayload: any = {};
    if (hasTasks) syncPayload.tasks = tasks;
    if (hasHabits) syncPayload.habits = habits;
    if (hasCompletions) syncPayload.habitCompletions = habitCompletions;
    if (hasFocus) syncPayload.focusSessions = focusSessions;
    if (hasPriorities) syncPayload.dailyPriorities = dailyPriorities;

    const result = dbService.syncData(syncPayload, userId);

    return res.status(200).json({
      success: true,
      syncedAt: new Date().toISOString(),
      changed: result.changed,
      counts: {
        tasks: result.tasksCount,
        habits: result.habitsCount,
        habitCompletions: result.completionsCount,
        focusSessions: Array.isArray(focusSessions) ? focusSessions.length : 0,
      },
    });
  } catch (err: any) {
    console.error('[Vercel Sync API POST Error]', err);
    return res.status(500).json({ error: err?.message || 'Failed to sync data' });
  }
}

