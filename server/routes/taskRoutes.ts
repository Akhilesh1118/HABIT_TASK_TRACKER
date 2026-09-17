import express, { type Request, type Response } from 'express';
import mongoose from 'mongoose';
import { requireAuth } from '../middleware/authMiddleware.ts';
import { TaskModel } from '../models/HabitData.ts';
import { dbService } from '../services/dbService.ts';
import type { Task } from '../../src/types.ts';

export const taskRouter = express.Router();

// GET /api/tasks - Retrieve all tasks for the authenticated user
taskRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    let tasks: Task[] = [];

    try {
      const mongoTasks = await TaskModel.find({ userId }).sort({ createdAt: -1 }).lean();
      tasks = (mongoTasks as any[]).map((t) => ({
        ...t,
        scheduledDate: t.scheduledDate || t.date || t.dueDate || (t.createdAt ? t.createdAt.split('T')[0] : ''),
        status: t.status || (t.completed ? 'completed' : 'pending'),
        completed: Boolean(t.completed || t.status === 'completed'),
        completedAt: t.completedAt || (t.completed ? t.updatedAt || t.createdAt : null),
      }));

      console.log('[BACKEND] GET /api/tasks:', {
        endpoint: 'GET /api/tasks',
        authenticatedUserId: userId,
        mongoDatabase: mongoose.connection?.name || 'unknown',
        mongoTasksReturned: tasks.length,
      });
    } catch {
      // Fallback to dbService
      tasks = dbService.getTasks().filter((t) => t.userId === userId).map((t) => ({
        ...t,
        scheduledDate: t.scheduledDate || t.date || t.dueDate || (t.createdAt ? t.createdAt.split('T')[0] : ''),
        status: t.status || (t.completed ? 'completed' : 'pending'),
        completed: Boolean(t.completed || t.status === 'completed'),
        completedAt: t.completedAt || (t.completed ? t.updatedAt || t.createdAt : null),
      }));
    }

    return res.json({
      success: true,
      tasks,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err?.message || 'Failed to retrieve tasks',
    });
  }
});

// POST /api/tasks - Create a new task
taskRouter.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const body = req.body || {};

    if (!body.title || !body.title.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Task title is required',
      });
    }

    if (!body.category) {
      return res.status(400).json({
        success: false,
        error: 'Task category is required',
      });
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

    try {
      await TaskModel.findOneAndUpdate(
        { id: taskId, userId },
        { $set: newTask },
        { upsert: true, new: true }
      );
    } catch (dbErr: any) {
      console.warn('[TaskRoutes] MongoDB save warning:', dbErr?.message);
    }

    // Keep dbService in sync
    const currentTasks = dbService.getTasks().filter((t) => t.id !== taskId);
    currentTasks.unshift(newTask);
    dbService.syncTasks(currentTasks);

    return res.status(201).json({
      success: true,
      task: newTask,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err?.message || 'Failed to create task',
    });
  }
});

// PUT /api/tasks/:id - Update an existing task
taskRouter.put('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const taskId = req.params.id;
    const body = req.body || {};

    if (!taskId) {
      return res.status(400).json({
        success: false,
        error: 'Task ID is required',
      });
    }

    const now = new Date().toISOString();
    const updateData: any = {
      ...body,
      id: taskId,
      userId,
      updatedAt: now,
    };

    if (body.scheduledDate) {
      updateData.scheduledDate = body.scheduledDate;
      updateData.date = body.scheduledDate;
    } else if (body.date && !updateData.scheduledDate) {
      updateData.scheduledDate = body.date;
    }

    if (body.completed !== undefined || body.status !== undefined) {
      const isCompleted = body.completed !== undefined ? Boolean(body.completed) : body.status === 'completed';
      updateData.completed = isCompleted;
      updateData.status = isCompleted ? 'completed' : 'pending';
      updateData.completedAt = isCompleted ? (body.completedAt || now) : null;
    }

    let updatedTask: Task | null = null;

    try {
      const doc = await TaskModel.findOneAndUpdate(
        { id: taskId, userId },
        { $set: updateData },
        { new: true }
      ).lean();

      if (doc) {
        updatedTask = doc as any;
      }
    } catch (dbErr: any) {
      console.warn('[TaskRoutes] MongoDB update warning:', dbErr?.message);
    }

    // Also update dbService
    const currentTasks = dbService.getTasks();
    const idx = currentTasks.findIndex((t) => t.id === taskId && t.userId === userId);
    if (idx !== -1) {
      currentTasks[idx] = { ...currentTasks[idx], ...updateData };
      updatedTask = currentTasks[idx];
      dbService.syncTasks(currentTasks);
    } else if (!updatedTask) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      });
    }

    return res.json({
      success: true,
      task: updatedTask,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err?.message || 'Failed to update task',
    });
  }
});

// PATCH /api/tasks/:id/complete - Mark task complete or uncomplete
taskRouter.patch('/:id/complete', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const taskId = req.params.id;
    const { completed, completedAt } = req.body;
    const now = new Date().toISOString();
    const isCompleted = completed !== undefined ? Boolean(completed) : true;

    const updateData: {
      completed: boolean;
      status: 'completed' | 'pending';
      completedAt: string | null;
      updatedAt: string;
    } = {
      completed: isCompleted,
      status: isCompleted ? 'completed' : 'pending',
      completedAt: isCompleted ? (completedAt || now) : null,
      updatedAt: now,
    };

    const doc = await TaskModel.findOneAndUpdate(
      { id: taskId, userId },
      { $set: updateData },
      { new: true }
    ).lean();

    // Also update dbService
    const currentTasks = dbService.getTasks();
    const idx = currentTasks.findIndex((t) => t.id === taskId && t.userId === userId);
    if (idx !== -1) {
      currentTasks[idx] = { ...currentTasks[idx], ...updateData };
      dbService.syncTasks(currentTasks);
    }

    if (!doc && idx === -1) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      });
    }

    return res.json({
      success: true,
      task: doc || currentTasks[idx],
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err?.message || 'Failed to complete task',
    });
  }
});

// DELETE /api/tasks/:id - Delete a task
taskRouter.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const taskId = req.params.id;

    if (!taskId) {
      return res.status(400).json({
        success: false,
        error: 'Task ID is required',
      });
    }

    let deleted = false;
    try {
      const result = await TaskModel.deleteOne({ id: taskId, userId });
      if (result.deletedCount && result.deletedCount > 0) {
        deleted = true;
      }
    } catch (dbErr: any) {
      console.warn('[TaskRoutes] MongoDB delete warning:', dbErr?.message);
    }

    // Delete from dbService
    const currentTasks = dbService.getTasks();
    const existsInDbService = currentTasks.some((t) => t.id === taskId && t.userId === userId);
    if (existsInDbService) {
      deleted = true;
    }
    const remainingTasks = currentTasks.filter((t) => !(t.id === taskId && t.userId === userId));
    dbService.syncTasks(remainingTasks);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      });
    }

    return res.json({
      success: true,
      message: 'Task deleted successfully',
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err?.message || 'Failed to delete task',
    });
  }
});
