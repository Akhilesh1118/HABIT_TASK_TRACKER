import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { dbService, getTodayISTStr } from '../server/services/dbService.ts';
import { connectToDatabase, isMongoConnected } from '../server/services/mongoService.ts';
import {
  TaskModel,
  HabitModel,
  HabitCompletionModel,
  TaskCompletionModel,
  FocusSessionModel,
  UserCategoryModel,
} from '../server/models/HabitData.ts';
import { verifyRequestAuth } from '../server/middleware/authMiddleware.ts';
import { UserModel } from '../server/models/User.ts';
import { isValidDateKey, validateSyncCompletionDates, validateTaskCompletionSync } from '../server/utils/dateValidation.ts';
import { isValidDailyPriorities } from '../server/utils/dailyPriorities.ts';
import type { Task, Habit, HabitCompletion, TaskCompletion, FocusSession, CategoryItem } from '../src/types.ts';

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
      let taskCompletions: TaskCompletion[] = [];
      let focusSessions: FocusSession[] = [];
      let dailyPriorities: Record<string, string[]> = {};
      let dailyNotes: Record<string, string> = {};
      let categories: CategoryItem[] = [];

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

          const [mTasks, mHabits, mCompletions, mTaskCompletions, mFocus, mCategories] = await Promise.all([
            TaskModel.find(userFilter).sort({ createdAt: -1 }).lean(),
            HabitModel.find(userFilter).sort({ createdAt: 1 }).lean(),
            HabitCompletionModel.find(userFilter).lean(),
            TaskCompletionModel.find(userFilter).lean(),
            FocusSessionModel.find(userFilter).sort({ startedAt: -1 }).lean(),
            UserCategoryModel.find({ userId }).sort({ createdAt: 1 }).lean(),
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
          if (mCategories.length > 0) {
            categories = mCategories.map((category) => ({
              id: category.id,
              name: category.name,
              icon: category.icon || '🏷️',
              color: category.color || '#7c3aed',
              isDefault: Boolean(category.isDefault),
            }));
          } else {
            const entityCategories = new Set<string>();
            tasks.forEach((task) => {
              if (task.category?.trim()) entityCategories.add(task.category.trim());
            });
            habits.forEach((habit) => {
              if (habit.category?.trim()) entityCategories.add(habit.category.trim());
            });

            const categoryMap = new Map<string, CategoryItem>();
            categoryMap.set('personal learning', {
              id: 'cat_personal_learning',
              name: 'Personal Learning',
              icon: '📖',
              color: '#7c3aed',
              isDefault: true,
            });
            entityCategories.forEach((name) => {
              const normalizedName = name.toLowerCase().trim();
              if (!categoryMap.has(normalizedName)) {
                categoryMap.set(normalizedName, {
                  id: `cat_${normalizedName.replace(/[^a-z0-9]/g, '_')}`,
                  name,
                  icon: '🏷️',
                  color: '#6366f1',
                  isDefault: false,
                });
              }
            });
            categories = Array.from(categoryMap.values());
          }

          // If legacy records found for admin, migrate them to the current admin userId
          if (isAdmin) {
            await Promise.all([
              TaskModel.updateMany({ userId: { $in: [null, '', 'default_user', 'usr_admin', '6aaa82ad324e4764b161c6dd'] } }, { $set: { userId } }),
              HabitModel.updateMany({ userId: { $in: [null, '', 'default_user', 'usr_admin', '6aaa82ad324e4764b161c6dd'] } }, { $set: { userId } }),
              HabitCompletionModel.updateMany({ userId: { $in: [null, '', 'default_user', 'usr_admin', '6aaa82ad324e4764b161c6dd'] } }, { $set: { userId } }),
              TaskCompletionModel.updateMany({ userId: { $in: [null, '', 'default_user', 'usr_admin', '6aaa82ad324e4764b161c6dd'] } }, { $set: { userId } }),
              FocusSessionModel.updateMany({ userId: { $in: [null, '', 'default_user', 'usr_admin', '6aaa82ad324e4764b161c6dd'] } }, { $set: { userId } }),
            ]);
          }

          if (categories.length > 0) {
            const categoryOps = categories.map((category) => ({
              updateOne: {
                filter: { userId, name: category.name },
                update: {
                  $setOnInsert: { id: category.id },
                  $set: {
                    icon: category.icon,
                    color: category.color,
                    isDefault: category.isDefault,
                  },
                },
                upsert: true,
              },
            }));
            await UserCategoryModel.bulkWrite(categoryOps).catch((err: any) => {
              console.warn('[Vercel Sync API] MongoDB category initialization warning:', err?.message);
            });
            dbService.saveCategories(userId, categories);
          }
        } catch (err: any) {
          console.warn('[Vercel Sync API] MongoDB query warning, fallback to local store:', err?.message);
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

      let userDailyNotes = dbService.getUserDailyNotes(userId);
      if (isMongoConnected()) {
        try {
          const filter = mongoose.Types.ObjectId.isValid(userId) ? { _id: userId } : { id: userId };
          const priorityOwner = await UserModel.findOne(filter).select('dailyPriorities dailyNotes').lean() as any;
          if (priorityOwner?.dailyPriorities && typeof priorityOwner.dailyPriorities === 'object') {
            dailyPriorities = { ...dbService.getUserDailyPriorities(userId), ...priorityOwner.dailyPriorities };
          } else {
            dailyPriorities = dbService.getUserDailyPriorities(userId);
          }
          if (priorityOwner?.dailyNotes && typeof priorityOwner.dailyNotes === 'object') {
            for (const [date, text] of Object.entries(priorityOwner.dailyNotes)) {
              if (typeof text === 'string' && text.trim().length > 0) {
                userDailyNotes[date] = text;
              } else if (!userDailyNotes[date]) {
                userDailyNotes[date] = text as string;
              }
            }
            dbService.syncUserDailyNotes(userId, userDailyNotes);
          }
        } catch (err: any) {
          console.warn('[Vercel Sync GET] Non-fatal: error loading notes from MongoDB:', err?.message);
          dailyPriorities = dbService.getUserDailyPriorities(userId);
        }
      } else {
        dailyPriorities = dbService.getUserDailyPriorities(userId);
      }
      dailyNotes = userDailyNotes;

      return res.status(200).json({
        success: true,
        tasks,
        habits,
        habitCompletions,
        taskCompletions,
        focusSessions,
        dailyPriorities,
        dailyNotes,
        dailyPrioritiesPersisted: true,
        dailyNotesPersisted: true,
        categories,
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
        error: 'Invalid or missing sync payload. Expected JSON object with tasks, habits, habitCompletions, taskCompletions, focusSessions, dailyPriorities, dailyNotes, or categories.',
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

    // Protect against payloads that have no recognizable sync fields
    if (!hasTasks && !hasHabits && !hasCompletions && !hasTaskCompletions && !hasFocus && !hasPriorities && !hasNotes && !hasCategories) {
      const safeUserId = userId ? `${userId.slice(0, 8)}...` : 'unknown';
      console.warn('[Sync API POST Validation Failed: No recognized sync fields]', {
        method: req.method,
        contentType: req.headers['content-type'] || 'unknown',
        receivedKeys: Object.keys(body),
        user: safeUserId,
      });

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

    if (isMongoConnected()) {
      try {
        const todayIST = getTodayISTStr();

        // Tasks - Non-destructive upsert of incoming tasks
        if (hasTasks && tasks.length > 0) {
          const taskOps = tasks.map((task: Task) => {
            const { _id, __v, ...cleanTask } = task as Task & { _id?: unknown; __v?: unknown };
            const scheduledDate = cleanTask.scheduledDate || cleanTask.date || cleanTask.dueDate || (cleanTask.createdAt ? String(cleanTask.createdAt).split('T')[0] : '');
            const isCompleted = Boolean(cleanTask.completed || cleanTask.status === 'completed');
            const status = task.status || (isCompleted ? 'completed' : 'pending');
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
          await (TaskModel as any).bulkWrite(taskOps);
        }

        // Habits - Non-destructive upsert of incoming habits
        if (hasHabits && habits.length > 0) {
          const habitOps = habits.map((habit: Habit) => {
            const { _id, __v, ...cleanHabit } = habit as Habit & { _id?: unknown; __v?: unknown };
            return {
              updateOne: {
                filter: { id: cleanHabit.id, userId },
                update: { $set: { ...cleanHabit, userId } },
                upsert: true,
              },
            };
          });
          await (HabitModel as any).bulkWrite(habitOps);
        }

        // Habit Completions - Non-destructive upsert of incoming habit completions
        if (hasCompletions && habitCompletions.length > 0) {
          const validCompletions = habitCompletions.filter((comp: HabitCompletion) => !comp.completed || comp.date <= todayIST);
          if (validCompletions.length > 0) {
            const compOps = validCompletions.map((comp: HabitCompletion) => {
              const { _id, __v, ...cleanCompletion } = comp as HabitCompletion & { _id?: unknown; __v?: unknown };
              return {
                updateOne: {
                  filter: { habitId: cleanCompletion.habitId, date: cleanCompletion.date, userId },
                  update: { $set: { ...cleanCompletion, userId } },
                  upsert: true,
                },
              };
            });
            await (HabitCompletionModel as any).bulkWrite(compOps);
          }
        }

        if (hasTaskCompletions && taskCompletions.length > 0) {
          const validCompletions = taskCompletions.filter((comp: TaskCompletion) => !comp.completed || comp.date <= todayIST);
          if (validCompletions.length > 0) {
            const compOps = validCompletions.map((comp: TaskCompletion) => {
              const { _id, __v, ...cleanCompletion } = comp as TaskCompletion & { _id?: unknown; __v?: unknown };
              return {
                updateOne: {
                  filter: { taskId: cleanCompletion.taskId, date: cleanCompletion.date, userId },
                  update: { $set: { ...cleanCompletion, userId } },
                  upsert: true,
                },
              };
            });
            await (TaskCompletionModel as any).bulkWrite(compOps);
          }
        }

        // Focus Sessions - Non-destructive upsert of incoming focus sessions
        if (hasFocus && focusSessions.length > 0) {
          const validSessions = focusSessions.filter((session: FocusSession) => !session.date || session.date <= todayIST);
          if (validSessions.length > 0) {
            const focusOps = validSessions.map((session: FocusSession) => {
              const { _id, __v, ...cleanSession } = session as FocusSession & { _id?: unknown; __v?: unknown };
              return {
                updateOne: {
                  filter: { id: cleanSession.id, userId },
                  update: { $set: { ...cleanSession, userId } },
                  upsert: true,
                },
              };
            });
            await (FocusSessionModel as any).bulkWrite(focusOps);
          }
        }

        if (hasCategories) {
          await UserCategoryModel.deleteMany({ userId });
          if (categories.length > 0) {
            await UserCategoryModel.insertMany(
              categories.map((category: CategoryItem) => ({
                id: category.id,
                userId,
                name: category.name,
                icon: category.icon || '🏷️',
                color: category.color || '#7c3aed',
                isDefault: Boolean(category.isDefault),
              }))
            );
          }
        }

      } catch (mongoErr: any) {
        console.warn('[Vercel Sync POST Warning] MongoDB sync:', mongoErr?.message);
      }
    }

    let dailyPrioritiesPersisted = false;
    if (hasPriorities) {
      // 1. Always persist to dbService first for guaranteed persistence
      dbService.syncUserDailyPriorities(userId, dailyPriorities);
      dailyPrioritiesPersisted = true;

      // 2. If MongoDB is connected, also mirror into UserModel
      if (isMongoConnected()) {
        try {
          const filter = mongoose.Types.ObjectId.isValid(userId)
            ? { _id: new mongoose.Types.ObjectId(userId) }
            : { id: userId };
          const updateFields: Record<string, any> = {};
          for (const [date, priorityIds] of Object.entries(dailyPriorities)) {
            if (Array.isArray(priorityIds)) {
              updateFields[`dailyPriorities.${date}`] = priorityIds;
            }
          }
          if (Object.keys(updateFields).length > 0) {
            await UserModel.updateOne(filter, { $set: updateFields });
          }
        } catch (priorityErr: any) {
          console.warn('[Vercel Sync API] Notice: Failed to mirror Today’s Top 3 to MongoDB:', priorityErr?.message);
        }
      }
    }

    const syncPayload: any = {};
    if (hasTasks) syncPayload.tasks = tasks;
    if (hasHabits) syncPayload.habits = habits;
    if (hasCompletions) syncPayload.habitCompletions = habitCompletions;
    if (hasTaskCompletions) syncPayload.taskCompletions = taskCompletions;
    if (hasFocus) syncPayload.focusSessions = focusSessions;
    let dailyNotesPersisted = false;
    if (hasNotes) {
      // 1. Always persist to dbService first for guaranteed persistence
      dbService.syncUserDailyNotes(userId, dailyNotes);
      dailyNotesPersisted = true;

      // 2. If MongoDB is connected, also mirror into UserModel
      if (isMongoConnected()) {
        try {
          const filter = mongoose.Types.ObjectId.isValid(userId)
            ? { _id: new mongoose.Types.ObjectId(userId) }
            : { id: userId };
          const updateFields: Record<string, string> = {};
          for (const [date, noteText] of Object.entries(dailyNotes)) {
            if (typeof noteText === 'string') {
              updateFields[`dailyNotes.${date}`] = noteText;
            }
          }
          if (Object.keys(updateFields).length > 0) {
            await UserModel.updateOne(filter, { $set: updateFields });
          }
        } catch (notesErr: any) {
          console.warn('[Vercel Sync API] Notice: Failed to mirror Quick Notes to MongoDB:', notesErr?.message);
        }
      }
    }

    if (hasPriorities && dailyPrioritiesPersisted) syncPayload.dailyPriorities = dailyPriorities;

    if (hasFocus) dbService.syncFocusSessions(focusSessions, userId);
    if (hasCategories) dbService.saveCategories(userId, categories);

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
        focusSessions: Array.isArray(focusSessions) ? focusSessions.length : 0,
        categories: hasCategories ? categories.length : undefined,
      },
      categories: dbService.getCategories(userId),
    });
  } catch (err: any) {
    console.error('[Vercel Sync API POST Error]', err);
    return res.status(500).json({ error: err?.message || 'Failed to sync data' });
  }
}
