import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { dbService } from '../server/services/dbService.ts';
import { connectToDatabase, isMongoConnected } from '../server/services/mongoService.ts';
import { TaskModel, HabitModel, HabitCompletionModel } from '../server/models/HabitData.ts';
import { verifyRequestAuth } from '../server/middleware/authMiddleware.ts';
import type { Task, Habit, HabitCompletion } from '../src/types.ts';

// Helper to safely parse body on Vercel
async function parseRequestBody(req: any): Promise<any> {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk: any) => {
      data += chunk;
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(data));
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
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

          const [mTasks, mHabits, mCompletions] = await Promise.all([
            TaskModel.find(userFilter).sort({ createdAt: -1 }).lean(),
            HabitModel.find(userFilter).sort({ createdAt: 1 }).lean(),
            HabitCompletionModel.find(userFilter).lean(),
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

          // If legacy records found for admin, migrate them to the current admin userId
          if (isAdmin) {
            await Promise.all([
              TaskModel.updateMany({ userId: { $in: [null, '', 'default_user', 'usr_admin', '6aaa82ad324e4764b161c6dd'] } }, { $set: { userId } }),
              HabitModel.updateMany({ userId: { $in: [null, '', 'default_user', 'usr_admin', '6aaa82ad324e4764b161c6dd'] } }, { $set: { userId } }),
              HabitCompletionModel.updateMany({ userId: { $in: [null, '', 'default_user', 'usr_admin', '6aaa82ad324e4764b161c6dd'] } }, { $set: { userId } }),
            ]);
          }
        } catch (err: any) {
          console.warn('[Vercel Sync API] MongoDB query warning, fallback to local store:', err?.message);
          tasks = dbService.getTasks().filter((t) => t.userId === userId || (isAdmin && (!t.userId || t.userId === 'usr_admin')));
          habits = dbService.getHabits().filter((h) => h.userId === userId || (isAdmin && (!h.userId || h.userId === 'usr_admin')));
          habitCompletions = dbService.getHabitCompletions().filter((c) => c.userId === userId || (isAdmin && (!c.userId || c.userId === 'usr_admin')));
        }
      } else {
        tasks = dbService.getTasks().filter((t) => t.userId === userId || (isAdmin && (!t.userId || t.userId === 'usr_admin')));
        habits = dbService.getHabits().filter((h) => h.userId === userId || (isAdmin && (!h.userId || h.userId === 'usr_admin')));
        habitCompletions = dbService.getHabitCompletions().filter((c) => c.userId === userId || (isAdmin && (!c.userId || c.userId === 'usr_admin')));
      }

      dailyPriorities = dbService.getDailyPriorities();

      return res.status(200).json({
        success: true,
        tasks,
        habits,
        habitCompletions,
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
    const body = await parseRequestBody(req);
    const { tasks, habits, habitCompletions, dailyPriorities } = body || {};

    if (isMongoConnected()) {
      try {
        // Tasks
        if (Array.isArray(tasks)) {
          const taskIds = tasks.map((t: Task) => t.id).filter(Boolean);
          await TaskModel.deleteMany({ userId, id: { $nin: taskIds } });

          if (tasks.length > 0) {
            const taskOps = tasks.map((task: Task) => {
              const scheduledDate = task.scheduledDate || task.date || task.dueDate || (task.createdAt ? String(task.createdAt).split('T')[0] : '');
              const isCompleted = Boolean(task.completed || task.status === 'completed');
              const status = task.status || (isCompleted ? 'completed' : 'pending');
              const completedAt = isCompleted ? (task.completedAt || new Date().toISOString()) : null;
              return {
                updateOne: {
                  filter: { id: task.id },
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
        }

        // Habits
        if (Array.isArray(habits)) {
          const habitIds = habits.map((h: Habit) => h.id).filter(Boolean);
          await HabitModel.deleteMany({ userId, id: { $nin: habitIds } });
          await HabitCompletionModel.deleteMany({ userId, habitId: { $nin: habitIds } });

          if (habits.length > 0) {
            const habitOps = habits.map((habit: Habit) => ({
              updateOne: {
                filter: { id: habit.id },
                update: { $set: { ...habit, userId } },
                upsert: true,
              },
            }));
            await (HabitModel as any).bulkWrite(habitOps);
          }
        }

        // Habit Completions
        if (Array.isArray(habitCompletions)) {
          const compKeys = habitCompletions.map((c: HabitCompletion) => `${c.habitId}_${c.date}`);
          const existing = await HabitCompletionModel.find({ userId }).lean();
          const toDelete = (existing as any[])
            .filter((c) => !compKeys.includes(`${c.habitId}_${c.date}`))
            .map((c) => c._id);
          if (toDelete.length > 0) {
            await HabitCompletionModel.deleteMany({ _id: { $in: toDelete } });
          }

          if (habitCompletions.length > 0) {
            const compOps = habitCompletions.map((comp: HabitCompletion) => ({
              updateOne: {
                filter: { habitId: comp.habitId, date: comp.date },
                update: { $set: { ...comp, userId } },
                upsert: true,
              },
            }));
            await (HabitCompletionModel as any).bulkWrite(compOps);
          }
        }
      } catch (mongoErr: any) {
        console.warn('[Vercel Sync POST Warning] MongoDB sync:', mongoErr?.message);
      }
    }

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
    console.error('[Vercel Sync API POST Error]', err);
    return res.status(500).json({ error: err?.message || 'Failed to sync data' });
  }
}
