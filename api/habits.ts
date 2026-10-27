import type { Request, Response } from 'express';
import { dbService } from '../server/services/dbService.ts';
import { connectToDatabase, isMongoConnected } from '../server/services/mongoService.ts';
import { HabitModel, HabitCompletionModel } from '../server/models/HabitData.ts';
import { verifyRequestAuth } from '../server/middleware/authMiddleware.ts';
import type { Habit, HabitCompletion } from '../src/types.ts';

async function parseRequestBody(req: any): Promise<any> {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body;
  }
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  if (Buffer.isBuffer(req.body)) {
    try {
      return JSON.parse(req.body.toString('utf8'));
    } catch {
      return {};
    }
  }
  return new Promise((resolve) => {
    let data = '';
    req.on?.('data', (chunk: any) => {
      data += chunk;
    });
    req.on?.('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        resolve({});
      }
    });
    req.on?.('error', () => resolve({}));
    if (!req.on) resolve({});
  });
}

export default async function handler(req: Request, res: Response) {
  await connectToDatabase();

  const user = verifyRequestAuth(req);
  if (!user) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Personal authentication required.',
    });
  }

  const userId = user.userId;

  const rawUrl = req.url || '';
  const urlPath = rawUrl.split('?')[0];
  const pathParts = urlPath.split('/').filter(Boolean);
  const lastPart = pathParts[pathParts.length - 1];
  const isToggleAction = urlPath.endsWith('/toggle') || req.query?.action === 'toggle';
  const isCompletions = urlPath.endsWith('/completions') || req.query?.action === 'completions';
  const urlId = (req.query?.id as string) || (lastPart && !['habits', 'toggle', 'completions'].includes(lastPart) ? lastPart : '');

  // 1. GET - Retrieve all habits or completions
  if (req.method === 'GET') {
    if (isCompletions) {
      try {
        let completions: HabitCompletion[] = [];
        if (isMongoConnected()) {
          try {
            const mongoCompletions = await HabitCompletionModel.find({ userId }).lean();
            completions = mongoCompletions as any[];
          } catch {
            completions = dbService.getHabitCompletions(userId);
          }
        } else {
          completions = dbService.getHabitCompletions(userId);
        }
        return res.status(200).json({ success: true, completions });
      } catch (err: any) {
        return res.status(500).json({ success: false, error: err?.message || 'Failed to retrieve habit completions' });
      }
    }

    try {
      let habits: Habit[] = [];
      if (isMongoConnected()) {
        try {
          const mongoHabits = await HabitModel.find({ userId }).sort({ createdAt: 1 }).lean();
          habits = mongoHabits as any[];
        } catch {
          habits = dbService.getHabits(userId);
        }
      } else {
        habits = dbService.getHabits(userId);
      }
      return res.status(200).json({ success: true, habits });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || 'Failed to retrieve habits' });
    }
  }

  // 2. POST - Create new habit or toggle completion
  if (req.method === 'POST') {
    const body = await parseRequestBody(req);

    if (isToggleAction || (urlId && body.date)) {
      const habitId = urlId || body.habitId;
      const { date, completed } = body;
      if (!habitId || !date) {
        return res.status(400).json({ success: false, error: 'Habit ID and date are required' });
      }

      const completionId = `hc_${habitId}_${date}`;
      const newStatus = completed !== undefined ? Boolean(completed) : true;

      if (isMongoConnected()) {
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
          console.warn('[Vercel Habit API] MongoDB toggle warning:', dbErr?.message);
        }
      }

      const comps = dbService.getHabitCompletions(userId).filter(
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
      dbService.syncHabitCompletions(comps, userId);

      return res.status(200).json({
        success: true,
        completed: newStatus,
        date,
        habitId,
      });
    }

    // Create new habit
    if (!body.name || !body.name.trim()) {
      return res.status(400).json({ success: false, error: 'Habit name is required' });
    }
    if (!body.category) {
      return res.status(400).json({ success: false, error: 'Habit category is required' });
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

    if (isMongoConnected()) {
      try {
        await HabitModel.findOneAndUpdate(
          { id: habitId, userId },
          { $set: newHabit },
          { upsert: true, new: true }
        );
      } catch (dbErr: any) {
        console.warn('[Vercel Habit API] MongoDB save warning:', dbErr?.message);
      }
    }

    const currentHabits = dbService.getHabits(userId).filter((h) => h.id !== habitId);
    currentHabits.push(newHabit);
    dbService.syncHabits(currentHabits, userId);

    return res.status(201).json({ success: true, habit: newHabit });
  }

  // 3. PUT - Update habit
  if (req.method === 'PUT' || req.method === 'PATCH') {
    const habitId = urlId;
    if (!habitId) {
      return res.status(400).json({ success: false, error: 'Habit ID is required' });
    }

    const body = await parseRequestBody(req);
    const updateData: Partial<Habit> = { ...body, id: habitId, userId };

    let updatedHabit: Habit | null = null;
    if (isMongoConnected()) {
      try {
        const doc = await HabitModel.findOneAndUpdate(
          { id: habitId, userId },
          { $set: updateData },
          { new: true }
        ).lean();
        if (doc) updatedHabit = doc as any;
      } catch (dbErr: any) {
        console.warn('[Vercel Habit API] MongoDB update warning:', dbErr?.message);
      }
    }

    const currentHabits = dbService.getHabits(userId);
    const idx = currentHabits.findIndex((h) => h.id === habitId);
    if (idx !== -1) {
      currentHabits[idx] = { ...currentHabits[idx], ...updateData, userId };
      updatedHabit = currentHabits[idx];
      dbService.syncHabits(currentHabits, userId);
    } else if (!updatedHabit) {
      return res.status(404).json({ success: false, error: 'Habit not found' });
    }

    return res.status(200).json({ success: true, habit: updatedHabit });
  }

  // 4. DELETE - Delete habit
  if (req.method === 'DELETE') {
    const habitId = urlId;
    if (!habitId) {
      return res.status(400).json({ success: false, error: 'Habit ID is required' });
    }

    let deleted = false;
    if (isMongoConnected()) {
      try {
        const result = await HabitModel.deleteOne({ id: habitId, userId });
        if (result.deletedCount && result.deletedCount > 0) {
          deleted = true;
          await HabitCompletionModel.deleteMany({ habitId, userId });
        }
      } catch (dbErr: any) {
        console.warn('[Vercel Habit API] MongoDB delete warning:', dbErr?.message);
      }
    }

    const currentHabits = dbService.getHabits(userId);
    if (currentHabits.some((h) => h.id === habitId)) {
      deleted = true;
    }
    const remainingHabits = currentHabits.filter((h) => h.id !== habitId);
    dbService.syncHabits(remainingHabits, userId);

    const remainingCompletions = dbService.getHabitCompletions(userId).filter((c) => c.habitId !== habitId);
    dbService.syncHabitCompletions(remainingCompletions, userId);

    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Habit not found' });
    }

    return res.status(200).json({ success: true, message: 'Habit and completions deleted successfully' });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
