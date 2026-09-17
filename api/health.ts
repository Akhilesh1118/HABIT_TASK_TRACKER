import type { Request, Response } from 'express';
import { getCurrentIST } from '../src/utils/timeUtils.ts';

export default function handler(req: Request, res: Response) {
  const ist = getCurrentIST();
  return res.status(200).json({
    status: 'ok',
    service: 'Habit & Task Tracker API (Vercel Serverless)',
    ist,
    timestamp: new Date().toISOString(),
  });
}
