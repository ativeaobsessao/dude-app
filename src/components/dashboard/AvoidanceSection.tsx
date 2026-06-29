import React, { useState, useEffect } from 'react';
import { useDataStore } from '../../store/useDataStore';
import { useAuthStore } from '../../store/useAuthStore';
import { Shield, ShieldAlert, Sparkles, Flame, Plus, Brain, Calendar, Trash2, Pencil, BarChart2, ChevronDown, Check, X, AlertTriangle, UserCheck, Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Habit, AvoidanceCheckin } from '../../types';
import { AntiVicioModal } from './AntiVicioModal';

// Helper to get formatted date string: YYYY-MM-DD
const getLocalDateString = (d = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Precise clean-time and streak metrics calculator
export function calculateAvoidanceMetrics(ah: Habit, allCheckins: AvoidanceCheckin[]) {
  const checkins = allCheckins.filter(c => c.habit_id === ah.id);
  const todayStr = getLocalDateString();
  
  // Normalize victories and relapses
  const isVictory = (status: string) => status === 'success' || status === 'resisti';
  const isRelapse = (status: string) => status === 'relapse' || status === 'recai';

  // Sort relapses in ascending order of date/time
  const relapseCheckins = checkins
    .filter(c => isRelapse(c.status))
    .sort((a, b) => {
      const aTime = a.created_at ? new Date(a.created_at).getTime() : new Date(a.checkin_date + 'T12:00:00').getTime();
      const bTime = b.created_at ? new Date(b.created_at).getTime() : new Date(b.checkin_date + 'T12:00:00').getTime();
      return aTime - bTime;
    });
  
  // 1. Determine start limit (last relapse or creation)
  let lastRelapseTimestamp = 0;
  const lastRelapse = relapseCheckins[relapseCheckins.length - 1];
  if (lastRelapse) {
    lastRelapseTimestamp = lastRelapse.created_at 
      ? new Date(lastRelapse.created_at).getTime() 
      : new Date(lastRelapse.checkin_date + 'T12:00:00').getTime();
  } else {
    lastRelapseTimestamp = new Date(ah.created_at).getTime();
  }

  const startLimit = lastRelapseTimestamp;

  // 2. Identify if Janela specific
  const isJanela = ah.monitor_type === 'janela' || ah.avoidance_scope === 'time_window';
  
  const getWeekdays = (weekdaysStr?: string): number[] => {
    if (!weekdaysStr || weekdaysStr === 'all' || weekdaysStr === '') {
      return [0, 1, 2, 3, 4, 5, 6];
    }
    return weekdaysStr.split(',').map(Number);
  };

  const mStart = ah.monitor_start || ah.avoidance_window_start || "18:00";
  const mEnd = ah.monitor_end || ah.avoidance_window_end || "22:00";
  const mWeekdays = ah.monitor_weekdays || "all";
  
  const parsedWeekdays = ah.monitor_weekdays 
    ? getWeekdays(ah.monitor_weekdays)
    : (ah.recurrence_days && ah.recurrence_days.length > 0
        ? ah.recurrence_days.map(d => d === '7' ? 0 : parseInt(d))
        : [0, 1, 2, 3, 4, 5, 6]);

  const [startH, startM] = mStart.split(':').map(Number);
  const [endH, endM] = mEnd.split(':').map(Number);

  let currentCleanMs = 0;
  let diasLimpoSeguidos = 0;
  let maxStreak = 0;

  const getDaysBetween = (d1Str: string, d2Str: string) => {
    const d1 = new Date(d1Str + 'T12:00:00');
    const d2 = new Date(d2Str + 'T12:00:00');
    return Math.max(0, Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)));
  };

  if (isJanela) {
    // A. Clean time is total duration of windows occurring and clean
    const limitDate = new Date(startLimit);
    const nowDate = new Date();
    
    const cursor = new Date(limitDate.getFullYear(), limitDate.getMonth(), limitDate.getDate(), 0, 0, 0, 0);
    const endCursorLimit = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate() + 1, 0, 0, 0, 0);
    
    let totalOverlapMs = 0;
    let completedCount = 0;
    
    while (cursor.getTime() < endCursorLimit.getTime()) {
      if (parsedWeekdays.includes(cursor.getDay())) {
        const wStart = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), startH, startM, 0, 0);
        const wEnd = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), endH, endM, 0, 0);
        if (wEnd.getTime() < wStart.getTime()) {
          wEnd.setDate(wEnd.getDate() + 1);
        }
        
        const activeStart = Math.max(wStart.getTime(), startLimit);
        const activeEnd = Math.min(wEnd.getTime(), Date.now());
        
        if (activeEnd > activeStart) {
          totalOverlapMs += (activeEnd - activeStart);
        }
        
        // Count fully completed windows since startLimit
        if (wStart.getTime() >= startLimit && wEnd.getTime() <= Date.now()) {
          completedCount++;
        }
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    
    currentCleanMs = totalOverlapMs;
    diasLimpoSeguidos = completedCount;

    // Calculate max streak of completed windows
    const startDayTime = new Date(ah.created_at).getTime();
    const relapseTimes = relapseCheckins.map(c => c.created_at ? new Date(c.created_at).getTime() : new Date(c.checkin_date + 'T12:00:00').getTime());
    
    const getCompletedWindowsBetweenObjs = (t1: number, t2: number) => {
      const lDate = new Date(t1);
      const cur = new Date(lDate.getFullYear(), lDate.getMonth(), lDate.getDate(), 0, 0, 0, 0);
      const endLimit = new Date(t2);
      let count = 0;
      while (cur.getTime() <= endLimit.getTime()) {
        if (parsedWeekdays.includes(cur.getDay())) {
          const wStart = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate(), startH, startM, 0, 0);
          const wEnd = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate(), endH, endM, 0, 0);
          if (wEnd.getTime() < wStart.getTime()) {
            wEnd.setDate(wEnd.getDate() + 1);
          }
          if (wStart.getTime() >= t1 && wEnd.getTime() <= t2) {
            count++;
          }
        }
        cur.setDate(cur.getDate() + 1);
      }
      return count;
    };

    let times = [startDayTime, ...relapseTimes, Date.now()];
    let streaks: number[] = [];
    for (let i = 0; i < times.length - 1; i++) {
      streaks.push(getCompletedWindowsBetweenObjs(times[i], times[i+1]));
    }
    maxStreak = Math.max(...streaks, diasLimpoSeguidos);

  } else {
    // B. Dia todo
    currentCleanMs = Math.max(0, Date.now() - startLimit);
    
    const todayHasRelapse = relapseCheckins.some(c => c.checkin_date === todayStr);
    if (!todayHasRelapse) {
      if (lastRelapse) {
        diasLimpoSeguidos = getDaysBetween(lastRelapse.checkin_date, todayStr);
      } else {
        diasLimpoSeguidos = getDaysBetween(ah.created_at.split('T')[0], todayStr) + 1;
      }
    }

    const startDay = ah.created_at.split('T')[0];
    const relapseDates = relapseCheckins.map(c => c.checkin_date);
    
    if (relapseDates.length === 0) {
      maxStreak = getDaysBetween(startDay, todayStr) + 1;
    } else {
      maxStreak = Math.max(maxStreak, getDaysBetween(startDay, relapseDates[0]));
      for (let i = 0; i < relapseDates.length - 1; i++) {
        const gap = getDaysBetween(relapseDates[i], relapseDates[i+1]) - 1;
        maxStreak = Math.max(maxStreak, gap);
      }
      const lastGap = getDaysBetween(relapseDates[relapseDates.length - 1], todayStr);
      maxStreak = Math.max(maxStreak, lastGap);
    }
    maxStreak = Math.max(maxStreak, diasLimpoSeguidos);
  }

  // 3. Format text representation
  let tempoLimpoAtualText = "";
  let currentCleanDays = 0;
  let currentCleanHours = 0;
  let currentCleanMins = 0;
  let currentCleanSecs = 0;

  if (isJanela && currentCleanMs <= 0) {
    tempoLimpoAtualText = "Aguardando janela...";
  } else {
    currentCleanDays = Math.floor(currentCleanMs / (1000 * 60 * 60 * 24));
    currentCleanHours = Math.floor((currentCleanMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    currentCleanMins = Math.floor((currentCleanMs % (1000 * 60 * 60)) / (1000 * 60));
    currentCleanSecs = Math.floor((currentCleanMs % (1000 * 60)) / 1000);
    
    if (currentCleanDays > 0) {
      tempoLimpoAtualText = `${currentCleanDays}d ${currentCleanHours}h ${currentCleanMins}m`;
    } else if (currentCleanHours > 0) {
      tempoLimpoAtualText = `${currentCleanHours}h ${currentCleanMins}m`;
    } else if (currentCleanMins > 0) {
      tempoLimpoAtualText = `${currentCleanMins}m ${currentCleanSecs}s`;
    } else {
      tempoLimpoAtualText = `${currentCleanSecs}s`;
    }
  }
  
  const tempoLimpoSubtitle = lastRelapse ? "desde a última recaída" : "desde o início do controle";

  // 4. Dias Limpos no Total: Fim do reset incorreto.
  // O tempo total limpo é a soma absoluta dos dias decorridos menos as recaídas (âncora de custo irrecuperável).
  const absoluteStartDayStr = ah.created_at.split('T')[0];
  const totalDaysSinceCreation = getDaysBetween(absoluteStartDayStr, todayStr) + 1;
  const totalRelapseDays = new Set(relapseCheckins.map(c => c.checkin_date)).size;
  const diasLimposTotal = Math.max(0, totalDaysSinceCreation - totalRelapseDays);

  return {
    tempoLimpoAtualText,
    tempoLimpoSubtitle,
    diasLimpoSeguidos,
    diasLimposTotal,
    maxStreak,
    currentCleanMs,
    currentCleanDays,
    currentCleanHours,
    currentCleanMins,
    currentCleanSecs
  };
}

interface AvoidanceCardProps {
  key?: string | number;
  habit: Habit;
  metrics: any;
  promptVisible: boolean;
  activePromptPeriod: string | null;
  onCheckinSubmit: (habitId: string, period: any, status: 'success' | 'relapse', triggerTag?: string, triggerNote?: string) => Promise<void>;
  onEdit: (habit: Habit) => void;
  onDelete: (id: string, name: string) => void;
  onOpenRelapseModal: (habitId: string, habitName: string) => void;
  onSetUrgeTimer: (value: number) => void;
  habitCheckins: any[];
  last14Days: string[];
}

const AvoidanceCard = ({
  habit,
  metrics,
  promptVisible,
  activePromptPeriod,
  onCheckinSubmit,
  onEdit,
  onDelete,
  onOpenRelapseModal,
  onSetUrgeTimer,
  habitCheckins,
  last14Days
}: AvoidanceCardProps) => {
  const days = metrics.currentCleanDays || 0;
  const hours = metrics.currentCleanHours || 0;
  const mins = metrics.currentCleanMins || 0;
  const secs = metrics.currentCleanSecs || 0;

  const totalLimpo = metrics.diasLimposTotal || 0;

  let streakText = "";
  if (habit.monitor_type === 'janela' && metrics.currentCleanMs <= 0) {
    streakText = "Aguardando janela";
  } else if (days >= 1) {
    streakText = `${days} ${days === 1 ? 'dia invicto' : 'dias invictos'}`;
  } else if (hours >= 1) {
    streakText = `${hours} ${hours === 1 ? 'hora invicta' : 'horas invictas'}`;
  } else if (mins >= 1) {
    streakText = `${mins} ${mins === 1 ? 'minuto invicto' : 'minutos invictos'}`;
  } else {
    streakText = `${secs} ${secs === 1 ? 'segundo invicto' : 'segundos invictos'}`;
  }

  return (
    <div
      id={`avoidance-card-${habit.id}`}
      className="p-8 rounded-[28px] bg-zinc-950/40 backdrop-blur-xl border border-white/5 hover:border-white/10 transition-all flex flex-col justify-between gap-6 select-none"
    >
      <div className="flex justify-between items-start">
        <div className="space-y-1 text-left">
          <h3 className="text-4xl sm:text-5xl font-light text-white tracking-tight leading-none">
            {totalLimpo} {totalLimpo === 1 ? 'Dia Livre' : 'Dias Livres'}
          </h3>
          <h4 className="text-sm font-medium text-white/50 tracking-wide font-sans mt-2">
            {habit.name}
          </h4>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(habit); }}
            className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
            title="Editar"
          >
            <Pencil size={16} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(habit.id, habit.name); }}
            className="p-2 text-white/40 hover:text-red-400 hover:bg-white/10 rounded-full transition-colors cursor-pointer"
            title="Remover"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="space-y-6">
        <p className="text-xs text-zinc-500 font-light block font-sans text-left">
          Ofensiva atual: {streakText}
        </p>

        <div className="pt-2">
          <button
            onClick={(e) => { e.stopPropagation(); onSetUrgeTimer(600); }}
            className="py-4 bg-white/5 hover:bg-white/10 backdrop-blur-md border border-white/10 text-white rounded-[20px] text-xs font-semibold uppercase tracking-[0.15em] transition-all duration-200 cursor-pointer w-full flex items-center justify-center gap-2 shadow-lg"
          >
            <Shield size={16} className="text-emerald-400" />
            BLINDAGEM
          </button>
        </div>
      </div>
    </div>
  );
};

