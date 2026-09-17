import type { Request, Response } from 'express';
import { dbService } from '../../server/services/dbService.ts';
import { TaskModel, HabitModel, HabitCompletionModel } from '../../server/models/HabitData.ts';
import { verifyRequestAuth } from '../../server/middleware/authMiddleware.ts';

export default async function handler(req: Request, res: Response) {
  const isVercel = Boolean(process.env.VERCEL);
  const dbServiceLoaded = Boolean(dbService && typeof dbService.getTasks === 'function');
  const habitDataModelLoaded = Boolean(
    TaskModel && typeof TaskModel.find === 'function' &&
    HabitModel && typeof HabitModel.find === 'function' &&
    HabitCompletionModel && typeof HabitCompletionModel.find === 'function'
  );
  const authMiddlewareLoaded = Boolean(typeof verifyRequestAuth === 'function');

  return res.status(200).json({
    status: 'ok',
    isVercel,
    syncRouteLoaded: true,
    dbServiceLoaded,
    habitDataModelLoaded,
    authMiddlewareLoaded,
    supportedSyncMethods: ['GET /api/sync', 'POST /api/sync'],
  });
}
