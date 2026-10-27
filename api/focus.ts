import type { Request, Response } from 'express';
import { dbService } from '../server/services/dbService.ts';
import { connectToDatabase, isMongoConnected } from '../server/services/mongoService.ts';
import { FocusSessionModel } from '../server/models/HabitData.ts';
import { verifyRequestAuth } from '../server/middleware/authMiddleware.ts';
import type { FocusSession } from '../src/types.ts';

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

  // Extract ID if passed via query (/api/focus?id=...) or path
  const rawUrl = req.url || '';
  const urlPath = rawUrl.split('?')[0];
  const pathParts = urlPath.split('/').filter(Boolean);
  const lastPart = pathParts[pathParts.length - 1];
  const urlId = (req.query?.id as string) || (lastPart && lastPart !== 'focus' ? lastPart : '');

  // 1. GET - Retrieve focus sessions
  if (req.method === 'GET') {
    try {
      const date = (req.query?.date as string) || '';
      let focusSessions: FocusSession[] = [];

      if (isMongoConnected()) {
        try {
          const filter: any = { userId };
          if (date) {
            filter.date = date;
          }
          const docs = await FocusSessionModel.find(filter).sort({ startedAt: -1 }).lean();
          focusSessions = docs as any[];
        } catch (err: any) {
          console.warn('[Vercel Focus API] Mongo read fallback:', err?.message);
          focusSessions = dbService.getFocusSessions(userId);
          if (date) {
            focusSessions = focusSessions.filter((s) => s.date === date);
          }
        }
      } else {
        focusSessions = dbService.getFocusSessions(userId);
        if (date) {
          focusSessions = focusSessions.filter((s) => s.date === date);
        }
      }

      return res.status(200).json({
        success: true,
        focusSessions,
        source: isMongoConnected() ? 'mongodb' : 'local_fallback',
      });
    } catch (err: any) {
      console.error('[Vercel Focus GET Error]', err);
      return res.status(500).json({
        success: false,
        error: err?.message || 'Failed to fetch focus sessions',
      });
    }
  }

  // 2. POST - Save or update focus session
  if (req.method === 'POST') {
    try {
      const sessionData = await parseRequestBody(req);

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
          console.warn('[Vercel Focus API] Mongo save fallback:', err?.message);
          dbService.saveFocusSession(session, userId);
        }
      } else {
        dbService.saveFocusSession(session, userId);
      }

      return res.status(200).json({
        success: true,
        focusSession: session,
      });
    } catch (err: any) {
      console.error('[Vercel Focus POST Error]', err);
      return res.status(500).json({
        success: false,
        error: err?.message || 'Failed to save focus session',
      });
    }
  }

  // 3. DELETE - Delete focus session
  if (req.method === 'DELETE') {
    try {
      const sessionId = urlId || (req.query?.id as string);
      if (!sessionId) {
        return res.status(400).json({ success: false, error: 'Session ID required' });
      }

      if (isMongoConnected()) {
        try {
          await FocusSessionModel.deleteOne({ id: sessionId, userId });
        } catch (err: any) {
          console.warn('[Vercel Focus API] Mongo delete fallback:', err?.message);
          dbService.deleteFocusSession(sessionId, userId);
        }
      } else {
        dbService.deleteFocusSession(sessionId, userId);
      }

      return res.status(200).json({ success: true });
    } catch (err: any) {
      console.error('[Vercel Focus DELETE Error]', err);
      return res.status(500).json({
        success: false,
        error: err?.message || 'Failed to delete focus session',
      });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
