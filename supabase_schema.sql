-- SUPABASE SCHEMA FOR DUDE OPERATIONAL SYSTEM
-- Complete and Synchronized Production Schema (Source of Truth)

-- 1. PROFILES
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  total_focus_minutes BIGINT DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  daily_goal_minutes INTEGER DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. PROJECTS
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. HABITS
CREATE TABLE habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  total_minutes BIGINT DEFAULT 0,
  deep_sessions_count INTEGER DEFAULT 0,
  weekly_streak INTEGER DEFAULT 0,
  sessions_per_week INTEGER DEFAULT 0,
  minutes_per_session INTEGER DEFAULT 0,
  preferred_time TEXT DEFAULT 'morning' CHECK (preferred_time IN ('morning', 'afternoon', 'evening')),
  sessions_this_week INTEGER DEFAULT 0,
  week_start_date TEXT,
  current_streak INTEGER DEFAULT 0, -- legacy compatibility (replaced by weekly_streak in app)
  completed_today BOOLEAN DEFAULT FALSE, -- legacy compatibility
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_days TEXT[],
  recurrence_time TEXT,
  last_generated_week TEXT,
  is_scheduled BOOLEAN DEFAULT FALSE,
  sched_start TEXT,
  sched_duration INTEGER,
  sched_weekdays TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ACTIVITIES
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  habit_id UUID REFERENCES habits(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. SCHEDULED ACTIVITIES (AGENDA)
CREATE TABLE scheduled_activities (
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
  completed_session_id UUID, -- circular FK placeholder, set manually after focus_sessions is created
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. FOCUS SESSIONS
CREATE TABLE focus_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  habit_id UUID REFERENCES habits(id) ON DELETE SET NULL,
  activity_name TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  completed BOOLEAN DEFAULT FALSE,
  all_tasks_completed BOOLEAN DEFAULT FALSE,
  actual_duration_minutes INTEGER,
  parcial BOOLEAN DEFAULT FALSE,
  activity_id UUID REFERENCES activities(id) ON DELETE SET NULL,
  scheduled_activity_id UUID REFERENCES scheduled_activities(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Circular Reference Constraint setup
ALTER TABLE scheduled_activities ADD CONSTRAINT fk_scheduled_activities_completed_session 
  FOREIGN KEY (completed_session_id) REFERENCES focus_sessions(id) ON DELETE SET NULL;

-- 7. PENDING TASKS
CREATE TABLE pending_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  habit_id UUID REFERENCES habits(id) ON DELETE SET NULL,
  activity_id UUID REFERENCES activities(id) ON DELETE SET NULL,
  atividade_avulsa TEXT,
  description TEXT NOT NULL,
  origin_session_id UUID REFERENCES focus_sessions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. SESSION TASKS
CREATE TABLE session_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES focus_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. HABIT COMPLETIONS
CREATE TABLE habit_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_minutes INTEGER DEFAULT 0,
  focus_session_id UUID REFERENCES focus_sessions(id) ON DELETE SET NULL
);

-- 10. NOTES
CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT,
  content TEXT,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  activity_id UUID REFERENCES activities(id) ON DELETE SET NULL,
  target_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. MOOD ENTRIES
CREATE TABLE mood_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date TEXT NOT NULL, -- local YYYY-MM-DD
  period TEXT NOT NULL CHECK (period IN ('manha', 'tarde', 'noite')),
  mood TEXT NOT NULL CHECK (mood IN ('animado', 'tranquilo', 'neutro', 'ansioso', 'prabaixo')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_date_period UNIQUE (user_id, date, period)
);

-- 12. DAILY SHUTDOWNS
CREATE TABLE daily_shutdowns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date TEXT NOT NULL, -- local YYYY-MM-DD
  status TEXT NOT NULL CHECK (status IN ('completed', 'dismissed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_shutdown_date UNIQUE (user_id, date)
);


-- INDEXES FOR MAXIMUM QUERY EFFICIENCY
CREATE INDEX IF NOT EXISTS idx_profiles_streak ON profiles(current_streak);
CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_habits_user ON habits(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_user ON activities(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_project ON activities(project_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_activities_user ON scheduled_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_activities_date ON scheduled_activities(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_user ON focus_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_habit ON focus_sessions(habit_id);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_started ON focus_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_pending_tasks_user ON pending_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_session_tasks_session ON session_tasks(session_id);
CREATE INDEX IF NOT EXISTS idx_habit_completions_habit ON habit_completions(habit_id);
CREATE INDEX IF NOT EXISTS idx_habit_completions_user ON habit_completions(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_mood_entries_user ON mood_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_mood_entries_date ON mood_entries(date);
CREATE INDEX IF NOT EXISTS idx_daily_shutdowns_user ON daily_shutdowns(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_shutdowns_date ON daily_shutdowns(date);


-- ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE focus_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE habit_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE mood_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_shutdowns ENABLE ROW LEVEL SECURITY;

-- Profile Policies
CREATE POLICY "Users can view their own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Project Policies
CREATE POLICY "Users can manage their own projects" ON projects FOR ALL USING (auth.uid() = user_id);

-- Habit Policies
CREATE POLICY "Users can manage their own habits" ON habits FOR ALL USING (auth.uid() = user_id);

-- Activity Policies
CREATE POLICY "Users can manage their own activities" ON activities FOR ALL USING (auth.uid() = user_id);

-- Scheduled Activity Policies
CREATE POLICY "Users can manage their own scheduled activities" ON scheduled_activities FOR ALL USING (auth.uid() = user_id);

-- Focus Session Policies
CREATE POLICY "Users can manage their own sessions" ON focus_sessions FOR ALL USING (auth.uid() = user_id);

-- Pending Task Policies
CREATE POLICY "Users can manage their own pending tasks" ON pending_tasks FOR ALL USING (auth.uid() = user_id);

-- Session Task Policies
CREATE POLICY "Users can manage their own session tasks" ON session_tasks FOR ALL USING (auth.uid() = user_id);

-- Habit Completion Policies
CREATE POLICY "Users can manage their own completions" ON habit_completions FOR ALL USING (auth.uid() = user_id);

-- Note Policies
CREATE POLICY "Users can manage their own notes" ON notes FOR ALL USING (auth.uid() = user_id);

-- Mood Entries Policies
CREATE POLICY "Users can manage their own mood entries" ON mood_entries FOR ALL USING (auth.uid() = user_id);

-- Daily Shutdowns Policies
CREATE POLICY "Users can manage their own daily shutdowns" ON daily_shutdowns FOR ALL USING (auth.uid() = user_id);


-- FUNCTIONS AND TRIGGERS FOR NEW USERS
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
