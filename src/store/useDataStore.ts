import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { Project, Habit, FocusSession, Note, Profile, Activity, HabitCompletion, SessionTask, PendingTask, ScheduledActivity, AvoidanceCheckin, MoodEntry, MoodPeriod, SavedLink, DailyShutdown, DailyTask } from '../types';
import { useTimerStore } from './useTimerStore';
import { useAuthStore } from './useAuthStore';
import { getLocalDateString, getLocalYesterdayDateString } from '../lib/utils';

function getLocalMondayStr(): string {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 is Sunday, 1 is Monday, ..., 6 is Saturday
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  
  const year = monday.getFullYear();
  const month = String(monday.getMonth() + 1).padStart(2, '0');
  const day = String(monday.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

const VALID_SCHEDULED_COLUMNS = [
  'id',
  'user_id',
  'title',
  'project_id',
  'activity_id',
  'atividade_avulsa',
  'habit_id',
  'scheduled_date',
  'scheduled_time',
  'duration_minutes',
  'status',
  'tasks',
  'notes',
  'completed_session_id',
  'created_at'
];

function sanitizeScheduledActivity(payload: any) {
  const sanitized: any = {};
  for (const key of VALID_SCHEDULED_COLUMNS) {
    if (payload[key] !== undefined) {
      sanitized[key] = payload[key];
    }
  }
  return sanitized;
}

interface DataState {
  profile: Profile | null;
  projects: Project[];
  habits: Habit[];
  habitCompletions: HabitCompletion[];
  avoidanceCheckins: AvoidanceCheckin[];
  sessions: FocusSession[];
  notes: Note[];
  activities: Activity[];
  sessionTasks: SessionTask[];
  pendingTasks: PendingTask[];
  scheduledActivities: ScheduledActivity[];
  loading: boolean;
  initialFetchDone: boolean;
  hasCompletedFirstSession: boolean;
  moodEntries: MoodEntry[];
  savedLinks: SavedLink[];
  dailyShutdowns: DailyShutdown[];
  dailyTasks: DailyTask[];
  
  fetchDailyTasks: (userId: string) => Promise<void>;
  addDailyTask: (task: Omit<DailyTask, 'id' | 'created_at'>) => Promise<DailyTask | null>;
  updateDailyTask: (id: string, updates: Partial<DailyTask>) => Promise<boolean>;
  deleteDailyTask: (id: string) => Promise<boolean>;
  syncDailyTasksRollover: (userId: string) => Promise<void>;
  
  addMoodEntry: (userId: string, date: string, period: MoodPeriod, mood: 'animado' | 'tranquilo' | 'neutro' | 'ansioso' | 'prabaixo' | null, energy?: 'cansado' | 'normal' | 'energizado' | null) => Promise<MoodEntry | null>;
  addDailyShutdown: (userId: string, date: string, status: 'completed' | 'dismissed') => Promise<DailyShutdown | null>;
  
  fetchLinks: (userId: string) => Promise<void>;
  addLink: (userId: string, data: { title: string; url: string; projectId?: string | null; habitId?: string | null }) => Promise<SavedLink | null>;
  updateLink: (linkId: string, data: { title: string; url: string; projectId?: string | null; habitId?: string | null }) => Promise<boolean>;
  deleteLink: (linkId: string) => Promise<boolean>;
  registerLinkAccess: (linkId: string) => Promise<void>;
  
  fetchProfile: (userId: string) => Promise<void>;
  updateDailyGoal: (userId: string, minutes: number | null) => Promise<boolean>;
  updateProfileData: (userId: string, updates: { full_name?: string; avatar_url?: string | null }) => Promise<void>;
  fetchData: (userId: string) => Promise<void>;
  syncHabitsRollover: (userId: string) => Promise<void>;
  fetchActivities: (userId: string) => Promise<void>;
  fetchHabitCompletions: (userId: string) => Promise<void>;
  fetchAvoidanceCheckins: (userId: string) => Promise<void>;
  fetchSessionTasks: (userId: string) => Promise<void>;
  fetchPendingTasks: (userId: string) => Promise<void>;
  fetchScheduledActivities: (userId: string) => Promise<void>;
  
  addProject: (userId: string, name: string) => Promise<void>;
  addHabit: (
    userId: string,
    name: string,
    sessionsPerWeek: number,
    minutesPerSession: number,
    preferredTime: 'morning' | 'afternoon' | 'evening',
    isRecurring?: boolean,
    recurrenceDays?: string[],
    recurrenceTime?: string,
    extraAvoidanceParams?: Partial<Habit>
  ) => Promise<Habit | null>;
  updateHabit: (id: string, updates: Partial<Habit>) => Promise<boolean>;
  addAvoidanceCheckin: (checkin: Omit<AvoidanceCheckin, 'id' | 'created_at'>) => Promise<AvoidanceCheckin | null>;
  generateRecurringHabitInstances: (userId: string) => Promise<void>;
  addNote: (userId: string, content: string, projectId?: string, activityId?: string) => Promise<Note | null>;
  addSession: (session: Omit<FocusSession, 'id' | 'created_at'>) => Promise<FocusSession | null>;
  addActivity: (userId: string, name: string, projectId?: string, habitId?: string | null) => Promise<Activity | null>;
  addSessionTask: (sessionId: string, userId: string, description: string, completed?: boolean) => Promise<SessionTask | null>;
  toggleSessionTask: (taskId: string) => Promise<void>;
  addPendingTask: (task: Omit<PendingTask, 'id' | 'created_at'>) => Promise<PendingTask | null>;
  deletePendingTask: (id: string) => Promise<void>;
  deletePendingTasksByDescription: (descriptions: string[], context: { habit_id?: string | null; activity_id?: string | null; atividade_avulsa?: string | null }) => Promise<void>;
  addScheduledActivity: (activity: Omit<ScheduledActivity, 'id' | 'status' | 'created_at'>) => Promise<ScheduledActivity | null>;
  updateScheduledActivity: (id: string, updates: Partial<ScheduledActivity>) => Promise<boolean>;
  deleteScheduledActivity: (id: string) => Promise<void>;
  
  completeHabitSession: (habitId: string, userId: string, durationMinutes: number, focusSessionId?: string) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  updateNote: (id: string, content: string) => Promise<boolean>;
  deleteSession: (id: string) => Promise<void>;
  updateSession: (id: string, updates: Partial<FocusSession>) => Promise<void>;
  updateSessionTaskDescription: (taskId: string, description: string) => Promise<void>;
  deleteSessionTask: (taskId: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  deleteActivity: (id: string) => Promise<void>;
  deleteHabit: (id: string) => Promise<void>;
  completeFirstSession: () => void;
  notification: { message: string; type: 'success' | 'error' } | null;
  notificationTimeoutId: any;
  showNotification: (message: string, type?: 'success' | 'error') => void;
  clearNotification: () => void;
}

export const useDataStore = create<DataState>((set, get) => ({
  profile: null,
  projects: [],
  habits: [],
  habitCompletions: [],
  avoidanceCheckins: [],
  sessions: [],
  notes: [],
  activities: [],
  sessionTasks: [] as SessionTask[],
  pendingTasks: [],
  scheduledActivities: [],
  loading: false,
  initialFetchDone: false,
  hasCompletedFirstSession: localStorage.getItem('dude-first-session-completed') === 'true',
  moodEntries: (() => {
    try {
      const cached = localStorage.getItem('dude-mood-entries');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  })(),
  savedLinks: [],
  dailyTasks: [],
  dailyShutdowns: (() => {
    try {
      const cached = localStorage.getItem('dude-daily-shutdowns');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  })(),
  notification: null,
  notificationTimeoutId: null as any,
  clearNotification: () => {
    const tid = get().notificationTimeoutId;
    if (tid) clearTimeout(tid);
    set({ notification: null, notificationTimeoutId: null });
  },
  showNotification: (message, type = 'success') => {
    const prevTid = get().notificationTimeoutId;
    if (prevTid) clearTimeout(prevTid);

    set({ notification: { message, type } });

    const tid = setTimeout(() => {
      set({ notification: null, notificationTimeoutId: null });
    }, 6000);

    set({ notificationTimeoutId: tid });
  },

  fetchProfile: async (userId) => {
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (error) throw error;
      if (data) {
        set({ profile: data });
        // Local cache reconciliation
        if (data.daily_goal_minutes !== undefined && data.daily_goal_minutes !== null) {
          localStorage.setItem('dude_daily_focus_goal', data.daily_goal_minutes.toString());
        } else {
          const localSaved = localStorage.getItem('dude_daily_focus_goal');
          if (localSaved) {
            const minutes = parseInt(localSaved, 10);
            if (!isNaN(minutes)) {
              supabase.from('profiles').update({ daily_goal_minutes: minutes }).eq('id', userId).then();
              set({ profile: { ...data, daily_goal_minutes: minutes } });
            }
          }
        }
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
    }
  },

  updateDailyGoal: async (userId, minutes) => {
    const currentProfile = get().profile;
    if (currentProfile) {
      set({ profile: { ...currentProfile, daily_goal_minutes: minutes } });
    }
    
    if (minutes !== null) {
      localStorage.setItem('dude_daily_focus_goal', minutes.toString());
    } else {
      localStorage.removeItem('dude_daily_focus_goal');
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ daily_goal_minutes: minutes })
        .eq('id', userId);
      
      if (error) {
        console.warn('Silent fallback: daily_goal_minutes save on server failed', error);
        return false;
      }
      return true;
    } catch (err) {
      console.warn('Supabase profile focus goal update failed with exception:', err);
      return false;
    }
  },

  updateProfileData: async (userId, updates) => {
    const currentProfile = get().profile;
    if (currentProfile) {
      set({ profile: { ...currentProfile, ...updates } });
    }
    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId);
      if (error) throw error;
    } catch (err) {
      console.error('Error updating profile data:', err);
      throw err;
    }
  },

  fetchData: async (userId) => {
    try {
      set({ loading: true });
      const [p, h, s, n, a, hc, pt, sa, ac, me, sl, ds, dt] = await Promise.all([
        supabase.from('projects').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('habits').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('focus_sessions').select('*').eq('user_id', userId).order('started_at', { ascending: false }),
        supabase.from('notes').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('activities').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('habit_completions').select('*').eq('user_id', userId).order('completed_at', { ascending: false }),
        supabase.from('pending_tasks').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
        supabase.from('scheduled_activities').select('*').eq('user_id', userId).order('scheduled_date', { ascending: true }).order('scheduled_time', { ascending: true }),
        supabase.from('avoidance_checkins').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        (async () => {
          try {
            return await supabase.from('mood_entries').select('*').eq('user_id', userId).order('created_at', { ascending: false });
          } catch (err) {
            console.warn('Silent fallback: mood_entries table lookup failed', err);
            return { data: null };
          }
        })(),
        (async () => {
          try {
            const res = await supabase
              .from('saved_links')
              .select('*')
              .eq('user_id', userId)
              .order('access_count', { ascending: false })
              .order('created_at', { ascending: false });
            if (res.error) {
              console.warn('Silent fallback: saved_links table lookup failed with error', res.error);
              return { data: [] };
            }
            return res;
          } catch (err) {
            console.warn('Silent fallback: saved_links table lookup threw an exception', err);
            return { data: [] };
          }
        })(),
        (async () => {
          try {
            const res = await supabase
              .from('daily_shutdowns')
              .select('*')
              .eq('user_id', userId)
              .order('created_at', { ascending: false });
            if (res.error) {
              console.warn('Silent fallback: daily_shutdowns table lookup failed with error', res.error);
              return { data: [] };
            }
            return res;
          } catch (err) {
            console.warn('Silent fallback: daily_shutdowns table lookup threw an exception', err);
            return { data: [] };
          }
        })(),
        (async () => {
          try {
            const res = await supabase
              .from('daily_tasks')
              .select('*')
              .eq('user_id', userId)
              .order('created_at', { ascending: false });
            if (res.error) {
              console.warn('Silent fallback: daily_tasks table lookup failed with error', res.error);
              return { data: [] };
            }
            return res;
          } catch (err) {
            console.warn('Silent fallback: daily_tasks table lookup threw an exception', err);
            return { data: [] };
          }
        })(),
      ]);

      const fetchedMoods = (me && 'data' in me && me.data) ? (me.data as MoodEntry[]) : [];
      let combinedMoods = [...fetchedMoods];
      try {
        const cachedStr = localStorage.getItem('dude-mood-entries');
        const cachedMoods = cachedStr ? (JSON.parse(cachedStr) as MoodEntry[]) : [];
        const fetchedIds = new Set(fetchedMoods.map(m => m.id));
        const missingFromRemote = cachedMoods.filter(m => !fetchedIds.has(m.id));
        combinedMoods = [...combinedMoods, ...missingFromRemote];
      } catch (err) {
        console.error('Error merging local mood cache:', err);
      }
      combinedMoods.sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      try {
        localStorage.setItem('dude-mood-entries', JSON.stringify(combinedMoods));
      } catch (err) {
        console.error('Error writing merged mood cache:', err);
      }

      const fetchedShutdowns = (ds && 'data' in ds && ds.data) ? (ds.data as DailyShutdown[]) : [];
      let combinedShutdowns = [...fetchedShutdowns];
      try {
        const cachedStr = localStorage.getItem('dude-daily-shutdowns');
        const cachedShutdowns = cachedStr ? (JSON.parse(cachedStr) as DailyShutdown[]) : [];
        const fetchedIds = new Set(fetchedShutdowns.map(d => d.id));
        const missingFromRemote = cachedShutdowns.filter(d => !fetchedIds.has(d.id));
        combinedShutdowns = [...combinedShutdowns, ...missingFromRemote];
      } catch (err) {
        console.error('Error merging local shutdowns cache:', err);
      }
      combinedShutdowns.sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      try {
        localStorage.setItem('dude-daily-shutdowns', JSON.stringify(combinedShutdowns));
      } catch (err) {
        console.error('Error writing merged shutdowns cache:', err);
      }

      const fetchedDailyTasks = (dt && 'data' in dt && dt.data) ? (dt.data as DailyTask[]) : [];
      let combinedDailyTasks = [...fetchedDailyTasks];
      try {
        const cachedStr = localStorage.getItem(`dude-daily-tasks-${userId}`);
        const cachedDailyTasks = cachedStr ? (JSON.parse(cachedStr) as DailyTask[]) : [];
        const fetchedIds = new Set(fetchedDailyTasks.map(x => x.id));
        const missingFromRemote = cachedDailyTasks.filter(x => !fetchedIds.has(x.id));
        combinedDailyTasks = [...combinedDailyTasks, ...missingFromRemote];
      } catch (err) {
        console.error('Error merging local daily_tasks cache:', err);
      }
      combinedDailyTasks.sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      try {
        localStorage.setItem(`dude-daily-tasks-${userId}`, JSON.stringify(combinedDailyTasks));
      } catch (err) {
        console.error('Error writing merged daily_tasks cache:', err);
      }

      set({ 
         projects: p.data || [], 
         habits: h.data || [], 
         sessions: s.data || [], 
         notes: n.data || [],
         activities: a.data || [],
         habitCompletions: hc.data || [],
         pendingTasks: pt.data || [],
         scheduledActivities: sa.data || [],
         avoidanceCheckins: ac.data || [],
         moodEntries: combinedMoods,
         savedLinks: sl.data || [],
         dailyShutdowns: combinedShutdowns,
         dailyTasks: combinedDailyTasks,
         loading: false,
         initialFetchDone: true 
       });

      await get().fetchSessionTasks(userId);
      await get().syncDailyTasksRollover(userId);
      await get().syncHabitsRollover(userId);
    } catch (err) {
      console.error('Error fetching data:', err);
      set({ loading: false });
    }
  },

  syncHabitsRollover: async (userId) => {
    try {
      const currentMondayStr = getLocalMondayStr();
      const updatedHabits = [...get().habits];
      let hasChanges = false;

      for (let i = 0; i < updatedHabits.length; i++) {
        const habit = updatedHabits[i];
        if (!habit.week_start_date) {
          habit.week_start_date = currentMondayStr;
          habit.sessions_this_week = 0;
          await supabase
            .from('habits')
            .update({ week_start_date: currentMondayStr, sessions_this_week: 0 })
            .eq('id', habit.id);
          hasChanges = true;
          continue;
        }

        const storedMonday = parseLocalDate(habit.week_start_date);
        const currentMonday = parseLocalDate(currentMondayStr);
        const diffMs = currentMonday.getTime() - storedMonday.getTime();
        const weeksPassed = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));

        if (weeksPassed > 0) {
          let updatedWeeklyStreak = habit.weekly_streak;
          if (weeksPassed === 1) {
            if (habit.sessions_this_week < habit.sessions_per_week) {
              updatedWeeklyStreak = 0;
            }
          } else {
            updatedWeeklyStreak = 0;
          }

          habit.week_start_date = currentMondayStr;
          habit.sessions_this_week = 0;
          habit.weekly_streak = updatedWeeklyStreak;

          await supabase
            .from('habits')
            .update({
              week_start_date: currentMondayStr,
              sessions_this_week: 0,
              weekly_streak: updatedWeeklyStreak
            })
            .eq('id', habit.id);

          hasChanges = true;
        }
      }

      if (hasChanges) {
        set({ habits: updatedHabits });
      }

      // Automatically generate missing instances for is_recurring habits for this week
      await get().generateRecurringHabitInstances(userId);
    } catch (err) {
      console.error('Error syncing habits rollover:', err);
    }
  },

  fetchHabitCompletions: async (userId) => {
    try {
      const { data } = await supabase
        .from('habit_completions')
        .select('*')
        .eq('user_id', userId)
        .order('completed_at', { ascending: false });
      if (data) set({ habitCompletions: data });
    } catch (err) {
      console.error('Error fetching habit completions:', err);
    }
  },

  fetchAvoidanceCheckins: async (userId) => {
    try {
      const { data } = await supabase
        .from('avoidance_checkins')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (data) set({ avoidanceCheckins: data || [] });
    } catch (err) {
      console.error('Error fetching avoidance checkins:', err);
    }
  },

  addAvoidanceCheckin: async (checkin) => {
    try {
      const { data, error } = await supabase
        .from('avoidance_checkins')
        .insert(checkin)
        .select()
        .single();
      if (error) throw error;
      if (data) {
        set({ avoidanceCheckins: [data, ...get().avoidanceCheckins] });
        return data;
      }
      return null;
    } catch (err) {
      console.error('Error adding avoidance checkin:', err);
      return null;
    }
  },

  fetchActivities: async (userId) => {
    try {
      const { data, error } = await supabase.from('activities').select('*').eq('user_id', userId).order('created_at', { ascending: false });
      if (error) throw error;
      if (data) {
        const parsed = data.map(act => {
          const parts = act.name.split(' #habit:');
          return {
            ...act,
            name: parts[0],
            habit_id: parts[1] || null
          };
        });
        set({ activities: parsed });
      }
    } catch (err) {
      console.error('Error fetching activities:', err);
    }
  },

  fetchSessionTasks: async (userId) => {
    try {
      const { data, error } = await supabase
        .from('session_tasks')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      if (data) set({ sessionTasks: data });
    } catch (err) {
      console.error('Error fetching session tasks:', err);
    }
  },

  fetchPendingTasks: async (userId) => {
    try {
      const { data, error } = await supabase
        .from('pending_tasks')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      if (data) set({ pendingTasks: data });
    } catch (err) {
      console.error('Error fetching pending tasks:', err);
    }
  },

  fetchScheduledActivities: async (userId) => {
    try {
      const { data, error } = await supabase
        .from('scheduled_activities')
        .select('*')
        .eq('user_id', userId)
        .order('scheduled_date', { ascending: true })
        .order('scheduled_time', { ascending: true });
      if (error) throw error;
      if (data) {
        // Run expiry check for past days where activity is still pending/agendada
        const todayStr = getLocalDateString(new Date());
        const mapped = await Promise.all(data.map(async (sa) => {
          const isPending = sa.status === 'pending' || sa.status === 'agendada';
          const isPastDate = sa.scheduled_date < todayStr;
          if (isPending && isPastDate) {
            // Update on server database to 'cancelled' so it fits the DB constraint
            await supabase
              .from('scheduled_activities')
              .update({ status: 'cancelled' })
              .eq('id', sa.id);
            return { ...sa, status: 'expirada', resolved_at: new Date().toISOString() };
          }
          return sa;
        }));
        
        set({ scheduledActivities: mapped });
      }
    } catch (err) {
      console.error('Error fetching scheduled activities:', err);
    }
  },

  addPendingTask: async (task) => {
    try {
      const { data, error } = await supabase
        .from('pending_tasks')
        .insert(task)
        .select()
        .single();
      if (error) throw error;
      if (data) {
        set({ pendingTasks: [...get().pendingTasks, data] });
        return data;
      }
      return null;
    } catch (err) {
      console.error('Error adding pending task:', err);
      return null;
    }
  },

  deletePendingTask: async (id) => {
    try {
      const { error } = await supabase
        .from('pending_tasks')
        .delete()
        .eq('id', id);
      if (error) throw error;
      set({ pendingTasks: get().pendingTasks.filter(item => item.id !== id) });
    } catch (err) {
      console.error('Error deleting pending task:', err);
    }
  },

  deletePendingTasksByDescription: async (descriptions, context) => {
    try {
      if (descriptions.length === 0) return;
      
      let query = supabase.from('pending_tasks').delete().in('description', descriptions);
      
      if (context.habit_id) {
        query = query.eq('habit_id', context.habit_id);
      } else if (context.activity_id) {
        query = query.eq('activity_id', context.activity_id);
      } else if (context.atividade_avulsa) {
        query = query.eq('atividade_avulsa', context.atividade_avulsa);
      } else {
        return;
      }

      const { error } = await query;
      if (error) throw error;

      set({
        pendingTasks: get().pendingTasks.filter(item => {
          const matchedDesc = descriptions.includes(item.description);
          if (!matchedDesc) return true;
          
          if (context.habit_id) {
            return item.habit_id !== context.habit_id;
          }
          if (context.activity_id) {
            return item.activity_id !== context.activity_id;
          }
          if (context.atividade_avulsa) {
            return item.atividade_avulsa !== context.atividade_avulsa;
          }
          return true;
        })
      });
    } catch (err) {
      console.error('Error deleting pending tasks by description:', err);
    }
  },

  addScheduledActivity: async (activity) => {
    try {
      const rawPayload = {
        ...activity,
        status: 'pending'
      };
      
      const dbPayload = sanitizeScheduledActivity(rawPayload);
      
      const { data, error } = await supabase
        .from('scheduled_activities')
        .insert(dbPayload)
        .select()
        .single();
      if (error) throw error;
      if (data) {
        set({ scheduledActivities: [...get().scheduledActivities, data] });
        return data;
      }
      return null;
    } catch (err) {
      console.error('Error adding scheduled activity:', err);
      return null;
    }
  },

  updateScheduledActivity: async (id, updates) => {
    try {
      if (id.startsWith('habit-sched-')) {
        const habitId = id.replace('habit-sched-', '');
        const isCompleting = updates.status === 'concluida' || updates.status === 'completed';
        if (isCompleting) {
          const userId = useAuthStore.getState().user?.id;
          if (userId) {
            await get().completeHabitSession(habitId, userId, updates.duration_minutes || 45, updates.completed_session_id || undefined);
          }
        }
        return true;
      }
      
      const mappedUpdates = { ...updates };
      if (mappedUpdates.status) {
        if (mappedUpdates.status === 'concluida' || mappedUpdates.status === 'completed') {
          mappedUpdates.status = 'completed';
        } else if (mappedUpdates.status === 'cancelada' || mappedUpdates.status === 'cancelled' || mappedUpdates.status === 'expirada') {
          mappedUpdates.status = 'cancelled';
        } else if (mappedUpdates.status === 'agendada' || mappedUpdates.status === 'pending') {
          mappedUpdates.status = 'pending';
        }
      }

      const dbUpdates = sanitizeScheduledActivity(mappedUpdates);

      const { data, error } = await supabase
        .from('scheduled_activities')
        .update(dbUpdates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      if (data) {
        set({
          scheduledActivities: get().scheduledActivities.map(sa => sa.id === id ? { ...sa, ...updates, ...data } : sa)
        });
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error updating scheduled activity:', err);
      return false;
    }
  },

  deleteScheduledActivity: async (id) => {
    try {
      const { error } = await supabase
        .from('scheduled_activities')
        .delete()
        .eq('id', id);
      if (error) throw error;
      set({
        scheduledActivities: get().scheduledActivities.filter(sa => sa.id !== id)
      });
    } catch (err) {
      console.error('Error deleting scheduled activity:', err);
    }
  },

  addProject: async (userId, name) => {
    try {
      const { data, error } = await supabase.from('projects').insert({ user_id: userId, name }).select().single();
      if (error) throw error;
      if (data) set({ projects: [data, ...get().projects] });
    } catch (err) {
      console.error('Error adding project:', err);
    }
  },

  addHabit: async (
    userId,
    name,
    sessionsPerWeek,
    minutesPerSession,
    preferredTime,
    isRecurring = false,
    recurrenceDays = [],
    recurrenceTime = '',
    extraAvoidanceParams = {}
  ) => {
    try {
      if (!name || !sessionsPerWeek || !minutesPerSession || !preferredTime) {
        console.error('addHabit: parâmetros inválidos', { name, sessionsPerWeek, minutesPerSession, preferredTime });
        return null;
      }

      const weekStart = getLocalMondayStr();

      const { data, error } = await supabase.from('habits').insert({
        user_id: userId,
        name: name.trim(),
        sessions_per_week: sessionsPerWeek,
        minutes_per_session: minutesPerSession,
        preferred_time: preferredTime,
        weekly_streak: 0,
        sessions_this_week: 0,
        week_start_date: weekStart,
        is_recurring: isRecurring,
        recurrence_days: recurrenceDays,
        recurrence_time: isRecurring ? (recurrenceTime || '09:00') : null,
        last_generated_week: null,
        ...extraAvoidanceParams
      }).select().single();

      if (error) {
        console.error('Supabase error ao salvar hábito:', error);
        return null;
      }
      if (data) {
        set({ habits: [data, ...get().habits] });
        console.log('Hábito salvo com sucesso:', data);
        
        // Trigger generation instantly if it is clean and recurring
        if (data.is_recurring) {
          await get().generateRecurringHabitInstances(userId);
        }
        
        return data;
      }
      return null;
    } catch (err) {
      console.error('Erro crítico ao salvar hábito:', err);
      return null;
    }
  },

  updateHabit: async (id, updates) => {
    try {
      const oldHabit = get().habits.find(h => h.id === id);
      if (!oldHabit) return false;

      const { data, error } = await supabase
        .from('habits')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Supabase error ao atualizar hábito:', error);
        throw error;
      }

      if (data) {
        // Apply changes to store habits array
        const updatedHabits = get().habits.map(h => h.id === id ? data : h);
        set({ habits: updatedHabits });

        const todayStr = getLocalDateString(new Date());

        // Handle scheduled_activities sync for this habit editing
        if (!data.is_recurring) {
          // 1. Turned off recurrence: delete future pending ones
          const pToDel = get().scheduledActivities.filter(sa => 
            sa.habit_id === id && sa.status === 'pending' && sa.scheduled_date >= todayStr
          );
          if (pToDel.length > 0) {
            const ids = pToDel.map(sa => sa.id);
            await supabase.from('scheduled_activities').delete().in('id', ids);
            set({
              scheduledActivities: get().scheduledActivities.filter(sa => !ids.includes(sa.id))
            });
          }
        } else {
          // 2. Recurrence is active: we adjust future pending schedules
          const oldScheduled = get().scheduledActivities;
          
          // Delete future pending ones
          const pendingFuture = oldScheduled.filter(sa => 
            sa.habit_id === id && sa.status === 'pending' && sa.scheduled_date >= todayStr
          );
          const idsToDelete = pendingFuture.map(sa => sa.id);
          if (idsToDelete.length > 0) {
            await supabase.from('scheduled_activities').delete().in('id', idsToDelete);
          }

          let updatedScheduled = oldScheduled.filter(sa => !idsToDelete.includes(sa.id));

          // Generate new future pending ones for the current week starting from "today"
          const currentMondayStr = getLocalMondayStr();
          const monday = parseLocalDate(currentMondayStr);
          const days = data.recurrence_days || [];

          const activity = get().activities.find(act => act.habit_id === id);
          const projectId = activity?.project_id || null;
          const activityId = activity?.id || null;

          for (const dayStr of days) {
            const d = parseInt(dayStr, 10);
            if (isNaN(d)) continue;

            const offset = d === 0 ? 6 : d - 1;
            const targetDay = new Date(monday);
            targetDay.setDate(monday.getDate() + offset);

            const year = targetDay.getFullYear();
            const month = String(targetDay.getMonth() + 1).padStart(2, '0');
            const dateVal = String(targetDay.getDate()).padStart(2, '0');
            const scheduledDate = `${year}-${month}-${dateVal}`;

            // Only generate if scheduled date is !== past!
            if (scheduledDate >= todayStr) {
              const newActivityObj = {
                user_id: data.user_id,
                title: data.name,
                project_id: projectId,
                activity_id: activityId,
                atividade_avulsa: null,
                habit_id: data.id,
                scheduled_date: scheduledDate,
                scheduled_time: data.recurrence_time || '09:00',
                duration_minutes: data.minutes_per_session || 30,
                status: 'pending' as const,
                tasks: [],
                notes: `Gerado automaticamente para o hábito recorrente: ${data.name}`
              };

              const { data: inserted } = await supabase
                .from('scheduled_activities')
                .insert(newActivityObj)
                .select()
                .single();

              if (inserted) {
                updatedScheduled.push(inserted);
              }
            }
          }

          set({ scheduledActivities: updatedScheduled });
        }

        return true;
      }
      return false;
    } catch (err) {
      console.error('Error updating habit:', err);
      return false;
    }
  },

  generateRecurringHabitInstances: async (userId) => {
    try {
      const currentMondayStr = getLocalMondayStr();
      const habits = get().habits;
      const recurringHabits = habits.filter(h => h.is_recurring);
      
      if (recurringHabits.length === 0) return;
      
      let createdAny = false;
      const newScheduledActivities = [...get().scheduledActivities];
      const updatedHabits = [...get().habits];

      for (const habit of recurringHabits) {
        // If it was already generated for this week, skip
        if (habit.last_generated_week === currentMondayStr) {
          continue;
        }

        const days = habit.recurrence_days || [];
        if (days.length === 0) continue;

        const monday = parseLocalDate(currentMondayStr);
        let createdForThisHabit = false;

        for (const dayStr of days) {
          const d = parseInt(dayStr, 10);
          if (isNaN(d)) continue;
          
          const offset = d === 0 ? 6 : d - 1;
          const targetDay = new Date(monday);
          targetDay.setDate(monday.getDate() + offset);
          
          const year = targetDay.getFullYear();
          const month = String(targetDay.getMonth() + 1).padStart(2, '0');
          const dateVal = String(targetDay.getDate()).padStart(2, '0');
          const scheduledDate = `${year}-${month}-${dateVal}`;

          // Double gate: check local state
          const localExists = newScheduledActivities.some(sa => 
            sa.habit_id === habit.id && sa.scheduled_date === scheduledDate
          );
          if (localExists) continue;

          // Double gate: query Supabase select
          const { data: dbExists } = await supabase
            .from('scheduled_activities')
            .select('id')
            .eq('habit_id', habit.id)
            .eq('scheduled_date', scheduledDate)
            .limit(1);

          if (dbExists && dbExists.length > 0) {
            continue;
          }

          // Generate
          const activity = get().activities.find(act => act.habit_id === habit.id);
          const projectId = activity?.project_id || null;
          const activityId = activity?.id || null;

          const newActivityObj = {
            user_id: userId,
            title: habit.name,
            project_id: projectId,
            activity_id: activityId,
            atividade_avulsa: null,
            habit_id: habit.id,
            scheduled_date: scheduledDate,
            scheduled_time: habit.recurrence_time || '09:00',
            duration_minutes: habit.minutes_per_session || 30,
            status: 'pending' as const,
            tasks: [],
            notes: `Gerado automaticamente para o hábito recorrente: ${habit.name}`
          };

          const { data: inserted, error: insertErr } = await supabase
            .from('scheduled_activities')
            .insert(newActivityObj)
            .select()
            .single();

          if (insertErr) {
            console.error('Error auto-generating scheduled activity for habit:', insertErr);
            continue;
          }

          if (inserted) {
            newScheduledActivities.push(inserted);
            createdAny = true;
            createdForThisHabit = true;
          }
        }

        // Lock habit so we don't try to generate again for this week
        habit.last_generated_week = currentMondayStr;
        await supabase
          .from('habits')
          .update({ last_generated_week: currentMondayStr })
          .eq('id', habit.id);
      }

      if (createdAny) {
        set({ 
          scheduledActivities: newScheduledActivities,
          habits: updatedHabits
        });
      }
    } catch (err) {
      console.error('Error generating recurring habit instances:', err);
    }
  },

  addNote: async (userId, content, projectId, activityId) => {
    try {
      const { data, error } = await supabase
        .from('notes')
        .insert({
          user_id: userId,
          title: '',
          content: content,
          project_id: projectId || null,
          activity_id: activityId || null,
          target_date: getLocalDateString(new Date())
        })
        .select()
        .single();
      
      if (error) {
        console.error('Erro ao salvar anotação:', error);
        return null;
      }
      if (data) {
        set({ notes: [data, ...get().notes] });
        return data;
      }
      return null;
    } catch (err) {
      console.error('Erro crítico ao salvar anotação:', err);
      return null;
    }
  },

  addActivity: async (userId, name, projectId, habitId) => {
    try {
      const nameWithHabit = habitId ? `${name.trim()} #habit:${habitId}` : name.trim();
      const { data, error } = await supabase.from('activities').insert({ 
        user_id: userId, 
        name: nameWithHabit, 
        project_id: projectId || null 
      }).select().single();
      if (error) throw error;
      if (data) {
        const parts = data.name.split(' #habit:');
        const parsedData = {
          ...data,
          name: parts[0],
          habit_id: parts[1] || null
        };
        set({ activities: [parsedData, ...get().activities] });
        return parsedData;
      }
      return null;
    } catch (err) {
      console.error('Error adding activity:', err);
      return null;
    }
  },

  addSessionTask: async (sessionId, userId, description, completed = false) => {
    try {
      const { data, error } = await supabase
        .from('session_tasks')
        .insert({ session_id: sessionId, user_id: userId, description, completed })
        .select()
        .single();
      if (error) throw error;
      if (data) set({ sessionTasks: [...get().sessionTasks, data] });
      return data;
    } catch (err) {
      console.error('Erro ao adicionar tarefa:', err);
      return null;
    }
  },

  toggleSessionTask: async (taskId) => {
    try {
      const task = get().sessionTasks.find(t => t.id === taskId);
      if (!task) return;
      const { data, error } = await supabase
        .from('session_tasks')
        .update({ completed: !task.completed })
        .eq('id', taskId)
        .select()
        .single();
      if (error) throw error;
      if (data) set({ sessionTasks: get().sessionTasks.map(t => t.id === taskId ? data : t) });
    } catch (err) {
      console.error('Erro ao atualizar tarefa:', err);
    }
  },

  addSession: async (session) => {
    try {
      const timer = useTimerStore.getState();

      // Meta original configurada pelo usuário ao iniciar a sessão
      const duration_minutes = timer.totalDurationMs
        ? Math.round(timer.totalDurationMs / 60000)
        : session.duration_minutes;

      // Tempo real cronometrado até encerrar
      let actual_duration_minutes = session.actual_duration_minutes;
      if (actual_duration_minutes === null && timer.totalDurationMs) {
        const elapsedMs = timer.totalDurationMs - timer.getRemainingMs();
        actual_duration_minutes = Math.max(1, Math.round(elapsedMs / 60000));
      } else if (actual_duration_minutes !== null) {
        actual_duration_minutes = Math.max(1, Math.round(actual_duration_minutes));
      } else {
        actual_duration_minutes = duration_minutes;
      }

      // Uma sessão é marcada como parcial/incompleta se o tempo real realizado for menor que o planejado
      const isPartial = actual_duration_minutes < duration_minutes;
      const activityNameLimpo = (session.activity_name === "Sessão Sem Título" || !session.activity_name?.trim()) 
        ? null 
        : session.activity_name.trim();

      const sessionToSave = {
        ...session,
        duration_minutes,
        actual_duration_minutes,
        activity_name: activityNameLimpo,
        parcial: isPartial
      };

      const { data, error } = await supabase.from('focus_sessions').insert(sessionToSave).select().single();
      if (error) throw error;
      if (data) {
        set({ sessions: [data, ...get().sessions] });
        
        // Update habit stats if habit_id exists
        if (session.habit_id && session.user_id) {
          const habitId = session.habit_id;
          const userId = session.user_id;
          
          await get().syncHabitsRollover(userId);
          
          const habit = get().habits.find(h => h.id === habitId);
          if (habit) {
            const todayStr = getLocalDateString(new Date());
            const startOfWeek = new Date(habit.week_start_date);
            startOfWeek.setHours(0,0,0,0);

            // Fetch all sessions of this week for this habit, including the newly saved one
            const habitSessionsThisWeek = get().sessions.filter(s => 
              s.habit_id === habitId && 
              new Date(s.started_at) >= startOfWeek && 
              s.completed
            );

            // Group and sum minutes by day local string YYYY-MM-DD
            const minutesByDay: { [dateStr: string]: number } = {};
            habitSessionsThisWeek.forEach(s => {
              const dStr = getLocalDateString(new Date(s.started_at));
              const duration = s.actual_duration_minutes !== null ? s.actual_duration_minutes : s.duration_minutes;
              minutesByDay[dStr] = (minutesByDay[dStr] || 0) + duration;
            });

            // Recalculate completed sessions this week
            const completedDaysThisWeek = Object.keys(minutesByDay).filter(dStr => 
              minutesByDay[dStr] >= habit.minutes_per_session
            ).length;

            // Recalculate stats
            const totalMinutesAllTime = get().sessions
              .filter(s => s.habit_id === habitId && s.completed)
              .reduce((acc, s) => acc + (s.actual_duration_minutes !== null ? s.actual_duration_minutes : s.duration_minutes), 0);

            const totalDeepSessionsAllTime = get().sessions
              .filter(s => s.habit_id === habitId && s.completed).length;

            const minutesToday = minutesByDay[todayStr] || 0;

            // Insert habit_completion if meta achieved today and no completion exists yet
            if (minutesToday >= habit.minutes_per_session) {
              const hasCompletionToday = get().habitCompletions.some(hc => 
                hc.habit_id === habitId && 
                hc.completed_at.startsWith(todayStr)
              );

              if (!hasCompletionToday) {
                const { data: hcData } = await supabase.from('habit_completions').insert({
                  habit_id: habitId,
                  user_id: userId,
                  duration_minutes: minutesToday,
                  focus_session_id: data.id,
                  completed_at: new Date().toISOString()
                }).select().single();

                if (hcData) {
                  set({ habitCompletions: [hcData, ...get().habitCompletions] });
                }
              }
            }

            // Streak tracking: if completedDaysThisWeek reaches or exceeds target, update weekly streak if not already updated
            let weeklyStreak = habit.weekly_streak;
            if (completedDaysThisWeek >= habit.sessions_per_week && habit.sessions_this_week < habit.sessions_per_week) {
              weeklyStreak += 1;
            }

            // Update habit record dynamically in Supabase
            const { data: updatedHabit } = await supabase
              .from('habits')
              .update({
                sessions_this_week: completedDaysThisWeek,
                total_minutes: totalMinutesAllTime,
                deep_sessions_count: totalDeepSessionsAllTime,
                weekly_streak: weeklyStreak
              })
              .eq('id', habitId)
              .select()
              .single();

            if (updatedHabit) {
              set({ habits: get().habits.map(h => h.id === habitId ? updatedHabit : h) });
            }
          }
        }

        const currentProfile = get().profile;
        if (currentProfile) {
          const addedMinutes = data.actual_duration_minutes !== null ? data.actual_duration_minutes : data.duration_minutes;
          const newTotal = Number(currentProfile.total_focus_minutes) + addedMinutes;
          
          const today = getLocalDateString(new Date());
          const yesterday = getLocalYesterdayDateString(new Date());
          
          // Buscar todas as sessões para calcular streak
          const allSessions = get().sessions;
          
          // Verificar se já tinha sessão hoje antes dessa
          const hadSessionToday = allSessions
            .filter(s => s.id !== data.id) // excluir a que acabou de salvar
            .some(s => getLocalDateString(new Date(s.started_at)) === today);
          
          // Verificar se tinha sessão ontem
          const hadSessionYesterday = allSessions
            .some(s => getLocalDateString(new Date(s.started_at)) === yesterday);
          
          let newStreak = currentProfile.current_streak;
          
          if (!hadSessionToday) {
            // Primeira sessão do dia
            if (hadSessionYesterday || currentProfile.current_streak === 0) {
              // Tinha ontem ou é o primeiro dia → incrementa
              newStreak = currentProfile.current_streak + 1;
            } else {
              // Não tinha ontem → zera e começa do 1
              newStreak = 1;
            }
            
            // Salvar no Supabase
            await supabase
              .from('profiles')
              .update({ 
                total_focus_minutes: newTotal,
                current_streak: newStreak 
              })
              .eq('id', session.user_id);
              
            set({ profile: { 
              ...currentProfile, 
              total_focus_minutes: newTotal,
              current_streak: newStreak 
            }});
          } else {
            // Já tinha sessão hoje — só atualiza o total de minutos
            await supabase
              .from('profiles')
              .update({ total_focus_minutes: newTotal })
              .eq('id', session.user_id);
              
            set({ profile: { 
              ...currentProfile, 
              total_focus_minutes: newTotal 
            }});
          }
        }
        return data;
      }
      return null;
    } catch (err) {
      console.error('Error adding session:', err);
      return null;
    }
  },

  completeHabitSession: async (habitId, userId, durationMinutes, focusSessionId?) => {
    try {
      await get().syncHabitsRollover(userId);

      const habit = get().habits.find(h => h.id === habitId);
      if (!habit) return;

      const today = new Date();
      const todayStr = getLocalDateString(today);
      const startOfWeek = new Date(habit.week_start_date);
      startOfWeek.setHours(0,0,0,0);

      let finalFocusSessionId = focusSessionId || null;

      // If registered manually (no focusSessionId provided), let's create a real focus_session record first!
      if (!finalFocusSessionId) {
        const now = new Date();
        const startedAt = new Date(now.getTime() - durationMinutes * 60 * 1000).toISOString();
        const completedAt = now.toISOString();

        const sessionToSave = {
          user_id: userId,
          project_id: null,
          habit_id: habitId,
          activity_name: habit.name,
          description: 'Sessão de hábito registrada manualmente',
          duration_minutes: durationMinutes,
          started_at: startedAt,
          completed_at: completedAt,
          completed: true,
          all_tasks_completed: true,
          actual_duration_minutes: durationMinutes,
          parcial: false
        };

        const { data: sessionData, error: sErr } = await supabase
          .from('focus_sessions')
          .insert(sessionToSave)
          .select()
          .single();

        if (sErr) throw sErr;
        if (sessionData) {
          finalFocusSessionId = sessionData.id;
          // Add to local state immediately
          set({ sessions: [sessionData, ...get().sessions] });
        }
      }

      // Registrar completion using finalFocusSessionId
      const { data: hcData } = await supabase.from('habit_completions').insert({
        habit_id: habitId,
        user_id: userId,
        duration_minutes: durationMinutes,
        focus_session_id: finalFocusSessionId,
        completed_at: new Date().toISOString()
      }).select().single();

      if (hcData) {
        set({ habitCompletions: [hcData, ...get().habitCompletions] });
      }

      // Re-sum all weekly focus sessions + completions for this week to calculate sessions_this_week
      const habitSessionsThisWeek = get().sessions.filter(s => 
        s.habit_id === habitId && 
        new Date(s.started_at) >= startOfWeek && 
        s.completed
      );

      const minutesByDay: { [dateStr: string]: number } = {};
      habitSessionsThisWeek.forEach(s => {
        const dStr = getLocalDateString(new Date(s.started_at));
        const duration = s.actual_duration_minutes !== null ? s.actual_duration_minutes : s.duration_minutes;
        minutesByDay[dStr] = (minutesByDay[dStr] || 0) + duration;
      });

      // Also add any custom manual completions for this week that aren't tied to active focus sessions
      const manualCompletionsThisWeek = get().habitCompletions.filter(hc => 
        hc.habit_id === habitId && 
        new Date(hc.completed_at) >= startOfWeek && 
        !hc.focus_session_id
      );
      manualCompletionsThisWeek.forEach(hc => {
        const dStr = getLocalDateString(new Date(hc.completed_at));
        minutesByDay[dStr] = (minutesByDay[dStr] || 0) + hc.duration_minutes;
      });

      // Recalculate completed sessions this week
      const completedDaysThisWeek = Object.keys(minutesByDay).filter(dStr => 
        minutesByDay[dStr] >= habit.minutes_per_session
      ).length;

      const newTotal = habit.total_minutes + durationMinutes;
      const newSessions = habit.deep_sessions_count + 1;

      // Streak tracking: if completedDaysThisWeek reaches or exceeds target, update weekly streak if not already updated
      let weeklyStreak = habit.weekly_streak;
      if (completedDaysThisWeek >= habit.sessions_per_week && habit.sessions_this_week < habit.sessions_per_week) {
        weeklyStreak += 1;
      }

      const { data, error } = await supabase.from('habits').update({
        total_minutes: newTotal,
        deep_sessions_count: newSessions,
        sessions_this_week: completedDaysThisWeek,
        weekly_streak: weeklyStreak
      }).eq('id', habitId).select().single();

      if (error) throw error;
      if (data) {
        set({ habits: get().habits.map(h => h.id === habitId ? data : h) });
      }
    } catch (err) {
      console.error('Error completing habit session:', err);
    }
  },

  deleteNote: async (id) => {
    try {
      const { error } = await supabase.from('notes').delete().eq('id', id);
      if (error) throw error;
      set({ notes: get().notes.filter(n => n.id !== id) });
    } catch (err) {
      console.error('Erro ao deletar anotação:', err);
    }
  },

  updateNote: async (id, content) => {
    try {
      const { error } = await supabase
        .from('notes')
        .update({ content })
        .eq('id', id);
      if (error) throw error;
      set({
        notes: get().notes.map(n => n.id === id ? { ...n, content } : n)
      });
      return true;
    } catch (err) {
      console.error('Erro ao atualizar anotação:', err);
      return false;
    }
  },

  deleteSession: async (id) => {
    try {
      const { error } = await supabase.from('focus_sessions').delete().eq('id', id);
      if (error) throw error;
      set({ sessions: get().sessions.filter(s => s.id !== id) });
    } catch (err) {
      console.error('Error deleting session:', err);
    }
  },

  updateSession: async (id, updates) => {
    try {
      const { data, error } = await supabase
        .from('focus_sessions')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      if (data) {
        set({ 
          sessions: get().sessions.map(s => s.id === id ? data : s) 
        });
      }
    } catch (err) {
      console.error('Error updating session:', err);
    }
  },

  updateSessionTaskDescription: async (taskId, description) => {
    try {
      const { data, error } = await supabase
        .from('session_tasks')
        .update({ description })
        .eq('id', taskId)
        .select()
        .single();
      if (error) throw error;
      if (data) {
        set({
          sessionTasks: get().sessionTasks.map(t => t.id === taskId ? data : t)
        });
      }
    } catch (err) {
      console.error('Error updating session task description:', err);
    }
  },

  deleteSessionTask: async (taskId) => {
    try {
      const { error } = await supabase
        .from('session_tasks')
        .delete()
        .eq('id', taskId);
      if (error) throw error;
      set({
        sessionTasks: get().sessionTasks.filter(t => t.id !== taskId)
      });
    } catch (err) {
      console.error('Error deleting session task:', err);
    }
  },

  deleteProject: async (id) => {
    try {
      const { error } = await supabase.from('projects').delete().eq('id', id);
      if (error) throw error;
      set({ projects: get().projects.filter(p => p.id !== id) });
    } catch (err) {
      console.error('Error deleting project:', err);
    }
  },

  deleteActivity: async (id) => {
    try {
      const { error } = await supabase.from('activities').delete().eq('id', id);
      if (error) throw error;
      set({ activities: get().activities.filter(a => a.id !== id) });
    } catch (err) {
      console.error('Error deleting activity:', err);
    }
  },

  deleteHabit: async (id) => {
    try {
      const todayStr = getLocalDateString(new Date());
      
      // Selectively find future pending scheduled activities for this habit
      const futurePendingToDel = get().scheduledActivities.filter(sa => 
        sa.habit_id === id && sa.status === 'pending' && sa.scheduled_date >= todayStr
      );
      
      const idsToDelete = futurePendingToDel.map(sa => sa.id);
      if (idsToDelete.length > 0) {
        await supabase.from('scheduled_activities').delete().in('id', idsToDelete);
      }

      // Delete the habit in Supabase (foreign keys on delete set null will handle history)
      const { error } = await supabase.from('habits').delete().eq('id', id);
      if (error) throw error;

      set({ 
        habits: get().habits.filter(h => h.id !== id),
        scheduledActivities: get().scheduledActivities.filter(sa => !idsToDelete.includes(sa.id))
      });
    } catch (err) {
      console.error('Error deleting habit:', err);
    }
  },

  completeFirstSession: () => {
    localStorage.setItem('dude-first-session-completed', 'true');
    set({ hasCompletedFirstSession: true });
  },

  addMoodEntry: async (userId, date, period, mood, energy) => {
    const tempId = crypto.randomUUID ? crypto.randomUUID() : 'mood-' + Math.random().toString(36).substring(2, 11);
    const newEntry: MoodEntry = {
      id: tempId,
      user_id: userId,
      date,
      period,
      mood,
      energy: energy || null,
      created_at: new Date().toISOString()
    };

    const updated = [newEntry, ...get().moodEntries];
    set({ moodEntries: updated });
    try {
      localStorage.setItem('dude-mood-entries', JSON.stringify(updated));
    } catch (err) {
      console.error('Local Storage save mood error:', err);
    }

    try {
      const { data, error } = await supabase
        .from('mood_entries')
        .insert({
          user_id: userId,
          date,
          period,
          mood,
          energy: energy || null
        })
        .select()
        .single();
      
      if (error) throw error;
      if (data) {
        const finalEntries = get().moodEntries.map(m => m.id === tempId ? data : m);
        set({ moodEntries: finalEntries });
        try {
          localStorage.setItem('dude-mood-entries', JSON.stringify(finalEntries));
        } catch (err) {
          console.error('Local Storage update mood error:', err);
        }
        return data;
      }
    } catch (err) {
      console.warn('Supabase sync warning for mood entry (cached locally only):', err);
    }
    return newEntry;
  },

  addDailyShutdown: async (userId, date, status) => {
    const tempId = crypto.randomUUID ? crypto.randomUUID() : 'shutdown-' + Math.random().toString(36).substring(2, 11);
    const newEntry: DailyShutdown = {
      id: tempId,
      user_id: userId,
      date,
      status,
      created_at: new Date().toISOString()
    };

    const existing = get().dailyShutdowns.filter(d => d.date !== date);
    const updated = [newEntry, ...existing];
    set({ dailyShutdowns: updated });
    try {
      localStorage.setItem('dude-daily-shutdowns', JSON.stringify(updated));
    } catch (err) {
      console.error('Local Storage save shutdown error:', err);
    }

    try {
      await supabase.from('day_closures').upsert({
        user_id: userId,
        closure_date: date,
        closed_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,closure_date'
      });
    } catch (err) {
      console.warn('Supabase sync warning for day_closures table:', err);
    }

    try {
      await supabase.from('daily_shutdowns').delete().eq('user_id', userId).eq('date', date);
      const { data, error } = await supabase
        .from('daily_shutdowns')
        .insert({
          user_id: userId,
          date,
          status
        })
        .select()
        .single();
      
      if (error) throw error;
      if (data) {
        const finalEntries = get().dailyShutdowns.map(d => d.id === tempId ? data : d);
        set({ dailyShutdowns: finalEntries });
        try {
          localStorage.setItem('dude-daily-shutdowns', JSON.stringify(finalEntries));
        } catch (err) {
          console.error('Local Storage update shutdowns error:', err);
        }
        return data;
      }
    } catch (err) {
      console.warn('Supabase sync warning for daily shutdown (cached locally only):', err);
    }
    return newEntry;
  },

  fetchLinks: async (userId) => {
    try {
      const { data, error } = await supabase
        .from('saved_links')
        .select('*')
        .eq('user_id', userId)
        .order('access_count', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      set({ savedLinks: data || [] });
    } catch (err) {
      console.error('Error in fetchLinks:', err);
    }
  },

  addLink: async (userId, { title, url, projectId, habitId }) => {
    try {
      let normalizedUrl = url.trim();
      if (!/^https?:\/\//i.test(normalizedUrl)) {
        normalizedUrl = 'https://' + normalizedUrl;
      }

      const { data, error } = await supabase
        .from('saved_links')
        .insert({
          user_id: userId,
          title: title.trim(),
          url: normalizedUrl,
          project_id: projectId || null,
          habit_id: habitId || null,
          access_count: 0
        })
        .select()
        .single();

      if (error) throw error;
      if (data) {
        set({ savedLinks: [data, ...get().savedLinks] });
        get().showNotification('✅ Link salvo com sucesso!');
        return data;
      }
    } catch (err: any) {
      console.error('Error in addLink:', err);
      get().showNotification(`Erro ao salvar link: ${err?.message || err}`, 'error');
    }
    return null;
  },

  updateLink: async (linkId, { title, url, projectId, habitId }) => {
    try {
      let normalizedUrl = url.trim();
      if (!/^https?:\/\//i.test(normalizedUrl)) {
        normalizedUrl = 'https://' + normalizedUrl;
      }

      const { data, error } = await supabase
        .from('saved_links')
        .update({
          title: title.trim(),
          url: normalizedUrl,
          project_id: projectId || null,
          habit_id: habitId || null
        })
        .eq('id', linkId)
        .select()
        .single();

      if (error) throw error;
      if (data) {
        const updated = get().savedLinks.map(l => l.id === linkId ? data : l);
        set({ savedLinks: updated });
        get().showNotification('✅ Link atualizado com sucesso!');
        return true;
      }
    } catch (err: any) {
      console.error('Error in updateLink:', err);
      get().showNotification(`Erro ao atualizar link: ${err?.message || err}`, 'error');
    }
    return false;
  },

  deleteLink: async (linkId) => {
    try {
      const { error } = await supabase
        .from('saved_links')
        .delete()
        .eq('id', linkId);

      if (error) throw error;
      set({ savedLinks: get().savedLinks.filter(l => l.id !== linkId) });
      get().showNotification('✅ Link removido!');
      return true;
    } catch (err: any) {
      console.error('Error in deleteLink:', err);
      get().showNotification(`Erro ao excluir link: ${err?.message || err}`, 'error');
      return false;
    }
  },

  registerLinkAccess: async (linkId) => {
    try {
      const link = get().savedLinks.find(l => l.id === linkId);
      if (!link) return;

      const newCount = link.access_count + 1;
      const nowStr = new Date().toISOString();

      const optimisticallyUpdated = get().savedLinks.map(l => 
        l.id === linkId 
          ? { ...l, access_count: newCount, last_accessed_at: nowStr } 
          : l
      );
      set({ savedLinks: optimisticallyUpdated });

      const { error } = await supabase
        .from('saved_links')
        .update({
          access_count: newCount,
          last_accessed_at: nowStr
        })
        .eq('id', linkId);

      if (error) throw error;
    } catch (err) {
      console.error('Error in registerLinkAccess:', err);
    }
  },

  fetchDailyTasks: async (userId) => {
    try {
      const { data, error } = await supabase.from('daily_tasks').select('*').eq('user_id', userId).order('created_at', { ascending: false });
      if (!error && data) {
        set({ dailyTasks: data });
        localStorage.setItem(`dude-daily-tasks-${userId}`, JSON.stringify(data));
      }
    } catch (err) {
      console.error('Error fetching daily tasks:', err);
    }
  },

  addDailyTask: async (task) => {
    const tempId = `task-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const tempTask: DailyTask = {
      id: tempId,
      created_at: new Date().toISOString(),
      ...task
    } as DailyTask;
    
    // Optimistic update
    const currentTasks = get().dailyTasks;
    const nextTasks = [tempTask, ...currentTasks];
    set({ dailyTasks: nextTasks });
    localStorage.setItem(`dude-daily-tasks-${task.user_id}`, JSON.stringify(nextTasks));

    try {
      const { data, error } = await supabase
        .from('daily_tasks')
        .insert({
          user_id: task.user_id,
          task_date: task.task_date,
          title: task.title,
          project_id: task.project_id,
          activity_id: task.activity_id,
          activity_avulsa: task.activity_avulsa,
          habit_id: task.habit_id,
          checklist: task.checklist,
          is_completed: task.is_completed,
          completed_at: task.completed_at,
          rolled_from_date: task.rolled_from_date
        })
        .select()
        .single();
      
      if (error) throw error;
      if (data) {
        const updated = get().dailyTasks.map(t => t.id === tempId ? data : t);
        set({ dailyTasks: updated });
        localStorage.setItem(`dude-daily-tasks-${task.user_id}`, JSON.stringify(updated));
        return data;
      }
      return tempTask;
    } catch (err) {
      console.warn('Supabase addDailyTask failed, keeping local-only version', err);
      return tempTask;
    }
  },

  updateDailyTask: async (id, updates) => {
    const currentTasks = get().dailyTasks;
    const taskObj = currentTasks.find(t => t.id === id);
    if (!taskObj) return false;

    const updatedTask = { ...taskObj, ...updates };
    const updatedTasks = currentTasks.map(t => t.id === id ? updatedTask : t);
    set({ dailyTasks: updatedTasks });
    localStorage.setItem(`dude-daily-tasks-${taskObj.user_id}`, JSON.stringify(updatedTasks));

    try {
      const { error } = await supabase
        .from('daily_tasks')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
      return true;
    } catch (err) {
      console.warn('Supabase updateDailyTask failed, kept local-only updates', err);
      return true;
    }
  },

  deleteDailyTask: async (id) => {
    const currentTasks = get().dailyTasks;
    const taskObj = currentTasks.find(t => t.id === id);
    if (!taskObj) return false;

    const updatedTasks = currentTasks.filter(t => t.id !== id);
    set({ dailyTasks: updatedTasks });
    localStorage.setItem(`dude-daily-tasks-${taskObj.user_id}`, JSON.stringify(updatedTasks));

    try {
      const { error } = await supabase
        .from('daily_tasks')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return true;
    } catch (err) {
      console.warn('Supabase deleteDailyTask failed, completed local-only deletion', err);
      return true;
    }
  },

  syncDailyTasksRollover: async (userId) => {
    try {
      const todayStr = getLocalDateString(new Date());
      const currentTasks = [...get().dailyTasks];
      let hasChanges = false;

      for (let i = 0; i < currentTasks.length; i++) {
        const task = currentTasks[i];
        if (task.task_date < todayStr && !task.is_completed) {
          const originalDate = task.rolled_from_date || task.task_date;
          task.task_date = todayStr;
          task.rolled_from_date = originalDate;
          
          hasChanges = true;
          
          await supabase
            .from('daily_tasks')
            .update({
              task_date: todayStr,
              rolled_from_date: originalDate
            })
            .eq('id', task.id);
        }
      }

      if (hasChanges) {
        set({ dailyTasks: currentTasks });
        localStorage.setItem(`dude-daily-tasks-${userId}`, JSON.stringify(currentTasks));
      }
    } catch (err) {
      console.error('Error syncing daily tasks rollover:', err);
    }
  }

}));
