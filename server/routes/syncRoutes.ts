import express, { type Request, type Response } from 'express';
import mongoose from 'mongoose';
import { requireAuth } from '../middleware/authMiddleware.ts';
import { TaskModel, HabitModel, HabitCompletionModel, TaskCompletionModel, FocusSessionModel, UserCategoryModel } from '../models/HabitData.ts';
import { UserModel } from '../models/User.ts';
import { isValidDateKey, validateSyncCompletionDates, validateTaskCompletionSync } from '../utils/dateValidation.ts';
import { isValidDailyPriorities } from '../utils/dailyPriorities.ts';
import { dbService, getTodayISTStr } from '../services/dbService.ts';
import { isMongoConnected } from '../services/mongoService.ts';
import type { Task, Habit, HabitCompletion, TaskCompletion, FocusSession, CategoryItem } from '../../src/types.ts';

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
    let dailyNotes: Record<string, string> = {};
    let categories: CategoryItem[] = [];

    if (isMongoConnected()) {
      try {
        const userFilter = { userId };

        const [mTasks, mHabits, mCompletions, mTaskCompletions, mFocus, mCategories] = await Promise.all([
          TaskModel.find(userFilter).sort({ createdAt: -1 }).lean(),
          HabitModel.find(userFilter).sort({ createdAt: 1 }).lean(),
          HabitCompletionModel.find(userFilter).lean(),
          TaskCompletionModel.find(userFilter).lean(),
          FocusSessionModel.find(userFilter).sort({ startedAt: -1 }).lean(),
          UserCategoryModel.find(userFilter).sort({ createdAt: 1 }).lean(),
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
        if (mCategories && mCategories.length > 0) {
          categories = (mCategories as any[]).map((c) => ({
            id: c.id,
            name: c.name,
            icon: c.icon || '🏷️',
            color: c.color || '#7c3aed',
            isDefault: Boolean(c.isDefault),
          }));
        } else {
          // No categories in UserCategoryModel: check if user has tasks/habits (older user)
          const entityCats = new Set<string>();
          tasks.forEach((t) => { if (t.category && t.category.trim()) entityCats.add(t.category.trim()); });
          habits.forEach((h) => { if (h.category && h.category.trim()) entityCats.add(h.category.trim()); });

          if (entityCats.size > 0) {
            const catMap = new Map<string, CategoryItem>();
            catMap.set('personal learning', {
              id: 'cat_personal_learning',
              name: 'Personal Learning',
              icon: '📖',
              color: '#7c3aed',
              isDefault: true,
            });
            entityCats.forEach((name) => {
              const norm = name.toLowerCase().trim();
              if (!catMap.has(norm)) {
                catMap.set(norm, {
                  id: 'cat_' + norm.replace(/[^a-z0-9]/g, '_'),
                  name: name.trim(),
                  icon: '🏷️',
                  color: '#6366f1',
                  isDefault: false,
                });
              }
            });
            categories = Array.from(catMap.values());
          } else {
            // New user: ONLY Personal Learning
            categories = [
              { id: 'cat_personal_learning', name: 'Personal Learning', icon: '📖', color: '#7c3aed', isDefault: true },
            ];
          }

          if (userId && categories.length > 0) {
            const catOps = categories.map((cat) => ({
              updateOne: {
                filter: { userId, name: cat.name },
                update: {
                  $setOnInsert: { id: cat.id },
                  $set: { icon: cat.icon, color: cat.color, isDefault: cat.isDefault },
                },
                upsert: true,
              },
            }));
            (UserCategoryModel as any).bulkWrite(catOps).catch(() => {});
            dbService.saveCategories(userId, categories);
          }
        }

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
            categories: categories.length,
          },
        });
      } catch (err: any) {
        console.warn('[SyncRoutes] Error reading from MongoDB, falling back to local:', err?.message);
        tasks = dbService.getTasks(userId);
        habits = dbService.getHabits(userId);
        habitCompletions = dbService.getHabitCompletions(userId);
        taskCompletions = dbService.getTaskCompletions(userId);
        focusSessions = dbService.getFocusSessions(userId);
        categories = dbService.getCategories(userId);
      }
    } else {
      tasks = dbService.getTasks(userId);
      habits = dbService.getHabits(userId);
      habitCompletions = dbService.getHabitCompletions(userId);
      taskCompletions = dbService.getTaskCompletions(userId);
      focusSessions = dbService.getFocusSessions(userId);
      categories = dbService.getCategories(userId);
    }

    if (isMongoConnected()) {
      const priorityOwner = await UserModel.findById(userId).select('dailyPriorities dailyNotes').lean() as any;
      dailyPriorities = priorityOwner?.dailyPriorities || dbService.getUserDailyPriorities(userId);
      dailyNotes = priorityOwner?.dailyNotes || dbService.getUserDailyNotes(userId);
    } else if (!process.env.VERCEL) {
      dailyPriorities = dbService.getUserDailyPriorities(userId);
      dailyNotes = dbService.getUserDailyNotes(userId);
    }

    return res.json({
      success: true,
      tasks,
      habits,
      habitCompletions,
      taskCompletions,
      focusSessions,
      ...(isMongoConnected() || !process.env.VERCEL ? { dailyPriorities } : {}),
      ...(isMongoConnected() || !process.env.VERCEL ? { dailyNotes } : {}),
      dailyPrioritiesPersisted: Boolean(isMongoConnected() || !process.env.VERCEL),
      dailyNotesPersisted: Boolean(isMongoConnected() || !process.env.VERCEL),
      categories,
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

    const { tasks, habits, habitCompletions, taskCompletions, focusSessions, dailyPriorities, dailyNotes, categories } = body;

    const hasTasks = Array.isArray(tasks);
    const hasHabits = Array.isArray(habits);
    const hasCompletions = Array.isArray(habitCompletions);
    const hasTaskCompletions = Array.isArray(taskCompletions);
    const hasFocus = Array.isArray(focusSessions);
    const hasPriorities = dailyPriorities !== undefined && typeof dailyPriorities === 'object' && !Array.isArray(dailyPriorities);
    const hasNotes = dailyNotes !== undefined && typeof dailyNotes === 'object' && !Array.isArray(dailyNotes);
    const hasCategories = Array.isArray(categories);

    if (!hasTasks && !hasHabits && !hasCompletions && !hasTaskCompletions && !hasFocus && !hasPriorities && !hasNotes && !hasCategories) {
      return res.status(400).json({
        success: false,
        error: 'Malformed sync payload: at least one valid array/field (tasks, habits, habitCompletions, taskCompletions, focusSessions, dailyPriorities, dailyNotes, categories) must be provided.',
      });
    }
    if (hasPriorities && !isValidDailyPriorities(dailyPriorities)) {
      return res.status(400).json({ success: false, error: 'Daily priorities must map valid YYYY-MM-DD dates to arrays of up to three task IDs.' });
    }
    if (hasNotes && !Object.entries(dailyNotes).every(([date, notes]) => isValidDateKey(date) && typeof notes === 'string')) {
      return res.status(400).json({ success: false, error: 'Daily notes must map valid YYYY-MM-DD dates to text.' });
    }

    const todayIST = getTodayISTStr();
    const existingTasksForValidation = isMongoConnected()
      ? await TaskModel.find({ userId }).select('id date scheduledDate completed status completedAt').lean() as any[]
      : dbService.getTasks(userId);
    const existingHabitCompletions = isMongoConnected()
      ? await HabitCompletionModel.find({ userId }).select('habitId date completed').lean() as any[]
      : dbService.getHabitCompletions(userId);
    const existingTaskCompletions = isMongoConnected()
      ? await TaskCompletionModel.find({ userId }).select('taskId date completed completedAt').lean() as any[]
      : dbService.getTaskCompletions(userId);
    if (!validateTaskCompletionSync(hasTasks ? tasks : undefined, existingTasksForValidation, todayIST) ||
        !validateSyncCompletionDates(hasCompletions ? habitCompletions : undefined, existingHabitCompletions, (c: HabitCompletion) => `${c.habitId}_${c.date}`, todayIST) ||
        !validateSyncCompletionDates(hasTaskCompletions ? taskCompletions : undefined, existingTaskCompletions, (c: TaskCompletion) => `${c.taskId}_${c.date}`, todayIST)) {
      return res.status(400).json({ success: false, error: 'Sync cannot add or change completion records outside today.' });
    }

    // 1. Authoritative synchronization in MongoDB
    if (isMongoConnected()) {
      try {
        // Tasks - Non-destructive upsert of incoming tasks
        if (hasTasks && tasks.length > 0) {
          const taskOps = tasks.map((task: Task) => {
            const { _id, __v, ...cleanTask } = (task as any);
            const scheduledDate = cleanTask.scheduledDate || cleanTask.date || cleanTask.dueDate || (cleanTask.createdAt ? cleanTask.createdAt.split('T')[0] : '');
            const isCompleted = Boolean(cleanTask.completed || cleanTask.status === 'completed');
            const status = cleanTask.status || (isCompleted ? 'completed' : 'pending');
            const completedAt = isCompleted ? (cleanTask.completedAt || new Date().toISOString()) : null;
            return {
              updateOne: {
                filter: { id: cleanTask.id, userId },
                update: {
                  $set: {
                    ...cleanTask,
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
          await (TaskModel as any).bulkWrite(taskOps, { ordered: false });
        }

        // Habits - Non-destructive upsert of incoming habits
        if (Array.isArray(habits) && habits.length > 0) {
          const habitOps = habits.map((habit: Habit) => {
            const { _id, __v, ...cleanHabit } = (habit as any);
            return {
              updateOne: {
                filter: { id: cleanHabit.id, userId },
                update: { $set: { ...cleanHabit, userId } },
                upsert: true,
              },
            };
          });
          await (HabitModel as any).bulkWrite(habitOps, { ordered: false });
        }

        // Habit Completions - Non-destructive upsert of incoming habit completions
        const todayIST = getTodayISTStr();
        if (Array.isArray(habitCompletions) && habitCompletions.length > 0) {
          const validHabitComps = habitCompletions.filter((comp: HabitCompletion) => !comp.completed || comp.date <= todayIST);
          if (validHabitComps.length > 0) {
            const compOps = validHabitComps.map((comp: HabitCompletion) => {
              const { _id, __v, ...cleanComp } = (comp as any);
              return {
                updateOne: {
                  filter: { habitId: cleanComp.habitId, date: cleanComp.date, userId },
                  update: { $set: { ...cleanComp, userId } },
                  upsert: true,
                },
              };
            });
            await (HabitCompletionModel as any).bulkWrite(compOps, { ordered: false });
          }
        }

        // Task Completions - Non-destructive upsert of incoming date-specific task completions
        if (Array.isArray(taskCompletions) && taskCompletions.length > 0) {
          const validTaskComps = taskCompletions.filter((comp: TaskCompletion) => !comp.completed || comp.date <= todayIST);
          if (validTaskComps.length > 0) {
            const taskCompOps = validTaskComps.map((comp: TaskCompletion) => {
              const { _id, __v, ...cleanComp } = (comp as any);
              return {
                updateOne: {
                  filter: { taskId: cleanComp.taskId, date: cleanComp.date, userId },
                  update: { $set: { ...cleanComp, userId } },
                  upsert: true,
                },
              };
            });
            await (TaskCompletionModel as any).bulkWrite(taskCompOps, { ordered: false });
          }
        }

        // Focus Sessions - authoritative upsert preserving all user history (excluding future dates)
        if (Array.isArray(focusSessions) && focusSessions.length > 0) {
          const validSessions = focusSessions.filter((session: FocusSession) => !session.date || session.date <= todayIST);
          if (validSessions.length > 0) {
            const userPrefix = (userId || 'usr').replace(/[^a-zA-Z0-9_-]/g, '_');
            const focusOps = validSessions.map((session: FocusSession) => {
              // Strip internal MongoDB _id and __v so MongoDB never attempts to insert or update existing _id
              const { _id, __v, ...cleanSession } = (session as any);
              const sessionId = cleanSession.id && cleanSession.id.startsWith('foc_yest_') && !cleanSession.id.includes(userPrefix)
                ? `${cleanSession.id}_${userPrefix}`
                : cleanSession.id;
              return {
                updateOne: {
                  filter: { id: sessionId, userId },
                  update: { $set: { ...cleanSession, id: sessionId, userId } },
                  upsert: true,
                },
              };
            });
            try {
              await (FocusSessionModel as any).bulkWrite(focusOps, { ordered: false });
            } catch (focusErr: any) {
              if (focusErr?.code === 11000 || focusErr?.message?.includes('E11000')) {
                console.warn('[SyncRoutes] Duplicate key warning handled gracefully for focus sessions:', focusErr?.message);
              } else {
                throw focusErr;
              }
            }
          }
        }

        // Categories - Authoritative replace of user's categories in MongoDB
        if (hasCategories) {
          await UserCategoryModel.deleteMany({ userId });
          if (categories.length > 0) {
            await UserCategoryModel.insertMany(
              categories.map((c: any) => ({
                id: c.id,
                userId,
                name: c.name,
                icon: c.icon || '🏷️',
                color: c.color || '#7c3aed',
                isDefault: Boolean(c.isDefault),
              }))
            );
          }
        }

      } catch (mongoErr: any) {
        console.warn('[SyncRoutes] Authoritative MongoDB sync warning:', mongoErr?.message);
      }
    }

    let dailyPrioritiesPersisted = false;
    if (hasPriorities) {
      if (isMongoConnected()) {
        try {
          const writeResult = await UserModel.updateOne({ _id: userId }, [{
            $set: {
              dailyPriorities: {
                $mergeObjects: [{ $ifNull: ['$dailyPriorities', {}] }, { $literal: dailyPriorities }],
              },
            },
          }]);
          if (!writeResult.acknowledged || writeResult.matchedCount < 1) {
            return res.status(404).json({ success: false, dailyPrioritiesPersisted: false, error: 'Account not found while saving Today’s Top 3.' });
          }
          dailyPrioritiesPersisted = true;
        } catch (priorityErr: any) {
          console.error('[SyncRoutes] Failed to persist Today’s Top 3 to MongoDB:', priorityErr?.message);
          return res.status(500).json({ success: false, dailyPrioritiesPersisted: false, error: 'Today’s Top 3 could not be saved to the account database.' });
        }
      } else if (process.env.MONGODB_URI?.trim() || process.env.VERCEL) {
        return res.status(503).json({ success: false, dailyPrioritiesPersisted: false, error: 'The account database is temporarily unavailable.' });
      } else {
        dailyPrioritiesPersisted = true;
      }
    }

    let dailyNotesPersisted = false;
    if (hasNotes) {
      if (isMongoConnected()) {
        try {
          // Merge the per-date map atomically. Dynamic dotted paths under a
          // Mixed field can be cast/stripped differently across Mongoose
          // versions, which made saves appear successful without persisting.
          const writeResult = await UserModel.updateOne({ _id: userId }, [{
            $set: {
              dailyNotes: {
                $mergeObjects: [{ $ifNull: ['$dailyNotes', {}] }, { $literal: dailyNotes }],
              },
            },
          }]);
          if (!writeResult.acknowledged || writeResult.matchedCount < 1) {
            return res.status(404).json({ success: false, dailyNotesPersisted: false, error: 'Account not found while saving Quick Notes.' });
          }
          dailyNotesPersisted = true;
        } catch (notesErr: any) {
          console.error('[SyncRoutes] Failed to persist Quick Notes to MongoDB:', notesErr?.message);
          return res.status(500).json({ success: false, dailyNotesPersisted: false, error: 'Quick Notes could not be saved to the account database.' });
        }
      } else if (process.env.MONGODB_URI?.trim() || process.env.VERCEL) {
        return res.status(503).json({ success: false, dailyNotesPersisted: false, error: 'The account database is temporarily unavailable.' });
      } else {
        dailyNotesPersisted = true;
      }

      if (dailyNotesPersisted) dbService.syncUserDailyNotes(userId, dailyNotes);
    }

    // 2. Also keep dbService in sync
    const syncPayload: any = {};
    if (hasTasks) syncPayload.tasks = tasks;
    if (hasHabits) syncPayload.habits = habits;
    if (hasCompletions) syncPayload.habitCompletions = habitCompletions;
    if (hasTaskCompletions) syncPayload.taskCompletions = taskCompletions;
    if (hasPriorities && dailyPrioritiesPersisted) syncPayload.dailyPriorities = dailyPriorities;
    if (hasFocus) {
      dbService.syncFocusSessions(focusSessions, userId);
    }
    if (hasCategories) {
      dbService.saveCategories(userId, categories);
    }

    const result = dbService.syncData(syncPayload, userId);

    return res.status(200).json({
      success: true,
      syncedAt: new Date().toISOString(),
      changed: result.changed,
      dailyPrioritiesPersisted,
      dailyNotesPersisted,
      counts: {
        tasks: result.tasksCount,
        habits: result.habitsCount,
        habitCompletions: result.completionsCount,
        taskCompletions: result.taskCompletionsCount,
        focusSessions: hasFocus ? focusSessions.length : undefined,
        categories: hasCategories ? categories.length : undefined,
      },
      categories: dbService.getCategories(userId),
    });
  } catch (err: any) {
    console.error('[Sync API Error]', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Failed to sync data',
    });
  }
});
