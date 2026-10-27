import type { Request, Response } from 'express';
import authHandler from '../auth.ts';

export default async function handler(req: Request, res: Response) {
  return authHandler(req, res);
}
