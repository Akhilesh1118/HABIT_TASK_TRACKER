import fs from 'fs';
import path from 'path';
import { Habit, HabitCompletion, Task } from '../../src/types';
import { isMongoConnected } from './mongoService';
import {
  HabitModel,
  TaskModel,
  HabitCompletionModel,
} from '../models/HabitData';

export interface DbUserAuth {
  id: string;
  email: string;
  name?: string;
  passwordHash: string;
  role: 'user' | 'admin';
  createdAt: string;
}

interface DatabaseSchema {
  tasks: Task[];
  habits: Habit[];
  habitCompletions: HabitCompletion[];
  dailyPriorities?: Record<string, string[]>;
  users?: DbUserAuth[];
  userAuth?: {
    id: string;
    email: string;
    passwordHash: string;
    role?: 'user' | 'admin';
    createdAt: string;
  };
}

// In Vercel serverless functions, process.cwd() is read-only (/var/task).
// Only /tmp is writable across all serverless lambda runtimes.
const DATA_DIR = process.env.VERCEL
  ? path.join('/tmp', '.data')
  : path.join(process.cwd(), '.data');

const DB_FILE = path.join(DATA_DIR, 'database.json');
const LOCK_FILE = path.join(DATA_DIR, 'cron_execution.lock');

// Default initial state
function getDefaultData(): DatabaseSchema {
  return {
    habits: [],
    tasks: [],
    habitCompletions: [],
    dailyPriorities: {},
  };
}

export class DbService {
  private data: DatabaseSchema;
  private inMemoryLock: boolean = false;
  private lastDiskMtimeMs: number = 0;

  constructor() {
    this.cleanupOrphanedTmpFiles();
    this.data = this.loadData();
    if (!fs.existsSync(DB_FILE)) {
      this.persistData();
    }
  }

  /**
   * Cleans up orphaned temporary files left by abruptly terminated worker instances
   */
  private cleanupOrphanedTmpFiles(): void {
    try {
      if (fs.existsSync(DATA_DIR)) {
        const files = fs.readdirSync(DATA_DIR);
        for (const file of files) {
          if (file.startsWith('database.tmp.') || file.endsWith('.tmp')) {
            try {
              fs.unlinkSync(path.join(DATA_DIR, file));
            } catch {
              // ignore
            }
          }
        }
      }
    } catch {
      // ignore
    }
  }

  /**
   * Loads current data with fresh read from disk to synchronize state across lambda/process invocations
   */
  private loadData(): DatabaseSchema {
    try {
      if (fs.existsSync(DB_FILE)) {
        const stat = fs.statSync(DB_FILE);
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        this.lastDiskMtimeMs = stat.mtimeMs;
        return {
          ...getDefaultData(),
          ...parsed,
        };
      }
    } catch (e) {
      console.warn('[DbService] Initializing default data store in:', DATA_DIR);
    }
    return getDefaultData();
  }

  /**
   * Refreshes data from disk before critical operations using mtime cache to eliminate redundant disk I/O
   */
  private reloadIfDiskExists(): void {
    try {
      if (fs.existsSync(DB_FILE)) {
        const stat = fs.statSync(DB_FILE);
        if (stat.mtimeMs <= this.lastDiskMtimeMs && this.lastDiskMtimeMs > 0) {
          return; // Cache is up to date, skip disk read and JSON parse
        }
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        this.data = {
          ...getDefaultData(),
          ...parsed,
        };
        this.lastDiskMtimeMs = stat.mtimeMs;
      }
    } catch (e) {
      // Keep existing memory copy
    }
  }

  private lastPersistedDataHash = '';

