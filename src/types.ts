export type Profile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  total_focus_minutes: number;
  current_streak: number;
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
  status: 'pending' | 'completed' | 'cancelled';
  tasks: string[];
  notes: string | null;
  created_at: string;
  completed_session_id?: string | null;
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
