import { useDataStore } from '../../store/useDataStore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Trophy, Target, ChevronDown, ChevronUp, Flame, Sparkles, 
  BarChart2, Calendar, Shield, Activity, HelpCircle, AlertCircle, Heart,
  Sun, CheckSquare, Brain
} from 'lucide-react';
import { formatHumanTime, getLocalDateString, resolverNomeSessao, formatSessionDuration, formatTimeRange } from '../../lib/utils';
import { calculateAvoidanceMetrics } from './AvoidanceSection';
import { useState, useMemo } from 'react';
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
    sessionTasks
  } = useDataStore();

  // Selected period state
  const [period, setPeriod] = useState<PeriodType>('today');

  // Selected date in Sessions History explorer
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Multi-pillar expander state
  const [expandedPillar, setExpandedPillar] = useState<'habits' | 'avoidance' | 'schedule' | 'mood' | null>(null);

  // Selected cell in Humor heat map
  const [tappedMoodDayStr, setTappedMoodDayStr] = useState<string | null>(null);

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
        .filter(c => c.habit_id === ah.id && (c.status === 'success' || c.status === 'relapse'))
        .sort((a, b) => new Date(b.checkin_date).getTime() - new Date(a.checkin_date).getTime());

      let currentStreak = 0;
      for (const c of checkins) {
        if (c.status === 'success') {
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
    let maxS = 0;
    let maxHabit = avoidanceHabitsList[0];

    avoidanceHabitsList.forEach(ah => {
      const s = avoidanceStreaks[ah.id] || 0;
      if (s > maxS) {
        maxS = s;
        maxHabit = ah;
      }
    });

    return maxS > 0 ? { habit: maxHabit, streak: maxS } : null;
  }, [avoidanceHabitsList, avoidanceStreaks]);

  const avoidanceAnalysis = useMemo(() => {
    const avoidHabits = habits.filter(h => h.habit_mode === 'avoid');
    const avoidHabitsMap = new Map(avoidHabits.map(h => [h.id, h]));
    
    // Filter relapses to existing habits of mode 'avoid'
    const relapses = avoidanceCheckins.filter(c => {
      if (c.status !== 'relapse') return false;
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
      
      const match = moodEntries.find(m => m.date === c.checkin_date && m.period === targetPeriod)
                 || moodEntries.find(m => m.date === c.checkin_date);
                 
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
    // 1. Get filtered mood logs based on selected period
    const targetSet = period === 'all' 
      ? null 
      : getDatesRangeSet(0, period === 'today' ? 1 : (period === 'week' ? 7 : 30));
    const filtered = targetSet 
      ? moodEntries.filter(m => targetSet.has(m.date))
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
    const totalDays = period === 'today' ? 1 : (period === 'week' ? 7 : 30);
    const stripDays = Array.from({ length: totalDays }, (_, idx) => {
      const d = new Date();
      d.setDate(d.getDate() - (totalDays - 1 - idx)); // oldest to newest (left to right)
      const dStr = getLocalDateString(d);
      
      const dayMoods = moodEntries.filter(m => m.date === dStr);
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
      if (!dailyMoodsMap[m.date]) dailyMoodsMap[m.date] = [];
      dailyMoodsMap[m.date].push(m);
    });

    Object.entries(dailyMoodsMap).forEach(([dateStr, list]) => {
      const counts: Record<string, number> = {};
      list.forEach(m => counts[m.mood] = (counts[m.mood] || 0) + 1);
      const maxCount = Math.max(...Object.values(counts));
      const candidates = Object.keys(counts).filter(k => counts[k] === maxCount);
      let dom: MoodKey;
      if (candidates.length === 1) {
        dom = candidates[0] as MoodKey;
      } else {
        const periodWeights = { noite: 3, tarde: 2, manha: 1 };
        const sortedByPeriod = [...list].sort((a, b) => (periodWeights[b.period] || 0) - (periodWeights[a.period] || 0));
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
      const morningDownDays = moodEntries.filter(m => m.period === 'manha' && m.mood === 'prabaixo').map(m => m.date);
      const morningClearDays = moodEntries.filter(m => m.period === 'manha' && m.mood !== 'prabaixo' && m.mood !== 'ansioso').map(m => m.date);
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
        const dateObj = new Date(m.date + 'T12:00:00'); // avoid timezone offsets
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
      const key = `${m.date}_${m.period}`;
      const minsObj = periodFocusDuration[key] || 0;
      focusDurationByEnergy[m.energy].push(minsObj);
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
        const energizedPeriods = moodEntries.filter(m => m.energy === 'energizado');
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
      .filter(m => m.energy === 'cansado')
      .map(m => m.date)
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

  return (
    <div className="fixed inset-0 z-[500] overflow-y-auto bg-background/95 backdrop-blur-xl p-4 md:p-6 flex items-start justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 15 }}
        className="w-full max-w-4xl bg-surface border border-primary-green/10 rounded-[2rem] p-6 md:p-10 relative my-auto shadow-[0_0_100px_rgba(110,231,168,0.06)] space-y-8"
      >
        {/* Close Button top-right */}
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 w-11 h-11 rounded-full bg-white/[0.02] border border-border-white flex items-center justify-center text-text-secondary hover:text-primary-green hover:border-primary-green hover:bg-primary-green/5 transition-all cursor-pointer z-50"
        >
          <X size={18} />
        </button>

        {/* HEADER SECTION */}
        <header className="space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary-green/5 border border-primary-green/15 rounded-full text-primary-green">
            <Sparkles size={13} className="animate-pulse" />
            <span className="text-[11px] font-semibold uppercase tracking-wider font-sans">Raio-X do seu Tempo</span>
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl md:text-3.5xl font-black tracking-tight text-text-primary uppercase font-sans">
              Centro de Inteligência Pessoal
            </h2>
            <p className="text-xs md:text-sm text-text-secondary/70 font-medium max-w-2xl leading-normal">
              Uma visão completa de como você está utilizando seu tempo e construindo consistência.
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

        {/* Personalized synthesis phrase */}
        <div className="p-4 bg-primary-green/[0.015] border border-primary-green/10 rounded-2xl flex items-center gap-3">
          <div className="w-5 h-5 rounded-full bg-primary-green/10 flex items-center justify-center shrink-0 border border-primary-green/10 font-sans">
            <Sparkles size={11} className="text-primary-green animate-pulse" />
          </div>
          <p className="text-xs md:text-[13.5px] font-semibold tracking-wide text-text-primary font-sans">
            "{interpretiveHeadline}"
          </p>
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
                <span className="text-fallback font-extrabold tracking-tight text-text-primary whitespace-nowrap inline-block font-mono" style={{ fontSize: 'clamp(2.75rem, 8vw, 4rem)', fontWeight: 800 }}>
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
          <section className="grid grid-cols-2 md:grid-cols-4 gap-4 font-sans">
            <div className="bg-white/[0.01] border border-white/5 p-4 rounded-2.5xl flex flex-col justify-between font-sans">
              <span className="text-[10px] uppercase tracking-wider text-text-secondary/65 font-semibold font-sans">Sessões</span>
              <span className="text-2xl font-black text-text-primary font-mono mt-2">{supportingStats.sessionCount}</span>
            </div>
            <div className="bg-white/[0.01] border border-white/5 p-4 rounded-2.5xl flex flex-col justify-between font-sans">
              <span className="text-[10px] uppercase tracking-wider text-text-secondary/65 font-semibold font-sans">Projetos</span>
              <span className="text-2xl font-black text-text-primary font-mono mt-2">{supportingStats.projectsCount}</span>
            </div>
            <div className="bg-white/[0.01] border border-white/5 p-4 rounded-2.5xl flex flex-col justify-between font-sans">
              <span className="text-[10px] uppercase tracking-wider text-text-secondary/65 font-semibold font-sans">Dias Invictos</span>
              <span className="text-2xl font-black text-primary-green font-mono mt-2">
                {currentStreak} {currentStreak === 1 ? 'dia invicto' : 'dias invictos'}
              </span>
            </div>
            <div className="bg-white/[0.01] border border-white/5 p-4 rounded-2.5xl flex flex-col justify-between font-sans">
              <span className="text-[10px] uppercase tracking-wider text-text-secondary/65 font-semibold font-sans">Recorde Pessoal</span>
              <span className="text-2xl font-black text-text-primary font-mono mt-2">
                {bestStreak} {bestStreak === 1 ? 'dia seguido' : 'dias seguidos'}
              </span>
            </div>
          </section>
        </div>

        {/* TAREFAS REALIZADAS NO DIA (migrated from HeroSection, respects generator select) */}
        <section className="bg-white/[0.01] border border-white/5 p-6 rounded-3xl space-y-5 font-sans">
          <div className="flex items-center justify-between">
            <h3 className="text-xs md:text-[13px] font-semibold text-text-secondary/75 uppercase tracking-wide flex items-center gap-1.5 font-sans">
              <CheckSquare size={12} className="text-primary-green" /> Tarefas Realizadas {
                period === 'today' ? 'no Dia' : period === 'week' ? 'na Semana' : period === 'month' ? 'no Mês' : 'no Total'
              }
            </h3>
            <span className="text-[10px] md:text-xs font-mono font-medium text-text-secondary/50 bg-white/5 px-2.5 py-0.5 rounded-full">
              {periodSessions.length} {periodSessions.length === 1 ? 'sessão' : 'sessões'}
            </span>
          </div>

          <div className="space-y-4 text-left">
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
                  <div key={session.id} className="flex gap-3 text-left items-start border-b border-white/5 pb-3 last:border-b-0 last:pb-0 font-sans">
                    <CheckSquare 
                      size={14} 
                      className="shrink-0 mt-1" 
                      style={{ color: isPartial ? 'var(--amber)' : '#10b981' }}
                    />
                    <div className="flex-1 min-w-0 font-sans">
                      <div className="flex items-center gap-2 flex-wrap font-sans">
                        <span className="text-sm font-semibold text-text-primary truncate">
                          {resolved.titulo}
                        </span>
                        <span className="text-text-secondary/30">—</span>
                        <span className="text-xs text-text-secondary/65 truncate font-light uppercase tracking-widest font-mono font-bold">
                          {resolved.projeto}
                        </span>
                        {session.scheduled_activity_id && (
                          <span 
                            className="inline-flex items-center font-bold font-mono"
                            style={{
                              backgroundColor: 'rgba(167, 139, 250, 0.12)',
                              border: '0.5px solid rgba(167, 139, 250, 0.25)',
                              color: 'var(--violet)',
                              fontSize: '9px',
                              letterSpacing: '0.12em',
                              textTransform: 'uppercase',
                              padding: '2px 6px',
                              borderRadius: '999px',
                              lineHeight: '1'
                            }}
                          >
                            AGENDADA
                          </span>
                        )}
                        {isPartial && (
                          <span 
                            className="inline-flex items-center font-bold font-mono"
                            style={{
                              backgroundColor: 'rgba(251, 191, 36, 0.12)',
                              border: '0.5px solid rgba(251, 191, 36, 0.25)',
                              color: 'var(--amber)',
                              fontSize: '9px',
                              letterSpacing: '0.12em',
                              textTransform: 'uppercase',
                              padding: '2px 6px',
                              borderRadius: '999px',
                              lineHeight: '1'
                            }}
                          >
                            INCOMPLETA
                          </span>
                        )}
                      </div>
                      
                      <div className="text-[11px] font-normal leading-normal mt-[2px] flex items-center gap-1.5 text-text-secondary/50 font-mono">
                        <span>{timeRange}</span>
                        <span className="text-text-secondary/30">·</span>
                        <span>{formattedDuration}</span>
                      </div>

                      {/* Checklist */}
                      {completedTasks.length > 0 && (
                        <div className="mt-2 space-y-1 pl-1 font-sans">
                          {completedTasks.map(task => (
                            <div key={task.id} className="flex items-center gap-2 text-xs text-text-secondary/80 font-sans">
                              <span className="text-primary-green select-none text-[13px]">☑</span>
                              <span className="line-through decoration-white/10 text-text-secondary/50 font-sans">{task.description}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-xs md:text-sm text-text-secondary/40 italic font-light pt-2 text-center font-sans">
                Nenhuma sessão realizada neste período.
              </p>
            )}
          </div>
        </section>

        {/* ONDE SEU TEMPO FOI */}
        <section className="bg-white/[0.01] border border-white/5 p-6 rounded-3xl space-y-5 font-sans">
          <h3 className="text-xs md:text-[13px] font-semibold text-text-secondary/75 uppercase tracking-wide flex items-center gap-1.5 font-sans">
            <Target size={12} className="text-primary-green" /> Onde seu tempo foi
          </h3>

          <div className="space-y-4 font-sans">
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
                      {formatCompactDuration(item.mins)} · <strong className="text-primary-green font-bold">{item.percent}%</strong>
                    </span>
                  </div>
                  {/* Compact progress bar */}
                  <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary-green rounded-full transition-all duration-300" 
                      style={{ width: `${item.percent}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* CONSISTÊNCIA DE AÇÕES */}
        <section className="bg-white/[0.01] border border-white/5 p-6 rounded-3xl space-y-5 font-sans">
          <h3 className="text-xs md:text-[13px] font-semibold text-text-secondary/75 uppercase tracking-wide flex items-center gap-1.5 font-sans">
            <Activity size={12} className="text-primary-green" /> Consistência de Ações
          </h3>

          <div className="flex items-center justify-between gap-4 font-sans">
            <div className="space-y-1 font-sans">
              <span className="text-[10px] md:text-xs font-semibold text-text-secondary/75 uppercase tracking-wide block font-sans">Eficácia Geral</span>
              <p className="text-xs text-text-secondary/70 leading-normal max-w-[280px] font-sans">
                Você participou de focar, hábitos ou prevenção de distrações em <strong className="text-text-primary font-bold">{consistencyStats.activeDays}</strong> de <strong className="text-text-primary font-bold">{consistencyStats.totalDays} dias</strong> selecionados.
              </p>
            </div>

            {/* Minimalist radial circle */}
            <div className="relative w-18 h-18 shrink-0 font-sans">
              <svg className="w-full h-full transform -rotate-90 animate-fade-in" viewBox="0 0 36 36">
                <path
                  className="text-white/5"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-primary-green transition-all duration-700"
                  strokeWidth="3.5"
                  strokeDasharray={`${consistencyStats.rate}, 100`}
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xs md:text-sm font-bold font-mono text-primary-green leading-none">{consistencyStats.rate}%</span>
              </div>
            </div>
          </div>
        </section>

        {/* BLOCK 3: EVOLUÇÃO DISCIPLINADA (BARS HEIGHT BUG FIXED) */}
        <section className="bg-white/[0.01] border border-white/5 p-6 rounded-3xl space-y-4 font-sans">
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

                  <div className="space-y-3 font-sans">
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
                          <div key={session.id} className="p-3 bg-white/[0.01] border border-white/5 rounded-xl space-y-2">
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
                      <p className="text-xs text-text-secondary/40 italic font-light py-4 text-center">
                        Nenhuma sessão realizada neste dia. O descanso também faz parte do processo consciente!
                      </p>
                    )}
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

        {/* PILLARS COLLAPSIBLE SECTIONS */}
        <section className="space-y-4 font-sans">
          <h3 className="text-xs md:text-[13px] font-semibold text-text-secondary/75 uppercase tracking-wide px-1 font-sans">
            Pilares do Desenvolvimento
          </h3>

          <div className="space-y-3 font-sans">
            
            {/* PILLAR 1: HABITS ATOMICOS */}
            <div className="border border-white/5 rounded-2xl bg-white/[0.01] overflow-hidden transition-all duration-300 font-sans">
              <button 
                onClick={() => setExpandedPillar(expandedPillar === 'habits' ? null : 'habits')}
                className="w-full p-5 flex items-center justify-between text-left cursor-pointer hover:bg-white/[0.01] font-sans"
              >
                <div className="flex items-center gap-3 font-sans">
                  <Activity size={16} className="text-primary-green" />
                  <div>
                    <span className="text-xs md:text-sm font-bold tracking-tight text-text-primary font-sans">Hábitos Atômicos</span>
                    <span className="text-[10px] text-text-secondary/60 block uppercase tracking-wide mt-0.5 font-sans font-sans">
                      {bestStreakHabit ? `🔥 melhor: ${bestStreakHabit.name} (${bestStreakHabit.weekly_streak} sem)` : 'Criar hábitos para ativar'}
                    </span>
                  </div>
                </div>
                {expandedPillar === 'habits' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              <AnimatePresence>
                {expandedPillar === 'habits' && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="px-5 pb-5 border-t border-white/5 pt-5 space-y-4 font-sans"
                  >
                    {/* Warning reminder */}
                    {neglectedHabit && (
                      <div className="p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl flex items-center gap-2.5 font-sans">
                        <AlertCircle size={14} className="text-amber-500 shrink-0" />
                        <p className="text-xs text-amber-500/80 font-light font-sans">
                          Atenção: o hábito <strong className="font-bold text-amber-500 font-sans">{neglectedHabit.name}</strong> está com consistência abaixo do esperado nesta semana.
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-sans">
                      {buildHabitsList.length === 0 ? (
                        <p className="text-xs md:text-sm text-text-secondary/60 italic font-sans col-span-2">Você ainda não possui hábitos em modo de construção.</p>
                      ) : (
                        buildHabitsList.map((h) => {
                          const target = h.sessions_per_week || 1;
                          const currentComp = h.sessions_this_week || 0;
                          const pct = Math.min(100, Math.round((currentComp / target) * 100));

                          return (
                            <div key={h.id} className="p-4 bg-white/[0.015] border border-white/5 rounded-xl space-y-2 font-sans">
                              <div className="flex justify-between items-start gap-1 font-sans">
                                <span className="text-[11px] md:text-xs font-bold text-text-primary max-w-[70%] truncate block font-sans">{h.name}</span>
                                <span className="text-[10px] font-bold text-primary-green whitespace-nowrap font-sans">🔥 {h.weekly_streak === 1 ? '1 sem' : `${h.weekly_streak} sem`}</span>
                              </div>
                              <div id={`habit-detail-${h.id}`} className="space-y-1 font-sans font-sans">
                                <div className="flex justify-between text-[10px] text-text-secondary/60 tracking-tight font-sans">
                                  <span>Progresso: {currentComp}/{target} sessões</span>
                                  <span>{pct}%</span>
                                </div>
                                <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden font-sans">
                                  <div className="bg-primary-green h-full rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* PILLAR 2: ANTI-VÍCIO */}
            <div className="border border-white/5 rounded-2xl bg-white/[0.01] overflow-hidden transition-all duration-300 font-sans">
              <button 
                onClick={() => setExpandedPillar(expandedPillar === 'avoidance' ? null : 'avoidance')}
                className="w-full p-5 flex items-center justify-between text-left cursor-pointer hover:bg-white/[0.01] font-sans"
              >
                <div className="flex items-center gap-3 font-sans">
                  <Shield size={16} className="text-primary-green" />
                  <div>
                    <span className="text-xs md:text-sm font-bold tracking-tight text-text-primary font-sans">Anti-Vício</span>
                    <span className="text-[10px] text-text-secondary/60 block uppercase tracking-wide mt-0.5 font-sans">
                      {bestAvoidanceStreak ? `🛡️ mais sólido: ${bestAvoidanceStreak.habit.name} (${bestAvoidanceStreak.streak} ${bestAvoidanceStreak.streak === 1 ? 'dia' : 'dias'})` : 'Evite distrações nos horários-chave'}
                    </span>
                  </div>
                </div>
                {expandedPillar === 'avoidance' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              <AnimatePresence>
                {expandedPillar === 'avoidance' && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="px-5 pb-5 border-t border-white/5 pt-5 space-y-6 font-sans"
                  >
                    {avoidanceHabitsList.length === 0 ? (
                      <div className="p-5 bg-white/[0.015] border border-dashed border-white/5 rounded-xl text-center space-y-2 font-sans">
                        <p className="text-xs text-text-secondary/60 leading-relaxed font-light max-w-md mx-auto font-sans">
                          Você ainda não possui nenhuma blindagem ativa. Adicione um vício no painel principal e o DUDE começará a calcular seus recordes e mapear suas vitórias neurais.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-6 font-sans">
                        {/* 1. Módulos Ativos com Counters de Tempo Limpo e Métricas */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-sans">
                          {avoidanceHabitsList.map((ah) => {
                            const metrics = calculateAvoidanceMetrics(ah, avoidanceCheckins);
                            
                            return (
                              <div key={ah.id} className="p-4 bg-white/[0.02] border border-white/5 hover:border-primary-green/10 rounded-2xl space-y-3 font-sans transition-all duration-200">
                                <div className="flex justify-between items-start gap-1 font-sans">
                                  <span className="text-[11px] md:text-xs font-extrabold text-text-primary uppercase tracking-wider truncate block max-w-[65%] font-sans">
                                    {ah.name}
                                  </span>
                                  <span className="text-[9px] font-mono uppercase bg-primary-green/15 text-primary-green px-2 py-0.5 rounded border border-primary-green/20">
                                    {metrics.diasLimpoSeguidos} seguidos
                                  </span>
                                </div>

                                <div className="p-3.5 bg-background/40 border border-white/5 rounded-xl text-center space-y-1">
                                  <span className="text-[8px] font-bold text-text-secondary/40 uppercase tracking-widest block font-sans">
                                    Tempo Limpo Atual
                                  </span>
                                  <span className="text-lg md:text-xl font-black text-primary-green tracking-tight font-mono">
                                    {metrics.tempoLimpoAtualText}
                                  </span>
                                  <span className="text-[8px] text-text-secondary/60 block italic font-light">
                                    {metrics.tempoLimpoSubtitle}
                                  </span>
                                </div>

                                {/* Custom Support stats boxes requested */}
                                <div className="grid grid-cols-3 gap-1.5 text-center pt-1">
                                  <div className="py-1.5 px-1 bg-white/[0.02] border border-white/5 rounded-lg flex flex-col justify-center">
                                    <span className="text-[7px] font-bold text-text-secondary/40 uppercase tracking-tight block">
                                      Seguidos
                                    </span>
                                    <span className="text-[11px] font-bold text-text-primary font-mono mt-0.5">
                                      {metrics.diasLimpoSeguidos}d
                                    </span>
                                  </div>
                                  <div className="py-1.5 px-1 bg-white/[0.02] border border-white/5 rounded-lg flex flex-col justify-center">
                                    <span className="text-[7px] font-bold text-text-secondary/40 uppercase tracking-tight block">
                                      Total Limpo
                                    </span>
                                    <span className="text-[11px] font-bold text-primary-green font-mono mt-0.5">
                                      {metrics.diasLimposTotal}d
                                    </span>
                                  </div>
                                  <div className="py-1.5 px-1 bg-white/[0.02] border border-white/5 rounded-lg flex flex-col justify-center">
                                    <span className="text-[7px] font-bold text-text-secondary/40 uppercase tracking-tight block">
                                      Recorde
                                    </span>
                                    <span className="text-[11px] font-bold text-amber-400 font-mono mt-0.5">
                                      {metrics.maxStreak}d
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* 2. Centro de Inteligência — Mapeador Real de Gatilhos */}
                        <div className="p-4 bg-white/[0.015] border border-white/5 rounded-2xl space-y-4 font-sans">
                          <span className="text-[9px] font-extrabold text-[#6ee7a8] uppercase tracking-widest flex items-center gap-1">
                            <Brain size={12} className="animate-pulse" /> Mapeamento de Gatilhos de Lapsos/Recaídas
                          </span>

                          {avoidanceAnalysis.totalRelapses === 0 ? (
                            <div className="p-5 bg-white/5 rounded-xl border border-dashed border-white/5 text-center space-y-2">
                              <span className="text-xs">🧘</span>
                              <p className="text-xs text-[#6ee7a8] font-bold uppercase tracking-wider">Mente Blindada</p>
                              <p className="text-[10px] text-text-secondary/60 leading-relaxed font-light max-w-sm mx-auto">
                                Nenhuma recaída registrada! Continue firme no autocontrole para manter esta saúde mental intacta. Quando houver registros, o DUDE mapeará seus gatilhos de energia, humor e período.
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              {/* Lead Insight block */}
                              <div className="p-3 rounded-xl bg-orange-400/5 border border-orange-400/10 space-y-1.5 text-left">
                                <span className="text-[8px] font-black text-orange-400 uppercase tracking-wider block">Insight Dominante</span>
                                <p className="text-xs text-text-primary font-medium tracking-tight leading-relaxed">
                                  {avoidanceAnalysis.leadInsight}
                                </p>
                                <p className="text-[10px] text-text-secondary/80 font-light leading-relaxed">
                                  💡 <strong>Sugestão:</strong> {avoidanceAnalysis.suggestion}
                                </p>
                              </div>

                              {/* Proportional Bars Section */}
                              <div className="space-y-3 font-sans">
                                <h5 className="text-[9px] font-bold text-text-secondary/50 uppercase tracking-wider">Quando a impulsividade ganha força:</h5>
                                
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  {/* Dimension A: Period */}
                                  <div className="space-y-2 bg-background/50 p-3 rounded-xl border border-white/5">
                                    <span className="text-[8px] font-black text-text-secondary/60 uppercase tracking-widest block border-b border-white/5 pb-1">
                                      Por Período do Dia
                                    </span>
                                    <div className="space-y-1.5">
                                      {Object.entries(avoidanceAnalysis.byPeriod).map(([key, val]) => {
                                        const total = avoidanceAnalysis.totalRelapses;
                                        const pct = total > 0 ? Math.round((val / total) * 100) : 0;
                                        const label = { morning: "Manhã", afternoon: "Tarde", evening: "Noite", window: "Janela" }[key] || key;
                                        return (
                                          <div key={key} className="space-y-0.5 text-left">
                                            <div className="flex justify-between items-center text-[8px] text-text-secondary/70 font-mono">
                                              <span>{label}</span>
                                              <span>{pct}% ({val})</span>
                                            </div>
                                            <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
                                              <div className="bg-primary-green h-full" style={{ width: `${pct}%` }} />
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  {/* Dimension B: Energy Level */}
                                  <div className="space-y-2 bg-background/50 p-3 rounded-xl border border-white/5">
                                    <span className="text-[8px] font-black text-text-secondary/60 uppercase tracking-widest block border-b border-white/5 pb-1">
                                      Por Nível de Energia
                                    </span>
                                    <div className="space-y-1.5">
                                      {Object.entries(avoidanceAnalysis.byEnergy).map(([key, val]) => {
                                        const total = avoidanceAnalysis.byEnergy.cansado + avoidanceAnalysis.byEnergy.normal + avoidanceAnalysis.byEnergy.energizado;
                                        const pct = total > 0 ? Math.round((val / total) * 100) : 0;
                                        const label = { cansado: "🥱 Cansado", normal: "😐 Normal", energizado: "⚡ Energizado" }[key] || key;
                                        const color = { cansado: "bg-red-400", normal: "bg-amber-400", energizado: "bg-emerald-400" }[key] || "bg-primary-green";
                                        return (
                                          <div key={key} className="space-y-0.5 text-left">
                                            <div className="flex justify-between items-center text-[8px] text-text-secondary/70 font-mono">
                                              <span>{label}</span>
                                              <span>{pct}% ({val})</span>
                                            </div>
                                            <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
                                              <div className={`${color} h-full`} style={{ width: `${pct}%` }} />
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  {/* Dimension C: Mood Level */}
                                  <div className="space-y-2 bg-background/50 p-3 rounded-xl border border-white/5">
                                    <span className="text-[8px] font-black text-text-secondary/60 uppercase tracking-widest block border-b border-white/5 pb-1">
                                      Por Estado de Humor
                                    </span>
                                    <div className="space-y-1.5">
                                      {Object.entries(avoidanceAnalysis.byMood).map(([key, val]) => {
                                        const total = Object.values(avoidanceAnalysis.byMood).reduce((a, b) => a + b, 0);
                                        const pct = total > 0 ? Math.round((val / total) * 100) : 0;
                                        const label = {
                                          animado: "😃 Animado",
                                          tranquilo: "😌 Tranquilo",
                                          neutro: "😐 Neutro",
                                          ansioso: "😰 Ansioso",
                                          prabaixo: "😞 Pra baixo"
                                        }[key] || key;
                                        return (
                                          <div key={key} className="space-y-0.5 text-left">
                                            <div className="flex justify-between items-center text-[8px] text-text-secondary/70 font-mono">
                                              <span>{label}</span>
                                              <span>{pct}% ({val})</span>
                                            </div>
                                            <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
                                              <div className="bg-orange-400 h-full" style={{ width: `${pct}%` }} />
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* PILLAR 3: AGENDAMENTOS */}
            <div className="border border-white/5 rounded-2xl bg-white/[0.01] overflow-hidden transition-all duration-300 font-sans">
              <button 
                onClick={() => setExpandedPillar(expandedPillar === 'schedule' ? null : 'schedule')}
                className="w-full p-5 flex items-center justify-between text-left cursor-pointer hover:bg-white/[0.01] font-sans"
              >
                <div className="flex items-center gap-3 font-sans">
                  <Calendar size={16} className="text-primary-green" />
                  <div>
                    <span className="text-xs md:text-sm font-bold tracking-tight text-text-primary font-sans">Compromissos e Acordos</span>
                    <span className="text-[10px] text-text-secondary/60 block uppercase tracking-wide mt-0.5 font-sans">
                      ✓ {scheduleCompliance.rate}% de palavra cumprida
                    </span>
                  </div>
                </div>
                {expandedPillar === 'schedule' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              <AnimatePresence>
                {expandedPillar === 'schedule' && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="px-5 pb-5 border-t border-white/5 pt-5 space-y-4 font-sans"
                  >
                    {scheduleCompliance.total === 0 ? (
                      <p className="text-xs md:text-sm text-text-secondary/60 italic font-sans">Nenhum compromisso marcado na sua agenda até o momento.</p>
                    ) : (
                      <div className="space-y-3 font-sans">
                        <div className="p-4 bg-white/[0.015] border border-white/5 rounded-xl space-y-2 font-sans">
                          <span className="text-[11px] md:text-xs font-semibold text-text-secondary/70 uppercase tracking-wide block font-sans">Taxa de Palavra Cumprida</span>
                          <span className="text-base font-bold text-text-primary block leading-tight font-sans">
                            Você cumpriu {scheduleCompliance.completed} de {scheduleCompliance.completed + scheduleCompliance.lost} agendamentos elegíveis ({scheduleCompliance.rate}%).
                          </span>
                          <p className="text-[10px] md:text-xs text-text-secondary/60 leading-snug font-sans font-sans">
                            Cancelamentos não reduzem sua pontuação, pois representam uma escolha consciente de recalibração de rota.
                          </p>
                        </div>

                        {/* Exact breakdown status blocks */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center font-sans">
                          <div className="p-3 bg-white/[0.01] border border-white/5 rounded-lg space-y-0.5 font-sans">
                            <span className="text-[9px] md:text-xs font-semibold text-text-secondary/60 uppercase tracking-wider block font-sans font-sans">Concluídas</span>
                            <span className="text-base font-bold text-primary-green font-sans">{scheduleCompliance.completed}</span>
                          </div>
                          <div className="p-3 bg-white/[0.01] border border-white/5 rounded-lg space-y-0.5 font-sans">
                            <span className="text-[9px] md:text-xs font-semibold text-text-secondary/60 uppercase tracking-wider block font-sans font-sans">Não Cumpridas</span>
                            <span className="text-base font-bold text-amber-500 font-sans">{scheduleCompliance.lost}</span>
                          </div>
                          <div className="p-3 bg-white/[0.01] border border-white/5 rounded-lg space-y-0.5 font-sans font-sans">
                            <span className="text-[9px] md:text-xs font-semibold text-text-secondary/60 uppercase tracking-wider block font-sans font-sans">Pendentes</span>
                            <span className="text-base font-bold text-sky-400 font-sans">{scheduleCompliance.pendentes}</span>
                          </div>
                          <div className="p-3 bg-white/[0.01] border border-white/5 rounded-lg space-y-0.5 font-sans">
                            <span className="text-[9px] md:text-xs font-semibold text-text-secondary/60 uppercase tracking-wider block font-sans">Canceladas</span>
                            <span className="text-sm font-bold text-text-secondary/60 font-sans">{scheduleCompliance.cancelled}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* PILLAR 4: HUMOR */}
            <div className="border border-white/5 rounded-2xl bg-white/[0.01] overflow-hidden transition-all duration-300 font-sans">
              <button 
                onClick={() => setExpandedPillar(expandedPillar === 'mood' ? null : 'mood')}
                className="w-full p-5 flex items-center justify-between text-left cursor-pointer hover:bg-white/[0.02] transition-colors font-sans"
              >
                <div className="flex items-center gap-3 font-sans">
                  <Heart size={16} className="text-pink-500 fill-pink-500/10" style={{ color: moodAnalytics.dominantMoodOfPeriod ? MOODS[moodAnalytics.dominantMoodOfPeriod]?.color : 'var(--primary-green)' }} />
                  <div>
                    <span className="text-xs md:text-sm font-bold tracking-tight text-text-primary font-sans">Sua Energia e Humor</span>
                    <span className="text-[10px] text-text-secondary/60 block uppercase tracking-wide mt-0.5 font-sans">
                      {moodAnalytics.dominantMoodOfPeriod ? (
                        <span className="capitalize">{MOODS[moodAnalytics.dominantMoodOfPeriod]?.emoji} {MOODS[moodAnalytics.dominantMoodOfPeriod]?.label} na maioria dos dias</span>
                      ) : (
                        "Comece a registrar seu humor diário"
                      )}
                    </span>
                  </div>
                </div>
                {expandedPillar === 'mood' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              <AnimatePresence>
                {expandedPillar === 'mood' && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="px-5 pb-5 border-t border-white/5 pt-5 space-y-6 font-sans"
                  >
                    {!moodAnalytics.hasEnoughData ? (
                      <div className="p-5 bg-white/[0.015] border border-dashed border-white/5 rounded-xl text-center space-y-2 font-sans">
                        <p className="text-xs text-text-secondary/60 leading-relaxed font-light max-w-md mx-auto font-sans">
                          Nenhum registro de humor encontrado para o filtro selecionado neste período. Responda ao ritual diário para gerar métricas emocionais de alta sensibilidade.
                        </p>
                      </div>
                    ) : (
                      <>
                        {/* 1. MOOD OVER TIME (Heatmap / Strip) */}
                        <div className="space-y-3 font-sans">
                          <div className="flex justify-between items-baseline font-sans">
                            <span className="text-xs font-bold text-text-primary uppercase tracking-wider block font-sans">Evolução do Humor</span>
                            <span className="text-[10px] text-text-secondary/60 font-sans">Toque em um dia para ver os períodos</span>
                          </div>

                          <div className="w-full bg-white/[0.015] border border-white/5 p-4 rounded-xl space-y-3 font-sans">
                            {/* Flex layout with gap matching heatmaps */}
                            <div className={`grid ${period === 'week' ? 'grid-cols-7' : 'grid-cols-5 sm:grid-cols-10'} gap-2 w-full font-sans`}>
                              {moodAnalytics.stripDays.map((day, idx) => {
                                const hasMood = !!day.dominantMood;
                                const md = day.dominantMood ? MOODS[day.dominantMood] : null;
                                const isSelected = tappedMoodDayStr === day.dateStr;

                                return (
                                  <button
                                    key={idx}
                                    onClick={() => setTappedMoodDayStr(isSelected ? null : day.dateStr)}
                                    className={`relative flex flex-col items-center justify-between p-2 rounded-xl border transition-all duration-300 aspect-square sm:aspect-auto hover:brightness-110 active:scale-95 cursor-pointer select-none font-sans ${
                                      hasMood 
                                        ? 'border-white/5 hover:scale-105' 
                                        : 'bg-white/[0.02] border-white/[0.02] text-text-secondary/30'
                                    } ${isSelected ? 'ring-2 ring-primary-green/60 border-primary-green scale-105 shadow-inner' : ''}`}
                                    style={{
                                      backgroundColor: md ? `${md.color}15` : undefined,
                                      borderColor: md ? `${md.color}35` : undefined,
                                    }}
                                  >
                                    <span className="text-[9px] font-bold text-text-secondary/60 uppercase tracking-tight block">
                                      {day.dayName}
                                    </span>
                                    <span className="text-[10px] font-bold text-text-secondary/50 block tracking-tighter my-0.5">
                                      {day.dayLabel.split(' ')[0]}
                                    </span>
                                    <div className="flex items-center justify-center h-6 w-full text-sm">
                                      {md ? (
                                        <span role="img" aria-label={md.label} className="animate-fade-in block">
                                          {md.emoji}
                                        </span>
                                      ) : (
                                        <span className="text-text-secondary/40">·</span>
                                      )}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>

                            {/* Tapped Day Detail Section */}
                            {tappedMoodDayStr && (() => {
                              const selectedDay = moodAnalytics.stripDays.find(d => d.dateStr === tappedMoodDayStr);
                              if (!selectedDay) return null;

                              const pWeights = { manha: 'Manhã 🌅', tarde: 'Tarde ☀️', noite: 'Noite 🌙' };

                              return (
                                <motion.div 
                                  initial={{ opacity: 0, y: -5 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  className="p-3 bg-white/[0.02] border border-white/5 rounded-lg space-y-2 mt-2 font-sans text-left"
                                >
                                  <span className="text-[10px] font-bold text-text-secondary/80 uppercase tracking-wider block">
                                    Registros detalhados em {selectedDay.dayLabel}:
                                  </span>
                                  <div className="grid grid-cols-3 gap-2 font-sans">
                                    {(['manha', 'tarde', 'noite'] as const).map(pKey => {
                                      const matching = selectedDay.allMoods.find(m => m.period === pKey);
                                      const mdMeta = matching ? MOODS[matching.mood] : null;

                                      return (
                                        <div key={pKey} className="p-2 bg-white/[0.01] border border-white/5 rounded-lg text-center space-y-1 font-sans">
                                          <span className="text-[9px] font-semibold text-text-secondary/50 block uppercase">
                                            {pWeights[pKey]}
                                          </span>
                                          <div className="text-xs font-bold font-sans flex items-center justify-center gap-1">
                                            {mdMeta ? (
                                              <span className="flex items-center gap-1">
                                                <span>{mdMeta.emoji}</span>
                                                <span className="capitalize text-[10px] text-text-primary" style={{ color: mdMeta.color }}>{mdMeta.label}</span>
                                              </span>
                                            ) : (
                                              <span className="text-text-secondary/40 text-[10px] font-normal">-</span>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </motion.div>
                              );
                            })()}
                          </div>
                        </div>

                        {/* 2. MOOD DISTRIBUTION (Breakdown bars) */}
                        <div className="space-y-3 font-sans">
                          <span className="text-xs font-bold text-text-primary uppercase tracking-wider block font-sans font-sans">Distribuição dos Tons de Humor</span>
                          
                          <div className="space-y-2 bg-white/[0.015] border border-white/5 p-4 rounded-xl font-sans">
                            {moodAnalytics.distribution.map((item) => (
                              <div key={item.key} className="space-y-1.5 font-sans font-sans">
                                <div className="flex justify-between items-baseline text-xs font-sans">
                                  <span className="font-semibold text-text-primary uppercase tracking-wider text-[10px] flex items-center gap-1.5 min-w-[100px] block">
                                    <span>{item.emoji}</span>
                                    <span>{item.label}</span>
                                  </span>
                                  <span className="text-text-secondary text-right text-[10px] font-semibold font-mono block">
                                    {item.count} {item.count === 1 ? 'registro' : 'registros'} · <strong className="font-bold" style={{ color: item.color }}>{item.percent}%</strong>
                                  </span>
                                </div>
                                <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full rounded-full transition-all duration-500" 
                                    style={{ 
                                      width: `${item.percent}%`,
                                      backgroundColor: item.color
                                    }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* 3. NEW ACTIONABLE ENERGY & FOCUS INSIGHTS */}
                        <div className="space-y-4 font-sans bg-white/[0.015] border border-white/5 p-4 rounded-xl">
                          <h4 className="text-[11px] md:text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-1.5 leading-none">
                            <Sparkles size={11} className="text-pink-500 animate-pulse" />
                            <span>Neurociência do Foco · Diagnósticos Cruzados</span>
                          </h4>

                          {!moodAnalytics.hasEnoughEnergyData ? (
                            <div className="p-3.5 bg-white/[0.01] border border-dashed border-white/5 rounded-lg text-center font-sans">
                              <p className="text-[11px] text-text-secondary/70 leading-relaxed font-sans font-light">
                                Suas novas medições em duas dimensões (Energia × Humor) estão sendo salvas. Continue registrando seus rituais para a DUDE revelar seus padrões de rendimento e fadiga mental. (Mínimo de 3 registros em dobro para ligar os motores).
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-3 font-sans">
                              {/* Insight A: Energy x Focus correlation */}
                              {moodAnalytics.energyCorrelationInsight && (
                                <div className="flex items-start gap-2.5 p-3 bg-pink-500/[0.02] border border-pink-500/10 rounded-lg font-sans">
                                  <span className="text-base shrink-0 select-none mt-0.5">🧠</span>
                                  <span className="space-y-1 block text-left">
                                    <strong className="text-[9px] font-bold text-pink-400 uppercase tracking-wider block">Correlação de Energia</strong>
                                    <span className="text-xs text-text-secondary/90 leading-relaxed font-sans font-light block">
                                      {moodAnalytics.energyCorrelationInsight}
                                    </span>
                                  </span>
                                </div>
                              )}

                              {/* Insight B: Risk Pattern */}
                              {moodAnalytics.energyRiskInsight && (
                                <div className="flex items-start gap-2.5 p-3 bg-amber-500/[0.02] border border-amber-500/10 rounded-lg font-sans">
                                  <span className="text-base shrink-0 select-none mt-0.5">⚠️</span>
                                  <span className="space-y-1 block text-left">
                                    <strong className="text-[9px] font-bold text-amber-400 uppercase tracking-wider block">Fadiga & Consistência</strong>
                                    <span className="text-xs text-text-secondary/90 leading-relaxed font-sans font-light block leading-relaxed">
                                      {moodAnalytics.energyRiskInsight}
                                    </span>
                                  </span>
                                </div>
                              )}

                              {/* Insight C: Mini chart */}
                              <div className="space-y-2.5 pt-1.5">
                                <span className="text-[9px] font-bold text-text-secondary/60 uppercase tracking-widest block text-left">Rendimento Médio de Foco por Período</span>
                                <div className="space-y-2">
                                  {[
                                    { key: 'energizado', label: '⚡ Energizado', color: 'bg-emerald-500', avg: moodAnalytics.energyAverages.energizado },
                                    { key: 'normal', label: '😐 Normal', color: 'bg-amber-400', avg: moodAnalytics.energyAverages.normal },
                                    { key: 'cansado', label: '🥱 Cansado', color: 'bg-rose-500', avg: moodAnalytics.energyAverages.cansado }
                                  ].map((lvl) => {
                                    const maxVal = Math.max(
                                      moodAnalytics.energyAverages.energizado,
                                      moodAnalytics.energyAverages.normal,
                                      moodAnalytics.energyAverages.cansado,
                                      1
                                    );
                                    const percentage = Math.round((lvl.avg / maxVal) * 100);
                                    return (
                                      <div key={lvl.key} className="flex items-center justify-between text-xs gap-3 font-sans">
                                        <span className="font-semibold text-text-primary uppercase tracking-wider text-[10px] w-24 shrink-0 block text-left">{lvl.label}</span>
                                        <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden relative">
                                          <div 
                                            className={`h-full rounded-full transition-all duration-500 ${lvl.color}`}
                                            style={{ width: `${lvl.avg > 0 ? percentage : 0}%` }}
                                          />
                                        </div>
                                        <span className="text-[10px] font-mono font-bold text-text-secondary/80 w-16 text-right shrink-0 block font-sans">
                                          {lvl.avg > 0 ? `${Math.round(lvl.avg)} min` : '0 min'}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

          </div>
        </section>

        {/* WAVE 2C: IDENTITY LAYER (Atomic Habits) */}
        <section className="space-y-4 font-sans pt-4 border-t border-white/5">
          {/* Identity Headline Banner */}
          <div className="p-5 bg-gradient-to-r from-primary-green/[0.04] to-primary-green/[0.012] border border-primary-green/15 rounded-3xl relative overflow-hidden select-none cursor-default">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary-green/5 blur-2xl rounded-full pointer-events-none" />
            <div className="flex items-center gap-2 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary-green animate-pulse" />
              <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-primary-green block">
                Sua Identidade
              </span>
            </div>
            <h3 className="text-sm md:text-base font-bold text-text-primary leading-snug">
              {identityData.headline}
            </h3>
            <p className="text-[10px] sm:text-[11px] text-text-secondary/60 mt-1 font-light italic">
              "A verdadeira mudança de comportamento ocorre através da mudança de identidade." — Atomic Habits
            </p>
          </div>

          {/* Identity Milestones Strip */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-text-secondary/60">
                Marcos de Identidade Desbloqueados
              </span>
              <span className="text-[10px] font-mono text-primary-green/80 font-bold">
                {identityData.milestones.filter(m => m.unlocked).length} de 5 Desbloqueados
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 w-full">
              {identityData.milestones.map((m) => {
                const IconComponent = 
                  m.key === 'foco_diario' ? Flame :
                  m.key === 'madrugador' ? Sun :
                  m.key === 'construtor' ? Activity :
                  m.key === 'mente_blindada' ? Shield :
                  CheckSquare;

                return (
                  <div
                    key={m.key}
                    className={`relative p-4 rounded-2xl border transition-all duration-300 flex flex-col justify-between overflow-hidden select-none cursor-default group min-h-[140px] ${
                      m.unlocked
                        ? 'bg-primary-green/[0.03] border-primary-green/20 hover:border-primary-green/40 shadow-[0_4px_12px_rgba(110,231,168,0.03)]'
                        : 'bg-white/[0.015] border-white/5 hover:bg-white/[0.02]'
                    }`}
                  >
                    {/* Glowing effect for unlocked */}
                    {m.unlocked && (
                      <div className="absolute top-0 right-0 w-16 h-16 bg-primary-green/5 blur-lg pointer-events-none rounded-full" />
                    )}

                    <div className="space-y-2 z-10 relative">
                      <div className="flex items-center justify-between">
                        <div className={`p-2 rounded-xl border ${
                          m.unlocked
                            ? 'bg-primary-green/10 border-primary-green/20 text-primary-green'
                            : 'bg-white/5 border-white/5 text-text-secondary/40'
                        }`}>
                          <IconComponent size={14} className={m.unlocked ? 'animate-pulse' : ''} />
                        </div>
                        {m.unlocked ? (
                          <span className="text-[9px] font-mono font-bold text-primary-green bg-primary-green/10 px-1.5 py-0.5 rounded">
                            ATIVO
                          </span>
                        ) : (
                          <span className="text-[9px] font-mono font-medium text-text-secondary/30 bg-white/5 px-1.5 py-0.5 rounded">
                            BLOQ
                          </span>
                        )}
                      </div>

                      <div className="space-y-1">
                        <h4 className={`text-[12px] font-bold tracking-tight leading-none ${
                          m.unlocked ? 'text-text-primary' : 'text-text-secondary/60'
                        }`}>
                          {m.title}
                        </h4>
                        <p className={`text-[10px] leading-tight font-light ${
                          m.unlocked ? 'text-text-secondary/85' : 'text-text-secondary/40'
                        }`}>
                          {m.description}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between text-[9px] font-mono leading-none z-10 relative">
                      <span className="text-text-secondary/35 uppercase">REQUISITO</span>
                      <span 
                        className={`font-semibold shrink-0 cursor-help ${
                          m.unlocked ? 'text-primary-green/90' : 'text-text-secondary/50'
                        }`}
                        title={m.requirement}
                      >
                        {m.progress}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* FOOTER BUTTON */}
        <footer className="flex justify-end pt-4 font-sans">
          <button
            onClick={onClose}
            className="px-6 py-3 bg-white/[0.02] border border-border-white hover:bg-white/5 rounded-2xl text-[11px] uppercase font-bold tracking-wider transition-all cursor-pointer text-text-primary font-sans"
          >
            Fechar Centro de Inteligência
          </button>
        </footer>

      </motion.div>
    </div>
  );
};
