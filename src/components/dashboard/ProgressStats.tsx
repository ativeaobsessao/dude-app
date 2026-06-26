import { useDataStore } from '../../store/useDataStore';
import { motion, AnimatePresence } from 'motion/react';
import { SuaEvolucaoModal } from './SuaEvolucaoModal';
import { TrendsAntiVicioModal } from './TrendsAntiVicioModal';
import { 
  X, Trophy, Target, ChevronDown, ChevronUp, Flame, Sparkles, 
  BarChart2, Calendar, Shield, Activity, HelpCircle, AlertCircle, Heart,
  Sun, CheckSquare, Brain, CheckCircle2, ShieldCheck, ShieldAlert
} from 'lucide-react';
import { formatHumanTime, getLocalDateString, resolverNomeSessao, formatSessionDuration, formatTimeRange } from '../../lib/utils';
import { calculateAvoidanceMetrics } from './AvoidanceSection';
import { useState, useMemo, useEffect } from 'react';
import { MOODS, MOOD_LIST, MoodKey } from '../../lib/mood';
import { MoodEntry } from '../../types';

const formatCompactDuration = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) {
    return `${h}h ${m}m`;
  }
  return `${m}m`;
};

const formatEnergy = (energy?: string | null) => {
  if (!energy) return 'Normal ⚡';
  switch (energy) {
    case 'cansado': return 'Baixa 🥱';
    case 'normal': return 'Normal ⚡';
    case 'energizado': return 'Alta 🔥';
    default: return `${energy.charAt(0).toUpperCase() + energy.slice(1)}`;
  }
};

type PeriodType = 'today' | 'week' | 'month' | 'all';