  /**
   * Writes data atomically using a process-scoped temp file + rename to prevent race condition corruption.
   * Includes content-hash dirty checking to completely eliminate redundant disk writes and Vite reload loops.
   */
  private persistData(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const serialized = JSON.stringify(this.data, null, 2);
      if (this.lastPersistedDataHash && this.lastPersistedDataHash === serialized) {
        return; // Content is identical, skip disk write completely
      }
      const tmpFile = path.join(DATA_DIR, `database.tmp.${process.pid}.${Date.now()}`);
      fs.writeFileSync(tmpFile, serialized, 'utf-8');
      fs.renameSync(tmpFile, DB_FILE);
      this.lastDiskMtimeMs = Date.now();
      this.lastPersistedDataHash = serialized;
    } catch (e: any) {
      console.warn('[DbService] Notice: File persistence fallback active:', e?.message);
    }
  }

  // --- ATOMIC DISTRIBUTED / IN-PROCESS EXECUTION LOCK ---
  public acquireLock(maxAgeSeconds = 60): boolean {
    if (this.inMemoryLock) {
      return false;
    }

    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      // Check if existing lock file exists and handle expiration
      if (fs.existsSync(LOCK_FILE)) {
        try {
          const lockStat = fs.statSync(LOCK_FILE);
          const ageInSeconds = (Date.now() - lockStat.mtimeMs) / 1000;
          if (ageInSeconds < maxAgeSeconds) {
            // Lock is actively held by another running worker
            return false;
          }
          // Lock expired / orphaned from crashed worker, reclaim
          fs.unlinkSync(LOCK_FILE);
        } catch {
          // If unlinked concurrently, proceed
        }
      }

      // Atomic lock creation: 'wx' flag fails atomically with EEXIST if another worker created it
      try {
        const fd = fs.openSync(LOCK_FILE, 'wx');
        const lockPayload = JSON.stringify({ pid: process.pid, lockedAt: new Date().toISOString() });
        fs.writeFileSync(fd, lockPayload, 'utf-8');
        fs.closeSync(fd);
        this.inMemoryLock = true;
        return true;
      } catch (err: any) {
        if (err.code === 'EEXIST') {
          return false;
        }
        throw err;
      }
    } catch {
      // Fallback in environments without filesystem access
      this.inMemoryLock = true;
      return true;
    }
  }

  public releaseLock(): void {
    this.inMemoryLock = false;
    try {
      if (fs.existsSync(LOCK_FILE)) {
        fs.unlinkSync(LOCK_FILE);
      }
    } catch {
      // Ignore
    }
  }

  // --- UNIFIED BATCH SYNC WITH DIRTY CHECKING ---
  /**
   * Synchronizes tasks, habits, completions, and priorities in a single atomic batch.
   * Performs rigorous dirty checks: if nothing changed, no disk writes or MongoDB bulkWrites occur.
   */
  public syncData(payload: {
    tasks?: Task[];
    habits?: Habit[];
    habitCompletions?: HabitCompletion[];
    dailyPriorities?: Record<string, string[]>;
  }): { tasksCount: number; habitsCount: number; completionsCount: number; changed: boolean } {
    this.reloadIfDiskExists();
    let isDirty = false;

    // 1. Sync tasks
    if (Array.isArray(payload.tasks)) {
      const taskMap = new Map<string, Task>();
      for (const t of payload.tasks) {
        if (!t || !t.id) continue;
        const existing = taskMap.get(t.id);
        if (!existing || (t.updatedAt && t.updatedAt >= (existing.updatedAt || ''))) {
          taskMap.set(t.id, t);
        }
      }
      const newTasks = Array.from(taskMap.values());
      if (JSON.stringify(newTasks) !== JSON.stringify(this.data.tasks)) {
        this.data.tasks = newTasks;
        isDirty = true;
      }
    }

    // 2. Sync habits
    if (Array.isArray(payload.habits)) {
      const habitMap = new Map<string, Habit>();
      for (const h of payload.habits) {
        if (!h || !h.id) continue;
        habitMap.set(h.id, h);
      }
      const newHabits = Array.from(habitMap.values());
      if (JSON.stringify(newHabits) !== JSON.stringify(this.data.habits)) {
        this.data.habits = newHabits;
        isDirty = true;
      }
    }

    // 3. Sync habit completions
    if (Array.isArray(payload.habitCompletions)) {
      const compMap = new Map<string, HabitCompletion>();
      for (const c of payload.habitCompletions) {
        if (!c || !c.habitId || !c.date) continue;
        const key = `${c.habitId}_${c.date}`;
        compMap.set(key, c);
      }
      const newComps = Array.from(compMap.values());
      if (JSON.stringify(newComps) !== JSON.stringify(this.data.habitCompletions)) {
        this.data.habitCompletions = newComps;
        isDirty = true;
      }
    }

    // 4. Sync daily priorities
    if (payload.dailyPriorities && typeof payload.dailyPriorities === 'object') {
      if (JSON.stringify(payload.dailyPriorities) !== JSON.stringify(this.data.dailyPriorities)) {
        this.data.dailyPriorities = payload.dailyPriorities;
        isDirty = true;
      }
    }

    // If changes occurred, persist once atomically
    if (isDirty) {
      this.persistData();

      // Mirror to MongoDB Atlas asynchronously if connected
      if (isMongoConnected()) {
        try {
          if (this.data.tasks.length > 0) {
            const taskOps = this.data.tasks.map((task) => ({
              updateOne: {
                filter: { id: task.id },
                update: { $set: task },
                upsert: true,
              },
            }));
            (TaskModel as any).bulkWrite(taskOps).catch(() => {});
          }
          if (this.data.habits.length > 0) {
            const habitOps = this.data.habits.map((habit) => ({
              updateOne: {
                filter: { id: habit.id },
                update: { $set: habit },
                upsert: true,
              },
            }));
            (HabitModel as any).bulkWrite(habitOps).catch(() => {});
          }
          if (this.data.habitCompletions.length > 0) {
            const compOps = this.data.habitCompletions.map((comp) => ({
              updateOne: {
                filter: { habitId: comp.habitId, date: comp.date },
                update: { $set: comp },
                upsert: true,
              },
            }));
            (HabitCompletionModel as any).bulkWrite(compOps).catch(() => {});
          }
        } catch {
          // Non-blocking
        }
      }
    }

    return {
      tasksCount: this.data.tasks.length,
      habitsCount: this.data.habits.length,
      completionsCount: this.data.habitCompletions.length,
      changed: isDirty,
    };
  }

  // --- TASKS ---
  public getTasks(): Task[] {
    this.reloadIfDiskExists();
    return this.data.tasks;
  }

  public syncTasks(clientTasks: Task[]): void {
    if (!Array.isArray(clientTasks)) return;
    this.reloadIfDiskExists();
    // Deduplicate by task ID, preserving latest updatedAt
    const taskMap = new Map<string, Task>();
    for (const t of clientTasks) {
      if (!t || !t.id) continue;
      const existing = taskMap.get(t.id);
      if (!existing || (t.updatedAt && t.updatedAt >= (existing.updatedAt || ''))) {
        taskMap.set(t.id, t);
      }
    }
    const newTasks = Array.from(taskMap.values());
    if (JSON.stringify(newTasks) === JSON.stringify(this.data.tasks)) {
      return; // No changes, skip disk write completely
    }
    this.data.tasks = newTasks;
    this.persistData();

    if (isMongoConnected()) {
      const taskIds = this.data.tasks.map((t) => t.id);
      TaskModel.deleteMany({ id: { $nin: taskIds } }).catch((err: any) =>
        console.warn('[DbService] MongoDB task delete notice:', err?.message)
      );

      if (this.data.tasks.length > 0) {
        const ops = this.data.tasks.map((task) => ({
          updateOne: {
            filter: { id: task.id },
            update: { $set: task },
            upsert: true,
          },
        }));
        (TaskModel as any).bulkWrite(ops).catch((err: any) =>
          console.warn('[DbService] MongoDB tasks sync notice:', err?.message)
        );
      }
    }
  }

  // --- HABITS ---
  public getHabits(): Habit[] {
    this.reloadIfDiskExists();
    return this.data.habits;
  }

  public syncHabits(clientHabits: Habit[]): void {
    if (!Array.isArray(clientHabits)) return;
    this.reloadIfDiskExists();
    // Deduplicate by habit ID
    const habitMap = new Map<string, Habit>();
    for (const h of clientHabits) {
      if (!h || !h.id) continue;
      habitMap.set(h.id, h);
    }
    const newHabits = Array.from(habitMap.values());
    if (JSON.stringify(newHabits) === JSON.stringify(this.data.habits)) {
      return; // No changes, skip disk write completely
    }
    this.data.habits = newHabits;
    this.persistData();

    if (isMongoConnected()) {
      const habitIds = this.data.habits.map((h) => h.id);
      HabitModel.deleteMany({ id: { $nin: habitIds } }).catch(() => {});
      HabitCompletionModel.deleteMany({ habitId: { $nin: habitIds } }).catch(() => {});

      if (this.data.habits.length > 0) {
        const ops = this.data.habits.map((habit) => ({
          updateOne: {
            filter: { id: habit.id },
            update: { $set: habit },
            upsert: true,
          },
        }));
        (HabitModel as any).bulkWrite(ops).catch((err: any) =>
          console.warn('[DbService] MongoDB habits sync notice:', err?.message)
        );
      }
    }
  }

  // --- HABIT COMPLETIONS ---
  public getHabitCompletions(): HabitCompletion[] {
    this.reloadIfDiskExists();
    return this.data.habitCompletions;
  }

  public syncHabitCompletions(clientCompletions: HabitCompletion[]): void {
    if (!Array.isArray(clientCompletions)) return;
    this.reloadIfDiskExists();
    // Deduplicate by habitId + date: guarantee exactly 1 completion record per habit per day
    const compMap = new Map<string, HabitCompletion>();
    for (const c of clientCompletions) {
      if (!c || !c.habitId || !c.date) continue;
      const key = `${c.habitId}_${c.date}`;
      compMap.set(key, c);
    }
    const newComps = Array.from(compMap.values());
    if (JSON.stringify(newComps) === JSON.stringify(this.data.habitCompletions)) {
      return; // No changes, skip disk write completely
    }
    this.data.habitCompletions = newComps;
    this.persistData();

    if (isMongoConnected()) {
      const compKeys = this.data.habitCompletions.map((c) => `${c.habitId}_${c.date}`);
      HabitCompletionModel.find().lean().then((existing: any[]) => {
        const toDelete = existing
          .filter((c) => !compKeys.includes(`${c.habitId}_${c.date}`))
          .map((c) => c._id);
        if (toDelete.length > 0) {
          HabitCompletionModel.deleteMany({ _id: { $in: toDelete } }).catch(() => {});
        }
      }).catch(() => {});

      if (this.data.habitCompletions.length > 0) {
        const ops = this.data.habitCompletions.map((comp) => ({
          updateOne: {
            filter: { habitId: comp.habitId, date: comp.date },
            update: { $set: comp },
            upsert: true,
          },
        }));
        (HabitCompletionModel as any).bulkWrite(ops).catch((err: any) =>
          console.warn('[DbService] MongoDB completions sync notice:', err?.message)
        );
      }
    }
  }

  // --- DAILY PRIORITIES ---
  public getDailyPriorities(): Record<string, string[]> {
    this.reloadIfDiskExists();
    return this.data.dailyPriorities || {};
  }

  public syncDailyPriorities(priorities: Record<string, string[]>): void {
    this.reloadIfDiskExists();
    if (JSON.stringify(priorities) === JSON.stringify(this.data.dailyPriorities)) {
      return; // No changes, skip disk write completely
    }
    this.data.dailyPriorities = priorities;
    this.persistData();
  }

  /**
   * Preserves and synchronizes existing MongoDB data with the local engine.
   * Treats MongoDB as authoritative source of truth.
   */
  public async syncWithMongoDB(): Promise<void> {
    if (!isMongoConnected()) return;

    try {
      const habitsCount = await HabitModel.countDocuments();
      const tasksCount = await TaskModel.countDocuments();

      if (habitsCount > 0 || tasksCount > 0) {
        console.log(
          `[DbService] Authoritative MongoDB data found: ${habitsCount} habits, ${tasksCount} tasks.`
        );

        const mongoHabits = await HabitModel.find().lean();
        const mongoTasks = await TaskModel.find().lean();
        const mongoCompletions = await HabitCompletionModel.find().lean();

        this.data.habits = mongoHabits as any[];
        this.data.tasks = mongoTasks as any[];
        this.data.habitCompletions = mongoCompletions as any[];
        this.persistData();
      }
    } catch (err: any) {
      console.warn('[DbService] MongoDB sync warning (non-fatal):', err?.message || err);
    }
  }

  /**
   * Get single user auth record for local/offline fallback
   */
  public getSingleUserAuth(): { id: string; email: string; passwordHash: string; role?: 'user' | 'admin'; createdAt: string } | undefined {
    this.reloadIfDiskExists();
    return this.data.userAuth;
  }

  /**
   * Store single user auth record for local/offline fallback
   */
  public setSingleUserAuth(auth: { id: string; email: string; passwordHash: string; role?: 'user' | 'admin'; createdAt: string }): void {
    this.reloadIfDiskExists();
    this.data.userAuth = auth;
    this.saveUserAuth({
      id: auth.id,
      email: auth.email,
      name: 'Admin',
      passwordHash: auth.passwordHash,
      role: auth.role || 'admin',
      createdAt: auth.createdAt,
    });
    this.persistData();
  }

  /**
   * Multi-user: get all local users
   */
  public getAllUsers(): DbUserAuth[] {
    this.reloadIfDiskExists();
    const users = this.data.users || [];
    if (this.data.userAuth && !users.some((u) => u.email === this.data.userAuth?.email)) {
      users.push({
        id: this.data.userAuth.id,
        email: this.data.userAuth.email,
        name: 'Admin',
        passwordHash: this.data.userAuth.passwordHash,
        role: this.data.userAuth.role || 'admin',
        createdAt: this.data.userAuth.createdAt,
      });
    }
    return users;
  }

  /**
   * Multi-user: find local user by email
   */
  public findUserByEmail(email: string): DbUserAuth | undefined {
    const normalized = email.toLowerCase().trim();
    const users = this.getAllUsers();
    return users.find((u) => u.email.toLowerCase().trim() === normalized);
  }

  /**
   * Multi-user: find local user by ID
   */
  public findUserById(id: string): DbUserAuth | undefined {
    const users = this.getAllUsers();
    return users.find((u) => u.id === id);
  }

  /**
   * Multi-user: save or update local user
   */
  public saveUserAuth(user: DbUserAuth): void {
    this.reloadIfDiskExists();
    if (!this.data.users) {
      this.data.users = [];
    }
    const idx = this.data.users.findIndex(
      (u) => u.id === user.id || u.email.toLowerCase().trim() === user.email.toLowerCase().trim()
    );
    if (idx >= 0) {
      this.data.users[idx] = { ...this.data.users[idx], ...user };
    } else {
      this.data.users.push(user);
    }
    this.persistData();
  }
}

export const dbService = new DbService();
