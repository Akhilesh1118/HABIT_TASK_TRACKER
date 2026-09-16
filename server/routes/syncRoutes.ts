import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { requireAuth } from '../middleware/authMiddleware';
import { TaskModel, HabitModel, HabitCompletionModel } from '../models/HabitData';
import { dbService } from '../services/dbService';
import { isMongoConnected } from '../services/mongoService';
import { Task, Habit, HabitCompletion } from '../../src/types';

export const syncRouter = Router();

// GET /api/sync - Retrieve authoritative data directly from MongoDB
syncRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    let tasks: Task[] = [];
    let habits: Habit[] = [];
    let habitCompletions: HabitCompletion[] = [];
    let dailyPriorities: Record<string, string[]> = {};

    if (isMongoConnected()) {
      try {
        // Link any orphan legacy 'usr_1' tasks/habits to active authenticated user
        await Promise.all([
          TaskModel.updateMany({ userId: 'usr_1' }, { $set: { userId } }),
          HabitModel.updateMany({ userId: 'usr_1' }, { $set: { userId } }),
          HabitCompletionModel.updateMany({ userId: 'usr_1' }, { $set: { userId } }),
        ]);

        const [mTasks, mHabits, mCompletions] = await Promise.all([
          TaskModel.find({ $or: [{ userId }, { userId: 'usr_1' }] }).sort({ createdAt: -1 }).lean(),
          HabitModel.find({ $or: [{ userId }, { userId: 'usr_1' }] }).sort({ createdAt: 1 }).lean(),
          HabitCompletionModel.find({ $or: [{ userId }, { userId: 'usr_1' }] }).lean(),
        ]);
        tasks = (mTasks as any[]).map((t) => ({
          ...t,
          scheduledDate: t.scheduledDate || t.date || t.dueDate || (t.createdAt ? t.createdAt.split('T')[0] : ''),
          status: t.status || (t.completed ? 'completed' : 'pending'),
          completed: Boolean(t.completed || t.status === 'completed'),
          completedAt: t.completedAt || (t.completed ? t.updatedAt || t.createdAt : null),
        }));
        habits = mHabits as any[];
        habitCompletions = mCompletions as any[];

        // Diagnostic logging
        console.log('[DIAGNOSTIC - BACKEND] GET /api/sync:', {
          endpoint: 'GET /api/sync',
          authenticatedUserId: userId,
          mongoDatabase: mongoose.connection?.name || 'unknown',
          mongoDocumentsReturned: {
            tasks: tasks.length,
            habits: habits.length,
            habitCompletions: habitCompletions.length,
          },
        });
      } catch (err: any) {
        console.warn('[SyncRoutes] Error reading from MongoDB, falling back to local:', err?.message);
        tasks = dbService.getTasks().filter((t) => t.userId === userId || !t.userId);
        habits = dbService.getHabits().filter((h) => h.userId === userId || !h.userId);
        habitCompletions = dbService.getHabitCompletions().filter((c) => c.userId === userId || !c.userId);
      }
    } else {
      tasks = dbService.getTasks().filter((t) => t.userId === userId || !t.userId);
      habits = dbService.getHabits().filter((h) => h.userId === userId || !h.userId);
      habitCompletions = dbService.getHabitCompletions().filter((c) => c.userId === userId || !c.userId);
    }

    dailyPriorities = dbService.getDailyPriorities();

    return res.json({
      success: true,
      tasks,
      habits,
      habitCompletions,
      dailyPriorities,
      source: isMongoConnected() ? 'mongodb' : 'local_fallback',
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err?.message || 'Failed to fetch sync state',
    });
  }
});

// POST /api/sync - Synchronize data with authoritative deletion of removed items
syncRouter.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        // fallback
      }
    }

    const { tasks, habits, habitCompletions, dailyPriorities } = body || {};

    // 1. Authoritative synchronization in MongoDB
    if (isMongoConnected()) {
      try {
        // Tasks
        if (Array.isArray(tasks)) {
          const taskIds = tasks.map((t: Task) => t.id).filter(Boolean);
          // Delete any tasks in MongoDB that are NOT in the incoming list for this user
          await TaskModel.deleteMany({ userId, id: { $nin: taskIds } });

          if (tasks.length > 0) {
            const taskOps = tasks.map((task: Task) => {
              const scheduledDate = task.scheduledDate || task.date || task.dueDate || (task.createdAt ? task.createdAt.split('T')[0] : '');
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
          // Delete any habits in MongoDB that are NOT in the incoming list for this user
          await HabitModel.deleteMany({ userId, id: { $nin: habitIds } });
          // Also delete completions for deleted habits
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
          // Remove completions for this user that are not in incoming list
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
        console.warn('[SyncRoutes] Authoritative MongoDB sync warning:', mongoErr?.message);
      }
    }

    // 2. Also keep dbService in sync
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
    return res.status(500).json({
      success: false,
      error: err?.message || 'Failed to sync data',
    });
  }
});
