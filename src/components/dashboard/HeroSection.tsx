import { useShallow } from 'zustand/react/shallow';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useMemo, useEffect, useRef } from 'react';
import { useTimerStore } from '../../store/useTimerStore';
import { useDataStore } from '../../store/useDataStore';
import { usePWA } from '../../context/PWAContext';
import { Moon, X, Calendar, Shield, Bell, Brain, Hand, Flame, CheckCircle2, Settings, RotateCcw } from 'lucide-react';
import { resolverNomeSessao, formatSessionDuration, formatTimeRange, getLocalDateString } from '../../lib/utils';

import { calculateAvoidanceMetrics, getAvoidanceActiveWeekdays, isTimeWindowAvoidance, normalizeAvoidanceStatus } from '../../lib/avoidanceMetrics';
import { DailyReopenModal } from './DailyReopenModal';
import { Habit, AvoidanceCheckin } from '../../types';
import { playScheduleSound } from '../../hooks/useSessionNotifications';
import { useAgendaAlertEngine } from '../../hooks/useAgendaAlertEngine';
import { AntiVicioModal } from './AntiVicioModal';
import { InboxCaptures } from './InboxCaptures';

interface HeroSectionProps {
  tasks?: any[];
  onNavigateToLists?: () => void;
}

export const HeroSection = ({ tasks = [], onNavigateToLists }: HeroSectionProps) => {
  const timer = useTimerStore();
  const dataStore = useDataStore(useShallow(state => ({
    addAvoidanceCheckin: state.addAvoidanceCheckin,
    avoidanceCheckins: state.avoidanceCheckins,
    currentEnergyState: state.currentEnergyState,
    dailyShutdowns: state.dailyShutdowns,
    dailyTasks: state.dailyTasks,
    deleteDailyShutdown: state.deleteDailyShutdown,
    habitCompletions: state.habitCompletions,
    habits: state.habits,
    initialFetchDone: state.initialFetchDone,
    profile: state.profile,
    projects: state.projects,
    scheduledActivities: state.scheduledActivities,
    sessions: state.sessions,
    showNotification: state.showNotification,
    updateAvoidanceCheckin: state.updateAvoidanceCheckin,
    updateDailyGoal: state.updateDailyGoal
  })));
  
  const [isAntiVicioOpen, setIsAntiVicioOpen] = useState(false);
  const [antiVicioHabitId, setAntiVicioHabitId] = useState<string | undefined>(undefined);
  const [antiVicioCheckinId, setAntiVicioCheckinId] = useState<string | undefined>(undefined);
  const [isAntiVicioVictory, setIsAntiVicioVictory] = useState(false);
  
  const firstName = dataStore.profile?.full_name?.split(' ')[0] || 'Gustavo';

  // Greeting Logic
  const [isEditingGoal, setIsEditingGoal] = useState(false);

  // PWA Install hook context
  const { isInstalled, isInitialized, isDismissedPeriod, installApp } = usePWA();

  const [dismissedAntiVicioKeys, setDismissedAntiVicioKeys] = useState<string[]>(() => {
    try {
      const saved = sessionStorage.getItem('dude_dismissed_anti_vicio_keys');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const dismissAntiVicio = (habitId: string, windowLabel: string, promptIndex = 1) => {
    const key = `${habitId}:${windowLabel}:${promptIndex}`;
    setDismissedAntiVicioKeys(prev => {
      const next = prev.includes(key) ? prev : [...prev, key];
      sessionStorage.setItem('dude_dismissed_anti_vicio_keys', JSON.stringify(next));
      return next;
    });
  };

  const { alertSchedule, dismissSchedule } = useAgendaAlertEngine();
  const [dismissedEnergyCard, setDismissedEnergyCard] = useState(false);

  // When energy state changes, reset dismiss state
  useEffect(() => {
    setDismissedEnergyCard(false);
  }, [dataStore.currentEnergyState]);

  // TRANSIENT ALERT BANNER LIFECYCLE
  // Trigger alarm sounds for overdue or imminent focal blocks on mount/foreground
  const playedSoundScheduleIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (alertSchedule && alertSchedule.activity.id !== playedSoundScheduleIdRef.current) {
      playedSoundScheduleIdRef.current = alertSchedule.activity.id;
      const type = alertSchedule.isOverdue ? 'overdue' : 'start';
      playScheduleSound(type).catch(err => console.warn('Failed to play alarm chime:', err));
    } else if (!alertSchedule) {
      playedSoundScheduleIdRef.current = null;
    }
  }, [alertSchedule]);

  const hour = new Date().getHours();
  let greeting = 'Boa noite';
  if (hour >= 5 && hour < 12) greeting = 'Bom dia';
  else if (hour >= 12 && hour < 18) greeting = 'Boa tarde';

  // Date Logic
  const dateObj = new Date();
  const weekdayShort = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(dateObj).toUpperCase().replace('.', '');
  const dayNum = dateObj.getDate();
  const monthLong = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(dateObj).toUpperCase();
  const fullCustomDate = `${weekdayShort}, ${dayNum} DE ${monthLong}`;

  // Daily Metrics
  const today = getLocalDateString(new Date());

  const [forceRenderCount, setForceRenderCount] = useState(0);
  const [showReopenModal, setShowReopenModal] = useState(false);

  useEffect(() => {
    const handleReset = () => setForceRenderCount(c => c + 1);
    window.addEventListener('reset-daily-circle', handleReset);
    return () => window.removeEventListener('reset-daily-circle', handleReset);
  }, []);

  const isDayClosed = useMemo(() => {
    return dataStore.dailyShutdowns.some(d => d.date === today && d.status === 'completed');
  }, [today, dataStore.dailyShutdowns, forceRenderCount]);

  const handleReopenDay = async () => {
    const { supabase } = await import('../../lib/supabase');
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await dataStore.deleteDailyShutdown(user.id, today);
    }
    
    setShowReopenModal(false);
    setForceRenderCount(c => c + 1);
    window.dispatchEvent(new CustomEvent('reload-tasks'));
    window.dispatchEvent(new CustomEvent('reset-daily-circle'));
  };

  // DUDE BUG 3 FIX: Compute a unified, deduplicated list of today's planned tasks
  // (combining daily tasks, database scheduled activities, and virtual scheduled habits).
  const { completedTasksCount, totalTasksCount } = useMemo(() => {
    const todayStr = getLocalDateString(new Date());

    const tTasks = (dataStore.dailyTasks || []).filter(t => t.task_date === todayStr);
    const tSchedules = (dataStore.scheduledActivities || []).filter(sa => sa.scheduled_date === todayStr);

    const todayObj = new Date();
    let dayOfWeek = todayObj.getDay();
    if (dayOfWeek === 0) dayOfWeek = 7;
    const dayOfWeekStr = String(dayOfWeek);

    // 1. Map Daily Tasks
    const dbDailyTasks = tTasks.map(t => ({
      id: `task-${t.id}`,
      type: 'daily_task' as const,
      habit_id: t.habit_id || null,
      is_completed: t.is_completed,
      title: t.title,
    }));

    // 2. Map Database Scheduled Activities, filtering out cancelled/expired ones unless completed
    const dbSchedules = tSchedules
      .filter(sa => {
        const isCompleted = sa.status === 'completed' || sa.status === 'concluida';
        const isCancelled = sa.status === 'cancelled' || sa.status === 'cancelada' || sa.status === 'expirada';
        return !isCancelled || isCompleted;
      })
      .map(sa => ({
        id: `schedule-${sa.id}`,
        type: 'schedule' as const,
        habit_id: sa.habit_id || null,
        is_completed: sa.status === 'completed' || sa.status === 'concluida',
        title: sa.title || sa.atividade_avulsa || 'Sessão Profunda Ocasional',
      }));

    // 3. Map Virtual Scheduled Habits for today (not materialized in scheduledActivities db table)
    const virtualHabits = (dataStore.habits || [])
      .filter(habit => {
        if (!habit.is_scheduled) return false;
        if (!habit.sched_start) return false;
        if (habit.sched_weekdays === 'all') return true;
        const days = (habit.sched_weekdays || '').split(',');
        return days.includes(dayOfWeekStr);
      })
      .map(habit => {
        const isCompleted = (dataStore.habitCompletions || []).some(hc => {
          if (hc.habit_id !== habit.id) return false;
          const compDateStr = getLocalDateString(new Date(hc.completed_at));
          return compDateStr === todayStr;
        });

        return {
          id: `virtual-${habit.id}`,
          type: 'habit_virtual' as const,
          habit_id: habit.id,
          is_completed: isCompleted,
          title: habit.name,
        };
      });

    // UNIFIED LIST TO DEDUPLICATE HABITS FOR TODAY
    // This solves the overlapping issue and double counting constraints cleanly.
    const finalItems: {
      id: string;
      type: 'daily_task' | 'schedule' | 'habit_virtual' | 'consolidated_habit';
      title: string;
      is_completed: boolean;
    }[] = [];

    // Occasional tasks (without an associated habit_id) are never deduplicated against each other
    dbDailyTasks.forEach(item => {
      if (!item.habit_id) {
        finalItems.push(item);
      }
    });

    dbSchedules.forEach(item => {
      if (!item.habit_id) {
        finalItems.push(item);
      }
    });

    // For tasks that are associated with a habit, we extract all unique active habit_ids today
    // across all possible representations: daily tasks, DB schedules, and virtual habits due today.
    const allHabitIds = new Set<string>();
    dbDailyTasks.forEach(item => { if (item.habit_id) allHabitIds.add(item.habit_id); });
    dbSchedules.forEach(item => { if (item.habit_id) allHabitIds.add(item.habit_id); });
    virtualHabits.forEach(item => { if (item.habit_id) allHabitIds.add(item.habit_id); });

    // Deduplication Engine of Habit + Day:
    // If multiple sources represent the same habit today, we consolidate it into a single task slot.
    // It is marked as completed if ANY source of truth (daily_task, database scheduled_activity,
    // virtual schedule completion, or raw habitCompletions database logs) lists it as resolved.
    allHabitIds.forEach(habitId => {
      const tasksOfHabit = dbDailyTasks.filter(t => t.habit_id === habitId);
      const schedulesOfHabit = dbSchedules.filter(s => s.habit_id === habitId);
      const virtualsOfHabit = virtualHabits.filter(v => v.habit_id === habitId);

      const hasCompletedDailyTask = tasksOfHabit.some(t => t.is_completed);
      const hasCompletedSchedule = schedulesOfHabit.some(s => s.is_completed);
      const hasCompletedVirtual = virtualsOfHabit.some(v => v.is_completed);

      const hasCompletedInDatabaseLogs = (dataStore.habitCompletions || []).some(hc => {
        if (hc.habit_id !== habitId) return false;
        const compDateStr = getLocalDateString(new Date(hc.completed_at));
        return compDateStr === todayStr;
      });

      const isCompleted = hasCompletedDailyTask || hasCompletedSchedule || hasCompletedVirtual || hasCompletedInDatabaseLogs;
      const title = tasksOfHabit[0]?.title || schedulesOfHabit[0]?.title || virtualsOfHabit[0]?.title || "Hábito Atômico";

      finalItems.push({
        id: `habit-con-${habitId}`,
        type: 'consolidated_habit',
        title,
        is_completed: isCompleted,
      });
    });

    return {
      completedTasksCount: finalItems.filter(item => item.is_completed).length,
      totalTasksCount: finalItems.length
    };
  }, [dataStore.dailyTasks, dataStore.scheduledActivities, dataStore.habits, dataStore.habitCompletions]);

  const todaySessions = dataStore.sessions.filter(s => s.started_at && getLocalDateString(new Date(s.started_at)) === today);
  const totalMinutes = todaySessions.reduce((acc, session) => {
    const trackedMinutes = session.actual_duration_minutes ?? (session.completed ? session.duration_minutes ?? 0 : 0);
    return acc + Math.max(0, trackedMinutes);
  }, 0);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const streak = useMemo(() => {
    const completedDates = new Set(
      dataStore.sessions
        .filter(session => session.completed && session.started_at)
        .map(session => getLocalDateString(new Date(session.started_at)))
    );
    if (completedDates.size === 0) return 0;

    const cursor = new Date(`${today}T12:00:00`);
    if (!completedDates.has(today)) cursor.setDate(cursor.getDate() - 1);

    let current = 0;
    while (completedDates.has(getLocalDateString(cursor))) {
      current += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return current;
  }, [dataStore.sessions, today]);

  const compactFocusTime = hours === 0
    ? `${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`
    : `${hours}h${minutes > 0 ? ` ${minutes}m` : ''}`;

  const todayFocusFormatted = hours === 0
    ? `${minutes} ${minutes === 1 ? 'minuto registrado' : 'minutos registrados'}`
    : `${hours}h ${minutes}m registrados`;

  const hasSessions = dataStore.sessions && dataStore.sessions.length > 0;

  const formatCompact = (totalMins: number) => {
    const h = Math.floor(totalMins / 60);
    const m = Math.round(totalMins % 60);
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  const todayMinutesToShow = isDayClosed ? 0 : totalMinutes;
  const todaySessionsCount = isDayClosed ? 0 : todaySessions.length;

  const averageData = useMemo(() => {
    const map: { [key: string]: number } = {};
    dataStore.sessions.forEach(s => {
      if (!s.completed || !s.started_at) return;
      const sDate = getLocalDateString(new Date(s.started_at));
      const mins = s.actual_duration_minutes ?? s.duration_minutes ?? 0;
      map[sDate] = (map[sDate] || 0) + mins;
    });

    const activeDates = Object.keys(map).filter(d => map[d] > 0);
    const activeDatesCount = activeDates.length;

    const otherActiveDates = activeDates.filter(d => d !== today);
    let avg = 0;
    if (otherActiveDates.length > 0) {
      const sum = otherActiveDates.reduce((acc, d) => acc + map[d], 0);
      avg = Math.round(sum / otherActiveDates.length);
    } else if (activeDatesCount > 0) {
      const sum = activeDates.reduce((acc, d) => acc + map[d], 0);
      avg = Math.round(sum / activeDatesCount);
    }

    const otherDaysMins = otherActiveDates.map(d => map[d]);
    const record = otherDaysMins.length > 0 ? Math.max(...otherDaysMins) : 0;

    return {
      averageMinutes: avg,
      personalRecord: record,
      hasEnoughHistory: avg > 0
    };
  }, [dataStore.sessions, today]);

  // SOURCE OF TRUTH FOR THE DAILY FOCUS GOAL (MANUAL GOAL / CACHED GOAL)
  const userGoal = dataStore.profile?.daily_goal_minutes;

  const targetMinutes = useMemo(() => {
    if (userGoal !== undefined && userGoal !== null && userGoal > 0) {
      return userGoal;
    }
    const saved = localStorage.getItem('dude_daily_focus_goal');
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }
    // SMART DEFAULT: if the user has NEVER set a goal, initialize a suggested goal based on their recent
    // average (rounded to a friendly number, sensible floor), but from then on it's the user's manual goal.
    const avg = averageData.averageMinutes;
    if (avg && avg > 0) {
      return Math.max(45, Math.round(avg / 15) * 15);
    }
    return 150; // Fallback default
  }, [userGoal, averageData.averageMinutes]);

  const hasEnoughHistory = targetMinutes > 0;

  const percent = targetMinutes > 0 ? Math.round((todayMinutesToShow / targetMinutes) * 100) : 0;
  const strokePercent = Math.min(100, percent);

  const [tempGoal, setTempGoal] = useState<number>(150);

  const [showSupportiveRelapseModal, setShowSupportiveRelapseModal] = useState(false);
  const [relapsedHabitName, setRelapsedHabitName] = useState('');
  const [animatingResistedHabitId, setAnimatingResistedHabitId] = useState<string | null>(null);

  const [showTriggerInputModal, setShowTriggerInputModal] = useState(false);
  const [relapsedCheckinId, setRelapsedCheckinId] = useState<string | null>(null);
  const [triggerNoteText, setTriggerNoteText] = useState('');
  const [relapseTriggerTag, setRelapseTriggerTag] = useState('');
  const [relapseEmotionTag, setRelapseEmotionTag] = useState('');
  const [relapseEnvironmentTag, setRelapseEnvironmentTag] = useState('');
  const [relapsePrecedingActivity, setRelapsePrecedingActivity] = useState('');
  const [relapseUrgeIntensity, setRelapseUrgeIntensity] = useState(5);

  const [showCheckinModal, setShowCheckinModal] = useState(false);

  // Atualiza a avaliação dos horários sem depender de outras mudanças na tela.
  const [clockNow, setClockNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setClockNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const [cooldownsVal, setCooldownsVal] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('dude_antivicio_cooldowns');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [snoozesVal, setSnoozesVal] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('dude_antivicio_snoozes');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const registerCooldown = (promptKey: string) => {
    const updated = { ...cooldownsVal, [promptKey]: Date.now() };
    setCooldownsVal(updated);
    try {
      localStorage.setItem('dude_antivicio_cooldowns', JSON.stringify(updated));
    } catch (error) {
      console.warn('Não foi possível salvar o intervalo do lembrete.', error);
    }
  };

  const registerSnooze = (promptKey: string) => {
    const updated = { ...snoozesVal, [promptKey]: Date.now() + 2 * 60 * 60 * 1000 };
    setSnoozesVal(updated);
    try {
      localStorage.setItem('dude_antivicio_snoozes', JSON.stringify(updated));
    } catch (error) {
      console.warn('Não foi possível adiar o lembrete.', error);
    }
  };

  const playVictorySound = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      
      const playTone = (freq: number, start: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        
        gainNode.gain.setValueAtTime(0.12, start);
        gainNode.gain.exponentialRampToValueAtTime(0.001, start + duration);
        
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        osc.start(start);
        osc.stop(start + duration);
      };
      
      const nowTime = ctx.currentTime;
      playTone(523.25, nowTime, 0.18); // C5
      playTone(659.25, nowTime + 0.08, 0.18); // E5
      playTone(783.99, nowTime + 0.16, 0.18); // G5
      playTone(1046.50, nowTime + 0.24, 0.35); // C6
      setTimeout(() => { if (ctx.state !== 'closed') ctx.close().catch(() => {}); }, 750);
    } catch (e) {
      console.error('Failed to play victory sound', e);
    }
  };

  const pendingAvoidanceHabits = useMemo(() => {
    const avoidHabits = dataStore.habits.filter(habit => habit.habit_mode === 'avoid');
    if (avoidHabits.length === 0 || !dataStore.profile?.id) return [];

    const now = new Date(clockNow);
    const nowTime = now.getTime();
    const todayStr = getLocalDateString(now);
    const currentHour = now.getHours();
    const results: Array<{
      habit: Habit;
      windowLabel: string;
      checkinPeriod: string;
      promptIndex: number;
      checkinDate: string;
    }> = [];

    for (const habit of avoidHabits) {
      const isWindow = isTimeWindowAvoidance(habit);
      const cooldownHours = isWindow ? 4 : 3;
      const activeWeekdays = getAvoidanceActiveWeekdays(habit);
      const intensity = habit.avoidance_checkin_intensity || 'balanced';

      const addIfPending = (
        windowLabel: string,
        checkinPeriod: string,
        checkinDate: string,
        requiredCount: number,
        slotIndex?: number
      ) => {
        const related = dataStore.avoidanceCheckins.filter(checkin => {
          if (checkin.habit_id !== habit.id) return false;
          if (checkin.window_label === windowLabel) return true;
          // Compatibility with records created before each monitoring slot had its own label.
          const sameDate = checkin.checkin_date?.slice(0, 10) === checkinDate;
          const legacyFullDayLabel = checkin.window_label === checkinDate && checkin.checkin_period === checkinPeriod;
          return legacyFullDayLabel || (!checkin.window_label && sameDate && checkin.checkin_period === checkinPeriod);
        });

        const definitive = related.filter(checkin => {
          const status = normalizeAvoidanceStatus(checkin.status);
          return status === 'success' || status === 'relapse';
        });
        // A relapse resolves the current monitoring unit. More prompts in that same
        // window would add noise rather than useful information.
        if (definitive.some(checkin => normalizeAvoidanceStatus(checkin.status) === 'relapse')) return;
        if (definitive.length >= requiredCount) return;

        const promptIndex = slotIndex ?? (definitive.length + 1);
        const promptKey = `${habit.id}:${windowLabel}:${promptIndex}`;
        const lastChecked = cooldownsVal[promptKey] || 0;
        if (nowTime < lastChecked + cooldownHours * 60 * 60 * 1000) return;

        const snoozeUntil = snoozesVal[promptKey] || 0;
        if (nowTime < snoozeUntil) return;

        const dismissedKey = `${habit.id}:${windowLabel}:${promptIndex}`;
        if (dismissedAntiVicioKeys.includes(dismissedKey)) return;

        const promptsShown = related.filter(checkin => normalizeAvoidanceStatus(checkin.status) === 'pending').length;
        if (promptsShown >= 3) return;

        results.push({
          habit,
          windowLabel,
          checkinPeriod,
          promptIndex,
          checkinDate
        });
      };

      if (!isWindow) {
        if (!activeWeekdays.includes(now.getDay())) continue;

        const slots = intensity === 'light'
          ? [{ period: 'afternoon', hour: 15 }]
          : intensity === 'strong'
            ? [
                { period: 'morning', hour: 10 },
                { period: 'afternoon', hour: 15 },
                { period: 'evening', hour: 20 }
              ]
            : [
                { period: 'morning', hour: 11 },
                { period: 'evening', hour: 19 }
              ];

        for (const slot of slots) {
          if (currentHour < slot.hour) continue;
          const windowLabel = `${todayStr}:${slot.period}`;
          addIfPending(windowLabel, slot.period, todayStr, 1, 1);
        }
        continue;
      }

      const startText = habit.monitor_start || habit.avoidance_window_start || '18:00';
      const endText = habit.monitor_end || habit.avoidance_window_end || '22:00';
      const [startHour, startMinute] = startText.split(':').map(Number);
      const [endHour, endMinute] = endText.split(':').map(Number);
      const startMinutes = startHour * 60 + startMinute;
      const endMinutes = endHour * 60 + endMinute;
      const validClock = (hour: number, minute: number) =>
        Number.isInteger(hour) && hour >= 0 && hour <= 23 &&
        Number.isInteger(minute) && minute >= 0 && minute <= 59;
      if (
        !validClock(startHour, startMinute) ||
        !validClock(endHour, endMinute) ||
        startMinutes === endMinutes
      ) continue;

      const todayStart = new Date(now);
      todayStart.setHours(startHour, startMinute, 0, 0);
      let windowStart: Date | null = null;
      let windowEnd: Date | null = null;

      if (endMinutes > startMinutes) {
        if (activeWeekdays.includes(now.getDay()) && nowTime >= todayStart.getTime()) {
          const candidateEnd = new Date(now);
          candidateEnd.setHours(endHour, endMinute, 0, 0);
          if (nowTime <= candidateEnd.getTime()) {
            windowStart = todayStart;
            windowEnd = candidateEnd;
          }
        }
      } else {
        const candidateTodayEnd = new Date(now);
        candidateTodayEnd.setHours(endHour, endMinute, 0, 0);
        if (activeWeekdays.includes(now.getDay()) && nowTime >= todayStart.getTime()) {
          const tomorrowEnd = new Date(candidateTodayEnd);
          tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
          windowStart = todayStart;
          windowEnd = tomorrowEnd;
        } else {
          const yesterdayStart = new Date(todayStart);
          yesterdayStart.setDate(yesterdayStart.getDate() - 1);
          if (
            activeWeekdays.includes(yesterdayStart.getDay()) &&
            nowTime <= candidateTodayEnd.getTime()
          ) {
            windowStart = yesterdayStart;
            windowEnd = candidateTodayEnd;
          }
        }
      }

      if (!windowStart || !windowEnd) continue;

      const windowDate = getLocalDateString(windowStart);
      const windowLabel = `${windowDate}:${startText}-${endText}`;
      const elapsed = nowTime - windowStart.getTime();
      const duration = windowEnd.getTime() - windowStart.getTime();
      let dueCount = 0;

      if (intensity === 'light') {
        if (elapsed >= duration * 0.5) dueCount = 1;
      } else if (intensity === 'strong') {
        if (elapsed >= duration * 0.25) dueCount = 1;
        if (elapsed >= duration * 0.5) dueCount = 2;
        if (elapsed >= duration * 0.75) dueCount = 3;
      } else {
        if (elapsed >= duration * 0.33) dueCount = 1;
        if (elapsed >= duration * 0.66) dueCount = 2;
      }

      if (dueCount > 0) {
        addIfPending(windowLabel, 'window', windowDate, dueCount);
      }
    }

    return results;
  }, [
    clockNow,
    dataStore.habits,
    dataStore.avoidanceCheckins,
    dataStore.profile,
    dismissedAntiVicioKeys,
    cooldownsVal,
    snoozesVal
  ]);

  const avoidHabits = useMemo(() => {
    return dataStore.habits.filter(h => h.habit_mode === 'avoid');
  }, [dataStore.habits]);

  const buildHabits = useMemo(() => {
    return dataStore.habits.filter(h => h.habit_mode === 'build' || !h.habit_mode);
  }, [dataStore.habits]);

  const hasAvoidance = useMemo(() => {
    return avoidHabits.length >= 1;
  }, [avoidHabits]);

  const cleanLabel = useMemo(() => {
    if (avoidHabits.length === 0) return '';

    const processed = avoidHabits.map(habit => ({
      habit,
      metrics: calculateAvoidanceMetrics(habit, dataStore.avoidanceCheckins)
    }));
    const unitFor = (item: typeof processed[number]) =>
      item.metrics.isWindow ? 'janelas' : 'dias';

    const bestCurrent = [...processed].sort(
      (a, b) => b.metrics.currentStreak - a.metrics.currentStreak
    )[0];
    if (bestCurrent.metrics.currentStreak > 0) {
      return `Sequência atual: ${bestCurrent.metrics.currentStreak} ${unitFor(bestCurrent)} com resistência`;
    }

    const bestHistorical = [...processed].sort(
      (a, b) => b.metrics.bestStreak - a.metrics.bestStreak
    )[0];
    if (bestHistorical.metrics.bestStreak > 0) {
      return `Maior sequência registrada: ${bestHistorical.metrics.bestStreak} ${unitFor(bestHistorical)} com resistência`;
    }

    return 'Seu primeiro registro começa aqui';
  }, [avoidHabits, dataStore.avoidanceCheckins]);

  const handleToComVontade = () => {
    setAntiVicioHabitId(undefined);
    setIsAntiVicioVictory(false);
    setIsAntiVicioOpen(true);
  };

  useEffect(() => {
    if (pendingAvoidanceHabits.length === 0 && showCheckinModal) {
      setShowCheckinModal(false);
    }
  }, [pendingAvoidanceHabits, showCheckinModal]);

  const handleResisti = async (
    habit: Habit,
    windowLabel: string,
    checkinPeriod: string,
    checkinDate: string,
    promptIndex: number
  ) => {
    if (!dataStore.profile?.id) return;

    const created = await dataStore.addAvoidanceCheckin({
      user_id: dataStore.profile.id,
      habit_id: habit.id,
      checkin_date: checkinDate,
      checkin_period: checkinPeriod,
      status: 'success',
      occurred_at: new Date().toISOString(),
      window_label: windowLabel,
      prompts_shown: promptIndex
    });

    if (!created) {
      dataStore.showNotification('Não foi possível salvar seu registro. Verifique a conexão e tente novamente.', 'error');
      return;
    }

    playVictorySound();
    setAnimatingResistedHabitId(habit.id);
    setAntiVicioHabitId(habit.id);
    setAntiVicioCheckinId(created.id);
    setIsAntiVicioVictory(true);
    setIsAntiVicioOpen(true);
    setShowCheckinModal(false);
    dismissAntiVicio(habit.id, windowLabel, promptIndex);
    registerCooldown(`${habit.id}:${windowLabel}:${promptIndex}`);

    setTimeout(() => setAnimatingResistedHabitId(null), 1500);
    dataStore.showNotification('Registro salvo. Você conseguiu atravessar esse momento.', 'success');
  };

  const handleRecai = async (
    habit: Habit,
    windowLabel: string,
    checkinPeriod: string,
    checkinDate: string,
    promptIndex: number
  ) => {
    if (!dataStore.profile?.id) return;

    const created = await dataStore.addAvoidanceCheckin({
      user_id: dataStore.profile.id,
      habit_id: habit.id,
      checkin_date: checkinDate,
      checkin_period: checkinPeriod,
      status: 'relapse',
      occurred_at: new Date().toISOString(),
      window_label: windowLabel,
      prompts_shown: promptIndex
    });

    if (!created) {
      dataStore.showNotification('Não foi possível salvar o registro. Tente novamente.', 'error');
      return;
    }

    dismissAntiVicio(habit.id, windowLabel, promptIndex);
    registerCooldown(`${habit.id}:${windowLabel}:${promptIndex}`);
    setRelapsedCheckinId(created.id);
    setTriggerNoteText('');
    setRelapsedHabitName(habit.name);
    setShowCheckinModal(false);
    setShowSupportiveRelapseModal(true);
  };

  const handleDepois = async (
    habit: Habit,
    windowLabel: string,
    checkinPeriod: string,
    checkinDate: string,
    promptIndex: number
  ) => {
    if (!dataStore.profile?.id) return;

    const promptKey = `${habit.id}:${windowLabel}:${promptIndex}`;
    const created = await dataStore.addAvoidanceCheckin({
      user_id: dataStore.profile.id,
      habit_id: habit.id,
      checkin_date: checkinDate,
      checkin_period: checkinPeriod,
      status: 'pending',
      occurred_at: new Date().toISOString(),
      window_label: windowLabel,
      prompts_shown: promptIndex
    });

    if (!created) {
      dataStore.showNotification('Não foi possível adiar o lembrete. Tente novamente.', 'error');
      return;
    }

    registerSnooze(promptKey);
    dataStore.showNotification('Tudo bem. Vou lembrar você novamente em duas horas.', 'success');
  };

  let stateType: 'above' | 'on_pace' | 'below' | 'neutral' = 'neutral';
  if (percent > 110) {
    stateType = 'above';
  } else if (percent >= 90) {
    stateType = 'on_pace';
  } else {
    stateType = 'below';
  }

  // Smart Status Phrase (varies by state — compared to MANUAL GOAL!)
  let smartPhrase = '';
  if (todayMinutesToShow === 0) {
    smartPhrase = `Sua meta de hoje é ${formatCompact(targetMinutes)}. Bora abrir o dia?`;
  } else if (stateType === 'above') {
    if (averageData.personalRecord > 0 && todayMinutesToShow >= averageData.personalRecord) {
      smartPhrase = `Recorde histórico superado com ${formatCompact(todayMinutesToShow)}! Você está voando alto hoje! 🏆`;
    } else if (averageData.personalRecord > 0 && (averageData.personalRecord - todayMinutesToShow) <= 15) {
      smartPhrase = `Incrível, você está quase quebrando seu recorde de ${formatCompact(averageData.personalRecord)}! 🔥`;
    } else {
      smartPhrase = `Meta batida! Excelente ritmo hoje. 🔥`;
    }
  } else if (stateType === 'on_pace') {
    smartPhrase = "No compasso da sua meta diária. Continue assim!";
  } else {
    // stateType === 'below'
    smartPhrase = `Dá tempo de atingir os ${formatCompact(targetMinutes)}. Uma sessão já te aproxima!`;
  }

  // Now, determine reactive text line (WAVE 1B living reactive line engine)
  const currentHour = new Date().getHours();
  const dayOfWeek = dateObj.getDay(); // 0 is Sunday, 1 is Monday, etc.

  // Formatted focus time for interpolation
  const formattedFocusTime = hours > 0 
    ? `${hours}h ${minutes}m` 
    : `${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`;

  // Deterministic selector using today's day number to rotate options securely and avoid re-render flickering
  const selectChoice = (options: string[]) => {
    return options[dayNum % options.length];
  };

  let reactiveLine = '';

  // PRIORITY 1 — PERFORMANCE (overrides time-based when notable)
  const isAfternoonOrLater = currentHour >= 12;

  if (totalMinutes === 0 && isAfternoonOrLater) {
    reactiveLine = selectChoice([
      "Você ainda não começou uma atividade hoje. Que tal iniciar uma Sessão Profunda?",
      "Que tal começar agora? O primeiro passo é o mais importante.",
      "Você está pronto para começar. Vamos iniciar uma Sessão Profunda?",
      "O dia está passando. Que tal reservar um tempo para uma atividade importante?"
    ]);
  } else if (averageData.hasEnoughHistory && totalMinutes > averageData.personalRecord && totalMinutes > 0) {
    reactiveLine = selectChoice([
      "Seu dia com mais tempo dedicado até agora. 🔥",
      "Incrível! Hoje é o dia em que você mais avançou. 🏆",
      "Você superou seu recorde diário de tempo dedicado! Fantástico!",
      "Superando todos os seus limites. Hoje foi histórico! 🔥"
    ]);
  } else if (averageData.hasEnoughHistory && totalMinutes > 0 && totalMinutes < 0.8 * averageData.averageMinutes) {
    reactiveLine = selectChoice([
      "Hoje rendeu menos que sua média. Vamos retomar?",
      "Hoje você avançou menos que o habitual. Que tal uma sessão curta?",
      "O dia ainda não acabou. Uma sessão curta pode fazer diferença hoje!",
      "Que tal retomar sua atividade? Uma sessão curta ajuda a voltar ao ritmo."
    ]);
  } else if (averageData.hasEnoughHistory && totalMinutes > 0 && totalMinutes >= averageData.averageMinutes) {
    reactiveLine = selectChoice([
      `Bom ritmo hoje — ${formattedFocusTime} de trabalho registrado. Continue assim.`,
      `Ótimo trabalho! Já são ${formattedFocusTime} de tempo dedicado hoje.`,
      `Boa dedicação hoje: ${formattedFocusTime} mantendo o controle do seu dia.`,
      `Consistência excelente! ${formattedFocusTime} dedicados ao que importa hoje.`
    ]);
  }

  // PRIORITY 2 — DAY OF WEEK (when performance is neutral or no high performance matches)
  if (!reactiveLine) {
    if (dayOfWeek === 1 && currentHour >= 5 && currentHour < 12) {
      reactiveLine = selectChoice([
        "Semana nova. Comece com uma sessão e dê o tom.",
        "Segunda-feira pede um bom começo para a semana.",
        "Nova semana, novas metas. Estabeleça seu ritmo logo cedo."
      ]);
    } else if (dayOfWeek === 5) {
      reactiveLine = selectChoice([
        "Sexta. Termine a semana no controle.",
        "Quase lá! Um último gás na sexta-feira para um fim de semana tranquilo.",
        "Sextou com produtividade. Feche as pendências e descanse em paz!"
      ]);
    } else if (dayOfWeek === 0) {
      reactiveLine = selectChoice([
        "Domingo é bom pra planejar a semana que vem.",
        "Um domingo organizado traz uma semana produtiva. Prepare-se.",
        "Planejar hoje poupa energia amanhã. Use o dia para estruturar seus alvos."
      ]);
    }
  }

  // PRIORITY 3 — TIME OF DAY (default fallback)
  if (!reactiveLine) {
    if (currentHour >= 5 && currentHour < 12) {
      reactiveLine = selectChoice([
        "Manhã é seu tempo mais nobre. Aproveite.",
        "O dia está decolando. Defina sua prioridade número um agora.",
        "As primeiras horas podem ser um bom momento para começar uma tarefa importante."
      ]);
    } else if (currentHour >= 12 && currentHour < 18) {
      reactiveLine = selectChoice([
        "Tarde rende. Que tal avançar em uma atividade?",
        "Metade do dia já foi. Mantenha a energia e a consistência.",
        "Hora de avançar nos projetos. Que tal uma sessão produtiva?"
      ]);
    } else if (currentHour >= 18 && currentHour < 23) {
      reactiveLine = selectChoice([
        "Boa hora pra fechar uma última sessão do dia.",
        "Feche o dia com chave de ouro: mais uma sessão de trabalho.",
        "O dia está terminando. Que tal resolver aquela última pendência?"
      ]);
    } else {
      reactiveLine = selectChoice([
        "Tá tarde. Uma sessão curta e depois descanse.",
        "Quase hora de dormir. Se for continuar, escolha uma tarefa curta.",
        "A noite pede tranquilidade. Priorize seu sono."
      ]);
    }
  }

  // Get upcoming/pending schedules
  const now = new Date();
  const upcomingSchedules = (dataStore.scheduledActivities || []).filter(activity => {
    if (activity.status !== 'pending') return false;
    const schedDate = new Date(`${activity.scheduled_date}T${activity.scheduled_time || '00:00'}`);
    return schedDate.getTime() > now.getTime();
  });

  const sortedUpcoming = [...upcomingSchedules].sort((a, b) => {
    const dateA = new Date(`${a.scheduled_date}T${a.scheduled_time || '00:00'}`);
    const dateB = new Date(`${b.scheduled_date}T${b.scheduled_time || '00:00'}`);
    return dateA.getTime() - dateB.getTime();
  });

  // Compute recent project
  const sortedSessions = [...(dataStore.sessions || [])].sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
  let recentProjectName = '';
  let recentProjectId = '';
  for (const session of sortedSessions) {
    if (session.project_id) {
      const proj = dataStore.projects.find(p => p.id === session.project_id);
      if (proj && proj.name) {
        recentProjectName = proj.name;
        recentProjectId = proj.id;
        break;
      }
    }
  }

  // Determine habitual focus window:
  let matchingCount = 0;
  (dataStore.sessions || []).forEach(s => {
    const startHour = new Date(s.started_at).getHours();
    const diff = Math.min((startHour - currentHour + 24) % 24, (currentHour - startHour + 24) % 24);
    if (diff <= 2) {
      matchingCount++;
    }
  });
  const isInHabitualWindow = matchingCount >= 2;

  // Cascade Cases for SP Button
  let buttonLabel = 'INICIAR SESSÃO PROFUNDA';
  let buttonSubline = '';
  let suggestedProjectId = recentProjectId || '';

  if (recentProjectName) {
    buttonSubline = `continuar ${recentProjectName}`;
  }

  const openDeepSession = () => {
    if (suggestedProjectId && timer.updateConfig) {
      // Pré-seleciona o projeto recente no timer global antes de mudar de aba
      timer.updateConfig(suggestedProjectId);
    }
    window.dispatchEvent(new CustomEvent('set-active-tab', { 
      detail: { tab: 'session' } 
    }));
  };

  if (timer.isActive) return null;

  return (
    <section className="relative pt-2 pb-4 md:pt-6 md:pb-12 px-4 sm:px-6 flex flex-col items-center text-center w-full max-w-5xl mx-auto overflow-hidden">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-3xl space-y-4 md:space-y-6 py-1 md:py-2"
      >
        {/* Bloco 1 — Saudação */}
        <div className="space-y-2 flex flex-col items-center w-full max-w-full overflow-hidden relative">
          <h2 className="text-[clamp(1.75rem,5.8vw,3.2rem)] font-bold tracking-tight text-text leading-none whitespace-nowrap px-2 relative z-10">
            {greeting}, {firstName}
          </h2>
          <span className="text-xs sm:text-sm md:text-[1rem]/[1.5rem] text-text-dim/60 md:text-text-dim font-mono tracking-[0.15em] uppercase font-bold md:font-semibold">
            {fullCustomDate}
          </span>
          <p className="text-[#6EE7B7] whitespace-nowrap text-[clamp(8.5px,2.8vw,14px)] text-center italic font-medium leading-normal select-none max-w-full tracking-[-0.05em] mb-3 px-2 overflow-visible">
            Se organize para passar mais tempo com as pessoas que importam <span className="inline-block align-middle ml-1">❤️</span>
          </p>

          {/* MONITORING CHIP (STATE B — MOBILE ONLY) */}
          {hasAvoidance && pendingAvoidanceHabits.length > 0 && (
            <div className="md:hidden flex justify-center pb-2 z-20">
              <button
                type="button"
                onClick={() => setShowCheckinModal(true)}
                className="flex items-center gap-1.5 px-3 py-1 border border-red-500/20 bg-red-950/15 rounded-full cursor-pointer text-[10px] font-bold text-red-300 uppercase tracking-wide transition-all hover:bg-red-950/25 max-h-[26px]"
              >
                <span className="relative flex h-1.5 w-1.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
                </span>
                <span className="pointer-events-none">Como está sua vontade?</span>
                <span className="text-red-400/40 text-[9px] font-mono font-medium leading-none whitespace-nowrap">
                  ({pendingAvoidanceHabits.length})
                </span>
              </button>
            </div>
          )}

          <InboxCaptures />

          {!isInstalled && isInitialized && !isDismissedPeriod && (
            <div className="w-full flex justify-center pt-2 animate-fade-in relative z-20">
              <button
                onClick={installApp}
                id="hero-pwa-install-btn"
                className="w-full max-w-[340px] py-3 border border-[#6ee7a8]/10 hover:border-[#6ee7a8]/35 bg-[#6ee7a8]/5 hover:bg-[#6ee7a8]/10 text-[#6ee7a8] active:scale-98 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all min-h-[44px] touch-manipulation cursor-pointer flex items-center justify-center gap-2"
              >
                <span className="text-sm">📱</span>
                <span>Instalar Aplicativo DUDE</span>
              </button>
            </div>
          )}


        </div>

        {/* THE AVERAGE RING COLUMNS (WAVE 2C / PART B) - REDUCED VERTICAL GAP FOR ABOVE-THE-FOLD EFFECT */}
        <div className="flex flex-col items-center justify-center gap-3.5 w-full py-1">
          {/* THE AVERAGE RING */}
          <div className="relative w-36 h-36 flex items-center justify-center rounded-full bg-white/[0.01]">
            <svg className="w-full h-full transform -rotate-90 select-none pointer-events-none" viewBox="0 0 36 36">
              {/* Track ring */}
              <path
                className="text-white/[0.05]"
                strokeWidth="2.8"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              {/* Active progress ring */}
              {hasEnoughHistory && (
                <motion.path
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  stroke={
                    stateType === 'above'
                      ? 'var(--green)'
                      : stateType === 'on_pace'
                      ? 'var(--amber)'
                      : 'var(--coral)'
                  }
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  initial={{ strokeDasharray: "0, 100" }}
                  animate={{ strokeDasharray: `${strokePercent}, 100` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                />
              )}
            </svg>
            
            {/* Centered label element with absolute centering to prevent layout shift */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none p-2 select-none">
              {hasEnoughHistory ? (
                <>
                  <span className="text-3xl font-black font-mono text-text tracking-tighter leading-none">
                    {percent}%
                  </span>
                  <span className="text-[10px] text-text-dim/60 font-mono tracking-tight leading-normal mt-1.5 whitespace-nowrap">
                    {formatCompact(todayMinutesToShow)} / {formatCompact(targetMinutes)}
                  </span>
                  <div className={`text-[10px] font-bold uppercase tracking-wider mt-1.5 flex items-center gap-1 leading-none ${
                    stateType === 'above' ? 'text-green' : stateType === 'on_pace' ? 'text-amber' : 'text-coral'
                  }`}>
                    {stateType === 'above' && '↑ acima'}
                    {stateType === 'on_pace' && '= no ritmo'}
                    {stateType === 'below' && '↓ abaixo'}
                  </div>
                </>
              ) : (
                <>
                  <span className="text-4xl font-extrabold font-mono text-text-dim/30 leading-none">
                    —
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Prominent Adjust Goal Control */}
          <div className="flex flex-col items-center justify-center pt-2 pb-2 w-full">
            {!isEditingGoal ? (
              <button
                onClick={() => {
                  setTempGoal(targetMinutes);
                  setIsEditingGoal(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1 bg-transparent hover:bg-transparent border-none text-[10px] font-medium text-gray-400 opacity-60 hover:opacity-100 transition-opacity cursor-pointer select-none"
              >
                <Settings size={12} className="text-gray-400" />
                <span>Ajustar minha meta diária</span>
              </button>
            ) : (
              <div className="flex flex-col items-center gap-2 bg-surface-1 border border-border-custom p-3.5 rounded-2xl shadow-2xl w-full max-w-[280px] animate-fade-in font-sans">
                <div className="flex items-center justify-between w-full">
                  <span className="text-[10px] font-mono text-text-dim uppercase tracking-wider font-bold">Definir Meta</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => {
                        if (dataStore.profile?.id) {
                          await dataStore.updateDailyGoal(dataStore.profile.id, null);
                        } else {
                          localStorage.removeItem('dude_daily_focus_goal');
                        }
                        dataStore.showNotification('Meta diária redefinida para o padrão! ✓');
                        setIsEditingGoal(false);
                      }}
                      className="text-[10px] text-coral hover:underline uppercase font-bold cursor-pointer"
                    >
                      reset
                    </button>
                    <button
                      onClick={() => setIsEditingGoal(false)}
                      className="text-text-dim hover:text-text cursor-pointer text-xs"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 w-full mt-1">
                  <input
                    type="number"
                    value={tempGoal}
                    onChange={(e) => setTempGoal(Math.max(15, parseInt(e.target.value, 10) || 15))}
                    className="w-20 bg-surface-2 border border-border-custom text-center font-mono text-sm font-bold text-text focus:outline-none py-1.5 rounded-xl"
                  />
                  <span className="text-xs text-text-dim font-mono shrink-0">min</span>
                  <button
                    onClick={async () => {
                      const cleanVal = Math.max(15, Math.min(720, tempGoal));
                      if (dataStore.profile?.id) {
                        await dataStore.updateDailyGoal(dataStore.profile.id, cleanVal);
                      } else {
                        localStorage.setItem('dude_daily_focus_goal', cleanVal.toString());
                      }
                      dataStore.showNotification('Meta diária salva com sucesso! ✓');
                      setIsEditingGoal(false);
                    }}
                    className="flex-1 py-1.5 bg-green hover:brightness-110 rounded-xl text-xs font-bold text-surface-2 uppercase cursor-pointer transition-colors"
                  >
                    Ok
                  </button>
                </div>
                
                {averageData.averageMinutes > 0 && (
                  <p className="text-[10px] text-text-dim/80 font-medium leading-relaxed mt-1 text-center font-sans">
                    Sua média recente é <span className="font-mono text-text">{formatCompact(averageData.averageMinutes)}</span> — que tal mirar <span className="font-mono text-text">{formatCompact(Math.max(45, Math.round((averageData.averageMinutes * 1.2) / 15) * 15))}</span>?
                  </p>
                )}
              </div>
            )}
          </div>

          {/* SMART STATUS PHRASE */}
          <p className="text-xs sm:text-sm font-medium italic text-text-dim/80 max-w-sm text-center leading-relaxed select-none px-4">
            "{smartPhrase}"
          </p>
        </div>

        {/* Energy Tracker Card */}
        <AnimatePresence>
          {dataStore.currentEnergyState && !dismissedEnergyCard && (
            <motion.div
              layout={false}
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98, y: -10 }}
              className="w-full max-w-[340px] sm:max-w-md mx-auto p-4 sm:p-5 rounded-2xl border text-center select-none relative overflow-hidden flex flex-col gap-2 font-sans transition-all z-20 bg-surface-1/80 border-border-custom/50 shadow-sm"
            >
              <button 
                onClick={() => setDismissedEnergyCard(true)}
                className="absolute top-3 right-3 text-text-secondary/40 hover:text-text-primary transition-all p-1 cursor-pointer z-10"
                title="Dispensar"
              >
                <X size={14} />
              </button>
              
              <p className="text-xs sm:text-sm text-text font-medium leading-relaxed pr-6 text-left">
                {dataStore.currentEnergyState === 'pleno' && "⚡ Você está com bastante energia. Pode ser um bom momento para iniciar uma Sessão Profunda."}
                {dataStore.currentEnergyState === 'inquieto' && "🌪️ Energia alta, mas dispersa. Recomendação: faça uma tarefa rápida ou anote tudo o que está na cabeça."}
                {dataStore.currentEnergyState === 'equilibrado' && "⚖️ Seu ritmo está equilibrado. Um bom momento para avançar nas tarefas e rotinas."}
                {dataStore.currentEnergyState === 'fadigado' && "🪫 Bateria baixa. Respeite seu limite cognitivo, feche o dia ou faça pausas longas."}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* TRANSIENT SCHEDULE BANNER (below the ring) */}
        <AnimatePresence mode="wait">
          {alertSchedule && (
            <motion.div
              layout={false}
              key={alertSchedule.activity.id}
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98, y: -10 }}
              className={`w-full max-w-[340px] sm:max-w-md mx-auto p-5 rounded-2xl border text-center select-none relative overflow-hidden flex flex-col gap-3 font-sans transition-all z-20 ${
                alertSchedule.isOverdue 
                  ? 'bg-amber-500/5 border-amber-500/20 shadow-[0_0_20px_rgba(245,158,11,0.08)]' 
                  : 'bg-[#6ee7a8]/5 border-[#6ee7a8]/20 shadow-[0_0_20px_rgba(110,231,168,0.08)]'
              }`}
            >
              {/* Dismiss button */}
              <button 
                onClick={() => {
                  dismissSchedule(alertSchedule.activity.id);
                }}
                className="absolute top-3 right-3 text-text-secondary/40 hover:text-text-primary transition-all p-1 cursor-pointer"
                title="Dispensar"
              >
                <X size={14} />
              </button>

              <div className="flex justify-between items-center w-full">
                <p className={`text-[9px] uppercase tracking-widest font-bold flex items-center gap-1.5 font-mono ${
                  alertSchedule.isOverdue ? 'text-amber-400' : 'text-[#6ee7a8]'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${alertSchedule.isOverdue ? 'bg-amber-400 animate-pulse' : 'bg-[#6ee7a8] animate-ping'}`} />
                  ● {alertSchedule.isOverdue ? 'Atividade atrasada' : 'Atividade próxima'}
                </p>
                <span className="text-[9px] font-mono font-bold bg-white/5 border border-white/5 px-2.5 py-0.5 rounded-full text-text-secondary/60">
                  {alertSchedule.scheduled_time}
                </span>
              </div>

              <div className="space-y-1 text-left">
                <h4 className="text-sm font-bold text-text-primary leading-tight font-sans">
                  {alertSchedule.isOverdue ? (
                    <>Sua atividade está atrasada! <span className="text-amber-400 font-extrabold">"{alertSchedule.activity.title}"</span> deveria ter começado.</>
                  ) : (
                    <>Você tem uma atividade agendada em breve: <span className="text-[#6ee7a8] font-extrabold">"{alertSchedule.activity.title}"</span>.</>
                  )}
                </h4>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('start-scheduled-session', { detail: alertSchedule.activity }));
                  }}
                  className={`py-2 px-3 rounded-xl font-bold uppercase tracking-wider text-[10px] transition-all hover:scale-102 cursor-pointer text-center font-sans ${
                    alertSchedule.isOverdue 
                      ? 'bg-amber-400 text-background hover:brightness-110' 
                      : 'bg-green text-background hover:brightness-110'
                  }`}
                >
                  🚀 Iniciar Sessão
                </button>
                <button
                  type="button"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('open-reagendar', { detail: alertSchedule.activity }));
                  }}
                  className="py-2.5 px-3 bg-white/5 hover:bg-white/10 border border-white/10 text-text-secondary/60 rounded-xl font-bold uppercase tracking-wider text-[10px] transition-all cursor-pointer text-center font-sans"
                >
                  📅 Reagendar
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* PASSIVE ANTI-VICTIM CHECK-IN MODAL */}
        <AnimatePresence>
          {showCheckinModal && pendingAvoidanceHabits.length > 0 && (
            <div className="fixed inset-0 z-[600] flex items-center justify-center bg-app-base/80 backdrop-blur-md p-4">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className={`w-full ${pendingAvoidanceHabits.length > 1 ? 'max-w-lg' : 'max-w-md'} bg-surface-2 border border-border-custom rounded-3xl p-6 space-y-6 shadow-2xl relative flex flex-col max-h-[90vh]`}
              >
                {/* Close Button */}
                <button
                  onClick={() => setShowCheckinModal(false)}
                  className="absolute top-4 right-4 text-text-dim/50 hover:text-text transition-colors p-1 cursor-pointer"
                >
                  <X size={18} />
                </button>

                <div className="space-y-1.5 text-center">
                  <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-400 mx-auto mb-2">
                    <Shield size={20} />
                  </div>
                  <h4 className="text-lg font-extrabold text-red-300 tracking-tight uppercase">
                    Como você está agora?
                  </h4>
                  <p className="text-[11px] text-text-dim/80 max-w-xs mx-auto">
                    Um registro rápido ajuda você a perceber como está e escolher o próximo passo.
                  </p>
                  {pendingAvoidanceHabits.length > 1 && (
                    <span className="inline-block px-2.5 py-0.5 mt-2 bg-red-500/10 text-red-400 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider">
                      {pendingAvoidanceHabits.length} Pendência{pendingAvoidanceHabits.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {/* Render pending habits stacked vertically */}
                <div className="flex flex-col gap-3 overflow-y-auto flex-1 pr-1 pb-6">
                  {pendingAvoidanceHabits.map((currentItem) => {
                    const { habit, windowLabel, checkinPeriod, checkinDate, promptIndex } = currentItem;
                    const metrics = calculateAvoidanceMetrics(habit, dataStore.avoidanceCheckins);
                    const isAnimating = animatingResistedHabitId === habit.id;
                    const isJanela = isTimeWindowAvoidance(habit);
                    const mStart = habit.monitor_start || habit.avoidance_window_start || "18:00";
                    const mEnd = habit.monitor_end || habit.avoidance_window_end || "22:00";

                    return (
                      <div key={`${habit.id}-${windowLabel}-${promptIndex}`} className="bg-surface-1/50 border border-border-custom/50 rounded-2xl p-5 space-y-4 relative overflow-hidden text-left">
                        <div className="absolute inset-0 bg-green/5 animate-pulse opacity-20 pointer-events-none" />

                        <div className="flex justify-between items-center relative z-10 w-full">
                          <p className="text-[9px] uppercase tracking-widest font-bold text-green flex items-center gap-1.5 font-mono">
                            <span className="w-1.5 h-1.5 rounded-full bg-green animate-ping shrink-0" />
                            ● {habit.name}
                          </p>
                          <div className="flex items-center gap-1.5 bg-green/10 border border-green/20 px-2 py-0.5 rounded-lg shrink-0">
                            <span className="text-[8px] font-mono font-bold uppercase text-green">Sequência atual:</span>
                            <AnimatePresence mode="popLayout">
                              <motion.span
                                key={isAnimating ? 'anim' : 'static'}
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1.1, opacity: 1 }}
                                exit={{ scale: 0.8, opacity: 0 }}
                                className="text-xs font-mono font-black text-green inline-block"
                              >
                                {metrics.currentStreak} {metrics.unitPlural}
                              </motion.span>
                            </AnimatePresence>
                          </div>
                        </div>

                        <div className="space-y-1 relative z-10 text-left">
                          <h4 className="text-sm font-bold text-text-primary leading-tight">
                            Como você está com seu autocontrole agora?
                          </h4>
                          {isJanela && (
                            <p className="text-[10px] font-mono text-text-dim/60 uppercase tracking-wider">
                              Período: {mStart} às {mEnd}
                            </p>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2.5 relative z-10 font-sans">
                          <button
                            type="button"
                            onClick={() => handleResisti(habit, windowLabel, checkinPeriod, checkinDate, promptIndex)}
                            className="py-3 px-3 bg-green hover:brightness-110 text-background rounded-xl font-bold uppercase tracking-wider text-[10px] transition-all hover:scale-102 cursor-pointer text-center"
                          >
                            ✓ Resisti
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRecai(habit, windowLabel, checkinPeriod, checkinDate, promptIndex)}
                            className="py-3 px-3 bg-red-400/10 hover:bg-red-400/20 border border-red-400/20 text-red-300 rounded-xl font-bold uppercase tracking-wider text-[10px] transition-all hover:scale-102 cursor-pointer text-center"
                          >
                            Recaí
                          </button>
                        </div>

                        <div className="relative z-10">
                          <button
                            type="button"
                            onClick={() => handleDepois(habit, windowLabel, checkinPeriod, checkinDate, promptIndex)}
                            className="w-full py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-text-dim rounded-xl font-medium tracking-wider text-[10px] transition-all cursor-pointer text-center"
                          >
                            Depois (Adiar 2h)
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Bloco 4 — Botão de ação (The primary action centered with generous breathing room) */}
        <motion.div 
          layout={false}
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="pb-2 flex flex-col items-center gap-2 w-full animate-fade-in"
        >
          {pendingAvoidanceHabits.length > 0 && (
            <motion.button
              type="button"
              onClick={() => setShowCheckinModal(true)}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="hidden md:flex items-center gap-2 px-4 py-2 border border-red-500/20 bg-red-950/15 hover:bg-red-950/25 text-red-300 rounded-full transition-all cursor-pointer font-sans text-[11px] font-bold uppercase tracking-wider mb-2 relative"
            >
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
              </span>
<span className="pointer-events-none">Como está sua vontade?</span>
              <span className="text-red-400/40 text-[10px] font-mono font-bold leading-none whitespace-nowrap">
                ({pendingAvoidanceHabits.length})
              </span>
            </motion.button>
          )}

          {/* Placeholder silencioso no mobile/desktop enquanto os hábitos carregam (evita flash do botão verde) */}
          {!dataStore.initialFetchDone && (
            <div className="hidden md:block h-[56px] w-full max-w-[340px] sm:max-w-md md:max-w-xl mx-auto" />
          )}

          {dataStore.initialFetchDone && (
            <>
              {/* SP Button */}
              <button 
                onClick={openDeepSession}
                className={`group relative px-5 sm:px-10 py-4 sm:py-5 bg-green text-[#0D0F14] rounded-2xl overflow-hidden transition-all hover:brightness-105 active:scale-[0.98] hidden md:flex flex-col items-center justify-center gap-1.5 mx-auto shadow-[0_4px_12px_rgba(110,231,168,0.15)] sm:shadow-[0_20px_40px_rgba(110,231,168,0.25)] touch-manipulation min-h-[56px] w-full max-w-[340px] sm:max-w-md md:max-w-xl hover:scale-[1.02] duration-200 cursor-pointer text-center`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-app-base animate-pulse shrink-0" />
                  <span className="font-bold text-xs sm:text-sm uppercase tracking-[0.18em] whitespace-nowrap">
                    {buttonLabel}
                  </span>
                </div>
                {buttonSubline && (
                  <span className="text-[11px] sm:text-xs font-bold text-black/80 uppercase tracking-[0.1em] mt-0.5">
                    {buttonSubline}
                  </span>
                )}
              </button>

              {/* Autocontrole Strip - MOBILE ONLY */}
              <div className="md:hidden w-full max-w-[340px] sm:max-w-md mx-auto animate-fade-in pt-1">
                {/* ZONA DE AÇÃO: SESSÃO PROFUNDA GUIADA */}
                <div className="w-full flex flex-col gap-3 mt-2">
                  
                  {/* Card Hero (Botão 100% de largura) */}
                  <button 
                    onClick={handleToComVontade}
                    type="button"
                    className="w-full flex items-center justify-center gap-3 bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/20 p-4 rounded-2xl transition-all active:scale-95 cursor-pointer shadow-[0_0_15px_rgba(16,185,129,0.05)] backdrop-blur-md"
                  >
                    <Hand size={18} className="text-emerald-400 shrink-0" />
                    <span className="text-emerald-400 font-extrabold text-[11px] sm:text-xs uppercase tracking-widest leading-none mt-0.5">
                      Iniciar Sessão Profunda Guiada
                    </span>
                  </button>

                  {/* Legenda de Suporte (Obrigatório 1 única linha com Truncate) */}
                  <div className="flex items-center justify-center gap-2 px-4 w-full opacity-80 animate-fade-in">
                    <Brain size={14} className="text-purple-400 shrink-0" />
                    <p className="text-white/60 font-light text-[12px] truncate">
                      Faça uma pausa e retome sua atividade.
                    </p>
                  </div>

                </div>
              </div>
            </>
          )}
        </motion.div>

        {/* "SEUS NÚMEROS DE HOJE" BLOCK (PART B3 & B4) */}
        <div className="w-full space-y-4 pt-1">
          <h3 className="text-xs sm:text-sm font-bold tracking-[0.22em] text-text uppercase text-center font-sans">
            SEUS NÚMEROS DE HOJE
          </h3>
          
          {/* MOBILE DESIGN: Single line inline element, fully flat, de-boxed */}
          <div className="md:hidden flex flex-row items-center justify-center w-full py-2 select-none">
            {/* Slot 1: Tempo registrado */}
            <div className="flex-1 flex flex-col items-center justify-center border-r border-white/5 px-2">
              <span className="text-2xl sm:text-3xl font-mono font-bold text-text tracking-tighter leading-none">
                {formatCompact(todayMinutesToShow)}
              </span>
              <span className="text-[10px] text-text-dim/60 text-center font-sans tracking-wide leading-tight mt-1.5 px-1 whitespace-nowrap">
                Tempo registrado
              </span>
            </div>

            {/* Slot 2: Sessões Profundas */}
            <div className="flex-1 flex flex-col items-center justify-center border-r border-white/5 px-2">
              <span className="text-2xl sm:text-3xl font-mono font-bold text-text tracking-tighter leading-none">
                {todaySessionsCount}
              </span>
              <span className="text-[10px] text-text-dim/60 text-center font-sans tracking-wide leading-tight mt-1.5 px-1 whitespace-nowrap">
                {todaySessionsCount === 1 ? 'Sessão Profunda' : 'Sessões'}
              </span>
            </div>

            {/* Slot 3: Dias Invictos */}
            <div className="flex-1 flex flex-col items-center justify-center px-2">
              <div className="flex items-center gap-1">
                <span className="text-[1rem]/[1.5rem] select-none leading-none shrink-0">🔥</span>
                <span className="text-2xl sm:text-3xl font-mono font-bold text-green tracking-tighter leading-none">
                  {streak}
                </span>
              </div>
              <span className="text-[10px] text-text-dim/60 text-center font-sans tracking-wide leading-tight mt-1.5 px-1 whitespace-nowrap">
                {streak === 1 ? 'Dia Invicto' : 'Dias Invictos'}
              </span>
            </div>
          </div>

          {/* DESKTOP DESIGN: Single line inline element, fully flat, de-boxed, scaled for desktop */}
          <div className="hidden md:flex flex-row items-center justify-center w-full max-w-2xl mx-auto py-4 select-none">
            {/* Slot 1: Tempo registrado */}
            <div className="flex-1 flex flex-col items-center justify-center border-r border-white/5 px-4">
              <span className="text-3xl md:text-4xl font-mono font-bold text-text tracking-tighter leading-none">
                {formatCompact(todayMinutesToShow)}
              </span>
              <span className="text-[10px] text-text-dim/70 text-center font-sans tracking-wider leading-tight mt-2 px-1 whitespace-nowrap uppercase">
                Tempo registrado
              </span>
            </div>

            {/* Slot 2: Sessões Profundas */}
            <div className="flex-1 flex flex-col items-center justify-center border-r border-white/5 px-4">
              <span className="text-3xl md:text-4xl font-mono font-bold text-text tracking-tighter leading-none">
                {todaySessionsCount}
              </span>
              <span className="text-[10px] text-text-dim/70 text-center font-sans tracking-wider leading-tight mt-2 px-1 whitespace-nowrap uppercase">
                {todaySessionsCount === 1 ? 'Sessão Profunda' : 'Sessões Profundas'}
              </span>
            </div>

            {/* Slot 3: Dias Invictos */}
            <div className="flex-1 flex flex-col items-center justify-center px-4">
              <div className="flex items-center gap-1.5 justify-center">
                <span className="text-xl md:text-2xl select-none leading-none shrink-0">🔥</span>
                <span className="text-3xl md:text-4xl font-mono font-bold text-green tracking-tighter leading-none">
                  {streak}
                </span>
              </div>
              <span className="text-[10px] text-text-dim/70 text-center font-sans tracking-wider leading-tight mt-2 px-1 whitespace-nowrap uppercase">
                {streak === 1 ? 'Dia Invicto' : 'Dias Invictos'}
              </span>
            </div>
          </div>

          {/* NOVO CTA GUIADO - VERSÃO DESKTOP (Abaixo das métricas) */}
          <div className="hidden md:flex flex-col gap-2 w-full mt-6">
            <button 
              onClick={handleToComVontade}
              type="button"
              className="w-full flex items-center justify-center gap-3 py-4 border border-purple-500/30 rounded-2xl transition-all active:scale-95 cursor-pointer hover:bg-purple-500/5 bg-purple-500/5"
            >
              <Hand size={18} className="text-purple-400" />
              <span className="text-purple-400 font-bold text-xs uppercase tracking-widest">
                INICIAR SESSÃO PROFUNDA GUIADA
              </span>
            </button>
            <div className="flex items-center justify-center gap-2 opacity-70">
              <Brain size={14} className="text-purple-400" />
              <p className="text-white/60 font-light text-[12px] truncate">
                Faça uma pausa e retome sua atividade.
              </p>
            </div>
          </div>

          {/* Summary Card for Today's Task List */}
          {/* DESKTOP VERSION - flat, de-boxed with subtle progress bar */}
          <div
            onClick={() => onNavigateToLists?.()}
            className="hidden md:flex w-full max-w-xl mx-auto pt-4 pb-2 text-center cursor-pointer select-none mt-2 animate-fade-in flex-col items-center justify-center hover:opacity-85 transition-opacity"
          >
            <div className="flex justify-between items-center w-full max-w-[240px] mb-1.5">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-500" />
                <span className="text-sm text-gray-300 font-medium">Tarefas do dia</span>
              </div>
              <div className="text-sm">
                <span className="text-white font-medium">{completedTasksCount} <span className="text-gray-500">/ {totalTasksCount} concluídas</span></span>
              </div>
            </div>
            {totalTasksCount > 0 && (
              <div className="w-full max-w-[240px] h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500" 
                  style={{ width: `${(completedTasksCount / totalTasksCount) * 100}%` }} 
                />
              </div>
            )}
          </div>

          {/* MOBILE VERSION - flat, de-boxed with subtle progress bar */}
          <div
            onClick={() => onNavigateToLists?.()}
            className="md:hidden w-full max-w-[340px] sm:max-w-md mx-auto pt-4 pb-2 text-center cursor-pointer select-none mt-1 animate-fade-in flex-col items-center justify-center"
          >
            <div className="flex justify-between items-center w-full max-w-[240px] mb-1">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={15} className="text-emerald-500" />
                <span className="text-xs text-gray-300 font-medium">Tarefas do dia</span>
              </div>
              <div className="text-xs">
                <span className="text-white font-medium">{completedTasksCount} <span className="text-gray-500">/ {totalTasksCount} concluídas</span></span>
              </div>
            </div>
            {totalTasksCount > 0 && (
              <div className="w-full max-w-[240px] h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500" 
                  style={{ width: `${(completedTasksCount / totalTasksCount) * 100}%` }} 
                />
              </div>
            )}
          </div>
        </div>

        {/* Standalone Shutdown Button ("Fechar meu dia" / "Reabrir meu dia") */}
        {(todaySessions.length > 0 || isDayClosed) && (
          <div className="w-full flex justify-center pt-2">
            {!isDayClosed ? (
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('trigger-daily-shutdown'))}
                className="w-full max-w-[340px] py-3 sm:py-3.5 border border-white/10 hover:border-white/25 bg-transparent hover:bg-white/5 text-gray-400 hover:text-gray-200 font-mono font-bold uppercase tracking-wider text-[11px] rounded-full flex items-center justify-center gap-2 group transition-all duration-300 select-none cursor-pointer transform hover:scale-[1.01] active:scale-[0.99]"
              >
                <Moon size={13} className="text-gray-500 group-hover:text-gray-300 transition-colors shrink-0" />
                <span>Fechar meu dia</span>
              </button>
            ) : (
              <button
                onClick={() => setShowReopenModal(true)}
                className="w-full max-w-[340px] py-3 sm:py-3.5 border border-[#f59e0b]/20 hover:border-[#f59e0b]/40 bg-transparent hover:bg-[#f59e0b]/10 text-[#f59e0b]/80 hover:text-[#f59e0b] font-mono font-bold uppercase tracking-wider text-[11px] rounded-full flex items-center justify-center gap-2 group transition-all duration-300 select-none cursor-pointer transform hover:scale-[1.01] active:scale-[0.99]"
              >
                <RotateCcw size={13} className="text-[#f59e0b]/60 group-hover:text-[#f59e0b] transition-colors shrink-0" />
                <span>Reabrir meu dia</span>
              </button>
            )}
          </div>
        )}

        {/* Habits progress lines (Build habits only) - Mobile & Desktop */}
        {buildHabits.length > 0 && (
          <div className="w-full max-w-[340px] sm:max-w-md md:max-w-xl mx-auto pt-6 border-t border-white/5 space-y-4.5 md:space-y-6">
            <div className="flex items-center justify-between px-1">
              <span className="text-sm md:text-[1rem]/[1.5rem] font-bold text-primary-green tracking-[0.22em] uppercase font-mono">
                Hábitos Atômicos
              </span>
            </div>
            <div className="divide-y divide-white/5 px-1">
              {buildHabits.map((h) => {
                const todayStr = getLocalDateString(new Date());
                const startOfWeek = new Date(h.week_start_date);
                startOfWeek.setHours(0,0,0,0);

                const habitSessionsThisWeek = dataStore.sessions.filter(s =>
                  s.habit_id === h.id &&
                  !!s.started_at &&
                  new Date(s.started_at) >= startOfWeek &&
                  s.completed
                );

                const minutesByDay: { [dateStr: string]: number } = {};
                habitSessionsThisWeek.forEach(s => {
                  const dStr = getLocalDateString(new Date(s.started_at));
                  const duration = s.actual_duration_minutes ?? s.duration_minutes ?? 0;
                  minutesByDay[dStr] = (minutesByDay[dStr] || 0) + duration;
                });

                const manualCompletionsThisWeek = dataStore.habitCompletions.filter(hc => 
                  hc.habit_id === h.id && 
                  new Date(hc.completed_at) >= startOfWeek && 
                  !hc.focus_session_id
                );
                manualCompletionsThisWeek.forEach(hc => {
                  const dStr = getLocalDateString(new Date(hc.completed_at));
                  minutesByDay[dStr] = (minutesByDay[dStr] || 0) + hc.duration_minutes;
                });

                const completedDaysCount = Object.keys(minutesByDay).filter(dStr => 
                  minutesByDay[dStr] >= h.minutes_per_session
                ).length;

                const todayMinutes = minutesByDay[todayStr] || 0;
                const targetMinutes = h.minutes_per_session;
                const isTodayPartial = todayMinutes > 0 && todayMinutes < targetMinutes;

                const progressCircles = Array.from({ length: h.sessions_per_week }, (_, i) => {
                  if (i < completedDaysCount) {
                    return 'completed';
                  } else if (i === completedDaysCount && isTodayPartial) {
                    return 'partial';
                  } else {
                    return 'empty';
                  }
                });

                const preferredTimeLabel = {
                  morning: '🌅 Manhã',
                  afternoon: '☀️ Tarde', 
                  evening: '🌙 Noite'
                }[h.preferred_time] || '🌅 Manhã';

                return (
                  <div key={h.id} className="py-5 first:pt-0 last:pb-0 flex flex-col gap-2 md:gap-2.5 select-none animate-fade-in text-left">
                    {/* Tier 1: habit name + period */}
                    <div className="flex items-center justify-between">
                      <span className="text-[1rem]/[1.5rem] md:text-lg font-semibold text-text-primary tracking-tight block">
                        {h.name}
                      </span>
                      <span className="text-[9px] md:text-xs text-text-secondary/50 font-bold uppercase tracking-widest font-mono shrink-0 ml-2">
                        {preferredTimeLabel}
                      </span>
                    </div>

                    {/* Tier 2: weekly dots + text + weekly streak */}
                    <div className="flex items-end justify-between gap-3">
                      {/* Weekly progress dots & status */}
                      <div className="flex flex-col items-start gap-1.5 min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 shrink-0">
                          {progressCircles.map((state, i) => (
                            <div
                              key={i}
                              className={`w-2.5 h-2.5 md:w-3 md:h-3 rounded-full relative shrink-0 transition-all ${
                                state === 'completed'
                                  ? 'bg-primary-green shadow-[0_0_8px_rgba(110,231,168,0.5)]'
                                  : state === 'partial'
                                  ? 'border border-amber-400/40 bg-transparent overflow-hidden'
                                  : 'bg-white/10'
                                }`}
                            >
                              {state === 'partial' && (
                                <div 
                                  className="absolute inset-y-0 left-0 bg-amber-400" 
                                  style={{ width: `${(todayMinutes / targetMinutes) * 100}%` }}
                                />
                              )}
                            </div>
                          ))}
                        </div>
                        <span className="text-[10px] md:text-xs text-text-dim/50 font-bold whitespace-nowrap font-sans font-mono tracking-wide leading-none block shrink-0">
                          {completedDaysCount}/{h.sessions_per_week} esta semana
                        </span>
                        {completedDaysCount > h.sessions_per_week && (
                          <span className="mt-1 px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-[9px] font-bold uppercase tracking-wider block font-sans w-fit">
                            +{completedDaysCount - h.sessions_per_week} EXTRA
                          </span>
                        )}
                      </div>

                      {/* Weekly Streak */}
                      <span className="text-[11px] md:text-xs font-mono font-bold text-green flex items-center gap-1 whitespace-nowrap leading-none shrink-0 mb-0.5">
                        <Flame size={12} className="text-amber-500 fill-amber-500/15 shrink-0" />
                        <span>
                          {h.weekly_streak} {h.weekly_streak === 1 ? 'semana invicta' : 'semanas invictas'}
                        </span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}


      </motion.div>



      {/* SUPPORTIVE RELAPSE OCCURRENCE MODAL */}
      <AnimatePresence>
        {showSupportiveRelapseModal && (
          <div 
            onClick={() => setShowSupportiveRelapseModal(false)}
            className="fixed inset-0 z-[700] flex items-center justify-center p-4 bg-background/90 backdrop-blur-md cursor-pointer"
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="w-full max-w-md p-6 sm:p-8 rounded-3xl bg-surface-1 border border-white/5 shadow-2xl text-center relative z-10 cursor-default"
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 rounded-full blur-[60px] bg-red-500/10 pointer-events-none" />
              
              <span className="text-3xl sm:text-4xl block mb-4 select-none">🤍</span>
              
              <h3 className="text-xl sm:text-2xl font-bold text-text-primary tracking-tight">
                Tudo bem, respire fundo.
              </h3>
              
              <p className="text-xs sm:text-sm text-text-secondary/80 mt-3 leading-relaxed">
                Sem culpa nenhuma. O autocontrole de <strong className="text-red-400 font-bold">{relapsedHabitName}</strong> é uma habilidade que você treina dia após dia, não um castigo. Uma recaída não apaga o que você já construiu. Se quiser, registre o que aconteceu para reconhecer situações parecidas no futuro.
              </p>

              <p className="text-[11px] text-text-secondary/50 font-mono mt-4 italic uppercase tracking-wide">
                Que tal registrar o que causou isso hoje?
              </p>

              <div className="grid grid-cols-2 gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowSupportiveRelapseModal(false);
                    setShowTriggerInputModal(true);
                  }}
                  className="py-3 px-4 bg-red-400/20 hover:bg-red-400/30 text-red-300 font-bold uppercase tracking-wider text-[10px] rounded-xl transition-all cursor-pointer text-center"
                >
                  Fazer anotação
                </button>
                <button
                  onClick={() => setShowSupportiveRelapseModal(false)}
                  className="py-3 px-4 bg-white/5 hover:bg-white/10 text-text-secondary font-bold uppercase tracking-wider text-[10px] rounded-xl transition-all cursor-pointer text-center border border-white/5"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* TRIGGER MAPPING MODAL */}
      <AnimatePresence>
        {showTriggerInputModal && (
          <div 
            className="fixed inset-0 z-[700] flex items-center justify-center p-4 bg-background/90 backdrop-blur-md"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="w-full max-w-md p-6 sm:p-8 rounded-3xl bg-surface-1 border border-white/5 shadow-2xl text-left relative z-10"
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 rounded-full blur-[60px] bg-green/10 pointer-events-none" />
              
              <span className="text-3xl block mb-4 select-none">🧬</span>
              
              <h3 className="text-xl sm:text-2xl font-bold text-text-primary tracking-tight">
                O que estava acontecendo?
              </h3>
              
              <p className="text-xs sm:text-sm text-text-secondary/70 mt-2 leading-relaxed">
                Se quiser, registre o que estava sentindo, onde estava ou o que aconteceu antes. Não precisa encontrar uma explicação perfeita.
              </p>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="text-[10px] text-text-secondary">
                  <span className="mb-1.5 block uppercase tracking-wider">Gatilho percebido</span>
                  <select value={relapseTriggerTag} onChange={e => setRelapseTriggerTag(e.target.value)} className="w-full rounded-xl border border-white/10 bg-surface-2 px-3 py-3 text-xs text-text-primary outline-none">
                    <option value="">Não identifiquei</option>
                    {['Estresse', 'Tédio', 'Solidão', 'Cansaço', 'Ansiedade', 'Frustração', 'Ambiente digital', 'Conflito', 'Outro'].map(value => <option key={value} value={value}>{value}</option>)}
                  </select>
                </label>
                <label className="text-[10px] text-text-secondary">
                  <span className="mb-1.5 block uppercase tracking-wider">Estado emocional</span>
                  <select value={relapseEmotionTag} onChange={e => setRelapseEmotionTag(e.target.value)} className="w-full rounded-xl border border-white/10 bg-surface-2 px-3 py-3 text-xs text-text-primary outline-none">
                    <option value="">Não informado</option>
                    {['Ansiedade', 'Estresse', 'Tédio', 'Tristeza', 'Frustração', 'Solidão', 'Cansaço', 'Calma'].map(value => <option key={value} value={value}>{value}</option>)}
                  </select>
                </label>
                <label className="text-[10px] text-text-secondary">
                  <span className="mb-1.5 block uppercase tracking-wider">Ambiente</span>
                  <select value={relapseEnvironmentTag} onChange={e => setRelapseEnvironmentTag(e.target.value)} className="w-full rounded-xl border border-white/10 bg-surface-2 px-3 py-3 text-xs text-text-primary outline-none">
                    <option value="">Não informado</option>
                    {['Em casa', 'No trabalho', 'Na rua', 'Na cama', 'Sozinho', 'Com outras pessoas', 'No celular ou computador', 'Outro'].map(value => <option key={value} value={value}>{value}</option>)}
                  </select>
                </label>
                <label className="text-[10px] text-text-secondary">
                  <span className="mb-1.5 block uppercase tracking-wider">O que fazia antes?</span>
                  <input value={relapsePrecedingActivity} onChange={e => setRelapsePrecedingActivity(e.target.value)} maxLength={120} placeholder="Ex.: navegando no celular" className="w-full rounded-xl border border-white/10 bg-surface-2 px-3 py-3 text-xs text-text-primary outline-none placeholder:text-text-dim/40" />
                </label>
              </div>

              <div className="mt-4 rounded-xl border border-white/5 bg-white/[0.025] p-3">
                <div className="flex items-center justify-between text-[10px] text-text-secondary">
                  <span className="uppercase tracking-wider">Intensidade do impulso</span>
                  <strong className="text-text-primary">{relapseUrgeIntensity}/10</strong>
                </div>
                <input type="range" min="1" max="10" value={relapseUrgeIntensity} onChange={e => setRelapseUrgeIntensity(Number(e.target.value))} className="mt-2 w-full accent-green" />
              </div>

              <div className="mt-4">
                <textarea
                  value={triggerNoteText}
                  onChange={(e) => setTriggerNoteText(e.target.value)}
                  placeholder="Anote o que aconteceu, o que percebeu ou o que gostaria de fazer diferente..."
                  className="w-full h-28 px-4 py-3 bg-surface-2 border border-white/5 focus:border-green/50 text-text-primary text-xs sm:text-sm placeholder:text-text-dim/40 rounded-2xl outline-none transition-all resize-none font-sans leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowTriggerInputModal(false);
                    setTriggerNoteText('');
                    setRelapseTriggerTag('');
                    setRelapseEmotionTag('');
                    setRelapseEnvironmentTag('');
                    setRelapsePrecedingActivity('');
                    setRelapseUrgeIntensity(5);
                  }}
                  className="py-3 px-4 bg-white/5 hover:bg-white/10 text-text-secondary font-bold uppercase tracking-wider text-[10px] rounded-xl transition-all cursor-pointer text-center border border-white/5 font-mono"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!triggerNoteText.trim() && !relapseTriggerTag && !relapseEmotionTag && !relapseEnvironmentTag && !relapsePrecedingActivity.trim()) {
                      dataStore.showNotification('Preencha ao menos uma informação para salvar o registro.', 'error');
                      return;
                    }

                    if (relapsedCheckinId) {
                      const success = await dataStore.updateAvoidanceCheckin(relapsedCheckinId, {
                        trigger_tag: relapseTriggerTag || null,
                        emotion_tag: relapseEmotionTag || null,
                        environment_tag: relapseEnvironmentTag || null,
                        preceding_activity: relapsePrecedingActivity.trim() || null,
                        urge_intensity: relapseUrgeIntensity,
                        trigger_note: triggerNoteText.trim() || null
                      });
                      if (!success) {
                        dataStore.showNotification('Não foi possível salvar a anotação. Tente novamente.', 'error');
                        return;
                      }
                      dataStore.showNotification('Anotação salva.', 'success');
                    } else {
                      dataStore.showNotification('Não encontramos o registro desta recaída.', 'error');
                      return;
                    }

                    setShowTriggerInputModal(false);
                    setTriggerNoteText('');
                    setRelapseTriggerTag('');
                    setRelapseEmotionTag('');
                    setRelapseEnvironmentTag('');
                    setRelapsePrecedingActivity('');
                    setRelapseUrgeIntensity(5);
                  }}
                  className="py-3 px-4 bg-green hover:bg-green-400 text-black font-bold uppercase tracking-wider text-[10px] rounded-xl transition-all cursor-pointer text-center font-mono"
                >
                  Salvar registro
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {isAntiVicioOpen && (
        <AntiVicioModal
          isOpen={true}
          onClose={() => setIsAntiVicioOpen(false)}
          initialHabitId={antiVicioHabitId}
          associatedCheckinId={antiVicioCheckinId}
          isVictoryMode={isAntiVicioVictory}
        />
      )}

      <DailyReopenModal
        isOpen={showReopenModal}
        onClose={() => setShowReopenModal(false)}
        onConfirm={handleReopenDay}
      />

      {/* Elemento Decorativo: Gradiente Sutil de Fundo */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[280px] h-[200px] md:w-[800px] md:h-[400px] bg-green/5 blur-[80px] md:blur-[120px] rounded-full" />
      </div>
    </section>
  );
};
