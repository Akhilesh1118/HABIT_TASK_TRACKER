import type { Request, Response } from 'express';
import { dbService } from '../server/services/dbService.ts';
import { connectToDatabase, isMongoConnected } from '../server/services/mongoService.ts';
import { TaskModel } from '../server/models/HabitData.ts';
import { verifyRequestAuth } from '../server/middleware/authMiddleware.ts';
import type { Task } from '../src/types.ts';

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
  const isCompleteAction = urlPath.endsWith('/complete') || req.query?.action === 'complete';
  const urlId = (req.query?.id as string) || (lastPart && lastPart !== 'tasks' && lastPart !== 'complete' ? lastPart : '');

  // 1. GET - Retrieve all tasks for the user
  if (req.method === 'GET') {
    try {
      let tasks: Task[] = [];
      if (isMongoConnected()) {
        try {
          const mongoTasks = await TaskModel.find({ userId }).sort({ createdAt: -1 }).lean();
          tasks = (mongoTasks as any[]).map((t) => ({
            ...t,
            scheduledDate: t.scheduledDate || t.date || t.dueDate || (t.createdAt ? t.createdAt.split('T')[0] : ''),
            status: t.status || (t.completed ? 'completed' : 'pending'),
            completed: Boolean(t.completed || t.status === 'completed'),
            completedAt: t.completedAt || (t.completed ? t.updatedAt || t.createdAt : null),
          }));
        } catch {
          tasks = dbService.getTasks(userId).map((t) => ({
            ...t,
            scheduledDate: t.scheduledDate || t.date || t.dueDate || (t.createdAt ? t.createdAt.split('T')[0] : ''),
            status: t.status || (t.completed ? 'completed' : 'pending'),
            completed: Boolean(t.completed || t.status === 'completed'),
            completedAt: t.completedAt || (t.completed ? t.updatedAt || t.createdAt : null),
          }));
        }
      } else {
        tasks = dbService.getTasks(userId);
      }

      return res.status(200).json({
        success: true,
        tasks,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err?.message || 'Failed to retrieve tasks',
      });
    }
  }

  // 2. POST - Create a new task
  if (req.method === 'POST') {
    try {
      const body = await parseRequestBody(req);

      if (!body.title || !body.title.trim()) {
        return res.status(400).json({ success: false, error: 'Task title is required' });
      }
      if (!body.category) {
        return res.status(400).json({ success: false, error: 'Task category is required' });
      }

      const now = new Date().toISOString();
      const taskId = body.id || `task_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      const scheduledDate = body.scheduledDate || body.date || body.dueDate || now.split('T')[0];
      const isCompleted = Boolean(body.completed || body.status === 'completed');
      const status = body.status || (isCompleted ? 'completed' : 'pending');
      const completedAt = isCompleted ? (body.completedAt || now) : null;

      const newTask: Task = {
        id: taskId,
        userId,
        title: body.title.trim(),
        category: body.category,
        date: scheduledDate,
        scheduledDate,
        dueDate: body.dueDate || scheduledDate,
        dueTime: body.dueTime,
        duration: body.duration,
        description: body.description || '',
        completed: isCompleted,
        status,
        completedAt,
        recurringSchedule: body.recurringSchedule || 'none',
        isTopPriority: Boolean(body.isTopPriority),
        priorityRank: body.priorityRank,
        isStudySession: Boolean(body.isStudySession),
        studySubject: body.studySubject,
        studyTopic: body.studyTopic,
        studyDurationMinutes: body.studyDurationMinutes,
        questionsAttempted: body.questionsAttempted,
        questionsCorrect: body.questionsCorrect,
        accuracy: body.accuracy,
        enableSpacedRevision: Boolean(body.enableSpacedRevision),
        createdAt: body.createdAt || now,
        updatedAt: now,
      };

      if (isMongoConnected()) {
        try {
          await TaskModel.findOneAndUpdate(
            { id: taskId, userId },
            { $set: newTask },
            { upsert: true, new: true }
          );
        } catch (dbErr: any) {
          console.warn('[Vercel Task API] MongoDB save warning:', dbErr?.message);
        }
      }

      const currentTasks = dbService.getTasks(userId).filter((t) => t.id !== taskId);
      currentTasks.unshift(newTask);
      dbService.syncTasks(currentTasks, userId);

      return res.status(201).json({
        success: true,
        task: newTask,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || 'Failed to create task' });
    }
  }

  // 3. PATCH / PUT - Update task or complete task
  if (req.method === 'PATCH' || req.method === 'PUT') {
    try {
      const taskId = urlId;
      if (!taskId) {
        return res.status(400).json({ success: false, error: 'Task ID is required' });
      }

      const body = await parseRequestBody(req);
      const now = new Date().toISOString();

      if (isCompleteAction || body.completed !== undefined) {
        const isCompleted = body.completed !== undefined ? Boolean(body.completed) : true;
        const updateData = {
          completed: isCompleted,
          status: (isCompleted ? 'completed' : 'pending') as 'completed' | 'pending',
          completedAt: isCompleted ? (body.completedAt || now) : null,
          updatedAt: now,
          userId,
        };

        let doc: any = null;
        if (isMongoConnected()) {
          try {
            doc = await TaskModel.findOneAndUpdate(
              { id: taskId, userId },
              { $set: updateData },
              { new: true }
            ).lean();
          } catch (dbErr: any) {
            console.warn('[Vercel Task API] MongoDB update warning:', dbErr?.message);
          }
        }

        const currentTasks = dbService.getTasks(userId);
        const idx = currentTasks.findIndex((t) => t.id === taskId);
        if (idx !== -1) {
          currentTasks[idx] = { ...currentTasks[idx], ...updateData };
          dbService.syncTasks(currentTasks, userId);
        }

        if (!doc && idx === -1) {
          return res.status(404).json({ success: false, error: 'Task not found' });
        }

        return res.status(200).json({ success: true, task: doc || currentTasks[idx] });
      }

      // General update
      const updateData: any = {
        ...body,
        id: taskId,
        userId,
        updatedAt: now,
      };

      if (body.scheduledDate) {
        updateData.scheduledDate = body.scheduledDate;
        updateData.date = body.scheduledDate;
      }

      let updatedTask: Task | null = null;
      if (isMongoConnected()) {
        try {
          const doc = await TaskModel.findOneAndUpdate(
            { id: taskId, userId },
            { $set: updateData },
            { new: true }
          ).lean();
          if (doc) updatedTask = doc as any;
        } catch (dbErr: any) {
          console.warn('[Vercel Task API] MongoDB update warning:', dbErr?.message);
        }
      }

      const currentTasks = dbService.getTasks(userId);
      const idx = currentTasks.findIndex((t) => t.id === taskId);
      if (idx !== -1) {
        currentTasks[idx] = { ...currentTasks[idx], ...updateData };
        updatedTask = currentTasks[idx];
        dbService.syncTasks(currentTasks, userId);
      } else if (!updatedTask) {
        return res.status(404).json({ success: false, error: 'Task not found' });
      }

      return res.status(200).json({ success: true, task: updatedTask });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || 'Failed to update task' });
    }
  }

  // 4. DELETE - Delete task
  if (req.method === 'DELETE') {
    try {
      const taskId = urlId;
      if (!taskId) {
        return res.status(400).json({ success: false, error: 'Task ID is required' });
      }

      let deleted = false;
      if (isMongoConnected()) {
        try {
          const result = await TaskModel.deleteOne({ id: taskId, userId });
          if (result.deletedCount && result.deletedCount > 0) {
            deleted = true;
          }
        } catch (dbErr: any) {
          console.warn('[Vercel Task API] MongoDB delete warning:', dbErr?.message);
        }
      }

      const currentTasks = dbService.getTasks(userId);
      if (currentTasks.some((t) => t.id === taskId)) {
        deleted = true;
      }
      const remainingTasks = currentTasks.filter((t) => t.id !== taskId);
      dbService.syncTasks(remainingTasks, userId);

      if (!deleted) {
        return res.status(404).json({ success: false, error: 'Task not found' });
      }

      return res.status(200).json({ success: true, message: 'Task deleted successfully' });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || 'Failed to delete task' });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
