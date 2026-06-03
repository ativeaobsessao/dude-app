-- SCHEMA MIGRATION: SYNCHRONIZE DUDE SCHEMAS
-- Safely modifies existing tables and creates missing ones

-- 1. ADD MISSING COLUMNS TO EXISTING TABLES IF NOT PRESENT

-- Table: habits
ALTER TABLE habits ADD COLUMN IF NOT EXISTS sessions_per_week INTEGER DEFAULT 0;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS minutes_per_session INTEGER DEFAULT 0;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS preferred_time TEXT DEFAULT 'morning' CHECK (preferred_time IN ('morning', 'afternoon', 'evening'));
ALTER TABLE habits ADD COLUMN IF NOT EXISTS sessions_this_week INTEGER DEFAULT 0;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS week_start_date TEXT;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS weekly_streak INTEGER DEFAULT 0;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS recurrence_days TEXT[];
ALTER TABLE habits ADD COLUMN IF NOT EXISTS recurrence_time TEXT;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS last_generated_week TEXT;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS habit_mode TEXT DEFAULT 'build' CHECK (habit_mode IN ('build', 'avoid'));
ALTER TABLE habits ADD COLUMN IF NOT EXISTS avoidance_target TEXT;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS avoidance_scope TEXT DEFAULT 'full_day' CHECK (avoidance_scope IN ('full_day', 'time_window'));
ALTER TABLE habits ADD COLUMN IF NOT EXISTS avoidance_window_start TIME;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS avoidance_window_end TIME;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS avoidance_checkin_intensity TEXT DEFAULT 'balanced' CHECK (avoidance_checkin_intensity IN ('light', 'balanced', 'strong'));
ALTER TABLE habits ADD COLUMN IF NOT EXISTS avoidance_notifications_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS avoidance_recovery_mode BOOLEAN DEFAULT TRUE;

-- Table: focus_sessions
ALTER TABLE focus_sessions ADD COLUMN IF NOT EXISTS all_tasks_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE focus_sessions ADD COLUMN IF NOT EXISTS actual_duration_minutes INTEGER;
ALTER TABLE focus_sessions ADD COLUMN IF NOT EXISTS parcial BOOLEAN DEFAULT FALSE;
ALTER TABLE focus_sessions ADD COLUMN IF NOT EXISTS activity_id UUID REFERENCES activities(id) ON DELETE SET NULL;
ALTER TABLE focus_sessions ADD COLUMN IF NOT EXISTS scheduled_activity_id UUID; -- linked after scheduled_activities creation

-- Table: activities
ALTER TABLE activities ADD COLUMN IF NOT EXISTS habit_id UUID REFERENCES habits(id) ON DELETE SET NULL;


-- 2. CREATE NEW TABLES FOR DUDE ECOSYSTEM

-- Table: scheduled_activities
CREATE TABLE IF NOT EXISTS scheduled_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  activity_id UUID REFERENCES activities(id) ON DELETE SET NULL,
  atividade_avulsa TEXT,
  habit_id UUID REFERENCES habits(id) ON DELETE SET NULL,
  scheduled_date TEXT NOT NULL,
  scheduled_time TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  tasks TEXT[] DEFAULT '{}',
  notes TEXT,
  completed_session_id UUID REFERENCES focus_sessions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Establish foreign key circular reference in focus_sessions to scheduled_activities
ALTER TABLE focus_sessions ADD CONSTRAINT fk_focus_sessions_scheduled_activity 
  FOREIGN KEY (scheduled_activity_id) REFERENCES scheduled_activities(id) ON DELETE SET NULL;

-- Table: pending_tasks
CREATE TABLE IF NOT EXISTS pending_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  habit_id UUID REFERENCES habits(id) ON DELETE SET NULL,
  activity_id UUID REFERENCES activities(id) ON DELETE SET NULL,
  atividade_avulsa TEXT,
  description TEXT NOT NULL,
  origin_session_id UUID REFERENCES focus_sessions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: session_tasks
CREATE TABLE IF NOT EXISTS session_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES focus_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: habit_completions
CREATE TABLE IF NOT EXISTS habit_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_minutes INTEGER DEFAULT 0,
  focus_session_id UUID REFERENCES focus_sessions(id) ON DELETE SET NULL
);


-- 3. ENABLE ROW LEVEL SECURITY (RLS) FOR NEW TABLES
ALTER TABLE scheduled_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE habit_completions ENABLE ROW LEVEL SECURITY;


-- 4. CREATE RLS POLICIES FOR NEW TABLES

CREATE POLICY "Users can manage their own scheduled activities" 
  ON scheduled_activities FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own pending tasks" 
  ON pending_tasks FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own session tasks" 
  ON session_tasks FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own completions" 
  ON habit_completions FOR ALL USING (auth.uid() = user_id);


-- 5. CREATE OPTIMIZED INDEXES FOR HIGH-PERFORMANCE QUERYING

CREATE INDEX IF NOT EXISTS idx_habits_user_id ON habits(user_id);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_user_id ON focus_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_habit_id ON focus_sessions(habit_id);
CREATE INDEX IF NOT EXISTS idx_habit_completions_habit_id ON habit_completions(habit_id);
CREATE INDEX IF NOT EXISTS idx_habit_completions_user_id ON habit_completions(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_activities_user_id ON scheduled_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_activities_date ON scheduled_activities(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_pending_tasks_user_id ON pending_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_session_tasks_session_id ON session_tasks(session_id);

-- 6. CREATE AVOIDANCE CHECKINS SCHEMA
CREATE TABLE IF NOT EXISTS avoidance_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  checkin_date TEXT NOT NULL,
  checkin_period TEXT NOT NULL CHECK (checkin_period IN ('morning', 'afternoon', 'evening', 'window')),
  status TEXT NOT NULL CHECK (status IN ('success', 'relapse', 'pending')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE avoidance_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own avoidance_checkins" 
  ON avoidance_checkins FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_avoidance_checkins_habit ON avoidance_checkins(habit_id);
CREATE INDEX IF NOT EXISTS idx_avoidance_checkins_user ON avoidance_checkins(user_id);
CREATE INDEX IF NOT EXISTS idx_avoidance_checkins_date ON avoidance_checkins(checkin_date);


-- 7. CREATE DAILY SHUTDOWNS SCHEMA
CREATE TABLE IF NOT EXISTS daily_shutdowns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date TEXT NOT NULL, -- local YYYY-MM-DD
  status TEXT NOT NULL CHECK (status IN ('completed', 'dismissed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_shutdown_date UNIQUE (user_id, date)
);

ALTER TABLE daily_shutdowns ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'daily_shutdowns' AND policyname = 'Users can manage their own daily shutdowns'
  ) THEN
    CREATE POLICY "Users can manage their own daily shutdowns" 
      ON daily_shutdowns FOR ALL USING (auth.uid() = user_id);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_daily_shutdowns_user ON daily_shutdowns(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_shutdowns_date ON daily_shutdowns(date);

-- 8. ADD DAILY_GOAL_MINUTES TO PROFILES
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS daily_goal_minutes INTEGER DEFAULT NULL;


