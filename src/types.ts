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
  current_streak: number;
  completed_today: boolean;
  created_at: string;
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
};

export type Note = {
  id: string;
  user_id: string;
  title: string | null;
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
};
