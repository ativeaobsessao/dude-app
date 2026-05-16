import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { Project, Habit, FocusSession, Note, Profile, Activity } from '../types';

interface DataState {
  profile: Profile | null;
  projects: Project[];
  habits: Habit[];
  sessions: FocusSession[];
  notes: Note[];
  activities: Activity[];
  loading: boolean;
  hasCompletedFirstSession: boolean;
  
  fetchProfile: (userId: string) => Promise<void>;
  fetchData: (userId: string) => Promise<void>;
  fetchActivities: (userId: string) => Promise<void>;
  
  addProject: (userId: string, name: string) => Promise<void>;
  addHabit: (userId: string, name: string) => Promise<void>;
  addNote: (userId: string, title: string | null, content: string, projectId?: string, activityId?: string, targetDate?: string) => Promise<void>;
  addSession: (session: Omit<FocusSession, 'id' | 'created_at'>) => Promise<void>;
  addActivity: (userId: string, name: string, projectId?: string) => Promise<void>;
  
  toggleHabitComplete: (habit: Habit) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  deleteActivity: (id: string) => Promise<void>;
  deleteHabit: (id: string) => Promise<void>;
  completeFirstSession: () => void;
}

export const useDataStore = create<DataState>((set, get) => ({
  profile: null,
  projects: [],
  habits: [],
  sessions: [],
  notes: [],
  activities: [],
  loading: false,
  hasCompletedFirstSession: localStorage.getItem('dude-first-session-completed') === 'true',

  fetchProfile: async (userId) => {
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (error) throw error;
      if (data) set({ profile: data });
    } catch (err) {
      console.error('Error fetching profile:', err);
    }
  },

  fetchData: async (userId) => {
    try {
      set({ loading: true });
      const [p, h, s, n, a] = await Promise.all([
        supabase.from('projects').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('habits').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('focus_sessions').select('*').eq('user_id', userId).order('started_at', { ascending: false }),
        supabase.from('notes').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('activities').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      ]);

      set({ 
        projects: p.data || [], 
        habits: h.data || [], 
        sessions: s.data || [], 
        notes: n.data || [],
        activities: a.data || [],
        loading: false 
      });
    } catch (err) {
      console.error('Error fetching data:', err);
      set({ loading: false });
    }
  },

  fetchActivities: async (userId) => {
    try {
      const { data, error } = await supabase.from('activities').select('*').eq('user_id', userId).order('created_at', { ascending: false });
      if (error) throw error;
      if (data) set({ activities: data });
    } catch (err) {
      console.error('Error fetching activities:', err);
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

  addHabit: async (userId, name) => {
    try {
      const { data, error } = await supabase.from('habits').insert({ user_id: userId, name }).select().single();
      if (error) throw error;
      if (data) set({ habits: [data, ...get().habits] });
    } catch (err) {
      console.error('Error adding habit:', err);
    }
  },

  addNote: async (userId, title, content, projectId, activityId, targetDate) => {
    try {
      const { data, error } = await supabase.from('notes').insert({ 
        user_id: userId, 
        title: title || null, 
        content, 
        project_id: projectId || null,
        activity_id: activityId || null,
        target_date: targetDate || new Date().toISOString().split('T')[0]
      }).select().single();
      if (error) throw error;
      if (data) set({ notes: [data, ...get().notes] });
    } catch (err) {
      console.error('Error adding note:', err);
    }
  },

  addActivity: async (userId, name, projectId) => {
    try {
      const { data, error } = await supabase.from('activities').insert({ 
        user_id: userId, 
        name, 
        project_id: projectId || null 
      }).select().single();
      if (error) throw error;
      if (data) set({ activities: [data, ...get().activities] });
    } catch (err) {
      console.error('Error adding activity:', err);
    }
  },

  addSession: async (session) => {
    try {
      const { data, error } = await supabase.from('focus_sessions').insert(session).select().single();
      if (error) throw error;
      if (data) {
        set({ sessions: [data, ...get().sessions] });
        
        // Update habit stats if habit_id exists
        if (session.habit_id) {
          const habit = get().habits.find(h => h.id === session.habit_id);
          if (habit) {
            await supabase.from('habits').update({
              total_minutes: habit.total_minutes + session.duration_minutes,
              deep_sessions_count: habit.deep_sessions_count + 1
            }).eq('id', habit.id);
            set({
              habits: get().habits.map(h => h.id === habit.id ? {
                ...h,
                total_minutes: h.total_minutes + session.duration_minutes,
                deep_sessions_count: h.deep_sessions_count + 1
              } : h)
            });
          }
        }

        const currentProfile = get().profile;
        if (currentProfile) {
          const newTotal = Number(currentProfile.total_focus_minutes) + session.duration_minutes;
          await supabase.from('profiles').update({ total_focus_minutes: newTotal }).eq('id', session.user_id);
          set({ profile: { ...currentProfile, total_focus_minutes: newTotal } });
        }
      }
    } catch (err) {
      console.error('Error adding session:', err);
    }
  },

  toggleHabitComplete: async (habit) => {
    try {
      const newValue = !habit.completed_today;
      const streakMod = newValue ? 1 : -1;
      const { data, error } = await supabase.from('habits').update({ 
        completed_today: newValue,
        current_streak: Math.max(0, habit.current_streak + streakMod)
      }).eq('id', habit.id).select().single();
      
      if (error) throw error;
      if (data) {
        set({ habits: get().habits.map(h => h.id === habit.id ? data : h) });
      }
    } catch (err) {
      console.error('Error toggling habit:', err);
    }
  },

  deleteNote: async (id) => {
    try {
      const { error } = await supabase.from('notes').delete().eq('id', id);
      if (error) throw error;
      set({ notes: get().notes.filter(n => n.id !== id) });
    } catch (err) {
      console.error('Error deleting note:', err);
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
      const { error } = await supabase.from('habits').delete().eq('id', id);
      if (error) throw error;
      set({ habits: get().habits.filter(h => h.id !== id) });
    } catch (err) {
      console.error('Error deleting habit:', err);
    }
  },

  completeFirstSession: () => {
    localStorage.setItem('dude-first-session-completed', 'true');
    set({ hasCompletedFirstSession: true });
  }
}));
