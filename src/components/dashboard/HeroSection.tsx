import { motion, AnimatePresence } from 'motion/react';
import { useState, useMemo, useEffect, useRef } from 'react';
import { useTimerStore } from '../../store/useTimerStore';
import { useDataStore } from '../../store/useDataStore';
import { usePWA } from '../../context/PWAContext';
import { Moon, X, Calendar, Shield, Bell, Brain, Hand, Flame } from 'lucide-react';
import { resolverNomeSessao, formatSessionDuration, formatTimeRange, getLocalDateString } from '../../lib/utils';
import { MOODS } from '../../lib/mood';
import { calculateAvoidanceMetrics } from './AvoidanceSection';
import { Habit, AvoidanceCheckin } from '../../types';
import { playScheduleSound } from '../../hooks/useSessionNotifications';
import { useAgendaAlertEngine } from '../../hooks/useAgendaAlertEngine';
import { AntiVicioModal } from './AntiVicioModal';

interface HeroSectionProps {
  tasks?: any[];
  onNavigateToLists?: () => void;
}

export const HeroSection = ({ tasks = [], onNavigateToLists }: HeroSectionProps) => {
  const timer = useTimerStore();
  const dataStore = useDataStore();
  
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

  const dismissAntiVicio = (habitId: string, windowLabel: string) => {
    const key = `${habitId}:${windowLabel}`;
    setDismissedAntiVicioKeys(prev => {
      const next = prev.includes(key) ? prev : [...prev, key];
      sessionStorage.setItem('dude_dismissed_anti_vicio_keys', JSON.stringify(next));
      return next;
    });
  };

  const { alertSchedule, dismissSchedule } = useAgendaAlertEngine();

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
  const todayMoods = dataStore.moodEntries ? dataStore.moodEntries.filter(m => m.date === today) : [];
  const activeMoodEntry = todayMoods.length > 0 ? todayMoods[0] : null;

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

  const todaySessions = dataStore.sessions.filter(s => getLocalDateString(new Date(s.started_at)) === today);
  const totalMinutes = todaySessions.reduce((acc, s) => acc + s.duration_minutes, 0);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const streak = dataStore.profile?.current_streak || 0;

  const compactFocusTime = hours === 0
    ? `${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`
    : `${hours}h${minutes > 0 ? ` ${minutes}m` : ''}`;

  const todayFocusFormatted = hours === 0
    ? `${minutes} ${minutes === 1 ? 'minuto focado' : 'minutos focados'}`
    : `${hours}h ${minutes}m focado${hours === 1 && minutes === 0 ? '' : 's'}`;

  const hasSessions = dataStore.sessions && dataStore.sessions.length > 0;

  const formatCompact = (totalMins: number) => {
    const h = Math.floor(totalMins / 60);
    const m = Math.round(totalMins % 60);
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  const todayMinutesToShow = totalMinutes;

  const averageData = useMemo(() => {
    const map: { [key: string]: number } = {};
    dataStore.sessions.forEach(s => {
      if (!s.completed) return;
      const sDate = getLocalDateString(new Date(s.started_at));
      const mins = s.actual_duration_minutes !== null && s.actual_duration_minutes !== undefined
        ? s.actual_duration_minutes
        : s.duration_minutes;
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

  const [showCheckinModal, setShowCheckinModal] = useState(false);

  // Estados para as frases rotativas do Chip de Monitoramento de Autocontrole
  const chipPhrases = useMemo(() => [
    "⚠ Como está sua vontade?",
    "⚠ Sua vontade está sob controle?",
    "⚠ Pausa: como você está agora?",
    "⚠ Tudo certo com seu controle?"
  ], []);
  const [chipPhraseIndex, setChipPhraseIndex] = useState(0);
  const [displayPhrase, setDisplayPhrase] = useState(chipPhrases[0]);
  const [fadePhrase, setFadePhrase] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setFadePhrase(false);
      setTimeout(() => {
        setChipPhraseIndex(prev => {
          const nextIdx = (prev + 1) % chipPhrases.length;
          setDisplayPhrase(chipPhrases[nextIdx]);
          return nextIdx;
        });
        setFadePhrase(true);
      }, 300); // 300ms de duração para o fade out
    }, 5000); // Rotação a cada 5 segundos
    return () => clearInterval(interval);
  }, [chipPhrases]);

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

  const registerCooldown = (habitId: string) => {
    const updated = { ...cooldownsVal, [habitId]: Date.now() };
    setCooldownsVal(updated);
    try {
      localStorage.setItem('dude_antivicio_cooldowns', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  };

  const registerSnooze = (habitId: string) => {
    const updated = { ...snoozesVal, [habitId]: Date.now() + 2 * 60 * 60 * 1000 };
    setSnoozesVal(updated);
    try {
      localStorage.setItem('dude_antivicio_snoozes', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
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
        
        osc. oscillators = osc;
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
    } catch (e) {
      console.error('Failed to play victory sound', e);
    }
  };

  const pendingAvoidanceHabits = useMemo(() => {
    const avoidHabits = dataStore.habits.filter(h => h.habit_mode === 'avoid');
    if (avoidHabits.length === 0 || !dataStore.profile?.id) return [];

    const now = new Date();
    const nowTime = now.getTime();
    const todayStr = getLocalDateString(now);
    const dayOfWeek = now.getDay();

    const getWeekdays = (weekdaysStr?: string): number[] => {
      if (!weekdaysStr || weekdaysStr === 'all' || weekdaysStr === '') {
        return [0, 1, 2, 3, 4, 5, 6];
      }
      return weekdaysStr.split(',').map(Number);
    };

    const results = [];

    for (const h of avoidHabits) {
      // 1. Cooldown dinâmico: 3h para hábitos contínuos (dia_todo/full_day), 4h para os demais
      const isContinuous = h.monitor_type === 'dia_todo' || h.avoidance_scope === 'full_day';
      const cooldownHours = isContinuous ? 3 : 4;
      const lastChecked = cooldownsVal[h.id] || 0;
      if (nowTime < lastChecked + cooldownHours * 60 * 60 * 1000) {
        continue;
      }

      // 2. Snooze de 2 horas
      const snoozeUntil = snoozesVal[h.id] || 0;
      if (nowTime < snoozeUntil) {
        continue;
      }

      const isJanela = h.monitor_type === 'janela' || h.avoidance_scope === 'time_window';
      const parsedWeekdays = h.monitor_weekdays
        ? getWeekdays(h.monitor_weekdays)
        : (h.recurrence_days && h.recurrence_days.length > 0
            ? h.recurrence_days.map(d => d === '7' ? 0 : parseInt(d))
            : [0, 1, 2, 3, 4, 5, 6]);

      if (!parsedWeekdays.includes(dayOfWeek)) {
        continue;
      }

      let isActiveUnit = false;
      let windowLabel = todayStr;
      let checkinPeriod = 'all';

      if (!isJanela) {
        isActiveUnit = true;
        windowLabel = todayStr;
        checkinPeriod = 'morning';
      } else {
        const mStart = h.monitor_start || h.avoidance_window_start || "18:00";
        const mEnd = h.monitor_end || h.avoidance_window_end || "22:00";
        const [startH, startM] = mStart.split(':').map(Number);
        const [endH, endM] = mEnd.split(':').map(Number);

        const wStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), startH, startM, 0, 0);
        const wEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), endH, endM, 0, 0);

        if (wEnd.getTime() < wStart.getTime()) {
          wEnd.setDate(wEnd.getDate() + 1);
        }

        if (nowTime >= wStart.getTime()) {
          isActiveUnit = true;
          windowLabel = `${todayStr}:${mStart}-${mEnd}`;
          checkinPeriod = 'window';
        }
      }

      // Check key-based dismissal
      const dismissalKey = `${h.id}:${windowLabel}`;
      if (dismissedAntiVicioKeys.includes(dismissalKey)) {
        continue;
      }

      if (isActiveUnit) {
        const cks = dataStore.avoidanceCheckins.filter(
          c => c.habit_id === h.id && 
          (c.window_label === windowLabel || (c.checkin_date === todayStr && !c.window_label))
        );
        const hasDefinitive = cks.some(
          c => c.status === 'resisti' || c.status === 'recai' || c.status === 'success' || c.status === 'relapse'
        );

        if (hasDefinitive) {
          continue;
        }

        const promptsShown = cks.filter(c => c.status === 'depois').length;
        if (promptsShown >= 3) {
          continue;
        }

        results.push({
          habit: h,
          windowLabel,
          checkinPeriod,
          promptsShown,
        });
      }
    }

    return results;
  }, [dataStore.habits, dataStore.avoidanceCheckins, dataStore.profile, dismissedAntiVicioKeys, cooldownsVal, snoozesVal]);

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
    
    const processed = avoidHabits.map(h => {
      return {
        habit: h,
        metrics: calculateAvoidanceMetrics(h, dataStore.avoidanceCheckins)
      };
    });

    // 1. Encontre o controle com maior diasLimpoSeguidos
    let bestCleanSeguidosObj = processed[0];
    for (let i = 1; i < processed.length; i++) {
      if (processed[i].metrics.diasLimpoSeguidos > bestCleanSeguidosObj.metrics.diasLimpoSeguidos) {
        bestCleanSeguidosObj = processed[i];
      }
    }

    const maxSeguidos = bestCleanSeguidosObj ? bestCleanSeguidosObj.metrics.diasLimpoSeguidos : 0;
    if (maxSeguidos > 0) {
      return maxSeguidos === 1 ? '1 dia invicto' : `${maxSeguidos} dias invictos`;
    }

    // 2. Se o maior diasLimpoSeguidos for 0, encontre o com maior maxStreak (Maior sequência)
    let bestMaxStreakObj = processed[0];
    for (let i = 1; i < processed.length; i++) {
      if (processed[i].metrics.maxStreak > bestMaxStreakObj.metrics.maxStreak) {
        bestMaxStreakObj = processed[i];
      }
    }

    const overallMaxStreak = bestMaxStreakObj ? bestMaxStreakObj.metrics.maxStreak : 0;
    if (overallMaxStreak > 0) {
      return overallMaxStreak === 1 ? 'Maior sequência: 1 dia' : `Maior sequência: ${overallMaxStreak} dias`;
    }

    // 3. Se maxStreak for 0, encontre o com maior diasLimposTotal
    let bestTotalObj = processed[0];
    for (let i = 1; i < processed.length; i++) {
      if (processed[i].metrics.diasLimposTotal > bestTotalObj.metrics.diasLimposTotal) {
        bestTotalObj = processed[i];
      }
    }

    const overallTotal = bestTotalObj ? bestTotalObj.metrics.diasLimposTotal : 0;
    if (overallTotal > 0) {
      return overallTotal === 1 ? '1 dia limpo no total' : `${overallTotal} dias limpos no total`;
    }

    // 4. Se tudo for 0 (Brand-new ou recém-criado sem checkins)
    return 'Vamos começar';
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

  const handleResisti = async (habit: Habit, windowLabel: string, checkinPeriod: string) => {
    if (!dataStore.profile?.id) return;
    playVictorySound();
    
    setAnimatingResistedHabitId(habit.id);
    dismissAntiVicio(habit.id, windowLabel);
    registerCooldown(habit.id);
    
    const todayStr = getLocalDateString(new Date());
    await dataStore.addAvoidanceCheckin({
      user_id: dataStore.profile.id,
      habit_id: habit.id,
      checkin_date: todayStr,
      checkin_period: checkinPeriod,
      status: 'success',
      window_label: windowLabel,
      prompts_shown: 1
    });

    dataStore.showNotification('Incrível! Sua força de vontade foi fortalecida. Continue firme! 🛡️', 'success');
    
    setTimeout(() => {
      setAnimatingResistedHabitId(null);
    }, 1500);
  };

  const handleRecai = async (habit: Habit, windowLabel: string, checkinPeriod: string) => {
    if (!dataStore.profile?.id) return;
    
    dismissAntiVicio(habit.id, windowLabel);
    registerCooldown(habit.id);

    const todayStr = getLocalDateString(new Date());
    const created = await dataStore.addAvoidanceCheckin({
      user_id: dataStore.profile.id,
      habit_id: habit.id,
      checkin_date: todayStr,
      checkin_period: checkinPeriod,
      status: 'relapse',
      window_label: windowLabel,
      prompts_shown: 1
    });

    if (created && created.id) {
      setRelapsedCheckinId(created.id);
    } else {
      setRelapsedCheckinId(null);
    }
    setTriggerNoteText('');

    setRelapsedHabitName(habit.name);
    setShowSupportiveRelapseModal(true);
  };

  const handleDepois = async (habit: Habit, windowLabel: string, checkinPeriod: string) => {
    if (!dataStore.profile?.id) return;
    
    dismissAntiVicio(habit.id, windowLabel);
    registerSnooze(habit.id);

    const todayStr = getLocalDateString(new Date());
    await dataStore.addAvoidanceCheckin({
      user_id: dataStore.profile.id,
      habit_id: habit.id,
      checkin_date: todayStr,
      checkin_period: checkinPeriod,
      status: 'pending',
      window_label: windowLabel,
      prompts_shown: 1
    });

    dataStore.showNotification('Acompanhamento adiado por 2 horas.', 'success');
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
    smartPhrase = "No compasso da sua meta diária. Continue focado!";
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
      "Você ainda não focou hoje. Que tal uma Sessão Profunda?",
      "Que tal começar a focar agora? O primeiro passo é o mais importante.",
      "Sua mente está pronta. Vamos iniciar uma Sessão Profunda hoje?",
      "O dia está passando. Que tal reservar um tempo para focar?"
    ]);
  } else if (averageData.hasEnoughHistory && totalMinutes > averageData.personalRecord && totalMinutes > 0) {
    reactiveLine = selectChoice([
      "Seu melhor dia de foco até agora. 🔥",
      "Incrível! Hoje é o seu dia mais focado de todos os tempos. 🏆",
      "Você quebrou seu recorde de foco diário hoje! Fantástico!",
      "Superando todos os seus limites. Hoje foi histórico! 🔥"
    ]);
  } else if (averageData.hasEnoughHistory && totalMinutes > 0 && totalMinutes < 0.8 * averageData.averageMinutes) {
    reactiveLine = selectChoice([
      "Hoje rendeu menos que sua média. Bora recuperar?",
      "Abaixo do seu ritmo normal. Que tal uma sessão rápida para retomar?",
      "O dia ainda não acabou. Um bloco de foco pode fazer a diferença hoje!",
      "Que tal ajustar o foco? Uma sessão curta ajuda a voltar ao ritmo."
    ]);
  } else if (averageData.hasEnoughHistory && totalMinutes > 0 && totalMinutes >= averageData.averageMinutes) {
    reactiveLine = selectChoice([
      `Bom ritmo hoje — ${formattedFocusTime} de foco. Continue assim.`,
      `Ótimo trabalho! Já são ${formattedFocusTime} de foco acumulados hoje.`,
      `Foco afiado hoje: ${formattedFocusTime} mantendo o controle do seu dia.`,
      `Consistência excelente! ${formattedFocusTime} dedicados ao que importa hoje.`
    ]);
  }

  // PRIORITY 2 — DAY OF WEEK (when performance is neutral or no high performance matches)
  if (!reactiveLine) {
    if (dayOfWeek === 1 && currentHour >= 5 && currentHour < 12) {
      reactiveLine = selectChoice([
        "Semana nova. Comece com uma sessão e dê o tom.",
        "Segunda-feira pede foco total para começar a semana com tudo.",
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
        "Mente fresca e silenciosa nas primeiras horas. Melhor momento para focar."
      ]);
    } else if (currentHour >= 12 && currentHour < 18) {
      reactiveLine = selectChoice([
        "Tarde rende. Que tal um bloco de foco?",
        "Metade do dia já foi. Mantenha a energia e a consistência.",
        "Hora de avançar nos projetos. Que tal uma sessão produtiva?"
      ]);
    } else if (currentHour >= 18 && currentHour < 23) {
      reactiveLine = selectChoice([
        "Boa hora pra fechar uma última sessão do dia.",
        "Feche o dia com chave de ouro: mais um bloco de foco profundo.",
        "O dia está terminando. Que tal resolver aquela última pendência?"
      ]);
    } else {
      reactiveLine = selectChoice([
        "Tá tarde. Uma sessão curta e depois descanse.",
        "Quase hora de dormir. Se for focar, faça um bloco curto.",
        "Silêncio da noite ajuda a focar, mas priorize seu sono."
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
                <span className={`transition-opacity duration-300 pointer-events-none ${fadePhrase ? 'opacity-100' : 'opacity-0'}`}>
                  {displayPhrase}
                </span>
                <span className="text-red-400/40 text-[9px] font-mono font-medium leading-none whitespace-nowrap">
                  ({pendingAvoidanceHabits.length})
                </span>
              </button>
            </div>
          )}

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

          {/* Nudge Banner for Mood Rastreamento */}
          {dataStore.profile?.mood_status === 'disabled' && !dataStore.profile?.hide_mood_nudge && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm mt-3 p-4 bg-[#6ee7a8]/5 border border-[#6ee7a8]/10 rounded-2xl flex items-start gap-3 text-left relative z-10"
            >
              <div className="flex-1 space-y-1">
                <span className="text-[10px] sm:text-xs font-bold text-text flex items-center gap-1.5">
                  ⚡ Insights de Produtividade Desativados
                </span>
                <p className="text-[10px] sm:text-[11px] text-text-dim leading-relaxed font-light">
                  Descubra os horários em que você rende mais reativando o radar de energia.
                </p>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await dataStore.updateProfileData(dataStore.profile!.id, {
                        mood_status: 'active'
                      });
                      dataStore.showNotification('Radar de humor reativado com sucesso!', 'success');
                    } catch (e: any) {
                      dataStore.showNotification('Não foi possível ativar: ' + e.message, 'error');
                    }
                  }}
                  className="mt-2.5 px-3 py-1.5 bg-[#6ee7a8] hover:bg-[#6ee7a8]/90 text-black text-[9px] font-bold uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
                >
                  Reativar Radar
                </button>
              </div>

              <button
                type="button"
                onClick={async () => {
                  try {
                    await dataStore.updateProfileData(dataStore.profile!.id, {
                      hide_mood_nudge: true
                    });
                    dataStore.showNotification('Aviso dispensado permanentemente.', 'success');
                  } catch (e: any) {
                    dataStore.showNotification('Não foi possível dispensar: ' + e.message, 'error');
                  }
                }}
                className="p-1 text-text-dim/30 hover:text-text rounded-full hover:bg-white/5 transition-colors cursor-pointer shrink-0"
                title="Não lembrar novamente"
              >
                <X size={14} />
              </button>
            </motion.div>
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

          {/* SMART STATUS PHRASE */}
          <p className="text-xs sm:text-sm font-medium italic text-text-dim/80 max-w-sm text-center leading-relaxed select-none px-4">
            "{smartPhrase}"
          </p>
        </div>

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
                  ● {alertSchedule.isOverdue ? 'Sessão Profunda Atrasada' : 'Sessão Profunda Iminente'}
                </p>
                <span className="text-[9px] font-mono font-bold bg-white/5 border border-white/5 px-2.5 py-0.5 rounded-full text-text-secondary/60">
                  {alertSchedule.scheduled_time}
                </span>
              </div>

              <div className="space-y-1 text-left">
                <h4 className="text-sm font-bold text-text-primary leading-tight font-sans">
                  {alertSchedule.isOverdue ? (
                    <>Sua Sessão Profunda está atrasada! <span className="text-amber-400 font-extrabold">"{alertSchedule.activity.title}"</span> deveria ter começado.</>
                  ) : (
                    <>Você tem uma Sessão Profunda agendada em breve: <span className="text-[#6ee7a8] font-extrabold">"{alertSchedule.activity.title}"</span>.</>
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
                    Check-in de Autocontrole
                  </h4>
                  <p className="text-[11px] text-text-dim/80 max-w-xs mx-auto">
                    Como está sua força de vontade hoje? Mantenha sua mente sob vigília inteligente e livre de vícios.
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
                    const { habit, windowLabel, checkinPeriod } = currentItem;
                    const metrics = calculateAvoidanceMetrics(habit, dataStore.avoidanceCheckins);
                    const isAnimating = animatingResistedHabitId === habit.id;
                    const isJanela = habit.monitor_type === 'janela' || habit.avoidance_scope === 'time_window';
                    const mStart = habit.monitor_start || habit.avoidance_window_start || "18:00";
                    const mEnd = habit.monitor_end || habit.avoidance_window_end || "22:00";

                    return (
                      <div key={habit.id} className="bg-surface-1/50 border border-border-custom/50 rounded-2xl p-5 space-y-4 relative overflow-hidden text-left">
                        <div className="absolute inset-0 bg-green/5 animate-pulse opacity-20 pointer-events-none" />

                        <div className="flex justify-between items-center relative z-10 w-full">
                          <p className="text-[9px] uppercase tracking-widest font-bold text-green flex items-center gap-1.5 font-mono">
                            <span className="w-1.5 h-1.5 rounded-full bg-green animate-ping shrink-0" />
                            ● {habit.name}
                          </p>
                          <div className="flex items-center gap-1.5 bg-green/10 border border-green/20 px-2 py-0.5 rounded-lg shrink-0">
                            <span className="text-[8px] font-mono font-bold uppercase text-green">Janelas limpas:</span>
                            <AnimatePresence mode="popLayout">
                              <motion.span
                                key={isAnimating ? 'anim' : 'static'}
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1.1, opacity: 1 }}
                                exit={{ scale: 0.8, opacity: 0 }}
                                className="text-xs font-mono font-black text-green inline-block"
                              >
                                {isAnimating ? metrics.diasLimpoSeguidos + 1 : metrics.diasLimpoSeguidos}
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
                              Janela Programada: {mStart} às {mEnd}
                            </p>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2.5 relative z-10 font-sans">
                          <button
                            type="button"
                            onClick={async () => {
                              if (dataStore.profile?.id) {
                                playVictorySound();
                                setAnimatingResistedHabitId(habit.id);

                                // Immediate silent save
                                const todayStr = getLocalDateString(new Date());
                                const checkinDetails = {
                                  user_id: dataStore.profile.id,
                                  habit_id: habit.id,
                                  checkin_date: todayStr,
                                  checkin_period: checkinPeriod || 'window',
                                  status: 'success' as const,
                                  window_label: windowLabel,
                                  prompts_shown: 1,
                                  created_at: new Date().toISOString()
                                };
                                const created = await dataStore.addAvoidanceCheckin(checkinDetails);
                                const checkinId = created ? created.id : undefined;

                                setAntiVicioHabitId(habit.id);
                                setAntiVicioCheckinId(checkinId);
                                setIsAntiVicioVictory(true);
                                setIsAntiVicioOpen(true);

                                dismissAntiVicio(habit.id, windowLabel);
                                registerCooldown(habit.id);

                                setTimeout(() => {
                                  setAnimatingResistedHabitId(null);
                                }, 1500);
                              }
                            }}
                            className="py-3 px-3 bg-green hover:brightness-110 text-background rounded-xl font-bold uppercase tracking-wider text-[10px] transition-all hover:scale-102 cursor-pointer text-center"
                          >
                            ✓ Resisti
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (dataStore.profile?.id) {
                                // Immediate silent save
                                const todayStr = getLocalDateString(new Date());
                                const checkinDetails = {
                                  user_id: dataStore.profile.id,
                                  habit_id: habit.id,
                                  checkin_date: todayStr,
                                  checkin_period: checkinPeriod || 'window',
                                  status: 'relapse' as const,
                                  window_label: windowLabel,
                                  prompts_shown: 1,
                                  created_at: new Date().toISOString()
                                };
                                const created = await dataStore.addAvoidanceCheckin(checkinDetails);
                                const checkinId = created ? created.id : undefined;

                                setAntiVicioHabitId(habit.id);
                                setAntiVicioCheckinId(checkinId);
                                setIsAntiVicioVictory(false);
                                setIsAntiVicioOpen(true);

                                dismissAntiVicio(habit.id, windowLabel);
                                registerCooldown(habit.id);
                              }
                            }}
                            className="py-3 px-3 bg-red-400/10 hover:bg-red-400/20 border border-red-400/20 text-red-300 rounded-xl font-bold uppercase tracking-wider text-[10px] transition-all hover:scale-102 cursor-pointer text-center"
                          >
                            Recaí
                          </button>
                        </div>

                        <div className="relative z-10">
                          <button
                            type="button"
                            onClick={() => handleDepois(habit, windowLabel, checkinPeriod)}
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
              <span className={`transition-opacity duration-300 pointer-events-none ${fadePhrase ? 'opacity-100' : 'opacity-0'}`}>
                {displayPhrase}
              </span>
              <span className="text-red-400/40 text-[10px] font-mono font-bold leading-none whitespace-nowrap">
                ({pendingAvoidanceHabits.length})
              </span>
            </motion.button>
          )}

          {/* Placeholder silencioso no mobile/desktop enquanto os hábitos carregam (evita flash do botão verde) */}
          {!dataStore.initialFetchDone && (
            <div className="h-[56px] w-full max-w-[340px] sm:max-w-md md:max-w-xl mx-auto" />
          )}

          {dataStore.initialFetchDone && (
            <>
              {/* SP Button */}
              <button 
                onClick={openDeepSession}
                className={`group relative px-5 sm:px-10 py-4 sm:py-5 bg-green text-[#0D0F14] rounded-2xl overflow-hidden transition-all hover:brightness-105 active:scale-[0.98] ${
                  hasAvoidance ? 'hidden md:flex' : 'flex'
                } flex-col items-center justify-center gap-1.5 mx-auto shadow-[0_4px_12px_rgba(110,231,168,0.15)] sm:shadow-[0_20px_40px_rgba(110,231,168,0.25)] touch-manipulation min-h-[56px] w-full max-w-[340px] sm:max-w-md md:max-w-xl hover:scale-[1.02] duration-200 cursor-pointer text-center`}
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

              {/* Autocontrole Strip - MOBILE & DESKTOP */}
              <div className="w-full max-w-[340px] sm:max-w-md md:max-w-xl mx-auto animate-fade-in pt-1">
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
                      Acalme sua mente e reduza sua impulsividade
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
            {/* Slot 1: Horas Focadas */}
            <div className="flex-1 flex flex-col items-center justify-center border-r border-white/5 px-2">
              <span className="text-2xl sm:text-3xl font-mono font-bold text-text tracking-tighter leading-none">
                {formatCompact(todayMinutesToShow)}
              </span>
              <span className="text-[10px] text-text-dim/60 text-center font-sans tracking-wide leading-tight mt-1.5 px-1 whitespace-nowrap">
                Horas Focadas
              </span>
            </div>

            {/* Slot 2: Sessões Profundas */}
            <div className="flex-1 flex flex-col items-center justify-center border-r border-white/5 px-2">
              <span className="text-2xl sm:text-3xl font-mono font-bold text-text tracking-tighter leading-none">
                {todaySessions.length}
              </span>
              <span className="text-[10px] text-text-dim/60 text-center font-sans tracking-wide leading-tight mt-1.5 px-1 whitespace-nowrap">
                {todaySessions.length === 1 ? 'Sessão Profunda' : 'Sessões'}
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
            {/* Slot 1: Horas Focadas */}
            <div className="flex-1 flex flex-col items-center justify-center border-r border-white/5 px-4">
              <span className="text-3xl md:text-4xl font-mono font-bold text-text tracking-tighter leading-none">
                {formatCompact(todayMinutesToShow)}
              </span>
              <span className="text-[10px] text-text-dim/70 text-center font-sans tracking-wider leading-tight mt-2 px-1 whitespace-nowrap uppercase">
                Horas Focadas
              </span>
            </div>

            {/* Slot 2: Sessões Profundas */}
            <div className="flex-1 flex flex-col items-center justify-center border-r border-white/5 px-4">
              <span className="text-3xl md:text-4xl font-mono font-bold text-text tracking-tighter leading-none">
                {todaySessions.length}
              </span>
              <span className="text-[10px] text-text-dim/70 text-center font-sans tracking-wider leading-tight mt-2 px-1 whitespace-nowrap uppercase">
                {todaySessions.length === 1 ? 'Sessão Profunda' : 'Sessões Profundas'}
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

          {/* Summary Card for Today's Task List */}
          {/* DESKTOP VERSION - flat, de-boxed with subtle progress bar */}
          <div
            onClick={() => onNavigateToLists?.()}
            className="hidden md:flex w-full max-w-xl mx-auto pt-4 pb-2 text-center cursor-pointer select-none mt-2 animate-fade-in flex-col items-center justify-center hover:opacity-85 transition-opacity"
          >
            <div className="flex items-center gap-2.5">
              <span className="text-xl">📋</span>
              <span className="text-sm font-semibold text-text-primary leading-normal">
                Você fez <span className="text-green font-bold">{completedTasksCount}</span> das <span className="text-text-primary font-bold">{totalTasksCount}</span> tarefas que planejou para hoje
              </span>
            </div>
            {totalTasksCount > 0 && (
              <div className="w-full max-w-[240px] h-0.5 bg-white/10 rounded-full mt-2.5 overflow-hidden">
                <div 
                  className="h-full bg-green rounded-full transition-all duration-500" 
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
            <div className="flex items-center gap-2">
              <span className="text-[15px]">📋</span>
              <span className="text-[11px] sm:text-xs font-semibold text-text-primary leading-normal">
                Você fez <span className="text-green font-bold">{completedTasksCount}</span> das <span className="text-text-primary font-bold">{totalTasksCount}</span> tarefas que planejou para hoje
              </span>
            </div>
            {totalTasksCount > 0 && (
              <div className="w-full max-w-[180px] h-0.5 bg-white/10 rounded-full mt-2 overflow-hidden">
                <div 
                  className="h-full bg-green rounded-full transition-all duration-500" 
                  style={{ width: `${(completedTasksCount / totalTasksCount) * 100}%` }} 
                />
              </div>
            )}
          </div>

          {/* Prominent Adjust Goal Control */}
          <div className="flex flex-col items-center justify-center pt-3 pb-1 w-full">
            {!isEditingGoal ? (
              <button
                onClick={() => {
                  setTempGoal(targetMinutes);
                  setIsEditingGoal(true);
                }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border-custom hover:border-green/20 bg-surface-1/50 hover:bg-surface-1/80 text-xs font-semibold text-text-dim hover:text-green transition-all shadow-sm cursor-pointer select-none"
              >
                <span>⚙️</span>
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
        </div>

        {/* Standalone Shutdown Button ("Fechar meu dia") */}
        {todaySessions.length > 0 && (
          <div className="w-full flex justify-center pt-2">
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('trigger-daily-shutdown'))}
              className="w-full max-w-[340px] py-3 sm:py-3.5 border border-green/20 hover:border-green/45 bg-green/5 hover:bg-green/10 text-green font-mono font-bold uppercase tracking-wider text-[11px] rounded-2xl flex items-center justify-center gap-2 group transition-all duration-300 select-none cursor-pointer transform hover:scale-[1.01] active:scale-[0.99]"
            >
              <Moon size={13} className="fill-green/15 group-hover:scale-115 transition-transform" />
              <span>Fechar meu dia</span>
            </button>
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
                  new Date(s.started_at) >= startOfWeek && 
                  s.completed
                );

                const minutesByDay: { [dateStr: string]: number } = {};
                habitSessionsThisWeek.forEach(s => {
                  const dStr = getLocalDateString(new Date(s.started_at));
                  const duration = s.actual_duration_minutes !== null ? s.actual_duration_minutes : s.duration_minutes;
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

                const completedDaysCount = h.habit_mode === 'avoid'
                  ? Object.keys(minutesByDay).filter(dStr => minutesByDay[dStr] >= h.minutes_per_session).length
                  : (
                      habitSessionsThisWeek.filter(s => {
                        const duration = s.actual_duration_minutes !== null ? s.actual_duration_minutes : s.duration_minutes;
                        return duration >= h.minutes_per_session;
                      }).length +
                      manualCompletionsThisWeek.filter(hc => hc.duration_minutes >= h.minutes_per_session).length
                    );

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
                              className={`w-2.5 h-2.5 md:w-3 md:h-3 rounded-full relative shrink-0 ${
                                state === 'completed'
                                  ? 'bg-green shadow-[0_0_6px_rgba(110,231,183,0.4)]'
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
                Sem culpa nenhuma. O autocontrole de <strong className="text-red-400 font-bold">{relapsedHabitName}</strong> é uma habilidade que você treina dia após dia, não um castigo. Recaídas são dados de aprendizado para amanhã, e nunca definem sua identidade.
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
                  Mapear Gatilho 🧬
                </button>
                <button
                  onClick={() => setShowSupportiveRelapseModal(false)}
                  className="py-3 px-4 bg-white/5 hover:bg-white/10 text-text-secondary font-bold uppercase tracking-wider text-[10px] rounded-xl transition-all cursor-pointer text-center border border-white/5"
                >
                  Continuar Firme
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
                O que causou essa recaída?
              </h3>
              
              <p className="text-xs sm:text-sm text-text-secondary/70 mt-2 leading-relaxed">
                Mapear o gatilho (emoção, local, companhia, pensamento) é o passo mais maduro para prevenir a próxima. Seja honesto e detalhado.
              </p>

              <div className="mt-4">
                <textarea
                  value={triggerNoteText}
                  onChange={(e) => setTriggerNoteText(e.target.value)}
                  placeholder="Ex: Tive um dia estressante no trabalho, cheguei em casa cansado e acionei o hábito sem pensar..."
                  className="w-full h-32 px-4 py-3 bg-surface-2 border border-white/5 focus:border-green/50 text-text-primary text-xs sm:text-sm placeholder:text-text-dim/40 rounded-2xl outline-none transition-all resize-none font-sans leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowTriggerInputModal(false);
                    setTriggerNoteText('');
                  }}
                  className="py-3 px-4 bg-white/5 hover:bg-white/10 text-text-secondary font-bold uppercase tracking-wider text-[10px] rounded-xl transition-all cursor-pointer text-center border border-white/5 font-mono"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!triggerNoteText.trim()) {
                      dataStore.showNotification('Por favor, digite o gatilho antes de salvar.', 'error');
                      return;
                    }

                    if (relapsedCheckinId) {
                      const success = await dataStore.updateAvoidanceCheckin(relapsedCheckinId, {
                        trigger_note: triggerNoteText.trim()
                      });
                      if (success) {
                        dataStore.showNotification('Gatilho mapeado com sucesso. Siga firme! 🧬', 'success');
                      } else {
                        dataStore.showNotification('Gatilho salvo offline. Continue lutando!', 'success');
                      }
                    } else {
                      dataStore.showNotification('Erro: ID da recaída não encontrado.', 'error');
                    }
                    
                    setShowTriggerInputModal(false);
                    setTriggerNoteText('');
                  }}
                  className="py-3 px-4 bg-green hover:bg-green-400 text-black font-bold uppercase tracking-wider text-[10px] rounded-xl transition-all cursor-pointer text-center font-mono"
                >
                  Salvar Gatilho
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AntiVicioModal
        isOpen={isAntiVicioOpen}
        onClose={() => setIsAntiVicioOpen(false)}
        initialHabitId={antiVicioHabitId}
        associatedCheckinId={antiVicioCheckinId}
        isVictoryMode={isAntiVicioVictory}
      />

      {/* Elemento Decorativo: Gradiente Sutil de Fundo */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[280px] h-[200px] md:w-[800px] md:h-[400px] bg-green/5 blur-[80px] md:blur-[120px] rounded-full" />
      </div>
    </section>
  );
};
