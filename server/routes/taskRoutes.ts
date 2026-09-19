import express, { type Request, type Response } from 'express';
import mongoose from 'mongoose';
import { requireAuth } from '../middleware/authMiddleware.ts';
import { TaskModel, TaskCompletionModel } from '../models/HabitData.ts';
import { dbService, getTodayISTStr } from '../services/dbService.ts';
import type { Task, TaskCompletion } from '../../src/types.ts';

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
      tasks = dbService.getTasks(userId).map((t) => ({
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
    const currentTasks = dbService.getTasks(userId).filter((t) => t.id !== taskId);
    currentTasks.unshift(newTask);
    dbService.syncTasks(currentTasks, userId);

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
    const currentTasks = dbService.getTasks(userId);
    const idx = currentTasks.findIndex((t) => t.id === taskId);
    if (idx !== -1) {
      currentTasks[idx] = { ...currentTasks[idx], ...updateData, userId };
      updatedTask = currentTasks[idx];
      dbService.syncTasks(currentTasks, userId);
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

// PATCH /api/tasks/:id/complete - Mark task complete or uncomplete for a specific date occurrence
taskRouter.patch('/:id/complete', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const taskId = req.params.id;
    const { completed, date, completedAt } = req.body || {};
    const now = new Date().toISOString();
    const todayIST = getTodayISTStr();
    const targetDate = date || todayIST;
    const isCompleted = completed !== undefined ? Boolean(completed) : true;

    if (isCompleted && targetDate > todayIST) {
      return res.status(400).json({
        success: false,
        error: 'A future task cannot be completed before its scheduled date.',
      });
    }

    // Find the task definition
    let task = await TaskModel.findOne({ id: taskId, userId }).lean() as any;
    if (!task) {
      const currentTasks = dbService.getTasks(userId);
      task = currentTasks.find((t) => t.id === taskId);
    }

    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      });
    }

    const isRecurring = Boolean(task.recurringSchedule && task.recurringSchedule !== 'none');

    // 1. Manage date-specific TaskCompletion record
    const compRecord: TaskCompletion = {
      id: `tc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      taskId,
      userId,
      date: targetDate,
      completed: isCompleted,
      completedAt: isCompleted ? (completedAt || now) : null,
    };

    if (isCompleted) {
      await TaskCompletionModel.findOneAndUpdate(
        { taskId, date: targetDate, userId },
        { $set: compRecord },
        { upsert: true, new: true }
      ).catch(() => {});
    } else {
      await TaskCompletionModel.deleteOne({ taskId, date: targetDate, userId }).catch(() => {});
    }

    // Sync task completions in dbService
    const currentComps = dbService.getTaskCompletions(userId);
    const filteredComps = currentComps.filter((c) => !(c.taskId === taskId && c.date === targetDate));
    if (isCompleted) {
      filteredComps.push(compRecord);
    }
    dbService.syncTaskCompletions(filteredComps, userId);

    // 2. For non-recurring tasks, also update the main task document for backward compatibility
    let updatedTaskDoc = task;
    if (!isRecurring) {
      const updateData: {
        completed: boolean;
        status: 'pending' | 'completed' | 'in_progress';
        completedAt: string | null;
        updatedAt: string;
        userId: string;
      } = {
        completed: isCompleted,
        status: isCompleted ? 'completed' : 'pending',
        completedAt: isCompleted ? (completedAt || now) : null,
        updatedAt: now,
        userId,
      };

      updatedTaskDoc = await TaskModel.findOneAndUpdate(
        { id: taskId, userId },
        { $set: updateData },
        { new: true }
      ).lean();

      const currentTasks = dbService.getTasks(userId);
      const idx = currentTasks.findIndex((t) => t.id === taskId);
      if (idx !== -1) {
        currentTasks[idx] = { ...currentTasks[idx], ...updateData, userId };
        dbService.syncTasks(currentTasks, userId);
      }
    }

    return res.json({
      success: true,
      task: updatedTaskDoc || task,
      completion: {
        taskId,
        date: targetDate,
        completed: isCompleted,
      },
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err?.message || 'Failed to complete task',
    });
  }
});

// DELETE /api/tasks/:id - Delete a task and its completion records
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
      const result = await TaskModel.deleteOne({
        id: taskId,
        userId,
      });
      if (result.deletedCount && result.deletedCount > 0) {
        deleted = true;
      }
      // Also delete any task completions
      await TaskCompletionModel.deleteMany({ taskId, userId }).catch(() => {});
    } catch (dbErr: any) {
      console.warn('[TaskRoutes] MongoDB delete warning:', dbErr?.message);
    }

    // Delete from dbService
    const currentTasks = dbService.getTasks(userId);
    const existsInDbService = currentTasks.some((t) => t.id === taskId);
    if (existsInDbService) {
      deleted = true;
    }
    const remainingTasks = currentTasks.filter((t) => t.id !== taskId);
    dbService.syncTasks(remainingTasks, userId);

    const currentComps = dbService.getTaskCompletions(userId);
    const remainingComps = currentComps.filter((c) => c.taskId !== taskId);
    dbService.syncTaskCompletions(remainingComps, userId);

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
