import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { Project, Habit, FocusSession, Note, Profile, Activity, HabitCompletion, SessionTask } from '../types';

interface DataState {
  profile: Profile | null;
  projects: Project[];
  habits: Habit[];
  habitCompletions: HabitCompletion[];
  sessions: FocusSession[];
  notes: Note[];
  activities: Activity[];
  sessionTasks: SessionTask[];
  loading: boolean;
  hasCompletedFirstSession: boolean;
  
  fetchProfile: (userId: string) => Promise<void>;
  fetchData: (userId: string) => Promise<void>;
  fetchActivities: (userId: string) => Promise<void>;
  fetchHabitCompletions: (userId: string) => Promise<void>;
  fetchSessionTasks: (userId: string) => Promise<void>;
  
  addProject: (userId: string, name: string) => Promise<void>;
  addHabit: (userId: string, name: string, sessionsPerWeek: number, minutesPerSession: number, preferredTime: 'morning' | 'afternoon' | 'evening') => Promise<void>;
  addNote: (userId: string, content: string, projectId?: string, activityId?: string) => Promise<Note | null>;
  addSession: (session: Omit<FocusSession, 'id' | 'created_at'>) => Promise<FocusSession | null>;
  addActivity: (userId: string, name: string, projectId?: string) => Promise<void>;
  addSessionTask: (sessionId: string, userId: string, description: string, completed?: boolean) => Promise<SessionTask | null>;
  toggleSessionTask: (taskId: string) => Promise<void>;
  
  completeHabitSession: (habitId: string, userId: string, durationMinutes: number, focusSessionId?: string) => Promise<void>;
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
  habitCompletions: [],
  sessions: [],
  notes: [],
  activities: [],
  sessionTasks: [] as SessionTask[],
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
      const [p, h, s, n, a, hc] = await Promise.all([
        supabase.from('projects').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('habits').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('focus_sessions').select('*').eq('user_id', userId).order('started_at', { ascending: false }),
        supabase.from('notes').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('activities').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('habit_completions').select('*').eq('user_id', userId).order('completed_at', { ascending: false }),
      ]);

      set({ 
        projects: p.data || [], 
        habits: h.data || [], 
        sessions: s.data || [], 
        notes: n.data || [],
        activities: a.data || [],
        habitCompletions: hc.data || [],
        loading: false 
      });

      await get().fetchSessionTasks(userId);
    } catch (err) {
      console.error('Error fetching data:', err);
      set({ loading: false });
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

  fetchActivities: async (userId) => {
    try {
      const { data, error } = await supabase.from('activities').select('*').eq('user_id', userId).order('created_at', { ascending: false });
      if (error) throw error;
      if (data) set({ activities: data });
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

  addProject: async (userId, name) => {
    try {
      const { data, error } = await supabase.from('projects').insert({ user_id: userId, name }).select().single();
      if (error) throw error;
      if (data) set({ projects: [data, ...get().projects] });
    } catch (err) {
      console.error('Error adding project:', err);
    }
  },

  addHabit: async (userId, name, sessionsPerWeek, minutesPerSession, preferredTime) => {
    try {
      if (!name || !sessionsPerWeek || !minutesPerSession || !preferredTime) {
        console.error('addHabit: parâmetros inválidos', { name, sessionsPerWeek, minutesPerSession, preferredTime });
        return;
      }

      const today = new Date();
      const dayOfWeek = today.getDay();
      const monday = new Date(today);
      monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      const weekStart = monday.toISOString().split('T')[0];

      const { data, error } = await supabase.from('habits').insert({
        user_id: userId,
        name: name.trim(),
        sessions_per_week: sessionsPerWeek,
        minutes_per_session: minutesPerSession,
        preferred_time: preferredTime,
        weekly_streak: 0,
        sessions_this_week: 0,
        week_start_date: weekStart
      }).select().single();

      if (error) {
        console.error('Supabase error ao salvar hábito:', error);
        return;
      }
      if (data) {
        set({ habits: [data, ...get().habits] });
        console.log('Hábito salvo com sucesso:', data);
      }
    } catch (err) {
      console.error('Erro crítico ao salvar hábito:', err);
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
          target_date: new Date().toISOString().split('T')[0]
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
      const isPartial = session.actual_duration_minutes !== null ? (session.actual_duration_minutes < session.duration_minutes) : false;
      const activityNameLimpo = (session.activity_name === "Sessão Sem Título" || !session.activity_name?.trim()) 
        ? null 
        : session.activity_name.trim();

      const sessionToSave = {
        ...session,
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
          const habit = get().habits.find(h => h.id === habitId);
          if (habit) {
            const todayStr = new Date().toLocaleDateString('en-CA');
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
              const dStr = new Date(s.started_at).toLocaleDateString('en-CA');
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
          const addedMinutes = session.actual_duration_minutes !== null ? session.actual_duration_minutes : session.duration_minutes;
          const newTotal = Number(currentProfile.total_focus_minutes) + addedMinutes;
          
          const today = new Date().toISOString().split('T')[0];
          const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
          
          // Buscar todas as sessões para calcular streak
          const allSessions = get().sessions;
          
          // Verificar se já tinha sessão hoje antes dessa
          const hadSessionToday = allSessions
            .filter(s => s.id !== data.id) // excluir a que acabou de salvar
            .some(s => s.started_at.startsWith(today));
          
          // Verificar se tinha sessão ontem
          const hadSessionYesterday = allSessions
            .some(s => s.started_at.startsWith(yesterday));
          
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
      const habit = get().habits.find(h => h.id === habitId);
      if (!habit) return;

      const today = new Date();
      const todayStr = today.toLocaleDateString('en-CA');
      const startOfWeek = new Date(habit.week_start_date);
      startOfWeek.setHours(0,0,0,0);

      // Registrar completion
      const { data: hcData } = await supabase.from('habit_completions').insert({
        habit_id: habitId,
        user_id: userId,
        duration_minutes: durationMinutes,
        focus_session_id: focusSessionId || null,
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
        const dStr = new Date(s.started_at).toLocaleDateString('en-CA');
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
        const dStr = new Date(hc.completed_at).toLocaleDateString('en-CA');
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
