-- ====================================================================
-- ESQUEMA COMPLETO E CONSOLIDADO DO BANCO DE DADOS - DUDE SYSTEM
-- Executar este script no SQL Editor do novo projeto Supabase
-- (https://wckuqhzjzqcndlrvdlaz.supabase.co)
-- ====================================================================

-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. PROFILES (Perfis de Usuário com Suporte a Trial de 21 dias)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  total_focus_minutes BIGINT DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  daily_goal_minutes INTEGER DEFAULT NULL,
  trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '21 days'),
  is_subscribed BOOLEAN DEFAULT false,
  is_admin BOOLEAN DEFAULT false,
  mood_status TEXT DEFAULT 'active',
  mood_snoozed_until TIMESTAMPTZ,
  hide_mood_nudge BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. PROJECTS (Projetos de Foco)
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. HABITS (Hábitos Atômicos e Anti-Vício)
CREATE TABLE IF NOT EXISTS public.habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  total_minutes BIGINT DEFAULT 0,
  deep_sessions_count INTEGER DEFAULT 0,
  weekly_streak INTEGER DEFAULT 0,
  sessions_per_week INTEGER DEFAULT 0,
  minutes_per_session INTEGER DEFAULT 0,
  preferred_time TEXT DEFAULT 'morning' CHECK (preferred_time IN ('morning', 'afternoon', 'evening')),
  sessions_this_week INTEGER DEFAULT 0,
  week_start_date TEXT,
  current_streak INTEGER DEFAULT 0,
  completed_today BOOLEAN DEFAULT FALSE,
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_days TEXT[],
  recurrence_time TEXT,
  last_generated_week TEXT,
  habit_mode TEXT DEFAULT 'build' CHECK (habit_mode IN ('build', 'avoid')),
  avoidance_target TEXT,
  avoidance_scope TEXT DEFAULT 'full_day' CHECK (avoidance_scope IN ('full_day', 'time_window')),
  avoidance_window_start TIME,
  avoidance_window_end TIME,
  avoidance_checkin_intensity TEXT DEFAULT 'balanced' CHECK (avoidance_checkin_intensity IN ('light', 'balanced', 'strong')),
  avoidance_notifications_enabled BOOLEAN DEFAULT TRUE,
  avoidance_recovery_mode BOOLEAN DEFAULT TRUE,
  monitor_type TEXT,
  monitor_start TEXT,
  monitor_end TEXT,
  monitor_weekdays TEXT,
  is_scheduled BOOLEAN DEFAULT FALSE,
  sched_start TEXT,
  sched_duration INTEGER,
  sched_weekdays TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ACTIVITIES (Atividades)
