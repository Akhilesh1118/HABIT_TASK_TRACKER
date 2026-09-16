import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectToDatabase, isMongoConnected } from '../server/services/mongoService';
import { UserModel } from '../server/models/User';
import { TaskModel, HabitModel, HabitCompletionModel } from '../server/models/HabitData';
import { dbService } from '../server/services/dbService';

const TODAY_DATE = '2026-09-16';

async function main() {
  console.log('=== FULL DATABASE RESET & DATA CONSISTENCY SCRIPT ===');
  console.log(`Connecting to MongoDB...`);
  await connectToDatabase();

  const mongoActive = isMongoConnected();
  console.log(`MongoDB connected: ${mongoActive}`);

  // 1. Completely clear MongoDB collections
  if (mongoActive) {
    console.log('Clearing MongoDB collections: users, tasks, habits, habitcompletions...');
    await UserModel.deleteMany({});
    await TaskModel.deleteMany({});
    await HabitModel.deleteMany({});
    await HabitCompletionModel.deleteMany({});
    console.log('MongoDB collections cleared successfully.');
  }

  // 2. Clear local storage file .data/database.json
  const dataDir = process.env.NODE_ENV === 'production' && !fs.existsSync(path.join(process.cwd(), '.data'))
    ? path.join('/tmp', '.data')
    : path.join(process.cwd(), '.data');
  const dbFile = path.join(dataDir, 'database.json');

  console.log(`Resetting local cache at: ${dbFile}`);
  if (fs.existsSync(dbFile)) {
    try {
      fs.unlinkSync(dbFile);
      console.log('Deleted existing database.json');
    } catch (e) {
      console.warn('Could not unlink database.json:', e);
    }
  }

  // 3. Admin user creation
  const adminEmail = (process.env.INITIAL_ADMIN_EMAIL || 'admin@example.com').toLowerCase().trim();
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || 'PersonalPassword2026!';
  console.log(`Creating initial admin user: ${adminEmail}`);

  const passwordHash = await bcrypt.hash(adminPassword, 12);
  let adminUserId = 'usr_admin_1';

  if (mongoActive) {
    const userDoc = await UserModel.create({
      email: adminEmail,
      passwordHash,
      createdAt: new Date(),
    });
    adminUserId = userDoc._id.toString();
    console.log(`Admin user created in MongoDB with ID: ${adminUserId}`);
  }

  dbService.setSingleUserAuth({
    id: adminUserId,
    email: adminEmail,
    passwordHash,
    createdAt: new Date().toISOString(),
  });

  // 4. Controlled ONE DAY dataset
  console.log(`Seeding controlled ONE-DAY dataset for date: ${TODAY_DATE}...`);

  const initialHabits = [
    {
      id: 'h_deep_work',
      userId: adminUserId,
      name: '📚 Deep Study & Core Concepts',
      description: 'Focused academic and technical study session',
      category: 'Technical',
      frequency: 'daily' as const,
      target: '2 hours',
      dueTime: '18:00',
      startDate: TODAY_DATE,
      active: true,
      createdAt: `${TODAY_DATE}T08:00:00.000Z`,
    },
    {
      id: 'h_dsa_practice',
      userId: adminUserId,
      name: '💻 DSA & Algorithm Practice',
      description: 'Solve 2 algorithmic problems with clean time complexity',
      category: 'Technical',
      frequency: 'daily' as const,
      target: '1 hour',
      dueTime: '20:00',
      startDate: TODAY_DATE,
      active: true,
      createdAt: `${TODAY_DATE}T08:30:00.000Z`,
    },
    {
      id: 'h_health_exercise',
      userId: adminUserId,
      name: '🏃 Physical Exercise & Wellness',
      description: 'Evening brisk walk, mobility drills, and stretching',
      category: 'Personal',
      frequency: 'daily' as const,
      target: '30 mins',
      dueTime: '19:00',
      startDate: TODAY_DATE,
      active: true,
      createdAt: `${TODAY_DATE}T09:00:00.000Z`,
    },
  ];

  const initialTasks = [
    {
      id: 'task_core_revision',
      userId: adminUserId,
      title: 'Review System Design & Concurrency Notes',
      description: 'Chapter 4 recap and architecture diagram review',
      date: TODAY_DATE,
      completed: true,
      completedAt: `${TODAY_DATE}T11:30:00.000Z`,
      category: 'Technical' as const,
      priority: 'high' as const,
      isTopPriority: true,
      order: 0,
      createdAt: `${TODAY_DATE}T08:00:00.000Z`,
      updatedAt: `${TODAY_DATE}T11:30:00.000Z`,
    },
    {
      id: 'task_leetcode_problems',
      userId: adminUserId,
      title: 'Solve 2 Graph Traversal Problems',
      description: 'Implement BFS/DFS solutions with cycle detection',
      date: TODAY_DATE,
      completed: false,
      category: 'Technical' as const,
      priority: 'high' as const,
      isTopPriority: true,
      order: 1,
      createdAt: `${TODAY_DATE}T08:15:00.000Z`,
      updatedAt: `${TODAY_DATE}T08:15:00.000Z`,
    },
    {
      id: 'task_daily_reflection',
      userId: adminUserId,
      title: 'Daily Progress Log & Planning',
      description: 'Review productivity metrics and finalize tomorrow plan',
      date: TODAY_DATE,
      completed: false,
      category: 'Personal' as const,
      priority: 'medium' as const,
      isTopPriority: true,
      order: 2,
      createdAt: `${TODAY_DATE}T08:30:00.000Z`,
      updatedAt: `${TODAY_DATE}T08:30:00.000Z`,
    },
  ];

  const initialCompletions = [
    {
      id: `hc_${initialHabits[0].id}_${TODAY_DATE}`,
      habitId: initialHabits[0].id,
      userId: adminUserId,
      date: TODAY_DATE,
      completed: true,
    },
  ];

  const initialPriorities: Record<string, string[]> = {
    [TODAY_DATE]: [initialTasks[0].id, initialTasks[1].id, initialTasks[2].id],
  };

  // Seed MongoDB
  if (mongoActive) {
    console.log('Inserting seed records into MongoDB...');
    await HabitModel.insertMany(initialHabits);
    await TaskModel.insertMany(initialTasks);
    await HabitCompletionModel.insertMany(initialCompletions);
    console.log('MongoDB seed completed.');
  }

  // Seed DbService
  dbService.syncHabits(initialHabits as any);
  dbService.syncTasks(initialTasks as any);
  dbService.syncHabitCompletions(initialCompletions as any);
  dbService.syncDailyPriorities(initialPriorities);

  // 5. Authoritative verification
  console.log('\n--- VERIFYING SEED COUNTS ---');
  if (mongoActive) {
    const uCount = await UserModel.countDocuments();
    const hCount = await HabitModel.countDocuments();
    const tCount = await TaskModel.countDocuments();
    const cCount = await HabitCompletionModel.countDocuments();
    console.log(`MongoDB counts: Users: ${uCount}, Habits: ${hCount}, Tasks: ${tCount}, Completions: ${cCount}`);
    if (uCount !== 1 || hCount !== 3 || tCount !== 3 || cCount !== 1) {
      throw new Error(`Seed count mismatch in MongoDB!`);
    }
  }

  // 6. Verification of CRUD in MongoDB
  console.log('\n--- RUNNING CRUD INTEGRITY TESTS ON MONGODB ---');
  if (mongoActive) {
    // Task CRUD
    const testTaskId = 'test_crud_task_' + Date.now();
    console.log('1. Creating test task in MongoDB...');
    await TaskModel.create({
      id: testTaskId,
      userId: adminUserId,
      title: 'CRUD Verification Task',
      date: TODAY_DATE,
      completed: false,
      category: 'Other',
      isTopPriority: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    let fetched = await TaskModel.findOne({ id: testTaskId }).lean();
    if (!fetched || fetched.title !== 'CRUD Verification Task') throw new Error('Task create failed');
    console.log('   ✓ Task created and verified in MongoDB');

    console.log('2. Updating test task in MongoDB...');
    await TaskModel.updateOne({ id: testTaskId }, { $set: { completed: true, title: 'Updated CRUD Task' } });
    fetched = await TaskModel.findOne({ id: testTaskId }).lean();
    if (!fetched || !fetched.completed || fetched.title !== 'Updated CRUD Task') throw new Error('Task update failed');
    console.log('   ✓ Task updated and completion verified in MongoDB');

    console.log('3. Deleting test task from MongoDB...');
    await TaskModel.deleteOne({ id: testTaskId });
    fetched = await TaskModel.findOne({ id: testTaskId }).lean();
    if (fetched) throw new Error('Task delete failed in MongoDB');
    console.log('   ✓ Task deleted and verified in MongoDB');

    // Habit CRUD
    const testHabitId = 'test_crud_habit_' + Date.now();
    console.log('4. Creating test habit in MongoDB...');
    await HabitModel.create({
      id: testHabitId,
      userId: adminUserId,
      name: 'CRUD Verification Habit',
      category: 'Other',
      frequency: 'daily',
      target: '15 mins',
      active: true,
      startDate: TODAY_DATE,
      createdAt: new Date().toISOString(),
    });
    let fetchedHabit = await HabitModel.findOne({ id: testHabitId }).lean();
    if (!fetchedHabit || fetchedHabit.name !== 'CRUD Verification Habit') throw new Error('Habit create failed');
    console.log('   ✓ Habit created and verified in MongoDB');

    console.log('5. Toggling habit completion in MongoDB...');
    await HabitCompletionModel.create({
      id: `hc_${testHabitId}_${TODAY_DATE}`,
      habitId: testHabitId,
      userId: adminUserId,
      date: TODAY_DATE,
      completed: true,
    });
    let fetchedComp = await HabitCompletionModel.findOne({ habitId: testHabitId, date: TODAY_DATE }).lean();
    if (!fetchedComp || !fetchedComp.completed) throw new Error('Habit completion failed');
    console.log('   ✓ Habit completion verified in MongoDB');

    console.log('6. Deleting test habit and completions from MongoDB...');
    await HabitModel.deleteOne({ id: testHabitId });
    await HabitCompletionModel.deleteMany({ habitId: testHabitId });
    fetchedHabit = await HabitModel.findOne({ id: testHabitId }).lean();
    fetchedComp = await HabitCompletionModel.findOne({ habitId: testHabitId }).lean();
    if (fetchedHabit || fetchedComp) throw new Error('Habit delete failed');
    console.log('   ✓ Habit and completions deleted and verified in MongoDB');
  }

  console.log('\n=== ALL DATABASE RESET & CRUD VERIFICATIONS COMPLETED SUCCESSFULLY ===');
  process.exit(0);
}

main().catch((err) => {
  console.error('Reset failed:', err);
  process.exit(1);
});
