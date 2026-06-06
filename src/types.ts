export type Profile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  total_focus_minutes: number;
  current_streak: number;
  daily_goal_minutes?: number | null;
  created_at: string;
  updated_at: string;
};

export type Project = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
};

export type Habit = {
  id: string;
  user_id: string;
  name: string;
  total_minutes: number;
  deep_sessions_count: number;
  weekly_streak: number;
  sessions_per_week: number;
  minutes_per_session: number;
  preferred_time: 'morning' | 'afternoon' | 'evening';
  sessions_this_week: number;
  week_start_date: string;
  created_at: string;
  is_recurring?: boolean;
  recurrence_days?: string[];
  recurrence_time?: string;
  last_generated_week?: string;
  habit_mode?: 'build' | 'avoid';
  avoidance_target?: string;
  avoidance_scope?: 'full_day' | 'time_window';
  avoidance_window_start?: string; // HH:MM
  avoidance_window_end?: string;   // HH:MM
  avoidance_checkin_intensity?: 'light' | 'balanced' | 'strong';
  avoidance_notifications_enabled?: boolean;
  avoidance_recovery_mode?: boolean;
  monitor_type?: 'dia_todo' | 'janela';
  monitor_start?: string | null;  // HH:MM
  monitor_end?: string | null;    // HH:MM
  monitor_weekdays?: string;      // '1,2,3,4,5' or 'all' etc.
};

export type AvoidanceCheckin = {
  id: string;
  user_id: string;
  habit_id: string;
  checkin_date: string;
  checkin_period: 'morning' | 'afternoon' | 'evening' | 'window' | string;
  status: 'success' | 'relapse' | 'pending' | 'resisti' | 'recai' | 'depois' | string;
  created_at: string;
  window_label?: string | null;
  prompts_shown?: number;
};

export type HabitCompletion = {
  id: string;
  habit_id: string;
  user_id: string;
  completed_at: string;
  duration_minutes: number;
  focus_session_id: string | null;
};

export type FocusSession = {
  id: string;
  user_id: string;
  project_id: string | null;
  habit_id: string | null;
  activity_name: string;
  description: string | null;
  duration_minutes: number;
  started_at: string;
  completed_at: string | null;
  completed: boolean;
  created_at: string;
  all_tasks_completed: boolean;
  actual_duration_minutes: number | null;
  parcial?: boolean | null;
  activity_id?: string | null;
  scheduled_activity_id?: string | null;
};

export type ScheduledActivity = {
  id: string;
  user_id: string;
  title: string;
  project_id: string | null;
  activity_id: string | null;
  atividade_avulsa: string | null;
  habit_id: string | null;
  scheduled_date: string;
  scheduled_time: string;
  duration_minutes: number;
  status: 'agendada' | 'concluida' | 'cancelada' | 'expirada' | 'pending' | 'completed' | 'cancelled';
  tasks: string[];
  notes: string | null;
  created_at: string;
  completed_session_id?: string | null;
  resolved_at?: string | null;
};

export type PendingTask = {
  id: string;
  user_id: string;
  habit_id: string | null;
  activity_id: string | null;
  atividade_avulsa: string | null;
  description: string;
  created_at: string;
  origin_session_id: string | null;
};

export type Note = {
  id: string;
  user_id: string;
  title: string;
  content: string;
  project_id: string | null;
  activity_id: string | null;
  target_date: string | null;
  created_at: string;
};

export type Activity = {
  id: string;
  user_id: string;
  project_id: string | null;
  name: string;
  completed: boolean;
  created_at: string;
  habit_id?: string | null;
};

export type SessionTask = {
  id: string;
  session_id: string;
  user_id: string;
  description: string;
  completed: boolean;
  created_at: string;
};

export type MoodPeriod = 'manha' | 'tarde' | 'noite';

export type MoodEntry = {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD local
  period: MoodPeriod;
  mood: 'animado' | 'tranquilo' | 'neutro' | 'ansioso' | 'prabaixo' | null;
  energy?: 'cansado' | 'normal' | 'energizado' | null;
  created_at: string;
};

export type DailyShutdown = {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD local
  status: 'completed' | 'dismissed';
  created_at: string;
};

export type SavedLink = {
  id: string;
  user_id: string;
  title: string;
  url: string;
  project_id: string | null;
  habit_id: string | null;
  access_count: number;
  last_accessed_at: string | null;
  created_at: string;
};
