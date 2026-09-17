import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { connectToDatabase, isMongoConnected } from '../../server/services/mongoService.ts';

export default async function handler(req: Request, res: Response) {
  const isVercel = Boolean(process.env.VERCEL);
  const mongodbConfigured = Boolean(process.env.MONGODB_URI && process.env.MONGODB_URI.trim().length > 0);

  if (!mongodbConfigured) {
    return res.status(200).json({
      status: 'error',
      isVercel,
      mongodbConfigured: false,
      mongodbConnected: false,
      error: 'MONGODB_URI environment variable is not configured',
    });
  }

  try {
    const conn = await connectToDatabase();
    const connected = isMongoConnected() && Boolean(conn);

    if (connected && mongoose.connection.db) {
      const databaseName = mongoose.connection.db.databaseName || mongoose.connection.name || 'unknown';
      return res.status(200).json({
        status: 'ok',
        isVercel,
        mongodbConfigured: true,
        mongodbConnected: true,
        databaseName,
      });
    } else {
      return res.status(200).json({
        status: 'error',
        isVercel,
        mongodbConfigured: true,
        mongodbConnected: false,
        error: 'Failed to establish connection to MongoDB Atlas',
      });
    }
  } catch (err: any) {
    // Sanitize any error message so MONGODB_URI or credentials are never exposed
    const safeMsg = (err?.message || 'Connection error')
      .replace(/mongodb(?:\+srv)?:\/\/[^\s]+/gi, '[REDACTED_URI]')
      .replace(/:[^:@]+@/g, ':[REDACTED_PASSWORD]@');

    return res.status(200).json({
      status: 'error',
      isVercel,
      mongodbConfigured: true,
      mongodbConnected: false,
      error: safeMsg,
    });
  }
}