export const AvoidanceSection = () => {
  const { user } = useAuthStore();
  const dataStore = useDataStore();
  
  const [activePromptHabitId, setActivePromptHabitId] = useState<string | null>(null);
  const [activePromptPeriod, setActivePromptPeriod] = useState<string | null>(null);
  const [isAntiVicioOpen, setIsAntiVicioOpen] = useState(false);
  const [antiVicioHabitId, setAntiVicioHabitId] = useState<string | undefined>(undefined);
  const [isAntiVicioVictory, setIsAntiVicioVictory] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [relapseModal, setRelapseModal] = useState<{
    isOpen: boolean;
    habitId: string;
    habitName: string;
    step: 'trigger' | 'feedback';
    totalCleanDays?: number;
  } | null>(null);
  const [customTriggerNote, setCustomTriggerNote] = useState('');

  const [tick, setTick] = useState(0);

  // Periodical ticker to update the clean-time counters in real time (every 10s)
  useEffect(() => {
    const timer = setInterval(() => {
      setTick(t => t + 1);
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Filtering habits centered on anti-vício (habit_mode === 'avoid')
  const avoidHabits = dataStore.habits.filter(h => h.habit_mode === 'avoid');

  // Listen to open-avoidance-history custom event
  useEffect(() => {
    const handleOpenHistory = () => {
      setShowHistoryModal(true);
    };
    window.addEventListener('open-avoidance-history', handleOpenHistory);
    return () => {
      window.removeEventListener('open-avoidance-history', handleOpenHistory);
    };
  }, []);

  // Trigger avoidance check-in evaluations periodically (in-app per-period)
  useEffect(() => {
    if (!user || avoidHabits.length === 0) return;

    const evaluateCheckins = () => {
      const todayStr = getLocalDateString();
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinutesTotal = currentHour * 60 + now.getMinutes();

      // Day of week: '1' -> Seg, '7' -> Dom
      const dayOfWeek = now.getDay();
      const currentDayStr = dayOfWeek === 0 ? '7' : String(dayOfWeek);

      for (const habit of avoidHabits) {
        // Is the habit active on this weekday?
        const isTodayActive = !habit.recurrence_days || 
                              habit.recurrence_days.length === 0 || 
                              habit.recurrence_days.includes(currentDayStr);

        if (!isTodayActive) continue;

        // Fetch completed checkins for this habit for today
        const todaysCheckins = dataStore.avoidanceCheckins.filter(
          c => c.habit_id === habit.id && c.checkin_date === todayStr
        );

        if (habit.avoidance_scope === 'time_window') {
          const startStr = habit.avoidance_window_start || '09:00';
          const endStr = habit.avoidance_window_end || '18:00';
          
          const [sh, sm] = startStr.split(':').map(Number);
          const [eh, em] = endStr.split(':').map(Number);
          
          let startMin = sh * 60 + sm;
          let endMin = eh * 60 + em;
          if (endMin < startMin) endMin += 1440;
          
          const duration = endMin - startMin;
          const currentAdjustedMin = (currentMinutesTotal < startMin && currentMinutesTotal < 120) 
            ? currentMinutesTotal + 1440 
            : currentMinutesTotal;

          if (currentAdjustedMin >= startMin && currentAdjustedMin <= endMin) {
            const intensity = habit.avoidance_checkin_intensity || 'balanced';
            const countRequired = intensity === 'light' ? 1 : intensity === 'balanced' ? 2 : 3;
            const elapsed = currentAdjustedMin - startMin;
            let dueCount = 0;

            if (countRequired === 1) {
              if (elapsed >= duration * 0.5) dueCount = 1;
            } else if (countRequired === 2) {
              if (elapsed >= duration * 0.33) dueCount = 1;
              if (elapsed >= duration * 0.66) dueCount = 2;
            } else {
              if (elapsed >= duration * 0.25) dueCount = 1;
              if (elapsed >= duration * 0.5) dueCount = 2;
              if (elapsed >= duration * 0.75) dueCount = 3;
            }

            const windowCheckinsCount = todaysCheckins.filter(c => c.checkin_period === 'window').length;
            if (windowCheckinsCount < dueCount) {
              setActivePromptHabitId(habit.id);
              setActivePromptPeriod('window');
              break;
            }
          }
        } else {
          // Full Day scope: morning, afternoon, evening slots
          const intensity = habit.avoidance_checkin_intensity || 'balanced';
          const slots: { period: 'morning' | 'afternoon' | 'evening'; hour: number }[] = [];
          
          if (intensity === 'light') {
            slots.push({ period: 'afternoon', hour: 15 });
          } else if (intensity === 'balanced') {
            slots.push({ period: 'morning', hour: 11 });
            slots.push({ period: 'evening', hour: 19 });
          } else {
            slots.push({ period: 'morning', hour: 10 });
            slots.push({ period: 'afternoon', hour: 15 });
            slots.push({ period: 'evening', hour: 20 });
          }

          let foundPending = false;
          for (const slot of slots) {
            if (currentHour >= slot.hour) {
              const registered = todaysCheckins.some(c => c.checkin_period === slot.period);
              if (!registered) {
                setActivePromptHabitId(habit.id);
                setActivePromptPeriod(slot.period);
                foundPending = true;
                break;
              }
            }
          }
          if (foundPending) break;
        }
      }
    };

    evaluateCheckins();
    const interval = setInterval(evaluateCheckins, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, [user, avoidHabits, dataStore.avoidanceCheckins]);

  // Submit check-in results
  const handleCheckinSubmit = async (
    habitId: string, 
    period: 'morning' | 'afternoon' | 'evening' | 'window', 
    status: 'success' | 'relapse',
    triggerTag?: string, // Nova injeção de gatilho
    triggerNote?: string // Nova nota opcional
  ) => {
    if (!user) return;

    const currentHabit = avoidHabits.find(h => h.id === habitId);
    if (!currentHabit) return;

    // Correção do Bug de Fuso: Forçar timestamp ISO local para cravar a hora exata da recaída
    const localIsoString = new Date().toISOString();

    const checkinData = {
      user_id: user.id,
      habit_id: habitId,
      checkin_date: getLocalDateString(), // Mantém index do dia 
      checkin_period: period,
      status,
      trigger_tag: triggerTag || null,
      trigger_note: triggerNote || null,
      created_at: localIsoString
    };

    const result = await dataStore.addAvoidanceCheckin(checkinData);
    if (result) {
      if (status === 'success') {
        dataStore.showNotification(`Excelente! Registro de resistência gravado para ${currentHabit.name} ✓`, 'success');
      } else {
        const relatedCheckins = [...dataStore.avoidanceCheckins, result];
        const metrics = calculateAvoidanceMetrics(currentHabit, relatedCheckins);
        
        setRelapseModal(prev => prev ? {
          ...prev,
          step: 'feedback',
          totalCleanDays: metrics.diasLimposTotal
        } : null);
      }
    }

    if (activePromptHabitId === habitId) {
      setActivePromptHabitId(null);
      setActivePromptPeriod(null);
    }
  };

  // Delete habit
  const handleDeleteHabit = async (id: string) => {
    await dataStore.deleteAvoidanceHabit(id);
    dataStore.showNotification('Módulo Anti-Vício removido com sucesso.', 'success');
    setShowDeleteConfirm(null);
  };

  // Trigger modals via action center
  const triggerNewAvoidanceModal = () => {
    window.dispatchEvent(new CustomEvent('open-action-center', {
      detail: { screen: 'anti-vicio' }
    }));
  };

  const triggerEditAvoidanceModal = (habit: Habit) => {
    window.dispatchEvent(new CustomEvent('open-action-center', {
      detail: { screen: 'anti-vicio', editHabit: habit }
    }));
  };

  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <section id="avoidance-section" className="w-full max-w-5xl space-y-4">
      {/* Header Collapsible Trigger */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-6 bg-surface/20 hover:bg-surface/35 border border-border-white rounded-3xl flex items-center justify-between cursor-pointer transition-all duration-300 group"
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-text-secondary/60 group-hover:bg-white/10 group-hover:text-text-primary transition-colors">
            <Brain size={18} />
          </div>
          <div className="text-left font-sans">
            <h3 className="text-lg font-semibold text-text-primary tracking-tight">Anti-Vício</h3>
            <p className="text-xs text-text-secondary/60 mt-0.5">
              {avoidHabits.length} {avoidHabits.length === 1 ? 'controle ativo' : 'controles ativos'}
            </p>
          </div>
        </div>
        <div className={`text-text-secondary/40 group-hover:text-text-primary transition-colors transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
          <ChevronDown size={20} />
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="w-full p-6 bg-surface/20 border border-border-white rounded-3xl space-y-6">
              {/* Inner header & Action panel */}
              <div className="flex items-center justify-between flex-wrap gap-4 pb-2 border-b border-white/5">
                <div className="text-left max-w-sm md:max-w-md">
                  <p className="text-xs text-text-secondary/60 font-light">
                    Sistema de Consciência: Monitore seu tempo limpo, rituais proativos e mapeie gatilhos sem culpa.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      triggerNewAvoidanceModal();
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-[#6ee7a8]/10 hover:bg-[#6ee7a8]/20 border border-[#6ee7a8]/20 rounded-xl text-xs font-bold uppercase tracking-wider text-[#6ee7a8] transition-all cursor-pointer"
                  >
                    <Plus size={14} />
                    Adicionar Controle
                  </button>
                </div>
              </div>

              {avoidHabits.length === 0 ? (
                <div className="p-8 md:p-12 rounded-3xl bg-surface/5 border border-white/5 text-center space-y-4 flex flex-col items-center justify-center">
                  <Brain size={36} className="text-text-secondary/20" />
                  <p className="text-text-secondary/50 font-light italic max-w-md">
                    Seu espaço para blindagem mental. Adicione o que deseja remover de sua vida e construa uma nova identidade.
                  </p>
                  <button
                    onClick={triggerNewAvoidanceModal}
                    className="px-6 py-2 rounded-full border border-white/10 hover:border-primary-green hover:bg-primary-green/10 text-text-primary text-[10px] uppercase font-bold tracking-widest transition-all cursor-pointer"
                  >
                    Começar Agora
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {avoidHabits.map(habit => {
                    const metrics = calculateAvoidanceMetrics(habit, dataStore.avoidanceCheckins);
                    const promptVisible = activePromptHabitId === habit.id;
                    const habitCheckins = dataStore.avoidanceCheckins.filter(c => c.habit_id === habit.id);

                    // Heatmap 14d
                    const today = new Date();
                    const last14Days = Array.from({ length: 14 }, (_, i) => {
                      const d = new Date();
                      d.setDate(today.getDate() - (13 - i));
                      return getLocalDateString(d);
                    });

                    return (
                      <AvoidanceCard
                        key={habit.id}
                        habit={habit}
                        metrics={metrics}
                        promptVisible={promptVisible}
                        activePromptPeriod={activePromptPeriod}
                        onCheckinSubmit={async (id) => {
                          setAntiVicioHabitId(id);
                          setIsAntiVicioVictory(true);
                          setIsAntiVicioOpen(true);
                        }}
                        onEdit={triggerEditAvoidanceModal}
                        onDelete={(id, name) => setShowDeleteConfirm({ id, name })}
                        onOpenRelapseModal={(id) => {
                          setAntiVicioHabitId(id);
                          setIsAntiVicioVictory(false);
                          setIsAntiVicioOpen(true);
                        }}
                        onSetUrgeTimer={(seconds) => {
                          dataStore.setUrgeTimerSeconds(seconds);
                          setAntiVicioHabitId(habit.id);
                          setIsAntiVicioVictory(false);
                          setIsAntiVicioOpen(true);
                        }}
                        habitCheckins={habitCheckins}
                        last14Days={last14Days}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {relapseModal && relapseModal.isOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-background/85 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 15 }}
              className="w-full max-w-md bg-surface border border-white/10 rounded-3xl p-6 md:p-8 text-center shadow-2xl relative"
            >
              <button
                onClick={() => { setRelapseModal(null); setCustomTriggerNote(''); }}
                className="absolute top-4 right-4 text-text-secondary/40 hover:text-text-primary transition-colors cursor-pointer"
              >
                <X size={18}/>
              </button>

              {relapseModal.step === 'trigger' ? (
                <div className="space-y-5">
                  <h3 className="text-xl font-bold text-text-primary tracking-tight">Mapeamento Biológico (HALT)</h3>
                  <p className="text-xs text-text-secondary/60">Identifique seu estado biológico ou emocional atual. A fissura costuma mascarar uma dessas necessidades básicas.</p>
                  <div className="grid grid-cols-1 gap-2 text-left mt-4">
                    {[
                      { tag: 'Hungry (Fome/Sede)', emoji: '🍎', desc: 'Queda de glicose ou desidratação' },
                      { tag: 'Angry (Raiva/Estresse)', emoji: '🔥', desc: 'Frustração, sobrecarga ou tensão' },
                      { tag: 'Lonely (Solidão/Tédio)', emoji: '🌌', desc: 'Necessidade de conexão ou estímulo' },
                      { tag: 'Tired (Cansaço/Exaustão)', emoji: '🔋', desc: 'Privação de sono ou fadiga mental' },
                      { tag: 'Outro Gatilho (Ambiente)', emoji: '📍', desc: 'Lugar ou situação específica' }
                    ].map((t) => (
                      <button
                        key={t.tag}
                        onClick={() => handleCheckinSubmit(relapseModal.habitId, 'window', 'relapse', t.tag, customTriggerNote)}
                        className="w-full p-3.5 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.05] hover:border-white/20 rounded-2xl text-sm font-medium text-text-primary transition-all flex items-center gap-3 cursor-pointer backdrop-blur-md"
                      >
                        <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-xl shrink-0">
                          {t.emoji}
                        </div>
                        <div className="flex flex-col text-left">
                          <span className="font-semibold text-white/90">{t.tag}</span>
                          <span className="text-[10px] text-white/40 font-light mt-0.5">{t.desc}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    placeholder="💬 Nota extra (opcional)..."
                    value={customTriggerNote}
                    onChange={(e) => setCustomTriggerNote(e.target.value)}
                    className="w-full mt-2 p-3 bg-black/20 border border-white/5 rounded-xl text-xs text-white placeholder:text-text-secondary/30 focus:outline-none focus:border-white/10"
                  />
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="w-12 h-12 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto">
                    <Heart size={24} className="fill-amber-500/20"/>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-lg font-bold text-text-primary tracking-tight">Padrão registrado.</h4>
                  </div>
                  <p className="text-xs text-text-secondary/80 leading-relaxed font-light">
                    A sua inteligência de gatilhos foi atualizada no banco de dados. Os <span className="font-bold text-primary-green">{relapseModal.totalCleanDays} dias limpos</span> acumulados no total continuam intactos. O que importa é ter retornado agora.
                  </p>
                  <button
                    onClick={() => { setRelapseModal(null); setCustomTriggerNote(''); }}
                    className="w-full py-3 bg-primary-green text-background hover:brightness-115 rounded-2xl font-bold uppercase tracking-widest text-[10px] transition-all cursor-pointer shadow-md"
                  >
                    VOLTAR À OPERAÇÃO
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirmation overlay */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[700] flex items-center justify-center p-6 bg-background/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm bg-surface border border-border-white rounded-3xl p-8 flex flex-col items-center gap-6 text-center shadow-2xl"
            >
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-400">
                <ShieldAlert size={22} className="animate-bounce" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-text-primary tracking-tight">Remover as configurações?</h3>
                <p className="text-xs text-text-secondary font-light leading-relaxed">
                  Tem certeza que deseja apagar o registro de autocontrole para <span className="font-semibold text-primary-green">{showDeleteConfirm.name}</span>? Seus relatórios anteriores serão desvinculados do painel.
                </p>
              </div>
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => handleDeleteHabit(showDeleteConfirm.id)}
                  className="flex-1 py-3 bg-red-500/15 hover:bg-red-500/25 border border-red-500/20 text-red-400 rounded-2xl font-bold uppercase tracking-widest text-[9px] transition-colors cursor-pointer"
                >
                  Sim, apagar
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="flex-1 py-3 border border-border-white text-text-primary rounded-2xl font-bold uppercase tracking-widest text-[9px] hover:bg-white/5 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Premium History modal */}
      <AnimatePresence>
        {showHistoryModal && (() => {
          const totalCheckinsList = dataStore.avoidanceCheckins;
          const totalCheckinsObj = totalCheckinsList.filter(c => c.status !== 'pending');
          const totalCheckins = totalCheckinsObj.length;
          const successes = totalCheckinsObj.filter(c => c.status === 'success').length;
          const relapses = totalCheckinsObj.filter(c => c.status === 'relapse').length;
          const successRate = totalCheckins > 0 ? Math.round((successes / totalCheckins) * 100) : 100;

          // Estimate streaks and total successes
          let bestOverallStreak = 0;
          avoidHabits.forEach(ah => {
            const hMetrics = calculateAvoidanceMetrics(ah, totalCheckinsList);
            bestOverallStreak = Math.max(bestOverallStreak, hMetrics.diasLimpoSeguidos);
          });

          // Leveling
          let mentalLevel = "Estágio 1 — Consciência Inicial";
          let mentalLevelDesc = "Você está começando a rastrear seus rituais e fortalecendo o córtex pré-frontal.";
          let nextThreshold = 10;
          let prevThreshold = 0;

          if (successes >= 60) {
            mentalLevel = "Estágio 5 — Consciência Inabalável";
            mentalLevelDesc = "Controle extremo sobre impulsos. Conexões neurais de recompensa totalmente recalibradas.";
            nextThreshold = 120;
            prevThreshold = 60;
          } else if (successes >= 30) {
            mentalLevel = "Estágio 4 — Autonomia Psicológica";
            mentalLevelDesc = "Nível extraordinário de resiliência a gatilhos cotidianos estressores.";
            nextThreshold = 60;
            prevThreshold = 30;
          } else if (successes >= 15) {
            mentalLevel = "Estágio 3 — Foco Reestruturado";
            mentalLevelDesc = "Seus novos caminhos neurais de recompensa estão ganhando resistência.";
            nextThreshold = 30;
            prevThreshold = 15;
          } else if (successes >= 5) {
            mentalLevel = "Estágio 2 — Resistência Consistente";
            mentalLevelDesc = "Sua capacidade de identificar e desviar do impulso está se consolidando.";
            nextThreshold = 15;
            prevThreshold = 5;
          }

          const progressPercent = Math.min(100, Math.round(((successes - prevThreshold) / (nextThreshold - prevThreshold)) * 100));

          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-background/90 backdrop-blur-md"
            >
              <motion.div
                initial={{ scale: 0.95, y: 15 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 15 }}
                className="w-full max-w-2xl bg-surface border border-white/5 rounded-3xl p-6 md:p-8 flex flex-col gap-6 shadow-2xl relative max-h-[90vh] overflow-y-auto style-scrollbar"
              >
                <div className="flex justify-between items-center border-b border-white/5 pb-4">
                  <div className="space-y-1">
                    <h3 className="text-2xl font-bold text-text-primary tracking-tight flex items-center gap-2">
                      <Brain className="text-primary-green animate-pulse" size={24} /> Relatórios de Autocontrole
                    </h3>
                    <p className="text-xs text-text-secondary/60">Análise de consistência e estágio de resiliência psicológica mental</p>
                  </div>
                  <button
                    onClick={() => setShowHistoryModal(false)}
                    className="p-2 text-text-secondary/40 hover:text-text-primary hover:bg-white/5 rounded-full transition-all cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl text-center">
                    <span className="text-[9px] font-bold text-text-secondary/50 uppercase tracking-widest block">Consistência</span>
                    <span className="text-2xl font-semibold text-primary-green font-mono">{successRate}%</span>
                  </div>
                  <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl text-center">
                    <span className="text-[9px] font-bold text-text-secondary/50 uppercase tracking-widest block">Maior Streak</span>
                    <span className="text-2xl font-semibold text-text-primary font-mono">{bestOverallStreak}d</span>
                  </div>
                  <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl text-center">
                    <span className="text-[9px] font-bold text-text-secondary/50 uppercase tracking-widest block">Resistências</span>
                    <span className="text-2xl font-semibold text-primary-green font-mono">{successes}</span>
                  </div>
                  <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl text-center">
                    <span className="text-[9px] font-bold text-text-secondary/50 uppercase tracking-widest block">Recaídas</span>
                    <span className="text-2xl font-semibold text-red-400 font-mono">{relapses}</span>
                  </div>
                </div>

                <div className="p-5 bg-gradient-to-r from-primary-green/5 to-transparent border border-primary-green/15 rounded-2xl space-y-3">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                    <div>
                      <span className="text-[9px] font-extrabold text-[#6ee7a8] uppercase tracking-widest flex items-center gap-1">
                        <Sparkles size={11} className="animate-pulse" /> Estágio de Resiliência Ativo
                      </span>
                      <h4 className="text-[1rem]/[1.5rem] font-bold text-text-primary">{mentalLevel}</h4>
                    </div>
                    <span className="text-[10px] text-text-secondary/50 font-mono uppercase">
                      {successes} / {nextThreshold} vitórias
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary/70 font-light leading-relaxed">{mentalLevelDesc}</p>
                  
                  <div className="space-y-1">
                    <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className="bg-primary-green h-full rounded-full transition-all duration-1000" 
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Historical records list */}
                <div className="space-y-3">
                  <span className="text-[9px] font-extrabold text-text-secondary/50 uppercase tracking-widest flex items-center gap-1.5 px-1">
                    <BarChart2 size={12} className="text-primary-green/60" /> Histórico Operacional de Lançamentos
                  </span>

                  <div className="space-y-2.5 max-h-[30vh] overflow-y-auto pr-1 style-scrollbar">
                    {totalCheckinsList.length === 0 ? (
                      <p className="text-center font-light text-text-secondary/40 italic py-6 text-xs">Nenhum check-in registrado.</p>
                    ) : (
                      totalCheckinsList.map((checkin) => {
                        const relatedHabit = avoidHabits.find(h => h.id === checkin.habit_id);
                        const displayDate = new Date(checkin.checkin_date).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        });

                        const periodLabel = {
                          morning: 'Manhã',
                          afternoon: 'Tarde',
                          evening: 'Noite',
                          window: 'Janela'
                        }[checkin.checkin_period] || checkin.checkin_period;

                        const isSuccess = checkin.status === 'success' || checkin.status === 'resisti';

                        return (
                          <div
                            key={checkin.id}
                            className="flex items-start justify-between gap-3 p-3.5 bg-white/[0.02] border border-white/5 rounded-2xl hover:bg-white/[0.04] transition-colors"
                          >
                            <div className="space-y-1.5 flex-1 min-w-0">
                              <h5 className="text-xs font-semibold text-text-primary truncate">
                                {relatedHabit?.name || 'Comportamento Excluído'}
                              </h5>
                              <p className="text-[9px] text-text-secondary/50 font-mono uppercase">
                                {displayDate} • {periodLabel}
                              </p>
                              {checkin.trigger_note && (
                                <div className="mt-1.5 p-2 bg-black/15 rounded-lg border-l-2 border-red-400/30">
                                  <p className="text-[10px] text-text-secondary/80 italic leading-relaxed break-words">
                                    🧬 <span className="font-mono text-[8px] not-italic text-red-400/70 uppercase tracking-widest font-bold">Gatilho:</span> {checkin.trigger_note}
                                  </p>
                                </div>
                              )}
                            </div>
                            
                            <span className={`shrink-0 text-[8px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${
                              isSuccess
                                ? 'bg-primary-green/10 text-primary-green border border-primary-green/15'
                                : 'bg-red-400/10 text-red-400 border border-red-400/15'
                            }`}>
                              {isSuccess ? '✓ Resisti' : '⚠ Caí'}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="mt-2 flex justify-end">
                  <button
                    onClick={() => setShowHistoryModal(false)}
                    className="px-6 py-3 border border-border-white rounded-2xl text-[10px] uppercase tracking-widest font-bold hover:bg-white/5 transition-all cursor-pointer"
                  >
                    Fechar
                  </button>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      <AntiVicioModal
        isOpen={isAntiVicioOpen}
        onClose={() => setIsAntiVicioOpen(false)}
        initialHabitId={antiVicioHabitId}
        isVictoryMode={isAntiVicioVictory}
      />
    </section>
  );
};
