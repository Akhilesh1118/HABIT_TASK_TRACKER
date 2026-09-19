import mongoose, { Schema, Document } from 'mongoose';
import type { Habit, HabitCompletion, TaskCompletion, Task, FocusSession } from '../../src/types.ts';

// 1. Habit Schema
export interface IHabitDocument extends Habit, Document {
  id: string;
}

const HabitSchema: Schema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    description: { type: String },
    category: { type: String, required: true },
    frequency: { type: String, enum: ['daily', 'weekly'], default: 'daily' },
    target: { type: String },
    dueTime: { type: String },
    startDate: { type: String, required: true },
    active: { type: Boolean, default: true },
    createdAt: { type: String, required: true },
  },
  { timestamps: true, strict: false }
);

export const HabitModel: mongoose.Model<IHabitDocument> =
  (mongoose.models.Habit as mongoose.Model<IHabitDocument>) || mongoose.model<IHabitDocument>('Habit', HabitSchema);

// 2. Task Schema
export interface ITaskDocument extends Task, Document {
  id: string;
}

const TaskSchema: Schema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    description: { type: String },
    category: { type: String, required: true },
    date: { type: String, required: true, index: true },
    scheduledDate: { type: String, index: true },
    status: { type: String, enum: ['pending', 'completed', 'in_progress'], default: 'pending', index: true },
    completed: { type: Boolean, default: false, index: true },
    completedAt: { type: String, default: null },
    dueDate: { type: String },
    duration: { type: String },
    dueTime: { type: String },
    recurringSchedule: { type: String },
    isTopPriority: { type: Boolean },
    priorityRank: { type: Number },
    isStudySession: { type: Boolean },
    studySubject: { type: String },
    studyTopic: { type: String },
    studyDurationMinutes: { type: Number },
    questionsAttempted: { type: Number },
    questionsCorrect: { type: Number },
    accuracy: { type: Number },
    isRevisionTask: { type: Boolean },
    revisionScheduleId: { type: String },
    revisionStepIndex: { type: Number },
    revisionDayOffset: { type: Number },
    revisionTopic: { type: String },
    revisionSubject: { type: String },
    enableSpacedRevision: { type: Boolean },
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
  },
  { timestamps: true, strict: false }
);

export const TaskModel: mongoose.Model<ITaskDocument> =
  (mongoose.models.Task as mongoose.Model<ITaskDocument>) || mongoose.model<ITaskDocument>('Task', TaskSchema);

// 3. Habit Completion Schema
export interface IHabitCompletionDocument extends HabitCompletion, Document {
  id: string;
}

const HabitCompletionSchema: Schema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    habitId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    date: { type: String, required: true, index: true },
    completed: { type: Boolean, default: true },
  },
  { timestamps: true, strict: false }
);

// Compound index for idempotency
HabitCompletionSchema.index({ habitId: 1, date: 1 }, { unique: true });

export const HabitCompletionModel: mongoose.Model<IHabitCompletionDocument> =
  (mongoose.models.HabitCompletion as mongoose.Model<IHabitCompletionDocument>) ||
  mongoose.model<IHabitCompletionDocument>('HabitCompletion', HabitCompletionSchema);

// 4. Focus Session Schema
export interface IFocusSessionDocument extends FocusSession, Document {
  id: string;
  userId: string;
}

const FocusSessionSchema: Schema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    taskId: { type: String, index: true },
    taskTitle: { type: String, required: true },
    taskCategory: { type: String },
    isHabit: { type: Boolean, default: false },
    mode: { type: String, default: '50/10' },
    targetFocusMinutes: { type: Number, default: 25 },
    actualSecondsSpent: { type: Number, required: true },
    date: { type: String, required: true, index: true }, // YYYY-MM-DD in IST
    startedAt: { type: String, required: true },
    completedAt: { type: String, required: true },
    wasCompletedNaturally: { type: Boolean, default: false },
    notes: { type: String },
  },
  { timestamps: true, strict: false }
);

export const FocusSessionModel: mongoose.Model<IFocusSessionDocument> =
  (mongoose.models.FocusSession as mongoose.Model<IFocusSessionDocument>) ||
  mongoose.model<IFocusSessionDocument>('FocusSession', FocusSessionSchema);

// 5. Task Completion Schema (Decoupled Date-Specific Occurrences)
export interface ITaskCompletionDocument extends TaskCompletion, Document {
  id: string;
}

const TaskCompletionSchema: Schema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    taskId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    date: { type: String, required: true, index: true },
    completed: { type: Boolean, default: true },
    completedAt: { type: String, default: null },
  },
  { timestamps: true, strict: false }
);

// Compound index for idempotency per task per date per user
TaskCompletionSchema.index({ taskId: 1, date: 1, userId: 1 }, { unique: true });

export const TaskCompletionModel: mongoose.Model<ITaskCompletionDocument> =
  (mongoose.models.TaskCompletion as mongoose.Model<ITaskCompletionDocument>) ||
  mongoose.model<ITaskCompletionDocument>('TaskCompletion', TaskCompletionSchema);



