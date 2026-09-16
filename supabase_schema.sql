-- ============================================================================
-- Habit & Task Tracker — Supabase / PostgreSQL Database Schema
-- Run this in the Supabase SQL Editor to set up cloud persistence
-- ============================================================================

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role_description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tasks Table (with Due Date, Due Time, and WhatsApp Reminder)
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  date DATE NOT NULL,
  due_time TEXT DEFAULT '20:00',
  reminder_time TEXT DEFAULT '20:00',
  whatsapp_reminder BOOLEAN DEFAULT TRUE,
  reminder_status TEXT DEFAULT 'pending',
  completed BOOLEAN DEFAULT FALSE,
  duration TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_date ON tasks(date);
CREATE INDEX IF NOT EXISTS idx_tasks_user_date ON tasks(user_id, date);

-- 3. Habits Table (Recurring Habits with Frequency and Due Time)
CREATE TABLE IF NOT EXISTS habits (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'daily',
  target TEXT,
  due_time TEXT DEFAULT '20:00',
  whatsapp_reminder BOOLEAN DEFAULT TRUE,
  start_date DATE NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Habit Completions Table
CREATE TABLE IF NOT EXISTS habit_completions (
  id TEXT PRIMARY KEY,
  habit_id TEXT REFERENCES habits(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  completed BOOLEAN DEFAULT TRUE,
  UNIQUE (habit_id, date)
);

CREATE INDEX IF NOT EXISTS idx_habit_completions_date ON habit_completions(date);

-- 5. Notification History Table (Prevents duplicate WhatsApp notifications)
CREATE TABLE IF NOT EXISTS notification_logs (
  id TEXT PRIMARY KEY,
  date DATE NOT NULL,
  item_id TEXT NOT NULL,
  item_type TEXT NOT NULL, -- 'task' or 'habit'
  title TEXT NOT NULL,
  due_time TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  recipient_number TEXT NOT NULL,
  status TEXT NOT NULL, -- 'success', 'failed', or 'in_progress'
  message_id TEXT, -- Meta Graph API message ID for proof of delivery
  streak_at_risk BOOLEAN DEFAULT FALSE,
  current_streak INT DEFAULT 0,
  error TEXT,
  UNIQUE(item_id, date, status)
);

CREATE INDEX IF NOT EXISTS idx_notification_logs_date ON notification_logs(date);
CREATE INDEX IF NOT EXISTS idx_notification_logs_item ON notification_logs(item_id, date);

-- 6. User Reminder Settings Table
CREATE TABLE IF NOT EXISTS reminder_settings (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  whatsapp_number TEXT NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  default_due_time TEXT DEFAULT '20:00',
  notification_preference TEXT DEFAULT 'single',
  timezone TEXT DEFAULT 'Asia/Kolkata',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Focus Sessions Table (Point 2: Database efficiency & full feature parity)
CREATE TABLE IF NOT EXISTS focus_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  subject TEXT,
  duration_minutes INT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_focus_sessions_user_time ON focus_sessions(user_id, started_at);

-- 8. Topic Spaced Revision Schedules Table
CREATE TABLE IF NOT EXISTS topic_revision_schedules (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  topic_title TEXT NOT NULL,
  subject TEXT NOT NULL,
  initial_study_date DATE NOT NULL,
  current_step INT DEFAULT 0,
  intervals_days JSONB NOT NULL DEFAULT '[1, 3, 7, 14, 30]',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_revision_schedules_user ON topic_revision_schedules(user_id, status);
