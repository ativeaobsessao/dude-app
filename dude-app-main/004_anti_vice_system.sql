-- Migration: 004_anti_vice_system.sql
-- Description: Sets up the Anti-Vício schema, including new fields on 'habits' and the 'avoidance_checkins' table.

-- 1. Alter habits table to support Anti-Vício patterns
ALTER TABLE habits
ADD COLUMN IF NOT EXISTS habit_mode TEXT DEFAULT 'build'
CHECK (habit_mode IN ('build', 'avoid'));

ALTER TABLE habits
ADD COLUMN IF NOT EXISTS avoidance_target TEXT;

ALTER TABLE habits
ADD COLUMN IF NOT EXISTS avoidance_scope TEXT DEFAULT 'full_day'
CHECK (avoidance_scope IN ('full_day', 'time_window'));

ALTER TABLE habits
ADD COLUMN IF NOT EXISTS avoidance_window_start TIME;

ALTER TABLE habits
ADD COLUMN IF NOT EXISTS avoidance_window_end TIME;

ALTER TABLE habits
ADD COLUMN IF NOT EXISTS avoidance_checkin_intensity TEXT DEFAULT 'balanced'
CHECK (avoidance_checkin_intensity IN ('light', 'balanced', 'strong'));

ALTER TABLE habits
ADD COLUMN IF NOT EXISTS avoidance_notifications_enabled BOOLEAN DEFAULT TRUE;

ALTER TABLE habits
ADD COLUMN IF NOT EXISTS avoidance_recovery_mode BOOLEAN DEFAULT TRUE;

-- 2. Create avoidance_checkins table
CREATE TABLE IF NOT EXISTS avoidance_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  checkin_date TEXT NOT NULL,
  checkin_period TEXT NOT NULL
  CHECK (checkin_period IN ('morning', 'afternoon', 'evening', 'window')),
  status TEXT NOT NULL
  CHECK (status IN ('success', 'relapse', 'pending')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable RLS and define security rules
ALTER TABLE avoidance_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own avoidance_checkins" 
  ON avoidance_checkins FOR ALL USING (auth.uid() = user_id);

-- 4. Create optimized indexes
CREATE INDEX IF NOT EXISTS idx_avoidance_checkins_habit ON avoidance_checkins(habit_id);
CREATE INDEX IF NOT EXISTS idx_avoidance_checkins_user ON avoidance_checkins(user_id);
CREATE INDEX IF NOT EXISTS idx_avoidance_checkins_date ON avoidance_checkins(checkin_date);
