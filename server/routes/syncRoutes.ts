import express, { type Request, type Response } from 'express';
import mongoose from 'mongoose';
import { requireAuth } from '../middleware/authMiddleware.ts';
import { TaskModel, HabitModel, HabitCompletionModel, TaskCompletionModel, FocusSessionModel } from '../models/HabitData.ts';
import { dbService, getTodayISTStr } from '../services/dbService.ts';
import { isMongoConnected } from '../services/mongoService.ts';
import type { Task, Habit, HabitCompletion, TaskCompletion, FocusSession } from '../../src/types.ts';

export const syncRouter = express.Router();

// GET /api/sync - Retrieve authoritative data directly from MongoDB
syncRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    let tasks: Task[] = [];
    let habits: Habit[] = [];
    let habitCompletions: HabitCompletion[] = [];
    let taskCompletions: TaskCompletion[] = [];
    let focusSessions: FocusSession[] = [];
    let dailyPriorities: Record<string, string[]> = {};

    if (isMongoConnected()) {
      try {
        const userFilter = { userId };

        const [mTasks, mHabits, mCompletions, mTaskCompletions, mFocus] = await Promise.all([
          TaskModel.find(userFilter).sort({ createdAt: -1 }).lean(),
          HabitModel.find(userFilter).sort({ createdAt: 1 }).lean(),
          HabitCompletionModel.find(userFilter).lean(),
          TaskCompletionModel.find(userFilter).lean(),
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
        taskCompletions = mTaskCompletions as any[];
        focusSessions = mFocus as any[];

        // Diagnostic logging
        console.log('[BACKEND] GET /api/sync:', {
          endpoint: 'GET /api/sync',
          authenticatedUserId: userId,
          mongoDatabase: mongoose.connection?.name || 'unknown',
          mongoDocumentsReturned: {
            tasks: tasks.length,
            habits: habits.length,
            habitCompletions: habitCompletions.length,
            taskCompletions: taskCompletions.length,
            focusSessions: focusSessions.length,
          },
        });
      } catch (err: any) {
        console.warn('[SyncRoutes] Error reading from MongoDB, falling back to local:', err?.message);
        tasks = dbService.getTasks(userId);
        habits = dbService.getHabits(userId);
        habitCompletions = dbService.getHabitCompletions(userId);
        taskCompletions = dbService.getTaskCompletions(userId);
        focusSessions = dbService.getFocusSessions(userId);
      }
    } else {
      tasks = dbService.getTasks(userId);
      habits = dbService.getHabits(userId);
      habitCompletions = dbService.getHabitCompletions(userId);
      taskCompletions = dbService.getTaskCompletions(userId);
      focusSessions = dbService.getFocusSessions(userId);
    }

    dailyPriorities = dbService.getDailyPriorities();

    return res.json({
      success: true,
      tasks,
      habits,
      habitCompletions,
      taskCompletions,
      focusSessions,
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
        body = null;
      }
    } else if (Buffer.isBuffer(body)) {
      try {
        body = JSON.parse(body.toString('utf8'));
      } catch {
        body = null;
      }
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      const safeUserId = userId ? `${userId.slice(0, 8)}...` : 'unknown';
      console.warn('[SyncRoutes POST Validation Failed: Invalid Body]', {
        contentType: req.headers['content-type'] || 'unknown',
        bodyType: typeof req.body,
        user: safeUserId,
      });
      return res.status(400).json({
        success: false,
        error: 'Invalid or missing sync payload. Expected JSON object with tasks, habits, habitCompletions, or taskCompletions.',
      });
    }

    const { tasks, habits, habitCompletions, taskCompletions, focusSessions, dailyPriorities } = body;

    const hasTasks = Array.isArray(tasks);
    const hasHabits = Array.isArray(habits);
    const hasCompletions = Array.isArray(habitCompletions);
    const hasTaskCompletions = Array.isArray(taskCompletions);
    const hasFocus = Array.isArray(focusSessions);
    const hasPriorities = dailyPriorities !== undefined && typeof dailyPriorities === 'object' && !Array.isArray(dailyPriorities);

    if (!hasTasks && !hasHabits && !hasCompletions && !hasTaskCompletions && !hasFocus && !hasPriorities) {
      return res.status(400).json({
        success: false,
        error: 'Malformed sync payload: at least one valid array/field (tasks, habits, habitCompletions, taskCompletions, focusSessions, dailyPriorities) must be provided.',
      });
    }

    // 1. Authoritative synchronization in MongoDB
    if (isMongoConnected()) {
      try {
        // Tasks - Non-destructive upsert of incoming tasks
        if (hasTasks && tasks.length > 0) {
          const taskOps = tasks.map((task: Task) => {
            const scheduledDate = task.scheduledDate || task.date || task.dueDate || (task.createdAt ? task.createdAt.split('T')[0] : '');
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
        if (Array.isArray(habits) && habits.length > 0) {
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
        const todayIST = getTodayISTStr();
        if (Array.isArray(habitCompletions) && habitCompletions.length > 0) {
          const validHabitComps = habitCompletions.filter((comp: HabitCompletion) => !comp.completed || comp.date <= todayIST);
          if (validHabitComps.length > 0) {
            const compOps = validHabitComps.map((comp: HabitCompletion) => ({
              updateOne: {
                filter: { habitId: comp.habitId, date: comp.date, userId },
                update: { $set: { ...comp, userId } },
                upsert: true,
              },
            }));
            await (HabitCompletionModel as any).bulkWrite(compOps);
          }
        }

        // Task Completions - Non-destructive upsert of incoming date-specific task completions
        if (Array.isArray(taskCompletions) && taskCompletions.length > 0) {
          const validTaskComps = taskCompletions.filter((comp: TaskCompletion) => !comp.completed || comp.date <= todayIST);
          if (validTaskComps.length > 0) {
            const taskCompOps = validTaskComps.map((comp: TaskCompletion) => ({
              updateOne: {
                filter: { taskId: comp.taskId, date: comp.date, userId },
                update: { $set: { ...comp, userId } },
                upsert: true,
              },
            }));
            await (TaskCompletionModel as any).bulkWrite(taskCompOps);
          }
        }

        // Focus Sessions - authoritative upsert preserving all user history (excluding future dates)
        if (Array.isArray(focusSessions) && focusSessions.length > 0) {
          const validSessions = focusSessions.filter((session: FocusSession) => !session.date || session.date <= todayIST);
          if (validSessions.length > 0) {
            const focusOps = validSessions.map((session: FocusSession) => ({
              updateOne: {
                filter: { id: session.id, userId },
                update: { $set: { ...session, userId } },
                upsert: true,
              },
            }));
            await (FocusSessionModel as any).bulkWrite(focusOps);
          }
        }
      } catch (mongoErr: any) {
        console.warn('[SyncRoutes] Authoritative MongoDB sync warning:', mongoErr?.message);
      }
    }

    // 2. Also keep dbService in sync
    const syncPayload: any = {};
    if (hasTasks) syncPayload.tasks = tasks;
    if (hasHabits) syncPayload.habits = habits;
    if (hasCompletions) syncPayload.habitCompletions = habitCompletions;
    if (hasTaskCompletions) syncPayload.taskCompletions = taskCompletions;
    if (hasPriorities) syncPayload.dailyPriorities = dailyPriorities;
    if (hasFocus) {
      dbService.syncFocusSessions(focusSessions, userId);
    }

    const result = dbService.syncData(syncPayload, userId);

    return res.status(200).json({
      success: true,
      syncedAt: new Date().toISOString(),
      changed: result.changed,
      counts: {
        tasks: result.tasksCount,
        habits: result.habitsCount,
        habitCompletions: result.completionsCount,
        taskCompletions: result.taskCompletionsCount,
        focusSessions: hasFocus ? focusSessions.length : undefined,
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
