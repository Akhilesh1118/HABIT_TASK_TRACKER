import express, { type Request, type Response } from 'express';
import { requireAuth } from '../middleware/authMiddleware.ts';
import { FocusSessionModel } from '../models/HabitData.ts';
import { dbService } from '../services/dbService.ts';
import { isMongoConnected } from '../services/mongoService.ts';
import type { FocusSession } from '../../src/types.ts';

export const focusRouter = express.Router();

// GET /api/focus - Retrieve focus sessions for authenticated user
focusRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { date } = req.query;

    let focusSessions: FocusSession[] = [];

    if (isMongoConnected()) {
      try {
        const filter: any = { userId };
        if (date && typeof date === 'string') {
          filter.date = date;
        }
        const docs = await FocusSessionModel.find(filter).sort({ startedAt: -1 }).lean();
        focusSessions = docs as any[];
      } catch (err: any) {
        console.warn('[FocusRoutes] Mongo read fallback:', err?.message);
        focusSessions = dbService.getFocusSessions(userId);
        if (date && typeof date === 'string') {
          focusSessions = focusSessions.filter((s) => s.date === date);
        }
      }
    } else {
      focusSessions = dbService.getFocusSessions(userId);
      if (date && typeof date === 'string') {
        focusSessions = focusSessions.filter((s) => s.date === date);
      }
    }

    return res.json({
      success: true,
      focusSessions,
      source: isMongoConnected() ? 'mongodb' : 'local_fallback',
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err?.message || 'Failed to fetch focus sessions',
    });
  }
});

// POST /api/focus - Save or update a focus session
focusRouter.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const sessionData = req.body;

    if (!sessionData || !sessionData.id || !sessionData.date || typeof sessionData.actualSecondsSpent !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'Invalid focus session payload. Required: id, date, actualSecondsSpent',
      });
    }

    const session: FocusSession = {
      id: sessionData.id,
      userId,
      taskId: sessionData.taskId,
      taskTitle: sessionData.taskTitle || 'Focus Session',
      taskCategory: sessionData.taskCategory,
      isHabit: Boolean(sessionData.isHabit),
      mode: sessionData.mode || '50/10',
      targetFocusMinutes: sessionData.targetFocusMinutes || 25,
      actualSecondsSpent: sessionData.actualSecondsSpent,
      date: sessionData.date,
      startedAt: sessionData.startedAt || new Date().toISOString(),
      completedAt: sessionData.completedAt || new Date().toISOString(),
      wasCompletedNaturally: Boolean(sessionData.wasCompletedNaturally),
      notes: sessionData.notes,
    };

    if (isMongoConnected()) {
      try {
        await FocusSessionModel.findOneAndUpdate(
          { id: session.id, userId },
          { $set: { ...session, userId } },
          { upsert: true, new: true }
        );
      } catch (err: any) {
        console.warn('[FocusRoutes] Mongo save fallback:', err?.message);
        dbService.saveFocusSession(session, userId);
      }
    } else {
      dbService.saveFocusSession(session, userId);
    }

    return res.json({
      success: true,
      focusSession: session,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err?.message || 'Failed to save focus session',
    });
  }
});

// DELETE /api/focus/:id - Delete a focus session
focusRouter.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ success: false, error: 'Session ID required' });
    }

    if (isMongoConnected()) {
      try {
        await FocusSessionModel.deleteOne({ id, userId });
      } catch (err: any) {
        console.warn('[FocusRoutes] Mongo delete fallback:', err?.message);
        dbService.deleteFocusSession(id, userId);
      }
    } else {
      dbService.deleteFocusSession(id, userId);
    }

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err?.message || 'Failed to delete focus session',
    });
  }
});
