import fs from 'fs';
import path from 'path';
import type { Habit, HabitCompletion, Task, FocusSession } from '../../src/types.ts';
import { isMongoConnected } from './mongoService.ts';
import {
  HabitModel,
  TaskModel,
  HabitCompletionModel,
  FocusSessionModel,
} from '../models/HabitData.ts';

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
  focusSessions?: (FocusSession & { userId?: string })[];
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
    focusSessions: [],
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
   * Performs rigorous user-isolation and dirty checks: if nothing changed, no disk writes or MongoDB bulkWrites occur.
   */
  public syncData(
    payload: {
      tasks?: Task[];
      habits?: Habit[];
      habitCompletions?: HabitCompletion[];
      dailyPriorities?: Record<string, string[]>;
    },
    userId?: string
  ): { tasksCount: number; habitsCount: number; completionsCount: number; changed: boolean } {
    this.reloadIfDiskExists();
    let isDirty = false;

    // 1. Sync tasks (non-destructive merge)
    if (Array.isArray(payload.tasks)) {
      const scopedIncoming = userId
        ? payload.tasks.map((t) => ({ ...t, userId: t.userId || userId }))
        : payload.tasks;
      const otherUserTasks = userId ? this.data.tasks.filter((t) => t.userId && t.userId !== userId) : [];
      const existingUserTasks = userId ? this.data.tasks.filter((t) => t.userId === userId) : this.data.tasks;

      const taskMap = new Map<string, Task>();
      for (const t of existingUserTasks) {
        if (t && t.id) taskMap.set(t.id, t);
      }
      for (const t of scopedIncoming) {
        if (!t || !t.id) continue;
        const existing = taskMap.get(t.id);
        if (!existing || (t.updatedAt && t.updatedAt >= (existing.updatedAt || ''))) {
          taskMap.set(t.id, t);
        }
      }
      const newTasks = [...otherUserTasks, ...Array.from(taskMap.values())];
      if (JSON.stringify(newTasks) !== JSON.stringify(this.data.tasks)) {
        this.data.tasks = newTasks;
        isDirty = true;
      }
    }

    // 2. Sync habits (non-destructive merge)
    if (Array.isArray(payload.habits)) {
      const scopedIncoming = userId
        ? payload.habits.map((h) => ({ ...h, userId: h.userId || userId }))
        : payload.habits;
      const otherUserHabits = userId ? this.data.habits.filter((h) => h.userId && h.userId !== userId) : [];
      const existingUserHabits = userId ? this.data.habits.filter((h) => h.userId === userId) : this.data.habits;

      const habitMap = new Map<string, Habit>();
      for (const h of existingUserHabits) {
        if (h && h.id) habitMap.set(h.id, h);
      }
      for (const h of scopedIncoming) {
        if (!h || !h.id) continue;
        habitMap.set(h.id, h);
      }
      const newHabits = [...otherUserHabits, ...Array.from(habitMap.values())];
      if (JSON.stringify(newHabits) !== JSON.stringify(this.data.habits)) {
        this.data.habits = newHabits;
        isDirty = true;
      }
    }

    // 3. Sync habit completions (non-destructive merge)
    if (Array.isArray(payload.habitCompletions)) {
      const scopedIncoming = userId
        ? payload.habitCompletions.map((c) => ({ ...c, userId: c.userId || userId }))
        : payload.habitCompletions;
      const otherUserComps = userId ? this.data.habitCompletions.filter((c) => c.userId && c.userId !== userId) : [];
      const existingUserComps = userId ? this.data.habitCompletions.filter((c) => c.userId === userId) : this.data.habitCompletions;

      const compMap = new Map<string, HabitCompletion>();
      for (const c of existingUserComps) {
        if (c && c.habitId && c.date) compMap.set(`${c.habitId}_${c.date}`, c);
      }
      for (const c of scopedIncoming) {
        if (!c || !c.habitId || !c.date) continue;
        const key = `${c.habitId}_${c.date}`;
        compMap.set(key, c);
      }
      const newComps = [...otherUserComps, ...Array.from(compMap.values())];
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

      // Mirror to MongoDB Atlas asynchronously if connected with strict user scoping
      if (isMongoConnected() && userId) {
        try {
          const userTasks = this.data.tasks.filter((t) => t.userId === userId);
          if (userTasks.length > 0) {
            const taskOps = userTasks.map((task) => ({
              updateOne: {
                filter: { id: task.id, userId },
                update: { $set: task },
                upsert: true,
              },
            }));
            (TaskModel as any).bulkWrite(taskOps).catch(() => {});
          }
          const userHabits = this.data.habits.filter((h) => h.userId === userId);
          if (userHabits.length > 0) {
            const habitOps = userHabits.map((habit) => ({
              updateOne: {
                filter: { id: habit.id, userId },
                update: { $set: habit },
                upsert: true,
              },
            }));
            (HabitModel as any).bulkWrite(habitOps).catch(() => {});
          }
          const userComps = this.data.habitCompletions.filter((c) => c.userId === userId);
          if (userComps.length > 0) {
            const compOps = userComps.map((comp) => ({
              updateOne: {
                filter: { habitId: comp.habitId, date: comp.date, userId },
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
      tasksCount: this.data.tasks.filter((t) => !userId || t.userId === userId).length,
      habitsCount: this.data.habits.filter((h) => !userId || h.userId === userId).length,
      completionsCount: this.data.habitCompletions.filter((c) => !userId || c.userId === userId).length,
      changed: isDirty,
    };
  }

  // --- TASKS ---
  public getTasks(userId?: string): Task[] {
    this.reloadIfDiskExists();
    if (userId) {
      return this.data.tasks.filter((t) => t.userId === userId);
    }
    return this.data.tasks;
  }

  public syncTasks(clientTasks: Task[], userId?: string): void {
    if (!Array.isArray(clientTasks)) return;
    this.reloadIfDiskExists();
    const scopedIncoming = userId
      ? clientTasks.map((t) => ({ ...t, userId: t.userId || userId }))
      : clientTasks;
    const otherUserTasks = userId ? this.data.tasks.filter((t) => t.userId && t.userId !== userId) : [];

    // Deduplicate by task ID, preserving latest updatedAt
    const taskMap = new Map<string, Task>();
    for (const t of scopedIncoming) {
      if (!t || !t.id) continue;
      const existing = taskMap.get(t.id);
      if (!existing || (t.updatedAt && t.updatedAt >= (existing.updatedAt || ''))) {
        taskMap.set(t.id, t);
      }
    }
    const newTasks = [...otherUserTasks, ...Array.from(taskMap.values())];
    if (JSON.stringify(newTasks) === JSON.stringify(this.data.tasks)) {
      return; // No changes, skip disk write completely
    }
    this.data.tasks = newTasks;
    this.persistData();

    if (isMongoConnected() && userId) {
      const taskIds = scopedIncoming.map((t) => t.id);
      TaskModel.deleteMany({ userId, id: { $nin: taskIds } }).catch((err: any) =>
        console.warn('[DbService] MongoDB task delete notice:', err?.message)
      );

      if (scopedIncoming.length > 0) {
        const ops = scopedIncoming.map((task) => ({
          updateOne: {
            filter: { id: task.id, userId },
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
  public getHabits(userId?: string): Habit[] {
    this.reloadIfDiskExists();
    if (userId) {
      return this.data.habits.filter((h) => h.userId === userId);
    }
    return this.data.habits;
  }

  public syncHabits(clientHabits: Habit[], userId?: string): void {
    if (!Array.isArray(clientHabits)) return;
    this.reloadIfDiskExists();
    const scopedIncoming = userId
      ? clientHabits.map((h) => ({ ...h, userId: h.userId || userId }))
      : clientHabits;
    const otherUserHabits = userId ? this.data.habits.filter((h) => h.userId && h.userId !== userId) : [];

    // Deduplicate by habit ID
    const habitMap = new Map<string, Habit>();
    for (const h of scopedIncoming) {
      if (!h || !h.id) continue;
      habitMap.set(h.id, h);
    }
    const newHabits = [...otherUserHabits, ...Array.from(habitMap.values())];
    if (JSON.stringify(newHabits) === JSON.stringify(this.data.habits)) {
      return; // No changes, skip disk write completely
    }
    this.data.habits = newHabits;
    this.persistData();

    if (isMongoConnected() && userId) {
      const habitIds = scopedIncoming.map((h) => h.id);
      HabitModel.deleteMany({ userId, id: { $nin: habitIds } }).catch(() => {});
      HabitCompletionModel.deleteMany({ userId, habitId: { $nin: habitIds } }).catch(() => {});

      if (scopedIncoming.length > 0) {
        const ops = scopedIncoming.map((habit) => ({
          updateOne: {
            filter: { id: habit.id, userId },
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
  public getHabitCompletions(userId?: string): HabitCompletion[] {
    this.reloadIfDiskExists();
    if (userId) {
      return this.data.habitCompletions.filter((c) => c.userId === userId);
    }
    return this.data.habitCompletions;
  }

  public syncHabitCompletions(clientCompletions: HabitCompletion[], userId?: string): void {
    if (!Array.isArray(clientCompletions)) return;
    this.reloadIfDiskExists();
    const scopedIncoming = userId
      ? clientCompletions.map((c) => ({ ...c, userId: c.userId || userId }))
      : clientCompletions;
    const otherUserComps = userId ? this.data.habitCompletions.filter((c) => c.userId && c.userId !== userId) : [];

    // Deduplicate by habitId + date: guarantee exactly 1 completion record per habit per day
    const compMap = new Map<string, HabitCompletion>();
    for (const c of scopedIncoming) {
      if (!c || !c.habitId || !c.date) continue;
      const key = `${c.habitId}_${c.date}`;
      compMap.set(key, c);
    }
    const newComps = [...otherUserComps, ...Array.from(compMap.values())];
    if (JSON.stringify(newComps) === JSON.stringify(this.data.habitCompletions)) {
      return; // No changes, skip disk write completely
    }
    this.data.habitCompletions = newComps;
    this.persistData();

    if (isMongoConnected() && userId) {
      const compKeys = scopedIncoming.map((c) => `${c.habitId}_${c.date}`);
      HabitCompletionModel.find({ userId }).lean().then((existing: any[]) => {
        const toDelete = existing
          .filter((c) => !compKeys.includes(`${c.habitId}_${c.date}`))
          .map((c) => c._id);
        if (toDelete.length > 0) {
          HabitCompletionModel.deleteMany({ userId, _id: { $in: toDelete } }).catch(() => {});
        }
      }).catch(() => {});

      if (scopedIncoming.length > 0) {
        const ops = scopedIncoming.map((comp) => ({
          updateOne: {
            filter: { habitId: comp.habitId, date: comp.date, userId },
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

  // --- FOCUS SESSIONS ---
  public getFocusSessions(userId?: string): FocusSession[] {
    this.reloadIfDiskExists();
    const all = this.data.focusSessions || [];
    if (!userId) return all;
    return all.filter((s) => s.userId === userId);
  }

  public saveFocusSession(session: FocusSession, userId: string): void {
    this.reloadIfDiskExists();
    if (!this.data.focusSessions) {
      this.data.focusSessions = [];
    }
    const fullSession = { ...session, userId };
    const idx = this.data.focusSessions.findIndex((s) => s.id === session.id && s.userId === userId);
    if (idx >= 0) {
      this.data.focusSessions[idx] = fullSession;
    } else {
      this.data.focusSessions.unshift(fullSession);
    }
    this.persistData();
  }

  public deleteFocusSession(id: string, userId: string): boolean {
    this.reloadIfDiskExists();
    if (!this.data.focusSessions) return false;
    const initialLen = this.data.focusSessions.length;
    this.data.focusSessions = this.data.focusSessions.filter((s) => !(s.id === id && s.userId === userId));
    const deleted = this.data.focusSessions.length < initialLen;
    if (deleted) {
      this.persistData();
    }
    return deleted;
  }

  public syncFocusSessions(sessions: FocusSession[], userId: string): void {
    this.reloadIfDiskExists();
    if (!this.data.focusSessions) {
      this.data.focusSessions = [];
    }
    const otherUsersSessions = this.data.focusSessions.filter((s) => s.userId && s.userId !== userId);
    const userSessions = sessions.map((s) => ({ ...s, userId }));
    this.data.focusSessions = [...userSessions, ...otherUsersSessions];
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
