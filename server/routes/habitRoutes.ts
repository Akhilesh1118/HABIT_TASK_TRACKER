import express, { type Request, type Response } from 'express';
import { requireAuth } from '../middleware/authMiddleware.ts';
import { HabitModel, HabitCompletionModel } from '../models/HabitData.ts';
import { dbService } from '../services/dbService.ts';
import type { Habit, HabitCompletion } from '../../src/types.ts';

export const habitRouter = express.Router();

// GET /api/habits - Retrieve all habits for the authenticated user
habitRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    let habits: Habit[] = [];

    try {
      const mongoHabits = await HabitModel.find({ userId }).sort({ createdAt: 1 }).lean();
      habits = mongoHabits as any[];
    } catch {
      habits = dbService.getHabits().filter((h) => h.userId === userId);
    }

    return res.json({
      success: true,
      habits,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err?.message || 'Failed to retrieve habits',
    });
  }
});

// POST /api/habits - Create a new habit
habitRouter.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const body = req.body || {};

    if (!body.name || !body.name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Habit name is required',
      });
    }

    if (!body.category) {
      return res.status(400).json({
        success: false,
        error: 'Habit category is required',
      });
    }

    const now = new Date().toISOString();
    const habitId = body.id || `habit_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

    const newHabit: Habit = {
      id: habitId,
      userId,
      name: body.name.trim(),
      description: body.description || '',
      category: body.category,
      frequency: body.frequency || 'daily',
      target: body.target,
      dueTime: body.dueTime,
      startDate: body.startDate || now.split('T')[0],
      active: body.active !== undefined ? Boolean(body.active) : true,
      createdAt: body.createdAt || now,
    };

    try {
      await HabitModel.findOneAndUpdate(
        { id: habitId },
        { $set: newHabit },
        { upsert: true, new: true }
      );
    } catch (dbErr: any) {
      console.warn('[HabitRoutes] MongoDB save warning:', dbErr?.message);
    }

    const currentHabits = dbService.getHabits().filter((h) => h.id !== habitId);
    currentHabits.push(newHabit);
    dbService.syncHabits(currentHabits);

    return res.status(201).json({
      success: true,
      habit: newHabit,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err?.message || 'Failed to create habit',
    });
  }
});

// PUT /api/habits/:id - Update an existing habit
habitRouter.put('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const habitId = req.params.id;
    const body = req.body || {};

    if (!habitId) {
      return res.status(400).json({
        success: false,
        error: 'Habit ID is required',
      });
    }

    const updateData: Partial<Habit> = {
      ...body,
      id: habitId,
      userId,
    };

    let updatedHabit: Habit | null = null;

    try {
      const doc = await HabitModel.findOneAndUpdate(
        { id: habitId, userId },
        { $set: updateData },
        { new: true }
      ).lean();

      if (doc) {
        updatedHabit = doc as any;
      }
    } catch (dbErr: any) {
      console.warn('[HabitRoutes] MongoDB update warning:', dbErr?.message);
    }

    const currentHabits = dbService.getHabits();
    const idx = currentHabits.findIndex((h) => h.id === habitId);
    if (idx !== -1) {
      currentHabits[idx] = { ...currentHabits[idx], ...updateData };
      updatedHabit = currentHabits[idx];
      dbService.syncHabits(currentHabits);
    } else if (!updatedHabit) {
      return res.status(404).json({
        success: false,
        error: 'Habit not found',
      });
    }

    return res.json({
      success: true,
      habit: updatedHabit,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err?.message || 'Failed to update habit',
    });
  }
});

// DELETE /api/habits/:id - Delete a habit and its completions
habitRouter.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const habitId = req.params.id;

    if (!habitId) {
      return res.status(400).json({
        success: false,
        error: 'Habit ID is required',
      });
    }

    let deleted = false;
    try {
      const result = await HabitModel.deleteOne({ id: habitId, userId });
      if (result.deletedCount && result.deletedCount > 0) {
        deleted = true;
        await HabitCompletionModel.deleteMany({ habitId, userId });
      }
    } catch (dbErr: any) {
      console.warn('[HabitRoutes] MongoDB delete warning:', dbErr?.message);
    }

    const currentHabits = dbService.getHabits();
    const existsInDb = currentHabits.some((h) => h.id === habitId && h.userId === userId);
    if (existsInDb) {
      deleted = true;
    }
    const remainingHabits = currentHabits.filter((h) => !(h.id === habitId && h.userId === userId));
    dbService.syncHabits(remainingHabits);

    const remainingCompletions = dbService.getHabitCompletions().filter(
      (c) => !(c.habitId === habitId && c.userId === userId)
    );
    dbService.syncHabitCompletions(remainingCompletions);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Habit not found',
      });
    }

    return res.json({
      success: true,
      message: 'Habit and completions deleted successfully',
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err?.message || 'Failed to delete habit',
    });
  }
});

// GET /api/habits/completions - Retrieve habit completions
habitRouter.get('/completions', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    let completions: HabitCompletion[] = [];

    try {
      const mongoCompletions = await HabitCompletionModel.find({ userId }).lean();
      completions = mongoCompletions as any[];
    } catch {
      completions = dbService.getHabitCompletions().filter((c) => c.userId === userId);
    }

    return res.json({
      success: true,
      completions,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err?.message || 'Failed to retrieve habit completions',
    });
  }
});

// POST /api/habits/:id/toggle - Toggle habit completion for a given date
habitRouter.post('/:id/toggle', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const habitId = req.params.id;
    const { date, completed } = req.body || {};

    if (!habitId || !date) {
      return res.status(400).json({
        success: false,
        error: 'Habit ID and date are required',
      });
    }

    const completionId = `hc_${habitId}_${date}`;
    const newStatus = completed !== undefined ? Boolean(completed) : true;

    try {
      if (newStatus) {
        await HabitCompletionModel.findOneAndUpdate(
          { habitId, date, userId },
          { $set: { id: completionId, habitId, userId, date, completed: true } },
          { upsert: true, new: true }
        );
      } else {
        await HabitCompletionModel.deleteOne({ habitId, date, userId });
      }
    } catch (dbErr: any) {
      console.warn('[HabitRoutes] MongoDB toggle completion warning:', dbErr?.message);
    }

    // Update dbService
    const comps = dbService.getHabitCompletions().filter(
      (c) => !(c.habitId === habitId && c.date === date)
    );
    if (newStatus) {
      comps.push({
        id: completionId,
        habitId,
        userId,
        date,
        completed: true,
      });
    }
    dbService.syncHabitCompletions(comps);

    return res.json({
      success: true,
      completed: newStatus,
      date,
      habitId,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err?.message || 'Failed to toggle habit completion',
    });
  }
});