CREATE TABLE IF NOT EXISTS public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  habit_id UUID REFERENCES public.habits(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  scheduled_date TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. SCHEDULED ACTIVITIES (Agenda DUDE)
CREATE TABLE IF NOT EXISTS public.scheduled_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  activity_id UUID REFERENCES public.activities(id) ON DELETE SET NULL,
  atividade_avulsa TEXT,
  habit_id UUID REFERENCES public.habits(id) ON DELETE SET NULL,
  scheduled_date TEXT NOT NULL,
  scheduled_time TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  tasks TEXT[] DEFAULT '{}',
  notes TEXT,
  completed_session_id UUID, -- Chave estrangeira circular vinculada abaixo
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. FOCUS SESSIONS (Sessões de Foco)
CREATE TABLE IF NOT EXISTS public.focus_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  habit_id UUID REFERENCES public.habits(id) ON DELETE SET NULL,
  activity_name TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  completed BOOLEAN DEFAULT FALSE,
  all_tasks_completed BOOLEAN DEFAULT FALSE,
  actual_duration_minutes INTEGER,
  parcial BOOLEAN DEFAULT FALSE,
  activity_id UUID REFERENCES public.activities(id) ON DELETE SET NULL,
  scheduled_activity_id UUID REFERENCES public.scheduled_activities(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chave Estrangeira Circular entre scheduled_activities e focus_sessions
ALTER TABLE public.scheduled_activities 
  DROP CONSTRAINT IF EXISTS fk_scheduled_activities_completed_session;
ALTER TABLE public.scheduled_activities 
  ADD CONSTRAINT fk_scheduled_activities_completed_session 
  FOREIGN KEY (completed_session_id) REFERENCES public.focus_sessions(id) ON DELETE SET NULL;

-- 7. PENDING TASKS (Tarefas Pendentes de Sessão)
CREATE TABLE IF NOT EXISTS public.pending_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  habit_id UUID REFERENCES public.habits(id) ON DELETE SET NULL,
  activity_id UUID REFERENCES public.activities(id) ON DELETE SET NULL,
  atividade_avulsa TEXT,
  description TEXT NOT NULL,
  origin_session_id UUID REFERENCES public.focus_sessions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. SESSION TASKS (Tarefas de Sessão Ativa)
CREATE TABLE IF NOT EXISTS public.session_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.focus_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. HABIT COMPLETIONS (Registro de Conclusões de Hábitos)
CREATE TABLE IF NOT EXISTS public.habit_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id UUID NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_minutes INTEGER DEFAULT 0,
  focus_session_id UUID REFERENCES public.focus_sessions(id) ON DELETE SET NULL
);

-- 10. NOTES (Notas Rápidas)
CREATE TABLE IF NOT EXISTS public.notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT,
  content TEXT,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  activity_id UUID REFERENCES public.activities(id) ON DELETE SET NULL,
  target_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. MOOD ENTRIES (Registro de Humor e Energia)
CREATE TABLE IF NOT EXISTS public.mood_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date TEXT,
  entry_date TEXT,
  period TEXT NOT NULL,
  mood TEXT,
  energy TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. DAILY SHUTDOWNS (Ritual de Encerramento Diário)
CREATE TABLE IF NOT EXISTS public.daily_shutdowns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  entry_date TEXT,
  status TEXT NOT NULL CHECK (status IN ('completed', 'dismissed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_shutdown_date UNIQUE (user_id, date)
);

-- 13. DAILY TASKS (Tarefas Diárias e Checklists)
CREATE TABLE IF NOT EXISTS public.daily_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  task_date TEXT NOT NULL,
  title TEXT NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  activity_id UUID REFERENCES public.activities(id) ON DELETE SET NULL,
  activity_avulsa TEXT,
  habit_id UUID REFERENCES public.habits(id) ON DELETE SET NULL,
  checklist JSONB DEFAULT '[]',
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  rolled_from_date TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. AVOIDANCE CHECKINS (Check-ins Anti-Vício)
CREATE TABLE IF NOT EXISTS public.avoidance_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  habit_id UUID NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
  checkin_date TEXT NOT NULL,
  checkin_period TEXT NOT NULL,
  status TEXT NOT NULL,
  trigger_tag TEXT,
  trigger_note TEXT,
  window_label TEXT,
  prompts_shown INTEGER,
  intensity INTEGER,
  time_spent INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. SAVED LINKS (Links Úteis e Favoritos)
CREATE TABLE IF NOT EXISTS public.saved_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  habit_id UUID REFERENCES public.habits(id) ON DELETE SET NULL,
  access_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. INBOX CAPTURES (Caixa de Entrada e Captura Rápida)
CREATE TABLE IF NOT EXISTS public.inbox_captures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ====================================================================
-- ÍNDICES DE ALTA PERFORMANCE
-- ====================================================================
CREATE INDEX IF NOT EXISTS idx_profiles_streak ON public.profiles(current_streak);
CREATE INDEX IF NOT EXISTS idx_projects_user ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_habits_user ON public.habits(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_user ON public.activities(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_project ON public.activities(project_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_activities_user ON public.scheduled_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_activities_date ON public.scheduled_activities(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_user ON public.focus_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_habit ON public.focus_sessions(habit_id);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_started ON public.focus_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_pending_tasks_user ON public.pending_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_session_tasks_session ON public.session_tasks(session_id);
CREATE INDEX IF NOT EXISTS idx_habit_completions_habit ON public.habit_completions(habit_id);
CREATE INDEX IF NOT EXISTS idx_habit_completions_user ON public.habit_completions(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_user ON public.notes(user_id);
CREATE INDEX IF NOT EXISTS idx_mood_entries_user ON public.mood_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_shutdowns_user ON public.daily_shutdowns(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_tasks_user ON public.daily_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_tasks_date ON public.daily_tasks(task_date);
CREATE INDEX IF NOT EXISTS idx_avoidance_checkins_habit ON public.avoidance_checkins(habit_id);
CREATE INDEX IF NOT EXISTS idx_avoidance_checkins_user ON public.avoidance_checkins(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_links_user ON public.saved_links(user_id);
CREATE INDEX IF NOT EXISTS idx_inbox_captures_user ON public.inbox_captures(user_id);


-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.focus_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habit_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mood_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_shutdowns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avoidance_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inbox_captures ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso por usuário
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can manage their own projects" ON public.projects;
CREATE POLICY "Users can manage their own projects" ON public.projects FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own habits" ON public.habits;
CREATE POLICY "Users can manage their own habits" ON public.habits FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own activities" ON public.activities;
CREATE POLICY "Users can manage their own activities" ON public.activities FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own scheduled activities" ON public.scheduled_activities;
CREATE POLICY "Users can manage their own scheduled activities" ON public.scheduled_activities FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own sessions" ON public.focus_sessions;
CREATE POLICY "Users can manage their own sessions" ON public.focus_sessions FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own pending tasks" ON public.pending_tasks;
CREATE POLICY "Users can manage their own pending tasks" ON public.pending_tasks FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own session tasks" ON public.session_tasks;
CREATE POLICY "Users can manage their own session tasks" ON public.session_tasks FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own completions" ON public.habit_completions;
CREATE POLICY "Users can manage their own completions" ON public.habit_completions FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own notes" ON public.notes;
CREATE POLICY "Users can manage their own notes" ON public.notes FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own mood entries" ON public.mood_entries;
CREATE POLICY "Users can manage their own mood entries" ON public.mood_entries FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own daily shutdowns" ON public.daily_shutdowns;
CREATE POLICY "Users can manage their own daily shutdowns" ON public.daily_shutdowns FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own daily tasks" ON public.daily_tasks;
CREATE POLICY "Users can manage their own daily tasks" ON public.daily_tasks FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own avoidance_checkins" ON public.avoidance_checkins;
CREATE POLICY "Users can manage their own avoidance_checkins" ON public.avoidance_checkins FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own saved_links" ON public.saved_links;
CREATE POLICY "Users can manage their own saved_links" ON public.saved_links FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own inbox_captures" ON public.inbox_captures;
CREATE POLICY "Users can manage their own inbox_captures" ON public.inbox_captures FOR ALL USING (auth.uid() = user_id);


-- ====================================================================
-- GATILHO E FUNÇÃO DE AUTO-PROVISIONAMENTO DE NOVOS USUÁRIOS
-- (Cria perfil automaticamente com 21 dias de Free Trial no cadastro)
-- ====================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (
    id, 
    full_name, 
    avatar_url, 
    trial_ends_at, 
    is_subscribed, 
    is_admin
  )
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'full_name', 
    new.raw_user_meta_data->>'avatar_url',
    NOW() + INTERVAL '21 days',
    false,
    false
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