export const ProgressStats = ({ onClose }: { onClose: () => void }) => {
  const { 
    sessions, 
    projects, 
    habits, 
    profile, 
    avoidanceCheckins, 
    habitCompletions,
    scheduledActivities,
    moodEntries,
    sessionTasks,
    dailyTasks
  } = useDataStore();

  // Selected period state
  const [period, setPeriod] = useState<PeriodType>('today');

  // Selected date in Sessions History explorer
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Progressive disclosure evolution modal state
  const [isEvolucaoModalOpen, setIsEvolucaoModalOpen] = useState(false);

  // Trends anti-vicio modal state
  const [isTrendsModalOpen, setIsTrendsModalOpen] = useState(false);

  // Multi-pillar expander state
  const [expandedPillar, setExpandedPillar] = useState<'habits' | 'avoidance' | 'schedule' | 'mood' | null>(null);

  // Selected cell in Humor heat map
  const [tappedMoodDayStr, setTappedMoodDayStr] = useState<string | null>(null);

  // Modal expander state for completed tasks
  const [showCompletedTasksModal, setShowCompletedTasksModal] = useState(false);

  const EMPTY_STATE_PHRASES = useMemo(() => [
    "O tempo escorre, mas a produção deixa rastros. Inicie sua primeira sessão profunda e ative os sensores de inteligência do seu painel.",
    "Seu radar de produtividade está paralisado. Execute uma sessão profunda para que o DUDE calibre sua verdadeira velocidade de execução."
  ], []);

  const [emptyStatePhrase, setEmptyStatePhrase] = useState(EMPTY_STATE_PHRASES[0]);

  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * EMPTY_STATE_PHRASES.length);
    setEmptyStatePhrase(EMPTY_STATE_PHRASES[randomIndex]);
  }, [EMPTY_STATE_PHRASES]);

  // Selected date snapshot for correlation analysis (Máquina do Tempo)
  const selectedDateSnapshot = useMemo(() => {
    if (!selectedDate) return null;
    
    const daySessions = sessions.filter(s => getLocalDateString(new Date(s.started_at)) === getLocalDateString(selectedDate));
    const dayMins = daySessions.reduce((acc, s) => acc + (s.actual_duration_minutes || s.duration_minutes || 0), 0);
    
    const dayMoodEntry = moodEntries.find(m => getLocalDateString(m.date) === getLocalDateString(selectedDate));
    const dayMoodObj = dayMoodEntry ? MOOD_LIST.find(m => m.key === dayMoodEntry.mood) : null;
    
    const dayAvoidanceCheckins = avoidanceCheckins.filter(ac => getLocalDateString(ac.checkin_date) === getLocalDateString(selectedDate));
    
    return {
      daySessions,
      dayMins,
      dayMoodEntry,
      dayMoodObj,
      dayAvoidanceCheckins,
    };
  }, [selectedDate, sessions, moodEntries, avoidanceCheckins]);

  // ----------------------------------------------------
  // TRENDS ANTI-VÍCIO DATA calculations for inline display
  // ----------------------------------------------------
  const [showAllVices, setShowAllVices] = useState(false);

  // Helper sets
  const getDatesRangeSet = (offsetStart: number, length: number) => {
    const s = new Set<string>();
    for (let i = 0; i < length; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (offsetStart + i));
      s.add(getLocalDateString(d));
    }
    return s;
  };

  // ----------------------------------------------------
  // TOTAL RETRIEVED STATISTICS (All-time metrics)
  // ----------------------------------------------------
  const rolloverAnalysis = useMemo(() => {
    const today = getLocalDateString(new Date());
    const tasks = dailyTasks || [];
    const todayTasks = tasks.filter(t => t.task_date === today);
    const rolloverCount = todayTasks.filter(t => t.rolled_from_date !== null && !t.is_completed).length;
    const completedCount = todayTasks.filter(t => t.is_completed).length;
    const totalCount = todayTasks.length;
    
    let coachingMsg = "Seu planejamento de hoje está equilibrado. Lembre-se: menos tarefas bem executadas valem mais que listas infinitas.";
    let coachingTitle = "Planejamento sob Controle 🎯";
    let coachingStyle = "text-green bg-green/5 border-green/10";
    
    if (totalCount > 7) {
      coachingTitle = "Gargalo por Hiper-Planejamento! ⚠️";
      coachingMsg = `Você programou ${totalCount} tarefas para hoje. Estresses de sobrecarga geram adiamento. Considere reavaliar e focar estritamente nas 3 principais metas cruciais de hoje, arquivando ou reprogramando o restante.`;
      coachingStyle = "text-orange-400 bg-orange-400/5 border-orange-400/10";
    } else if (rolloverCount > 2) {
      coachingTitle = "Alerta de Efeito Rollover ↩";
      coachingMsg = `Você possui ${rolloverCount} tarefas acumuladas que vieram de dias anteriores sem conclusão. Elas consomem energia mental passiva. Priorize eliminá-las hoje antes de acumular mais tarefas!`;
      coachingStyle = "text-amber-500 bg-[#df8a13]/5 border-amber-500/10";
    } else if (totalCount > 0 && completedCount === totalCount) {
      coachingTitle = "Metas Gabaritadas! 🎉";
      coachingMsg = "Sensacional! Você concluiu 100% de tudo que se propôs a fazer hoje. Sua dosagem de planejamento e execução estão impecáveis.";
      coachingStyle = "text-green bg-green/5 border-green/10";
    }
    
    return {
      rolloverCount,
      totalCount,
      completedCount,
      coachingTitle,
      coachingMsg,
      coachingStyle
    };
  }, [dailyTasks]);

  const totalFocusAllTimeMins = useMemo(() => {
    return sessions.reduce((acc, s) => acc + (s.duration_minutes || 0), 0);
  }, [sessions]);

  const currentStreak = profile?.current_streak || 0;

  const bestStreak = useMemo(() => {
    if (sessions.length === 0) return 0;
    const sortedDates = Array.from(new Set(
      sessions.map(s => getLocalDateString(new Date(s.started_at)))
    )).sort();

    let longest = 0;
    let current = 0;
    let prevDateStr: string | null = null;

    for (const dateStr of sortedDates) {
      if (!prevDateStr) {
        current = 1;
      } else {
        const prev = new Date(`${prevDateStr}T12:00:00`);
        const curr = new Date(`${dateStr}T12:00:00`);
        const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 3600 * 24));
        if (diffDays === 1) {
          current++;
        } else if (diffDays > 1) {
          if (current > longest) longest = current;
          current = 1;
        }
      }
      prevDateStr = dateStr;
    }
    if (current > longest) longest = current;
    return Math.max(longest, currentStreak);
  }, [sessions, currentStreak]);

  // ----------------------------------------------------
  // DYNAMIC PERIOD DETERMINATION
  // ----------------------------------------------------
  const currentPeriodMins = useMemo(() => {
    if (period === 'all') return totalFocusAllTimeMins;
    const length = period === 'today' ? 1 : (period === 'week' ? 7 : 30);
    const currentSet = getDatesRangeSet(0, length);
    return sessions
      .filter(s => currentSet.has(getLocalDateString(new Date(s.started_at))))
      .reduce((acc, s) => acc + (s.duration_minutes || 0), 0);
  }, [period, sessions, totalFocusAllTimeMins]);

  const previousPeriodMins = useMemo(() => {
    if (period === 'all') return 0;
    const length = period === 'today' ? 1 : (period === 'week' ? 7 : 30);
    const previousSet = getDatesRangeSet(length, length);
    return sessions
      .filter(s => previousSet.has(getLocalDateString(new Date(s.started_at))))
      .reduce((acc, s) => acc + (s.duration_minutes || 0), 0);
  }, [period, sessions]);

  // Delta calculations
  const deltaText = useMemo(() => {
    if (period === 'all') {
      const hrs = Math.floor(totalFocusAllTimeMins / 60);
      const mins = totalFocusAllTimeMins % 60;
      return `Todo o histórico: ${hrs}h ${mins}m · sem base de comparação anterior`;
    }
    const currentHrs = Math.floor(currentPeriodMins / 60);
    const currentMins = currentPeriodMins % 60;
    const periodLabel = period === 'today' ? 'dia' : (period === 'week' ? 'período' : 'mês');
    const currentText = `Este ${periodLabel}: ${currentHrs}h ${currentMins}m`;

    if (previousPeriodMins > 0) {
      const pct = Math.round(((currentPeriodMins - previousPeriodMins) / previousPeriodMins) * 100);
      if (pct > 0) return `${currentText}  (↑ ${pct}% vs. anterior)`;
      if (pct < 0) return `${currentText}  (↓ ${Math.abs(pct)}% vs. anterior)`;
      return `${currentText}  (· sem alteração vs. anterior)`;
    }
    return `${currentText}  (· sem dados comparativos ainda)`;
  }, [period, currentPeriodMins, previousPeriodMins, totalFocusAllTimeMins]);

  const deltaType = useMemo(() => {
    if (period === 'all' || previousPeriodMins === 0) return 'neutral';
    if (currentPeriodMins > previousPeriodMins) return 'positive';
    if (currentPeriodMins < previousPeriodMins) return 'negative';
    return 'neutral';
  }, [period, currentPeriodMins, previousPeriodMins]);

  // Sessions filtered by selected period
  const periodSessions = useMemo(() => {
    const targetSet = period === 'all' 
      ? null 
      : getDatesRangeSet(0, period === 'today' ? 1 : (period === 'week' ? 7 : 30));
    return targetSet 
      ? sessions.filter(s => targetSet.has(getLocalDateString(new Date(s.started_at))))
      : sessions;
  }, [period, sessions]);

  // Supporting metrics count inside period
  const supportingStats = useMemo(() => {
    const sessionCount = periodSessions.length;
    const activeProjectIds = new Set(periodSessions.map(s => s.project_id).filter(Boolean));
    const projectsCount = activeProjectIds.size;

    return { sessionCount, projectsCount };
  }, [periodSessions]);

  const overallDailyAverageMins = useMemo(() => {
    const focusDays = new Set(sessions.map(s => getLocalDateString(new Date(s.started_at))));
    if (focusDays.size === 0) return 0;
    return totalFocusAllTimeMins / focusDays.size;
  }, [sessions, totalFocusAllTimeMins]);

  const comparisonLine = useMemo(() => {
    const count = supportingStats.sessionCount;
    const sessionsWord = count === 1 ? 'sessão' : 'sessões';
    
    if (period === 'all') {
      return `Em ${count} ${sessionsWord} registradas no total`;
    }
    
    const periodLabel = period === 'today' ? 'hoje' : period === 'week' ? 'esta semana' : 'este mês';
    const multiplier = period === 'today' ? 1 : period === 'week' ? 7 : 30;
    const targetAverage = overallDailyAverageMins * multiplier;
    
    if (targetAverage <= 0) {
      return `Em ${count} ${sessionsWord} ${periodLabel} · seu primeiro registro`;
    }
    
    const diffPercent = Math.round(((currentPeriodMins - targetAverage) / targetAverage) * 100);
    
    if (diffPercent > 0) {
      return `Em ${count} ${sessionsWord} ${periodLabel} · ↑ ${diffPercent}% acima da sua média`;
    } else if (diffPercent < 0) {
      return `Em ${count} ${sessionsWord} ${periodLabel} · ↓ ${Math.abs(diffPercent)}% abaixo da sua média`;
    } else {
      return `Em ${count} ${sessionsWord} ${periodLabel} · na sua média de foco`;
    }
  }, [period, currentPeriodMins, overallDailyAverageMins, supportingStats.sessionCount]);

  // ----------------------------------------------------
  // INTERPRETIVE HEADLINE (Decision Engine Core)
  // ----------------------------------------------------
  const interpretiveHeadline = useMemo(() => {
    const today = new Date();
    
    // 1. Check inactive days
    if (sessions.length > 0) {
      const datesTimes = sessions.map(s => new Date(s.started_at).getTime());
      const maxTime = Math.max(...datesTimes);
      const diffDays = Math.floor((today.getTime() - maxTime) / (1000 * 3600 * 24));
      if (diffDays >= 3) {
        return `Você está há ${diffDays} ${diffDays === 1 ? 'dia' : 'dias'} sem registrar uma Sessão Profunda.`;
      }
    } else {
      return "Dê o primeiro passo focado para calibrar seu índice neural.";
    }

    // 2. Check weekly focus reduction
    const thisWeekMins = sessions
      .filter(s => getDatesRangeSet(0, 7).has(getLocalDateString(new Date(s.started_at))))
      .reduce((acc, s) => acc + (s.duration_minutes || 0), 0);
    const lastWeekMins = sessions
      .filter(s => getDatesRangeSet(7, 7).has(getLocalDateString(new Date(s.started_at))))
      .reduce((acc, s) => acc + (s.duration_minutes || 0), 0);

    if (thisWeekMins < lastWeekMins && lastWeekMins > 0) {
      const pct = Math.round(((lastWeekMins - thisWeekMins) / lastWeekMins) * 100);
      if (pct >= 15) {
        return `Você desacelerou — registrou ${pct}% menos foco que a semana anterior.`;
      }
    }

    // 3. Highlight consistency
    // Active days in last 7 days
    let active7Count = 0;
    const last7Set = getDatesRangeSet(0, 7);
    for (const dStr of last7Set) {
      const hasFocus = sessions.some(s => getLocalDateString(new Date(s.started_at)) === dStr);
      const hasHabit = habitCompletions.some(hc => getLocalDateString(new Date(hc.completed_at)) === dStr);
      const hasAvoid = avoidanceCheckins.some(ac => ac.checkin_date === dStr && ac.status === 'success');
      if (hasFocus || hasHabit || hasAvoid) active7Count++;
    }

    if (active7Count >= 5) {
      return `Consistência sólida: você produziu ativamente em ${active7Count} dos últimos 7 dias.`;
    }

    // 4. Highlight increase
    if (thisWeekMins > lastWeekMins && lastWeekMins > 0) {
      const pctInc = Math.round(((thisWeekMins - lastWeekMins) / lastWeekMins) * 100);
      if (pctInc >= 20) {
        return `Sua dedicação acelerou! ↑ ${pctInc}% mais minutos focados que na semana passada.`;
      }
    }

    return "Continue registrando para o DUDE mapear padrões profundos da sua evolução.";
  }, [sessions, habitCompletions, avoidanceCheckins]);

  const lifetimeMetric = useMemo(() => {
    if (sessions.length === 0) return null;
    const totalMinutes = sessions.reduce((acc, s) => acc + (s.duration_minutes || 0), 0);
    const totalHours = totalMinutes / 60;
    
    // Find the earliest session
    const firstSessionDate = new Date(Math.min(...sessions.map(s => new Date(s.started_at).getTime())));
    const today = new Date();
    
    // Calculate days between first session and today
    // Include the first day itself by adding 1
    const diffTime = Math.abs(today.getTime() - firstSessionDate.getTime());
    const lifetimeDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    
    const averageHoursPerDay = totalHours / lifetimeDays;
    return averageHoursPerDay.toFixed(1); // Keep 1 decimal
  }, [sessions]);

  // ----------------------------------------------------
  // BLOCK 2 — FOR REAL TIMELINE ANALYSIS (Para Onde Seu Tempo Foi)
  // ----------------------------------------------------
  const projectDistribution = useMemo(() => {
    const targetSet = period === 'all' 
      ? null 
      : getDatesRangeSet(0, period === 'today' ? 1 : (period === 'week' ? 7 : 30));
    const filteredSessions = targetSet 
      ? sessions.filter(s => targetSet.has(getLocalDateString(new Date(s.started_at))))
      : sessions;

    const periodTotalMins = filteredSessions.reduce((acc, s) => acc + (s.duration_minutes || 0), 0);
    if (!periodTotalMins) return [];

    // Map projects
    const pMap: { [idStr: string]: { name: string; mins: number } } = {};
    filteredSessions.forEach(s => {
      const projId = s.project_id || 'unassigned';
      const projName = s.project_id 
        ? (projects.find(p => p.id === s.project_id)?.name || 'Projeto Desconhecido')
        : 'Sessões Avulsas';

      if (!pMap[projId]) pMap[projId] = { name: projName, mins: 0 };
      pMap[projId].mins += s.duration_minutes;
    });

    const sortedList = Object.values(pMap).sort((a, b) => b.mins - a.mins);

    if (sortedList.length <= 3) {
      return sortedList.map(item => ({
        name: item.name,
        mins: item.mins,
        percent: Math.round((item.mins / periodTotalMins) * 100)
      }));
    }

    // Slice top 3 and combine rest as "Outros"
    const top3 = sortedList.slice(0, 3);
    const restMins = sortedList.slice(3).reduce((acc, item) => acc + item.mins, 0);

    const result = top3.map(item => ({
      name: item.name,
      mins: item.mins,
      percent: Math.round((item.mins / periodTotalMins) * 100)
    }));

    if (restMins > 0) {
      result.push({
        name: 'Outros Projetos',
        mins: restMins,
        percent: Math.round((restMins / periodTotalMins) * 100)
      });
    }

    return result;
  }, [period, sessions, projects]);

  // ----------------------------------------------------
  // BLOCK 3 — GRAPH EVOLUTION (Deterministic calculations)
  // ----------------------------------------------------
  const chartData = useMemo(() => {
    const daysShort = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
    const last7DaysList = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d;
    });

    return last7DaysList.map(d => {
      const dStr = getLocalDateString(d);
      const mins = sessions
        .filter(s => getLocalDateString(new Date(s.started_at)) === dStr)
        .reduce((acc, s) => acc + (s.duration_minutes || 0), 0);
      return {
        label: daysShort[d.getDay()],
        mins,
        displayValue: mins > 0 ? formatCompactDuration(mins) : '0'
      };
    });
  }, [sessions]);

  const maxChartMins = useMemo(() => {
    return Math.max(...chartData.map(c => c.mins), 0);
  }, [chartData]);

  // ----------------------------------------------------
  // BLOCK 4 — REAL CONSISTENCY INDICATOR
  // ----------------------------------------------------
  const consistencyStats = useMemo(() => {
    const totalDays = period === 'today' ? 1 : (period === 'week' ? 7 : (period === 'month' ? 30 : 90));
    let activeDays = 0;

    for (let i = 0; i < totalDays; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dStr = getLocalDateString(d);

      const hasFocus = sessions.some(s => getLocalDateString(new Date(s.started_at)) === dStr);
      const hasHabit = habitCompletions.some(hc => getLocalDateString(new Date(hc.completed_at)) === dStr);
      const hasAvoid = avoidanceCheckins.some(ac => ac.checkin_date === dStr && ac.status === 'success');

      if (hasFocus || hasHabit || hasAvoid) {
        activeDays++;
      }
    }

    const rate = Math.round((activeDays / totalDays) * 100);
    return { activeDays, totalDays, rate };
  }, [period, sessions, habitCompletions, avoidanceCheckins]);

  // ----------------------------------------------------
  // PILLAR A — HABITS ATOMICOS DATA GATHERING
  // ----------------------------------------------------
  const buildHabitsList = useMemo(() => {
    return habits.filter(h => h.habit_mode !== 'avoid');
  }, [habits]);

  const bestStreakHabit = useMemo(() => {
    if (buildHabitsList.length === 0) return null;
    return [...buildHabitsList].sort((a, b) => b.weekly_streak - a.weekly_streak)[0];
  }, [buildHabitsList]);

  const neglectedHabit = useMemo(() => {
    if (buildHabitsList.length === 0) return null;
    // Math: sessions_this_week / target
    const analysed = buildHabitsList.map(h => {
      const target = h.sessions_per_week || 1;
      const ratio = h.sessions_this_week / target;
      return { habit: h, ratio };
    }).sort((a, b) => a.ratio - b.ratio);

    return analysed[0].ratio < 1 ? analysed[0].habit : null;
  }, [buildHabitsList]);

  // ----------------------------------------------------
  // PILLAR B — BLINDAGEM MENTAL (Avoidance) GATHERING
  // ----------------------------------------------------
  const avoidanceHabitsList = useMemo(() => {
    return habits.filter(h => h.habit_mode === 'avoid');
  }, [habits]);

  // Calculate clean streak with local check-ins sorting
  const avoidanceStreaks = useMemo(() => {
    const streakMap: { [id: string]: number } = {};
    avoidanceHabitsList.forEach(ah => {
      const checkins = avoidanceCheckins
        .filter(c => c.habit_id === ah.id && (c.status === 'success' || c.status === 'relapse' || c.status === 'resisti' || c.status === 'recai'))
        .sort((a, b) => new Date(b.checkin_date).getTime() - new Date(a.checkin_date).getTime());

      let currentStreak = 0;
      for (const c of checkins) {
        if (c.status === 'success' || c.status === 'resisti') {
          currentStreak++;
        } else {
          break;
        }
      }
      streakMap[ah.id] = currentStreak;
    });
    return streakMap;
  }, [avoidanceHabitsList, avoidanceCheckins]);

  const bestAvoidanceStreak = useMemo(() => {
    if (avoidanceHabitsList.length === 0) return null;
    let maxS = -1;
    let maxHabit = avoidanceHabitsList[0];

    avoidanceHabitsList.forEach(ah => {
      const s = avoidanceStreaks[ah.id] || 0;
      if (s > maxS) {
        maxS = s;
        maxHabit = ah;
      }
    });

    return maxS >= 0 ? { habit: maxHabit, streak: maxS } : null;
  }, [avoidanceHabitsList, avoidanceStreaks]);

  const sortedVices = useMemo(() => {
    return [...avoidanceHabitsList].sort((a, b) => {
      const streakA = avoidanceStreaks[a.id] || 0;
      const streakB = avoidanceStreaks[b.id] || 0;
      return streakB - streakA;
    });
  }, [avoidanceHabitsList, avoidanceStreaks]);

  const vicesHeadline = useMemo(() => {
    if (!bestAvoidanceStreak || bestAvoidanceStreak.streak === 0) {
      if (sortedVices.length > 0) {
        return `Iniciando sua blindagem contra ${sortedVices[0].name}. Mantenha-se firme!`;
      }
      return null;
    }
    return `Maior Fortaleza: ${bestAvoidanceStreak.streak} dias limpos na blindagem contra ${bestAvoidanceStreak.habit.name}.`;
  }, [bestAvoidanceStreak, sortedVices]);

  const visibleVices = useMemo(() => {
    return showAllVices ? sortedVices : sortedVices.slice(0, 3);
  }, [sortedVices, showAllVices]);

  const getViceMetrics = (viceId: string) => {
    const checkins = avoidanceCheckins.filter(c => c.habit_id === viceId);
    const resist = checkins.filter(c => c.status === 'success' || c.status === 'resisti').length;
    const recai = checkins.filter(c => c.status === 'relapse' || c.status === 'recai').length;
    const total = resist + recai;
    const safeResistPercent = total > 0 ? (resist / total) * 100 : 0;
    const safeRecaiPercent = total > 0 ? (recai / total) * 100 : 0;
    return { resist, recai, total, safeResistPercent, safeRecaiPercent };
  };

  // Extract Avoidance check-ins with notes (GHOST QUOTES)
  const battlesWithNotes = useMemo(() => {
    return avoidanceCheckins
      .filter(c => c.trigger_note && c.trigger_note.trim() !== '')
      .sort((a, b) => {
        const timeA = new Date(a.created_at || a.checkin_date).getTime();
        const timeB = new Date(b.created_at || b.checkin_date).getTime();
        return timeB - timeA;
      });
  }, [avoidanceCheckins]);

  const avoidanceAnalysis = useMemo(() => {
    const avoidHabits = habits.filter(h => h.habit_mode === 'avoid');
    const avoidHabitsMap = new Map(avoidHabits.map(h => [h.id, h]));
    
    // Filter relapses to existing habits of mode 'avoid'
    const relapses = avoidanceCheckins.filter(c => {
      if (c.status !== 'relapse' && c.status !== 'recai') return false;
      return avoidHabitsMap.has(c.habit_id);
    });
    
    const byPeriod = { morning: 0, afternoon: 0, evening: 0, window: 0 };
    const byEnergy = { cansado: 0, normal: 0, energizado: 0 };
    const byMood = { animado: 0, tranquilo: 0, neutro: 0, ansioso: 0, prabaixo: 0 };
    let semRegistroCount = 0;
    
    const periodMap: Record<string, string> = {
      morning: 'manha',
      afternoon: 'tarde',
      evening: 'noite',
      window: 'tarde'
    };
    
    relapses.forEach(c => {
      const p = c.checkin_period;
      if (p in byPeriod) {
        byPeriod[p as keyof typeof byPeriod]++;
      } else {
        byPeriod.window++;
      }
      
      let targetPeriod = periodMap[p] || 'tarde';
      if (p === 'window' && c.created_at) {
        const hour = new Date(c.created_at).getHours();
        if (hour < 12) targetPeriod = 'manha';
        else if (hour < 18) targetPeriod = 'tarde';
        else targetPeriod = 'noite';
      }
      
      const checkinDateNorm = getLocalDateString(c.checkin_date || c.created_at);

      // Passo A: Tente encontrar o humor no mesmo dia (Data Normalizada) e mesmo período.
      let match = moodEntries.find(m => getLocalDateString(m.date) === checkinDateNorm && m.period === targetPeriod);
      
      // Passo B (Fallback 1): Se falhar, encontre qualquer registro de humor naquele mesmo dia.
      if (!match) {
        match = moodEntries.find(m => getLocalDateString(m.date) === checkinDateNorm);
      }
      
      // Passo C (Fallback 2 - Smart Fallback): Se o usuário não registrou humor no dia exato da recaída,
      // ordene o moodEntries por data decrescente e capture o registro de humor MAIS RECENTE anterior à data da recaída.
      if (!match) {
        const priorMoodEntries = [...moodEntries]
          .filter(m => {
            const mDate = getLocalDateString(m.date);
            return mDate < checkinDateNorm;
          })
          .sort((a, b) => {
            const aDate = getLocalDateString(a.date);
            const bDate = getLocalDateString(b.date);
            if (aDate !== bDate) {
              return bDate.localeCompare(aDate);
            }
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          });
        
        if (priorMoodEntries.length > 0) {
          match = priorMoodEntries[0];
        }
      }
                 
      if (match) {
        if (match.energy && match.energy in byEnergy) {
          byEnergy[match.energy as keyof typeof byEnergy]++;
        } else {
          semRegistroCount++;
        }
        
        if (match.mood && match.mood in byMood) {
          byMood[match.mood as keyof typeof byMood]++;
        }
      } else {
        semRegistroCount++;
      }
    });
    
    const totalRelapses = relapses.length;
    
    const findMaxKey = <T extends Record<string, number>>(obj: T): keyof T | null => {
      let maxVal = -1;
      let maxK: keyof T | null = null;
      Object.entries(obj).forEach(([k, val]) => {
        if (val > maxVal) {
          maxVal = val;
          maxK = k as keyof T;
        }
      });
      return maxVal > 0 ? maxK : null;
    };
    
    const maxPeriodKey = findMaxKey(byPeriod);
    const maxEnergyKey = findMaxKey(byEnergy);
    const maxMoodKey = findMaxKey(byMood);
    
    let leadInsight = "";
    let suggestion = "";
    
    if (totalRelapses > 0) {
      const periodLabel = {
        morning: "pela manhã",
        afternoon: "à tarde",
        evening: "à noite",
        window: "durante a janela de foco"
      }[maxPeriodKey || 'evening'];
      
      const energyLabel = {
        cansado: "cansado mentalmente",
        normal: "com energia normal",
        energizado: "energizado"
      }[maxEnergyKey || 'cansado'];
      
      const moodLabel = {
        animado: "animado / ansioso por recompensa",
        tranquilo: "tranquilo",
        neutro: "neutro",
        ansioso: "ansioso",
        prabaixo: "pra baixo ou desmotivado"
      }[maxMoodKey || 'ansioso'];
      
      leadInsight = `Você recai mais nos momentos em que está ${energyLabel}, geralmente ${periodLabel} e sentindo-se ${moodLabel}.`;
      
      if (maxEnergyKey === 'cansado') {
        suggestion = "Nesses momentos de cansaço mental, uma sessão curta de foco assistido ou um descanso absoluto ajuda muito mais do que tentar resistir apenas na pura força de vontade.";
      } else if (maxMoodKey === 'ansioso') {
        suggestion = "Quando os níveis de ansiedade sobem, técnicas de respiração quadrada ou uma pausa rápida de descompressão consciente no DUDE são seus maiores escudos.";
      } else if (maxMoodKey === 'prabaixo') {
        suggestion = "Em dias mais difíceis, lembre-se de que a autocompaixão é vital. Não busque compensar ou anestesiar a frustração cedendo ao vício; faça uma atividade física leve ou registre uma anotação.";
      } else {
        suggestion = "Identifique os primeiros sinais físicos de perda de controle e utilize rituais rápidos de desvio de foco para desarmar o loop do hábito voluntário.";
      }
    }
    
    return {
      totalRelapses,
      byPeriod,
      byEnergy,
      byMood,
      semRegistro: semRegistroCount,
      leadInsight,
      suggestion
    };
  }, [avoidanceCheckins, moodEntries, habits]);

  // ----------------------------------------------------
  // PILLAR C — AGENDAMENTOS (Schedules Rate)
  // ----------------------------------------------------
  const scheduleCompliance = useMemo(() => {
    const completed = scheduledActivities.filter(sa => sa.status === 'completed').length;
    const cancelled = scheduledActivities.filter(sa => sa.status === 'cancelled').length;

    // Check lost schedules: pending and in the PAST datetime
    const lostList = scheduledActivities.filter(sa => {
      if (sa.status !== 'pending') return false;
      const sched = new Date(`${sa.scheduled_date}T${sa.scheduled_time || '00:00'}`);
      return sched.getTime() < new Date().getTime();
    });
    const lost = lostList.length;

    // Check pending schedules: pending and in the FUTURE datetime
    const pendentesList = scheduledActivities.filter(sa => {
      if (sa.status !== 'pending') return false;
      const sched = new Date(`${sa.scheduled_date}T${sa.scheduled_time || '00:00'}`);
      return sched.getTime() >= new Date().getTime();
    });
    const pendentes = pendentesList.length;

    const denominator = completed + lost;
    const rate = denominator > 0 ? Math.round((completed / denominator) * 100) : 100;

    return { completed, lost, cancelled, pendentes, rate, total: scheduledActivities.length };
  }, [scheduledActivities]);

  // ----------------------------------------------------
  // LAST 30 DAYS COMPACT HEATMAP
  // ----------------------------------------------------
  const heatmapCells30 = useMemo(() => {
    const focusMap: { [day: string]: number } = {};
    sessions.forEach(s => {
      const day = getLocalDateString(new Date(s.started_at));
      if (day) {
        focusMap[day] = (focusMap[day] || 0) + (s.duration_minutes || 0);
      }
    });

    return Array.from({ length: 30 }, (_, idx) => {
      const d = new Date();
      d.setDate(d.getDate() - (29 - idx));
      const dStr = getLocalDateString(d);
      const mins = focusMap[dStr] || 0;

      let intensityLevel = 0;
      if (mins > 0 && mins <= 25) intensityLevel = 1;
      else if (mins > 25 && mins <= 60) intensityLevel = 2;
      else if (mins > 60 && mins <= 120) intensityLevel = 3;
      else if (mins > 120) intensityLevel = 4;

      const formatLabel = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
      return {
        dateStr: dStr,
        label: `${formatLabel}: ${mins > 0 ? `${mins}m focados` : 'Nenhum foco'}`,
        intensity: intensityLevel,
        dayOfMonth: d.getDate(),
        weekday: d.getDay(),
        mins
      };
    });
  }, [sessions]);

  // ----------------------------------------------------
  // PILLAR D — HUMOR / MOOD GATHERING & CROSS-INSIGHTS
  // ----------------------------------------------------
  const moodAnalytics = useMemo(() => {
    // 1. Get filtered mood logs based on selected period with safe local date normalization
    // To prevent single-day lock when period is 'today', we auto-expand the visualization to 'month' (last 30 days) to display past entries and patterns.
    const analyticPeriod = period === 'today' ? 'month' : period;
    const targetSet = analyticPeriod === 'all' 
      ? null 
      : getDatesRangeSet(0, analyticPeriod === 'week' ? 7 : 30);
    const filtered = targetSet 
      ? moodEntries.filter(m => targetSet.has(getLocalDateString(m.date)))
      : moodEntries;

    // 2. Compute dominant mood of the period
    let dominantMoodOfPeriod: MoodKey | null = null;
    if (filtered.length > 0) {
      const counts: Record<string, number> = {};
      filtered.forEach(m => counts[m.mood] = (counts[m.mood] || 0) + 1);
      const maxCount = Math.max(...Object.values(counts));
      const candidates = Object.keys(counts).filter(k => counts[k] === maxCount);

      if (candidates.length === 1) {
        dominantMoodOfPeriod = candidates[0] as MoodKey;
      } else {
        const periodWeights = { noite: 3, tarde: 2, manha: 1 };
        const sortedByPeriod = [...filtered].sort((a, b) => {
          return (periodWeights[b.period] || 0) - (periodWeights[a.period] || 0);
        });
        dominantMoodOfPeriod = sortedByPeriod[0].mood as MoodKey;
      }
    }

    // 3. Mood distribution frequency percentages
    const totalFilteredCount = filtered.length;
    const distribution = MOOD_LIST.map(m => {
      const count = filtered.filter(item => item.mood === m.key).length;
      const percent = totalFilteredCount > 0 ? Math.round((count / totalFilteredCount) * 100) : 0;
      return {
        ...m,
        count,
        percent
      };
    });

    // 4. Mood over time strip (Option A: a per-day strip/heatmap)
    let totalDays = analyticPeriod === 'week' ? 7 : 30;
    if (analyticPeriod === 'all' && moodEntries.length > 0) {
      const dates = moodEntries.map(m => getLocalDateString(m.date)).filter(Boolean);
      if (dates.length > 0) {
        dates.sort();
        const oldestStr = dates[0];
        const oldestDate = new Date(oldestStr + 'T12:00:00');
        const todayDate = new Date();
        const diffTime = todayDate.getTime() - oldestDate.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        totalDays = Math.max(30, diffDays + 1);
      }
    }

    const stripDays = Array.from({ length: totalDays }, (_, idx) => {
      const d = new Date();
      d.setDate(d.getDate() - (totalDays - 1 - idx)); // oldest to newest (left to right)
      const dStr = getLocalDateString(d);
      
      const dayMoods = moodEntries.filter(m => getLocalDateString(m.date) === dStr);
      let dayDominant: MoodKey | null = null;
      if (dayMoods.length > 0) {
        const counts: Record<string, number> = {};
        dayMoods.forEach(m => counts[m.mood] = (counts[m.mood] || 0) + 1);
        const maxCount = Math.max(...Object.values(counts));
        const candidates = Object.keys(counts).filter(k => counts[k] === maxCount);
        if (candidates.length === 1) {
          dayDominant = candidates[0] as MoodKey;
        } else {
          const periodWeights = { noite: 3, tarde: 2, manha: 1 };
          const sortedByPeriod = [...dayMoods].sort((a, b) => {
            return (periodWeights[b.period] || 0) - (periodWeights[a.period] || 0);
          });
          dayDominant = sortedByPeriod[0].mood as MoodKey;
        }
      }

      const formatLabel = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
      const dayName = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
      return {
        dateStr: dStr,
        dayLabel: formatLabel,
        dayName: dayName,
        dominantMood: dayDominant,
        allMoods: dayMoods
      };
    });

    // 5. Cross insights (Mood x Focus)
    const insights: string[] = [];
    
    // Group focus minutes by local Date string
    const dailyFocus: Record<string, number> = {};
    sessions.forEach(s => {
      const day = getLocalDateString(new Date(s.started_at));
      if (day) {
        dailyFocus[day] = (dailyFocus[day] || 0) + (s.duration_minutes || 0);
      }
    });

    // Group mood entries by local Date string and compute dominant mood per day
    const dailyDominantMood: Record<string, MoodKey> = {};
    const dailyMoodsMap: Record<string, MoodEntry[]> = {};
    moodEntries.forEach(m => {
      const normalizedDate = getLocalDateString(m.date);
      if (normalizedDate) {
        if (!dailyMoodsMap[normalizedDate]) dailyMoodsMap[normalizedDate] = [];
        dailyMoodsMap[normalizedDate].push(m);
      }
    });

    Object.entries(dailyMoodsMap).forEach(([dateStr, list]) => {
      const validList = list.filter(m => m.mood !== null);
      if (validList.length === 0) return;

      const counts: Record<string, number> = {};
      validList.forEach(m => counts[m.mood as string] = (counts[m.mood as string] || 0) + 1);
      const maxCount = Math.max(...Object.values(counts));
      const candidates = Object.keys(counts).filter(k => counts[k] === maxCount);
      let dom: MoodKey;
      if (candidates.length === 1) {
        dom = candidates[0] as MoodKey;
      } else {
        const periodWeights: Record<string, number> = { noite: 3, tarde: 2, manha: 1 };
        const sortedByPeriod = [...validList].sort((a, b) => (periodWeights[b.period] || 0) - (periodWeights[a.period] || 0));
        dom = sortedByPeriod[0].mood as MoodKey;
      }
      dailyDominantMood[dateStr] = dom;
    });

    // We only compute cross-insights if there exists enough mood entries (e.g., min 3 logs)
    if (moodEntries.length >= 3) {
      // Metric 1: Productivity average by mood
      const focusByMood: Record<MoodKey, number[]> = {
        animado: [],
        tranquilo: [],
        neutro: [],
        ansioso: [],
        prabaixo: []
      };

      Object.entries(dailyDominantMood).forEach(([dateStr, moodKey]) => {
        const mins = dailyFocus[dateStr] || 0;
        focusByMood[moodKey].push(mins);
      });

      const moodAverages = Object.entries(focusByMood).reduce((acc, [mKey, minsList]) => {
        acc[mKey as MoodKey] = minsList.length > 0 
          ? minsList.reduce((s, val) => s + val, 0) / minsList.length 
          : null;
        return acc;
      }, {} as Record<MoodKey, number | null>);

      // Standard active days average for base reference
      const loggedDates = Object.keys(dailyDominantMood);
      const overallAvg = loggedDates.reduce((sum, d) => sum + (dailyFocus[d] || 0), 0) / loggedDates.length;

      // Positive boost checks
      if (moodAverages['tranquilo'] !== null && moodAverages['tranquilo'] > overallAvg && overallAvg > 10) {
        const ratio = moodAverages['tranquilo'] / overallAvg;
        if (ratio >= 1.05) {
          insights.push(`Você foca em média ${Math.round((ratio - 1) * 100)}% mais nos dias em que o seu humor está predominantemente Tranquilo.`);
        }
      }
      if (moodAverages['animado'] !== null && moodAverages['animado'] > overallAvg && overallAvg > 10) {
        const ratio = moodAverages['animado'] / overallAvg;
        if (ratio >= 1.05 && insights.length < 2) {
          insights.push(`O humor Animado registra o maior boost de dedicação no seu histórico, gerando ${Math.round((ratio - 1) * 100)}% mais tempo focado.`);
        }
      }

      // Neutral state efficiency check
      if (moodAverages['neutro'] !== null && moodAverages['neutro'] > overallAvg && insights.length < 2) {
        insights.push(`Seus dias de tom Neutro mantêm uma consistência estável, garantindo boas sessões mesmo sem oscilações emocionais.`);
      }

      // Morning down day check
      const morningDownDays = moodEntries.filter(m => m.period === 'manha' && m.mood === 'prabaixo').map(m => getLocalDateString(m.date));
      const morningClearDays = moodEntries.filter(m => m.period === 'manha' && m.mood !== 'prabaixo' && m.mood !== 'ansioso').map(m => getLocalDateString(m.date));
      if (morningDownDays.length >= 1 && morningClearDays.length >= 2) {
        const avgDown = morningDownDays.reduce((sum, d) => sum + (dailyFocus[d] || 0), 0) / morningDownDays.length;
        const avgClear = morningClearDays.reduce((sum, d) => sum + (dailyFocus[d] || 0), 0) / morningClearDays.length;
        if (avgClear > avgDown && avgClear > 15) {
          const drop = Math.round(((avgClear - avgDown) / avgClear) * 100);
          if (drop > 10 && drop < 100 && insights.length < 3) {
            insights.push(`Quando você acorda se sentindo Pra Baixo, o foco do dia costuma recuar ${drop}%. Sintonize tarefas menos desgastantes e respeite seu próprio tempo.`);
          }
        }
      }

      // Ansioso weekend/weekday recurrence checks
      const weekdayNamesShort = ['Domingos', 'Segundas-feiras', 'Terças-feiras', 'Quartas-feiras', 'Quintas-feiras', 'Sextas-feiras', 'Sábados'];
      const weekdayCounts: Record<number, Record<MoodKey, number>> = {};
      
      moodEntries.forEach(m => {
        if (!m.mood) return;
        const dateObj = new Date(getLocalDateString(m.date) + 'T12:00:00'); // avoid timezone offsets
        const wday = dateObj.getDay();
        if (!weekdayCounts[wday]) {
          weekdayCounts[wday] = { animado: 0, tranquilo: 0, neutro: 0, ansioso: 0, prabaixo: 0 };
        }
        weekdayCounts[wday][m.mood] = (weekdayCounts[wday][m.mood] || 0) + 1;
      });

      let weekdayInsightFound = false;
      Object.entries(weekdayCounts).forEach(([wdayStr, counts]) => {
        if (weekdayInsightFound || insights.length >= 3) return;
        const wday = parseInt(wdayStr);
        const totalWday = Object.values(counts).reduce((s, v) => s + v, 0);
        if (totalWday >= 2) {
          const sortedMoods = Object.entries(counts).sort((a, b) => b[1] - a[1]);
          const dominantDayMood = sortedMoods[0][0] as MoodKey;
          const dominantCount = sortedMoods[0][1];
          const pct = Math.round((dominantCount / totalWday) * 100);
          
          if (pct >= 50 && (dominantDayMood === 'ansioso' || dominantDayMood === 'prabaixo' || dominantDayMood === 'tranquilo')) {
            weekdayInsightFound = true;
            if (dominantDayMood === 'ansioso') {
              insights.push(`Suas ${weekdayNamesShort[wday]} costumam carregar um tom mais Ansioso. Experimente fracionar suas metas de foco em fatias curtas.`);
            } else if (dominantDayMood === 'prabaixo') {
              insights.push(`Você tende a se sentir mais Pra Baixo nas ${weekdayNamesShort[wday]}. Considere inserir pausas gentis de descompressão nesses dias.`);
            } else if (dominantDayMood === 'tranquilo') {
              insights.push(`Suas ${weekdayNamesShort[wday]} são predominantemente Tranquilas, oferecendo um espaço natural perfeito para sessões focadas intensas.`);
            }
          }
        }
      });
    }

    if (insights.length === 0) {
      insights.push('Continue registrando seu humor diário para a DUDE revelar seus padrões de rendimento de foco.');
    }

    // --- START OF ENERGY CALCULATIONS ---
    const periodFocusDuration: Record<string, number> = {};
    sessions.forEach(s => {
      if (!s.completed) return;
      const dateObj = new Date(s.started_at);
      const hours = dateObj.getHours();
      const dStr = getLocalDateString(dateObj);
      let p: 'manha' | 'tarde' | 'noite';
      if (hours >= 5 && hours < 12) {
        p = 'manha';
      } else if (hours >= 12 && hours < 18) {
        p = 'tarde';
      } else {
        p = 'noite';
      }
      const key = `${dStr}_${p}`;
      const actualDuration = s.actual_duration_minutes !== null && s.actual_duration_minutes !== undefined
        ? s.actual_duration_minutes
        : s.duration_minutes;
      periodFocusDuration[key] = (periodFocusDuration[key] || 0) + (actualDuration || 0);
    });

    const dailyFocusDurationOnStats: Record<string, number> = {};
    sessions.forEach(s => {
      if (!s.completed) return;
      const dStr = getLocalDateString(new Date(s.started_at));
      const actualDuration = s.actual_duration_minutes !== null && s.actual_duration_minutes !== undefined
        ? s.actual_duration_minutes
        : s.duration_minutes;
      dailyFocusDurationOnStats[dStr] = (dailyFocusDurationOnStats[dStr] || 0) + (actualDuration || 0);
    });

    const focusDurationByEnergy: Record<'cansado' | 'normal' | 'energizado', number[]> = {
      cansado: [],
      normal: [],
      energizado: []
    };

    moodEntries.forEach(m => {
      if (!m.energy) return;
      
      let mappedEnergy: 'cansado' | 'normal' | 'energizado' | null = null;
      if (m.energy === 'cansado' || m.energy === 'fadigado') mappedEnergy = 'cansado';
      else if (m.energy === 'energizado' || m.energy === 'inquieto') mappedEnergy = 'energizado';
      else if (m.energy === 'normal' || m.energy === 'equilibrado' || m.energy === 'pleno') mappedEnergy = 'normal';
      
      if (!mappedEnergy) return;

      const key = `${getLocalDateString(m.date)}_${m.period}`;
      const minsObj = periodFocusDuration[key] || 0;
      focusDurationByEnergy[mappedEnergy].push(minsObj);
    });

    const energyCounts = {
      cansado: focusDurationByEnergy.cansado.length,
      normal: focusDurationByEnergy.normal.length,
      energizado: focusDurationByEnergy.energizado.length
    };

    const energySums = {
      cansado: focusDurationByEnergy.cansado.reduce((s, x) => s + x, 0),
      normal: focusDurationByEnergy.normal.reduce((s, x) => s + x, 0),
      energizado: focusDurationByEnergy.energizado.reduce((s, x) => s + x, 0)
    };

    const energyAverages = {
      cansado: energyCounts.cansado > 0 ? (energySums.cansado / energyCounts.cansado) : 0,
      normal: energyCounts.normal > 0 ? (energySums.normal / energyCounts.normal) : 0,
      energizado: energyCounts.energizado > 0 ? (energySums.energizado / energyCounts.energizado) : 0
    };

    const totalEnergyLogs = energyCounts.cansado + energyCounts.normal + energyCounts.energizado;
    const hasEnoughEnergyData = totalEnergyLogs >= 3;

    let energyCorrelationInsight = "";
    if (hasEnoughEnergyData) {
      if (energyAverages.energizado > energyAverages.normal && energyAverages.energizado > 0) {
        const factor = energyAverages.normal > 0 
          ? (energyAverages.energizado / energyAverages.normal).toFixed(1)
          : (energyAverages.cansado > 0 ? (energyAverages.energizado / energyAverages.cansado).toFixed(1) : "2.0");
        
        // Find most common period for 'energizado'
        const energizedPeriods = moodEntries.filter(m => m.energy === 'energizado' || m.energy === 'inquieto' || m.energy === 'pleno');
        const periodCounts: Record<string, number> = {};
        energizedPeriods.forEach(p => periodCounts[p.period] = (periodCounts[p.period] || 0) + 1);
        let favoredPeriod = "";
        const maxPeriodVal = Math.max(...Object.values(periodCounts), 0);
        const bestPeriod = Object.keys(periodCounts).find(k => periodCounts[k] === maxPeriodVal);
        if (bestPeriod) {
          if (bestPeriod === 'manha') favoredPeriod = " e quase sempre no período da manhã";
          else if (bestPeriod === 'tarde') favoredPeriod = " e quase sempre no período da tarde";
          else if (bestPeriod === 'noite') favoredPeriod = " e quase sempre no período da noite";
        }
        
        energyCorrelationInsight = `Você foca cerca de ${factor}x mais nos momentos em que registra nível de energia Energizado${favoredPeriod}.`;
      } else if (energyAverages.normal > energyAverages.cansado && energyAverages.normal > 0) {
        const factor = energyAverages.cansado > 0 
          ? (energyAverages.normal / energyAverages.cansado).toFixed(1)
          : "1.5";
        energyCorrelationInsight = `Seu rendimento se mantém sob controle nos períodos com energia Normal, sendo ${factor}x superior aos momentos marcados por fadiga mental.`;
      } else {
        energyCorrelationInsight = `Seus níveis de foco estão equilibrados entre seus momentos de alta e média energia. Excelente adaptação das suas sessões profundas!`;
      }
    }

    // RISK PATTERN (gentle, never shaming)
    const tiredFocusDates = moodEntries
      .filter(m => m.energy === 'cansado' || m.energy === 'fadigado')
      .map(m => getLocalDateString(m.date))
      .filter(date => (dailyFocusDurationOnStats[date] || 0) > 0);

    let nextDayFocusAfterTiredSum = 0;
    let nextDayFocusAfterTiredCount = 0;
    
    tiredFocusDates.forEach(dStr => {
      const dObj = new Date(dStr + 'T12:00:00');
      dObj.setDate(dObj.getDate() + 1);
      const nextDayStr = getLocalDateString(dObj);
      if (dailyFocusDurationOnStats[nextDayStr] !== undefined) {
        nextDayFocusAfterTiredSum += dailyFocusDurationOnStats[nextDayStr];
        nextDayFocusAfterTiredCount++;
      }
    });

    const averageFocusNextDayAfterTired = nextDayFocusAfterTiredCount > 0 
      ? (nextDayFocusAfterTiredSum / nextDayFocusAfterTiredCount) 
      : null;

    const overallDailyAvg = Object.values(dailyFocusDurationOnStats).length > 0
      ? Object.values(dailyFocusDurationOnStats).reduce((a, b) => a + b, 0) / Object.values(dailyFocusDurationOnStats).length
      : 0;

    let hasRiskPattern = false;
    if (averageFocusNextDayAfterTired !== null && overallDailyAvg > 0) {
      if (averageFocusNextDayAfterTired < overallDailyAvg * 0.9) {
        hasRiskPattern = true;
      }
    }

    let energyRiskInsight = "";
    if (hasEnoughEnergyData) {
      if (hasRiskPattern) {
        energyRiskInsight = "Quando você foca cansado mentalmente, sua consistência tende a cair no dia seguinte. Nesses dias, sessões curtas rendem mais — e descansar é estratégia.";
      } else {
        energyRiskInsight = "Sua resiliência mental pós-esforço é elogiável: mesmo ao focar sob fadiga mental, seu ritmo no dia subsequente não recua drasticamente. Lembre-se, porém, de cultivar pausas saudáveis.";
      }
    }

    return {
      dominantMoodOfPeriod,
      distribution,
      stripDays,
      insights,
      hasEnoughData: filtered.length >= 1,
      energyAverages,
      energyCounts,
      hasEnoughEnergyData,
      energyCorrelationInsight,
      energyRiskInsight
    };
  }, [moodEntries, sessions, period]);

  // ----------------------------------------------------
  // IDENTITY LAYER CALCULATIONS (WAVE 2C)
  // ----------------------------------------------------
  const identityData = useMemo(() => {
    // 1. Focus days in the last 7 days
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return getLocalDateString(d);
    });

    let focusDaysCount = 0;
    last7Days.forEach(dStr => {
      const dayHasFocus = sessions.some(s => s.completed && getLocalDateString(new Date(s.started_at)) === dStr);
      if (dayHasFocus) focusDaysCount++;
    });

    // 2. Focus streak
    const streak = profile?.current_streak || 0;

    // 3. Steady habits streak (weekly_streak >= 2 or sessions_this_week >= 3)
    const hasSteadyHabits = habits.filter(h => h.habit_mode !== 'avoid').some(h => (h.weekly_streak || 0) >= 2 || (h.sessions_this_week || 0) >= 3);

    // 4. Successful avoidance checkins in last 7 days
    let avoidanceDaysCount = 0;
    last7Days.forEach(dStr => {
      const dayHasAvoidance = avoidanceCheckins.some(ac => ac.checkin_date === dStr && ac.status === 'success');
      if (dayHasAvoidance) avoidanceDaysCount++;
    });

    // Determine the Headline based on hierarchy
    let headline = "Você está começando a construir sua identidade de foco."; // Default/building frame
    if (focusDaysCount >= 5) {
      headline = `Você é alguém que foca ${focusDaysCount} de 7 dias.`;
    } else if (streak >= 3) {
      headline = "Você está se tornando uma pessoa de foco diário.";
    } else if (hasSteadyHabits) {
      headline = "Você é alguém que mantém seus hábitos.";
    } else if (avoidanceDaysCount >= 4) {
      headline = "Você é alguém que resiste às distrações.";
    }

    // --- Compute Milestone States ---
    const bestStreakValue = sessions.length === 0 ? 0 : (() => {
      const sortedDates = Array.from(new Set(
        sessions.map(s => getLocalDateString(new Date(s.started_at)))
      )).sort();
  
      let longest = 0;
      let current = 0;
      let prevDateStr: string | null = null;
  
      for (const dateStr of sortedDates) {
        if (!prevDateStr) {
          current = 1;
        } else {
          const prev = new Date(`${prevDateStr}T12:00:00`);
          const curr = new Date(`${dateStr}T12:00:00`);
          const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 3600 * 24));
          if (diffDays === 1) {
            current++;
          } else if (diffDays > 1) {
            if (current > longest) longest = current;
            current = 1;
          }
        }
        prevDateStr = dateStr;
      }
      if (current > longest) longest = current;
      return Math.max(longest, streak);
    })();

    const isFocoDiarioUnlocked = streak >= 7 || bestStreakValue >= 7;

    // B) Madrugador do Foco: Focus registered between 5:00 and 10:59 on at least 3 distinct days
    const focusMorningDays = new Set<string>();
    sessions.forEach(s => {
      if (!s.completed) return;
      const date = new Date(s.started_at);
      const hour = date.getHours();
      if (hour >= 5 && hour < 11) {
        focusMorningDays.add(getLocalDateString(date));
      }
    });
    const isMadrugadorUnlocked = focusMorningDays.size >= 3;

    // C) Construtor de Hábitos: At least 1 habit with weekly_streak >= 3 or total completions >= 15
    const totalCompletions = habitCompletions.length;
    const hasWeeklyStreak3 = habits.filter(h => h.habit_mode !== 'avoid').some(h => (h.weekly_streak || 0) >= 3);
    const isConstrutorUnlocked = hasWeeklyStreak3 || totalCompletions >= 15;

    // D) Mente Blindada: At least 5 distinct days of successful avoidance checkins
    const successfulAvoidanceDays = new Set<string>();
    avoidanceCheckins.forEach(ac => {
      if (ac.status === 'success') {
        successfulAvoidanceDays.add(ac.checkin_date);
      }
    });
    const isMenteBlindadaUnlocked = successfulAvoidanceDays.size >= 5;

    // E) Palavra Cumprida: At least 5 completed scheduled activities
    const completedSchedulesCount = scheduledActivities.filter(sa => sa.status === 'completed').length;
    const isPalavraCumpridaUnlocked = completedSchedulesCount >= 5;

    return {
      headline,
      focusDaysCount,
      milestones: [
        {
          key: 'foco_diario',
          title: 'Foco Diário',
          description: 'Aparecer todos os dias para o que realmente importa.',
          unlocked: isFocoDiarioUnlocked,
          requirement: 'Sequência de foco de 7 dias (atual ou melhor)',
          progress: `${Math.max(streak, bestStreakValue)}/7 dias`
        },
        {
          key: 'madrugador',
          title: 'Madrugador do Foco',
          description: 'Começar o trabalho profundo nas primeiras horas do dia.',
          unlocked: isMadrugadorUnlocked,
          requirement: 'Focalizar pela manhã (05h - 11h) em 3 dias diferentes',
          progress: `${focusMorningDays.size}/3 dias`
        },
        {
          key: 'construtor',
          title: 'Construtor de Hábitos',
          description: 'Sustentar rituais consistentes semana após semana.',
          unlocked: isConstrutorUnlocked,
          requirement: 'Hábito com sequência ≥ 3 sem. ou 15 registros totais',
          progress: hasWeeklyStreak3 ? 'Sequência ≥ 3 em dia!' : `${totalCompletions}/15 registros`
        },
        {
          key: 'mente_blindada',
          title: 'Mente Blindada',
          description: 'Proteger sua atenção contra impulsos e ruídos.',
          unlocked: isMenteBlindadaUnlocked,
          requirement: 'Evitar distrações com check-in de sucesso em 5 dias',
          progress: `${successfulAvoidanceDays.size}/5 dias`
        },
        {
          key: 'palavra_cumprida',
          title: 'Palavra Cumprida',
          description: 'Cumprir o que foi planejado na agenda.',
          unlocked: isPalavraCumpridaUnlocked,
          requirement: 'Completar 5 atividades agendadas ou planejadas',
          progress: `${completedSchedulesCount}/5 concluídas`
        }
      ]
    };
  }, [sessions, habits, profile, avoidanceCheckins, habitCompletions, scheduledActivities]);

  const checkinsWithNotes = useMemo(() => {
    const avoidHabitsMap = new Map(habits.map(h => [h.id, h]));
    return avoidanceCheckins
      .filter(c => (c.status === 'relapse' || c.status === 'recai') && c.trigger_note && c.trigger_note.trim() !== '')
      .map(c => {
        const habit = avoidHabitsMap.get(c.habit_id);
        return {
          ...c,
          habitName: habit ? habit.name : 'Autocontrole'
        };
      })
      .sort((a, b) => new Date(b.created_at || b.checkin_date).getTime() - new Date(a.created_at || a.checkin_date).getTime());
  }, [avoidanceCheckins, habits]);

  const completedTasksCount = useMemo(() => {
    const periodSessionIds = new Set(periodSessions.map(s => s.id));
    return sessionTasks.filter(t => periodSessionIds.has(t.session_id) && t.completed).length;
  }, [periodSessions, sessionTasks]);

  const firstName = profile?.full_name?.split(' ')[0] || 'Campeão';

  const todayStr = getLocalDateString(new Date());
  const todayMoods = moodEntries ? moodEntries.filter(m => m.date === todayStr) : [];
  const activeMoodEntry = todayMoods.length > 0 ? todayMoods[0] : null;

  return (
    <div className="w-full max-w-4xl mx-auto px-4 md:px-0">
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 15 }}
        className="w-full bg-surface border border-primary-green/10 rounded-[2rem] p-6 md:p-10 relative shadow-[0_0_100px_rgba(110,231,168,0.06)] space-y-8"
      >
        {/* HEADER SECTION */}
        <header className="space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#6ee7a8]/10 border border-[#6ee7a8]/30 rounded-full text-[#6ee7a8]">
            <Sparkles size={13} className="animate-pulse" />
            <span className="text-[11px] font-extrabold uppercase tracking-widest font-sans">Raio-X do seu Tempo</span>
          </div>
          <div className="space-y-1 text-left">
            <h2 className="text-3xl md:text-4.5xl font-extrabold tracking-tight text-text-primary font-sans leading-tight">
              {firstName}, Aqui está o seu Centro de Inteligência
            </h2>
            <p className="text-sm md:text-base text-text-secondary/80 font-medium max-w-2xl leading-normal font-sans">
              Uma visão completa de como você está utilizando seu tempo e construindo novos hábitos.
            </p>
          </div>
        </header>

        {/* PERIOD SELECTOR */}
        <div className="w-full flex">
          <div className="w-full grid grid-cols-4 bg-white/[0.02] border border-white/5 p-1 rounded-2xl font-sans">
            {(['today', 'week', 'month', 'all'] as PeriodType[]).map((pType) => (
              <button
                key={pType}
                onClick={() => setPeriod(pType)}
                className={`py-3 text-xs md:text-sm font-bold uppercase tracking-wider rounded-xl cursor-pointer transition-all ${
                  period === pType
                    ? 'bg-primary-green text-background shadow-[0_0_20px_rgba(110,231,168,0.25)]'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {pType === 'today' ? 'Hoje' : pType === 'week' ? 'Semana' : pType === 'month' ? 'Mês' : 'Tudo'}
              </button>
            ))}
          </div>
        </div>

        {/* Seu estado energético atual chip */}
        {activeMoodEntry && activeMoodEntry.energy && (
          <div className="flex justify-center w-full my-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/[0.03] border border-white/5 rounded-full text-[10px] uppercase font-bold tracking-wider text-text-secondary hover:bg-white/[0.05] transition-colors cursor-default select-none relative z-10 shadow-sm shadow-black/20"
            >
              <span className="w-1.5 h-1.5 rounded-full animate-pulse z-10 bg-[#6ee7a8] shadow-[0_0_8px_rgba(110,231,168,0.5)]" />
              <span className="text-white/60 tracking-wider">Seu estado energético atual é: <span className="text-text-primary font-bold capitalize">{activeMoodEntry.energy}</span></span>
            </motion.div>
          </div>
        )}

        {/* Personalized synthesis phrase */}
        <div className="p-4 bg-primary-green/[0.015] border border-primary-green/10 rounded-2xl flex items-start gap-3">
          <div className="w-5 h-5 rounded-full bg-primary-green/10 flex items-center justify-center shrink-0 border border-primary-green/10 font-sans mt-0.5">
            <Sparkles size={11} className="text-primary-green animate-pulse" />
          </div>
          <div className="flex-1 flex flex-col font-sans">
            {sessions.length === 0 ? (
              <>
                <p className="text-sm text-white font-medium leading-relaxed">
                  "{emptyStatePhrase}"
                </p>
                <p className="text-[11px] text-white/50 mt-1.5">
                  ↳ DUDE aguardando sua primeira execução para iniciar o rastreamento...
                </p>
              </>
            ) : (
              <>
                <p className="text-sm text-white font-medium">
                  "{interpretiveHeadline}"
                </p>
                {lifetimeMetric && (
                  <p className="text-[11px] text-white/50 mt-1.5">
                    ↳ Média histórica: <span className="text-white/80 font-semibold">{lifetimeMetric}</span>h / dia em sessões profundas.
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        {/* PERIOD NUMBERS BLOCK (foco, sessões, projetos, "dias invictos", "recorde pessoal") */}
        <div className="space-y-4">
          <section className="bg-white/[0.01] border border-white/5 rounded-3xl p-6 md:p-8 space-y-4 relative overflow-hidden text-left font-sans">
            {/* Subtle decoration background glow */}
            <div className="absolute top-0 right-0 w-[150px] h-[150px] bg-primary-green/5 blur-3xl rounded-full pointer-events-none" />

            <div className="space-y-1 select-none cursor-default font-sans">
              <span className="text-[13px] md:text-sm font-semibold tracking-wide text-text-secondary/75 uppercase block font-sans">
                Tempo de Foco {period === 'today' ? 'Hoje' : period === 'week' ? 'esta Semana' : period === 'month' ? 'este Mês' : 'Acumulado Total'}
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-white/70 drop-shadow-[0_0_15px_rgba(255,255,255,0.15)] tracking-tight whitespace-nowrap inline-block font-mono">
                  {formatCompactDuration(period === 'all' ? totalFocusAllTimeMins : currentPeriodMins)}
                </span>
              </div>
              
              <div className="flex items-center gap-2 mt-2 font-sans">
                <span className={`w-2 h-2 rounded-full ${supportingStats.sessionCount > 0 ? 'bg-primary-green animate-pulse' : 'bg-text-secondary/30'}`} />
                <p className="text-xs md:text-[13.5px] font-semibold tracking-wide text-text-primary font-sans">
                  {comparisonLine}
                </p>
              </div>
            </div>
          </section>

          {/* METRICS BENTO GRID */}
          <section className="grid grid-cols-3 gap-6 md:gap-8 font-sans py-4 select-none">
            {/* Card 1: Sessões Profundas */}
            <div className="flex flex-col justify-between text-left font-sans">
              <span className="text-4xl md:text-5xl font-black text-text-primary mb-1 block leading-none">{supportingStats.sessionCount}</span>
              <span className="text-[10px] font-bold text-text-secondary/50 uppercase tracking-[0.2em] block">Sessões Profundas</span>
            </div>
            {/* Card 2: Projetos */}
            <div className="flex flex-col justify-between text-left font-sans">
              <span className="text-4xl md:text-5xl font-black text-text-primary mb-1 block leading-none">{supportingStats.projectsCount}</span>
              <span className="text-[10px] font-bold text-text-secondary/50 uppercase tracking-[0.2em] block">Projetos</span>
            </div>
            {/* Card 3: Dias Invictos */}
            <div className="flex flex-col justify-between text-left font-sans">
              <span className="text-4xl md:text-5xl font-black text-[#6ee7a8] mb-1 block leading-none">{currentStreak}</span>
              <span className="text-[10px] font-bold text-text-secondary/50 uppercase tracking-[0.2em] block">Dias Invictos</span>
            </div>
          </section>
        </div>



        {/* TAREFAS REALIZADAS NO DIA - SUBSTITUÍDO POR CARD EXPANSÍVEL BENTO E MODAL */}
        <section className="font-sans">
          <button
            onClick={() => setShowCompletedTasksModal(true)}
            className="w-full flex items-center justify-between p-5 bg-white/[0.01] hover:bg-white/[0.025] border border-white/5 hover:border-primary-green/30 rounded-3xl transition-all duration-300 group cursor-pointer text-left"
          >
            <div className="flex items-center gap-4 font-sans">
              <div className="w-10 h-10 rounded-xl bg-[#6ee7a8]/10 flex items-center justify-center shrink-0">
                <CheckCircle2 className="text-[#6ee7a8]" size={20} />
              </div>
              <div className="space-y-0.5">
                <span className="text-lg font-black text-text-primary tracking-tight font-sans block group-hover:text-primary-green transition-colors leading-tight">
                  {completedTasksCount} {completedTasksCount === 1 ? 'Tarefa Concluída' : 'Tarefas Concluídas'} {
                    period === 'today' ? 'Hoje' : period === 'week' ? 'esta Semana' : period === 'month' ? 'este Mês' : 'no Total'
                  }
                </span>
                <span className="text-xs text-text-secondary/60 font-semibold block uppercase tracking-wider">
                  Visualizar Diário de Atividades e Métricas · {periodSessions.length} {periodSessions.length === 1 ? 'sessão' : 'sessões'}
                </span>
              </div>
            </div>
            <div className="text-text-secondary/40 group-hover:text-primary-green transition-all duration-300 transform group-hover:translate-x-1 p-2 bg-white/5 rounded-full">
              <ChevronDown size={14} className="-rotate-90" />
            </div>
          </button>

          {/* OVERLAY MODAL FOR COMPLETED TASKS & LOGS */}
          <AnimatePresence>
            {showCompletedTasksModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                {/* Backdrop */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowCompletedTasksModal(false)}
                  className="absolute inset-0 bg-black/80 backdrop-blur-md cursor-pointer"
                />

                {/* Modal Container */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 30 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 30 }}
                  transition={{ type: "spring", damping: 25, stiffness: 350 }}
                  className="relative w-full max-w-2xl bg-surface border border-white/10 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[85vh] font-sans"
                >
                  {/* Modal Header */}
                  <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
                    <div className="space-y-1 text-left">
                      <h4 className="text-lg md:text-xl font-extrabold text-text-primary tracking-tight font-sans flex items-center gap-2">
                        <span className="text-primary-green">☑</span> Diário de Atividades Concluídas
                      </h4>
                      <p className="text-xs text-text-secondary/65 uppercase tracking-wider font-semibold font-mono">
                        {periodSessions.length} {periodSessions.length === 1 ? 'sessão registrada' : 'sessões registradas'} no período selecionado
                      </p>
                    </div>
                    <button
                      onClick={() => setShowCompletedTasksModal(false)}
                      className="p-2.5 hover:bg-white/5 rounded-xl text-text-secondary/70 hover:text-text-primary transition-colors cursor-pointer"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {/* Modal Scrollable Body */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar text-left font-sans">
                    {periodSessions.length > 0 ? (
                      periodSessions.map(session => {
                        const resolved = resolverNomeSessao(session, habits, projects);
                        const isPartial = session.parcial === true || 
                                         (session.actual_duration_minutes !== null && 
                                          session.actual_duration_minutes !== undefined && 
                                          session.actual_duration_minutes < session.duration_minutes);
                        const durationToUse = session.actual_duration_minutes !== null ? session.actual_duration_minutes : session.duration_minutes;
                        const formattedDuration = formatSessionDuration(durationToUse);
                        const timeRange = formatTimeRange(session.started_at, session.completed_at, session.duration_minutes);

                        const tasks = sessionTasks.filter(t => t.session_id === session.id);
                        const completedTasks = tasks.filter(t => t.completed);

                        return (
                          <div key={session.id} className="p-4 bg-white/[0.015] border border-white/5 rounded-2xl flex gap-3.5 items-start font-sans">
                            <CheckSquare 
                              size={15} 
                              className="shrink-0 mt-1" 
                              style={{ color: isPartial ? 'var(--amber)' : '#10b981' }}
                            />
                            <div className="flex-1 min-w-0 font-sans">
                              <div className="flex items-center gap-2 flex-wrap font-sans">
                                <span className="text-sm md:text-base font-extrabold text-text-primary break-words max-w-full">
                                  {resolved.titulo}
                                </span>
                                <span className="text-text-secondary/30">—</span>
                                <span className="text-xs text-text-secondary/60 truncate font-bold uppercase tracking-widest font-mono">
                                  {resolved.projeto}
                                </span>
                                {session.scheduled_activity_id && (
                                  <span 
                                    className="inline-flex items-center font-bold font-mono text-[9px] bg-purple-500/10 border border-purple-500/20 text-purple-400 tracking-wider py-0.5 px-2 rounded-full"
                                  >
                                    AGENDADA
                                  </span>
                                )}
                                {isPartial && (
                                  <span 
                                    className="inline-flex items-center font-bold font-mono text-[9px] bg-amber-500/10 border border-amber-500/20 text-amber-400 tracking-wider py-0.5 px-2 rounded-full"
                                  >
                                    INCOMPLETA
                                  </span>
                                )}
                              </div>
                              
                              <div className="text-[11px] md:text-xs font-semibold leading-normal mt-1 flex items-center gap-1.5 text-text-secondary/50 font-mono">
                                <span>{timeRange}</span>
                                <span className="text-text-secondary/30">·</span>
                                <span>{formattedDuration}</span>
                              </div>

                              {/* Checklist tasks of the session */}
                              {tasks.length > 0 ? (
                                <div className="mt-3.5 space-y-2 pl-1 border-t border-white/5 pt-3 font-sans">
                                  {tasks.map(task => (
                                    <div key={task.id} className="flex items-center gap-2.5 text-xs md:text-sm text-text-secondary/80 font-sans">
                                      <span className={task.completed ? "text-primary-green select-none font-bold" : "text-text-secondary/30 select-none"}>
                                        {task.completed ? "☑" : "☐"}
                                      </span>
                                      <span className={task.completed ? "line-through decoration-white/10 text-text-secondary/40 font-medium" : "text-text-primary font-medium"}>
                                        {task.description}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-[10px] md:text-xs text-text-secondary/40 italic font-medium mt-3 font-sans">
                                  Nenhum item de checklist associado a esta sessão de foco.
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs md:text-sm text-text-secondary/40 italic font-light pt-4 text-center font-sans">
                        Nenhuma sessão realizada neste período.
                      </p>
                    )}
                  </div>

                  {/* Modal Footer */}
                  <div className="p-5 border-t border-white/5 bg-white/[0.01] flex justify-end">
                    <button
                      onClick={() => setShowCompletedTasksModal(false)}
                      className="px-6 py-2.5 bg-white/5 hover:bg-white/10 text-xs font-bold text-text-primary uppercase tracking-wider rounded-xl transition-all cursor-pointer font-sans"
                    >
                      Fechar Diário
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </section>

        {/* ONDE SEU TEMPO FOI */}
        <section className="space-y-5 font-sans">
          <h3 className="text-xs md:text-[13px] font-semibold text-text-secondary/75 uppercase tracking-wide flex items-center gap-1.5 font-sans">
            <Target size={12} className="text-primary-green" /> Onde seu tempo foi
          </h3>

          <div className="space-y-4 font-sans text-left">
            {projectDistribution.length === 0 ? (
              <div className="py-8 text-center bg-white/[0.01] border border-dashed border-white/5 rounded-2xl font-sans">
                <p className="text-xs md:text-sm text-text-secondary/60 italic font-sans">Sem sessões de foco neste período.</p>
              </div>
            ) : (
              projectDistribution.map((item, idx) => (
                <div key={idx} className="space-y-1.5 font-sans">
                  <div className="flex justify-between items-baseline text-xs md:text-sm font-sans">
                    <span className="font-semibold text-text-primary max-w-[65%] truncate block font-sans">{item.name}</span>
                    <span className="text-text-secondary/80 text-right whitespace-nowrap block font-sans">
                      {formatCompactDuration(item.mins)} · <strong className="text-[#6ee7a8] font-bold">{item.percent}%</strong>
                    </span>
                  </div>
                  {/* Compact progress bar */}
                  <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-primary-green/80 to-[#6ee7a8] rounded-full transition-all duration-300 shadow-[0_0_8px_rgba(110,231,168,0.3)]" 
                      style={{ width: `${item.percent}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* BLOCK 3: EVOLUÇÃO DISCIPLINADA (BARS HEIGHT BUG FIXED) */}
        <section className="space-y-4 font-sans">
          <div className="flex items-center justify-between font-sans">
            <h3 className="text-xs md:text-[13px] font-semibold text-text-secondary/75 uppercase tracking-wide flex items-center gap-1.5 font-sans">
              <BarChart2 size={12} className="text-primary-green" /> Evolução de Concentração
            </h3>
            <span className="text-[10px] font-mono uppercase bg-primary-green/10 text-primary-green px-2 py-0.5 rounded border border-primary-green/15 tracking-wider">
              Últimos 7 dias
            </span>
          </div>

          <div id="focus-evolution-chart-container" className="flex flex-col space-y-2 font-sans">
            
            {/* The chart area */}
            <div className="h-[120px] md:h-[150px] flex items-end gap-3 md:gap-4 px-2 pt-6 w-full relative font-sans">
              {chartData.map((dataItem, idx) => {
                const heightPercent = maxChartMins > 0 ? (dataItem.mins / maxChartMins) * 100 : 0;
                // Proportional bar calculation with a minimum height for Zero/Near-zero days
                const heightStyle = dataItem.mins > 0 ? `${Math.max(6, heightPercent)}%` : '4px';

                return (
                  <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full relative group font-sans">
                    {/* Always visible label top of column to avoid hover requirements */}
                    <span className="text-[10px] md:text-[11px] font-medium text-text-secondary/85 tracking-tight mb-1 select-none font-sans font-mono">
                      {dataItem.displayValue}
                    </span>

                    {/* The bar core */}
                    <div 
                      className={`w-full rounded-t-lg transition-all duration-300 ${
                        dataItem.mins > 0 
                          ? 'bg-gradient-to-t from-primary-green/5 to-primary-green border-t border-primary-green group-hover:brightness-110 shadow-[0_-2px_10px_rgba(110,231,168,0.15)] cursor-pointer' 
                          : 'bg-white/[0.02] border-t border-dashed border-white/10'
                      }`}
                      style={{ height: heightStyle }}
                    />

                    {/* Below-label */}
                    <span className="text-[10px] md:text-xs font-semibold text-text-secondary/70 mt-2 tracking-wide select-none font-sans">
                      {dataItem.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {maxChartMins === 0 && (
              <p className="text-xs md:text-sm text-text-secondary/60 italic font-sans text-center pt-2 font-sans">
                Sem foco registrado nos últimos 7 dias.
              </p>
            )}
          </div>
        </section>


        {/* SEU HISTÓRICO DE SESSÕES PROFUNDAS POR DATAS */}
        <section className="bg-white/[0.01] border border-white/5 p-6 rounded-3xl space-y-6 font-sans">
          <div className="flex flex-col space-y-1 select-none">
            <h3 className="text-xs md:text-[13px] font-semibold text-text-secondary/75 uppercase tracking-wide flex items-center gap-1.5">
              <Calendar size={12} className="text-primary-green" /> Seu Histórico de Sessões Profundas por datas
            </h3>
            <span className="text-xs text-text-secondary/60 leading-normal">
              Toque em qualquer dia no mapa de 30 dias abaixo ou use o seletor de data para acessar e detalhar sessões e tarefas de qualquer período.
            </span>
          </div>

          {/* Redesigned Clickable Heatmap (30 days) with larger calendar-like cells */}
          <div className="space-y-3">
            <span className="text-[10px] uppercase tracking-wider text-text-secondary/50 font-bold block">
              Mapa do Foco (Últimos 30 Dias)
            </span>
            
            <div className="grid grid-cols-5 xs:grid-cols-6 sm:grid-cols-10 gap-2">
              {heatmapCells30.map((cell) => {
                const isSelected = selectedDate === cell.dateStr;
                const bgClass = {
                  0: 'bg-white/[0.01] border-white/5 hover:bg-white/[0.04]',
                  1: 'bg-primary-green/15 border-primary-green/10 hover:bg-primary-green/25',
                  2: 'bg-primary-green/35 border-primary-green/30 hover:bg-primary-green/45',
                  3: 'bg-primary-green/65 border-primary-green/60 hover:bg-primary-green/75',
                  4: 'bg-primary-green border-primary-green/90 hover:brightness-110'
                }[cell.intensity];

                return (
                  <button
                    key={cell.dateStr}
                    onClick={() => setSelectedDate(cell.dateStr)}
                    className={`aspect-square p-2 rounded-xl border flex flex-col justify-between transition-all duration-150 cursor-pointer ${bgClass} ${
                      isSelected 
                        ? 'ring-2 ring-primary-green ring-offset-2 ring-offset-background border-primary-green scale-[1.03] shadow-[0_0_15px_rgba(110,231,168,0.25)]' 
                        : ''
                    }`}
                  >
                    <span className="text-[10px] font-mono font-black block text-left text-text-primary">
                      {cell.dayOfMonth}
                    </span>
                    <span className="text-[8px] font-sans font-medium text-text-secondary/70 truncate block text-left w-full">
                      {cell.mins > 0 ? `${cell.mins}m` : '0m'}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Heatmap Legend */}
            <div className="flex items-center justify-between text-[10px] font-medium text-text-secondary/50 pt-1 border-t border-white/5">
              <span>Menos foco</span>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-white/[0.01] border border-white/5 rounded-sm" />
                <span className="w-2.5 h-2.5 bg-primary-green/15 border border-primary-green/10 rounded-sm" />
                <span className="w-2.5 h-2.5 bg-primary-green/35 border border-primary-green/30 rounded-sm" />
                <span className="w-2.5 h-2.5 bg-primary-green/65 border border-primary-green/60 rounded-sm" />
                <span className="w-2.5 h-2.5 bg-primary-green border border-primary-green rounded-sm" />
                <span>Mais foco</span>
              </div>
            </div>
          </div>

          {/* Date Picker select details */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/[0.01] border border-white/5 p-4 rounded-2xl">
            <div className="space-y-0.5">
              <span className="text-[11px] font-bold text-text-secondary/70 uppercase tracking-wide font-sans">Ir para uma data histórica</span>
              <p className="text-[10px] text-text-secondary/50 leading-tight font-sans">Escolha qualquer dia anterior para auditar.</p>
            </div>
            
            <input 
              type="date"
              value={selectedDate || ''}
              onChange={(e) => setSelectedDate(e.target.value || null)}
              className="bg-background/80 border border-white/10 rounded-xl px-4 py-2 text-xs text-text-primary font-mono focus:border-primary-green focus:outline-none transition-all cursor-pointer shadow-inner shrink-0"
            />
          </div>

          {/* Expanding Details Block */}
          <AnimatePresence mode="wait">
            {selectedDate && (() => {
              const formattedDateString = (() => {
                try {
                  const parts = selectedDate.split('-');
                  const dObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                  return dObj.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
                } catch {
                  return selectedDate;
                }
              })();

              const daySessions = sessions.filter(s => getLocalDateString(new Date(s.started_at)) === selectedDate);
              const dayMins = daySessions.reduce((acc, s) => acc + (s.duration_minutes || 0), 0);

              return (
                <motion.div
                  key={selectedDate}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="bg-white/[0.015] border border-primary-green/10 rounded-2.5xl p-5 space-y-4 text-left"
                >
                  <div className="flex justify-between items-center border-b border-white/5 pb-3">
                    <div className="space-y-0.5">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-primary-green font-mono">
                        Auditoria de Data
                      </span>
                      <h4 className="text-sm font-bold text-text-primary">
                        {formattedDateString}
                      </h4>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-black text-text-primary block font-mono">
                        {dayMins} min
                      </span>
                      <span className="text-[10px] text-text-secondary/50 block font-light">
                        Tempo total focado
                      </span>
                    </div>
                  </div>

                  <div className="space-y-5 font-sans">
                    {/* Bloco 1: Foco e Produtividade */}
                    <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl space-y-3">
                      <span className="text-[10px] font-bold text-text-secondary/40 uppercase tracking-widest block">
                        🎯 Foco & Produtividade
                      </span>
                      <div className="space-y-3">
                        {daySessions.length > 0 ? (
                          daySessions.map(session => {
                            const resolved = resolverNomeSessao(session, habits, projects);
                            const isPartial = session.parcial === true || 
                                             (session.actual_duration_minutes !== null && 
                                              session.actual_duration_minutes !== undefined && 
                                              session.actual_duration_minutes < session.duration_minutes);
                            const durationToUse = session.actual_duration_minutes !== null ? session.actual_duration_minutes : session.duration_minutes;
                            const formattedDuration = formatSessionDuration(durationToUse);
                            const timeRange = formatTimeRange(session.started_at, session.completed_at, session.duration_minutes);

                            const tasks = sessionTasks.filter(t => t.session_id === session.id);
                            const completedTasks = tasks.filter(t => t.completed);

                            return (
                              <div key={session.id} className="p-3 bg-white/[0.015] border border-white/5 rounded-xl space-y-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-bold text-text-primary">
                                    {resolved.titulo}
                                  </span>
                                  <span className="text-text-secondary/40 text-[10px]">•</span>
                                  <span className="text-[10px] text-text-secondary/70 uppercase tracking-wider font-semibold font-mono">
                                    {resolved.projeto}
                                  </span>
                                  {isPartial && (
                                    <span className="text-[8px] font-bold font-mono px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 uppercase">
                                      Incompleta
                                    </span>
                                  )}
                                </div>

                                <div className="text-[10px] text-text-secondary/50 font-mono flex items-center gap-2">
                                  <span>Horário: {timeRange}</span>
                                  <span>•</span>
                                  <span>Duração: {formattedDuration}</span>
                                </div>

                                {completedTasks.length > 0 && (
                                  <div className="space-y-1 pl-1 border-t border-white/5 pt-2 mt-1">
                                    <span className="text-[9px] font-bold text-text-secondary/40 uppercase tracking-widest block mb-1">
                                      Tarefas Completas na Sessão:
                                    </span>
                                    {completedTasks.map(task => (
                                      <div key={task.id} className="flex items-center gap-1.5 text-[11px] text-text-secondary/80">
                                        <span className="text-primary-green select-none text-xs">☑</span>
                                        <span className="line-through decoration-white/10 text-text-secondary/50">{task.description}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        ) : (
                          <p className="text-xs text-text-secondary/40 italic font-light py-2 pl-1">
                            Nenhuma sessão realizada neste dia. O descanso também faz parte do processo consciente!
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Bloco 2: Biométrico & Disposição */}
                    <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl space-y-3">
                      <span className="text-[10px] font-bold text-text-secondary/40 uppercase tracking-widest block">
                        🧠 Estado Biométrico
                      </span>
                      {selectedDateSnapshot?.dayMoodEntry ? (
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div className="bg-white/[0.015] border border-white/[0.03] p-3 rounded-xl">
                            <span className="text-[9px] font-bold text-text-secondary/50 uppercase tracking-wider block">DISPOSIÇÃO / ENERGIA</span>
                            <span className="text-text-primary font-bold mt-0.5 block">
                              {formatEnergy(selectedDateSnapshot.dayMoodEntry.energy)}
                            </span>
                          </div>
                          <div className="bg-white/[0.015] border border-white/[0.03] p-3 rounded-xl">
                            <span className="text-[9px] font-bold text-text-secondary/50 uppercase tracking-wider block">SINTONIA MENTAL</span>
                            <span className="text-text-primary font-bold mt-0.5 flex items-center gap-1">
                              {selectedDateSnapshot.dayMoodObj?.emoji || '😐'} 
                              <span>{selectedDateSnapshot.dayMoodObj?.label || 'Neutro'}</span>
                            </span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-text-secondary/40 italic font-light py-2 pl-1">
                          Nenhum registro biométrico registrado neste dia.
                        </p>
                      )}
                    </div>

                    {/* Bloco 3: Autocontrole / Anti-Vício */}
                    <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl space-y-3">
                      <span className="text-[10px] font-bold text-text-secondary/40 uppercase tracking-widest block">
                        🛡️ Batalhas de Autocontrole
                      </span>
                      {selectedDateSnapshot && selectedDateSnapshot.dayAvoidanceCheckins.length > 0 ? (
                        <div className="space-y-2">
                          {selectedDateSnapshot.dayAvoidanceCheckins.map((ac) => {
                            const habit = habits.find(h => h.id === ac.habit_id);
                            const hName = habit ? habit.name : 'Vício Cadastrado';
                            const status = ac.status?.toLowerCase();
                            const isResisti = status === 'resisti' || status === 'success';
                            const isRecai = status === 'recai' || status === 'relapse';
                            
                            let statusLabel = 'Registro';
                            let statusColor = 'text-text-secondary/60 bg-white/5 border-white/10';
                            if (isResisti) {
                              statusLabel = '✓ Resistido';
                              statusColor = 'text-green bg-green/10 border-green/20';
                            } else if (isRecai) {
                              statusLabel = '✗ Recaída';
                              statusColor = 'text-red-400 bg-red-400/10 border-red-400/20';
                            } else if (status === 'depois') {
                              statusLabel = '⏰ Postergado';
                              statusColor = 'text-amber-500 bg-[#df8a13]/10 border-amber-500/20';
                            }

                            return (
                              <div key={ac.id} className="flex justify-between items-start gap-3 p-3 rounded-xl bg-white/[0.015] border border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                                <div className="flex flex-col flex-1 min-w-0 space-y-1.5">
                                  <span className="text-xs font-bold text-text-primary">{hName}</span>
                                  {ac.window_label && <span className="text-[9px] font-mono text-text-secondary/50 mt-0.5">{ac.window_label}</span>}
                                  {ac.trigger_note && (
                                    <div className="mt-1.5 p-2 bg-black/15 rounded-lg border-l-2 border-red-400/30">
                                      <p className="text-[10px] text-text-secondary/80 italic leading-relaxed break-words">
                                        🧬 <span className="font-mono text-[8px] not-italic text-red-400/70 uppercase tracking-widest font-bold">Gatilho:</span> {ac.trigger_note}
                                      </p>
                                    </div>
                                  )}
                                </div>
                                <span className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border ${statusColor} shrink-0`}>
                                  {statusLabel}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-text-secondary/40 italic font-light py-2 pl-1">
                          Nenhum check-in de autocontrole registrado neste dia.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end pt-2 border-t border-white/5">
                    <button
                      onClick={() => setSelectedDate(null)}
                      className="px-4 py-2 bg-white/[0.03] border border-white/5 hover:bg-white/5 hover:border-primary-green/20 rounded-xl text-[10px] uppercase font-bold tracking-wider transition-all cursor-pointer text-text-primary"
                    >
                      Voltar para Visão Geral
                    </button>
                  </div>
                </motion.div>
              );
            })()}
          </AnimatePresence>

          {/* Bottom section controls with a general list clear / reset button */}
          {selectedDate && (
            <div className="flex justify-center pt-2">
              <button
                onClick={() => setSelectedDate(null)}
                className="inline-flex items-center gap-1.5 px-6 py-2.5 bg-primary-green/10 border border-primary-green/20 hover:bg-primary-green/15 rounded-2xl text-[11px] uppercase font-bold tracking-wider transition-all cursor-pointer text-primary-green"
              >
                Voltar
              </button>
            </div>
          )}
        </section>

        {/* PROGRESSIVE DISCLOSURE INNER TRIGGER BANNER ("Mapa do Tempo") */}
        <section className="font-sans">
          <div className="p-6 bg-gradient-to-br from-primary-green/[0.05] to-primary-green/[0.015] border border-primary-green/20 rounded-3xl flex flex-col md:flex-row md:items-center md:justify-between gap-6 md:gap-8 relative overflow-hidden select-none">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary-green/5 blur-2xl rounded-full pointer-events-none" />
            
            <div className="flex gap-4 items-start md:items-center">
              <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-xl shrink-0">
                <Brain className="text-[#6ee7a8] animate-pulse" size={24} />
              </div>
              <div className="space-y-1 text-left max-w-sm md:max-w-md font-sans">
                <div className="flex items-center gap-1.5 mb-0.5 font-sans">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-green animate-pulse" />
                  <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-[#6ee7a8] block">Insights Comportamentais</span>
                </div>
                <h4 className="text-lg font-bold text-text-primary tracking-tight font-sans">
                  O Mapa do seu Tempo
                </h4>
                <p className="text-xs md:text-sm text-text-secondary/70 font-light leading-normal font-sans">
                  A DUDE identificou padrões comportamentais pelo seu uso recente.
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsEvolucaoModalOpen(true)}
              className="px-6 py-3 bg-[#6ee7a8] hover:bg-[#5cd697] text-black font-extrabold text-xs uppercase tracking-widest rounded-2xl transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-primary-green/10 cursor-pointer text-center md:self-center shrink-0 flex items-center justify-center gap-1.5"
            >
              <span>Explorar Padrões</span>
              <span>➔</span>
            </button>
          </div>
        </section>

        {/* PROGRESSIVE DISCLOSURE CONTROL: TRENDS ANTI-VÍCIO GATILHO */}
        <section className="font-sans">
          <div className="p-6 bg-gradient-to-br from-red-500/[0.05] to-red-500/[0.015] border border-red-500/20 rounded-3xl flex flex-col md:flex-row md:items-center md:justify-between gap-6 md:gap-8 relative overflow-hidden select-none">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 blur-2xl rounded-full pointer-events-none" />
            
            <div className="flex gap-4 items-start md:items-center">
              <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-xl shrink-0">
                <Flame className="text-orange-500 animate-pulse" size={24} />
              </div>
              <div className="space-y-1 text-left max-w-sm md:max-w-md font-sans">
                <div className="flex items-center gap-1.5 mb-0.5 font-sans">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-[#6ee7a8] block">Prevenção e Análise</span>
                </div>
                <h4 className="text-lg font-bold text-text-primary tracking-tight font-sans">
                  Trends Anti-Vício
                </h4>
                <p className="text-xs md:text-sm text-text-secondary/70 font-light leading-normal font-sans">
                  Monitore sua blindagem e histórico de autocontrole.
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsTrendsModalOpen(true)}
              className="px-6 py-3 bg-[#6ee7a8] hover:bg-[#5cd697] text-black font-extrabold text-xs uppercase tracking-widest rounded-2xl transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-primary-green/10 cursor-pointer text-center md:self-center shrink-0 flex items-center justify-center gap-1.5 font-sans"
            >
              <span>Abrir Sala de Guerra</span>
              <span>➔</span>
            </button>
          </div>
        </section>



        {/* WAVE 2C: IDENTITY LAYER (Atomic Habits) */}
        <section className="space-y-4 font-sans pt-4 border-t border-white/5">
          {/* Identity Headline Banner */}
          <div className="p-5 bg-gradient-to-r from-primary-green/[0.04] to-primary-green/[0.012] border border-[#6ee7a8]/15 rounded-3xl relative overflow-hidden select-none cursor-default">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#6ee7a8]/5 blur-2xl rounded-full pointer-events-none" />
            <div className="flex items-center gap-2 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#6ee7a8] animate-pulse" />
              <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-[#6ee7a8] block">
                Sua Identidade
              </span>
            </div>
            <h3 className="text-sm md:text-lg lg:text-xl font-bold md:font-extrabold text-text-primary leading-normal">
              {identityData.headline}
            </h3>
            <p className="text-[10px] sm:text-[11px] md:text-xs lg:text-sm text-text-secondary/80 mt-1.5 font-light italic">
              "A verdadeira mudança de comportamento ocorre através da mudança de identidade." — Atomic Habits
            </p>
          </div>
        </section>

      </motion.div>

      {/* MODAL PORTAL: SUA EVOLUÇÃO (ORÁCULO) */}
      <SuaEvolucaoModal isOpen={isEvolucaoModalOpen} onClose={() => setIsEvolucaoModalOpen(false)} />

      {/* MODAL PORTAL: TRENDS ANTI-VÍCIO */}
      <TrendsAntiVicioModal isOpen={isTrendsModalOpen} onClose={() => setIsTrendsModalOpen(false)} />
    </div>
  );
};
