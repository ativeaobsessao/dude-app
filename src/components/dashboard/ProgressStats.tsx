import { useDataStore } from '../../store/useDataStore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Trophy, Target, ChevronDown, ChevronUp, Flame, Sparkles, 
  BarChart2, Calendar, Shield, Activity, HelpCircle, AlertCircle
} from 'lucide-react';
import { formatHumanTime, getLocalDateString } from '../../lib/utils';
import { useState, useMemo } from 'react';

const formatCompactDuration = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) {
    return `${h}h ${m}m`;
  }
  return `${m}m`;
};

type PeriodType = 'week' | 'month' | 'all';

export const ProgressStats = ({ onClose }: { onClose: () => void }) => {
  const { 
    sessions, 
    projects, 
    habits, 
    profile, 
    avoidanceCheckins, 
    habitCompletions,
    scheduledActivities
  } = useDataStore();

  // Selected period state
  const [period, setPeriod] = useState<PeriodType>('week');

  // Multi-pillar expander state
  const [expandedPillar, setExpandedPillar] = useState<'habits' | 'avoidance' | 'schedule' | null>(null);

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
    const length = period === 'week' ? 7 : 30;
    const currentSet = getDatesRangeSet(0, length);
    return sessions
      .filter(s => currentSet.has(getLocalDateString(new Date(s.started_at))))
      .reduce((acc, s) => acc + (s.duration_minutes || 0), 0);
  }, [period, sessions, totalFocusAllTimeMins]);

  const previousPeriodMins = useMemo(() => {
    if (period === 'all') return 0;
    const length = period === 'week' ? 7 : 30;
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
    const currentText = `Este ${period === 'week' ? 'período' : 'mês'}: ${currentHrs}h ${currentMins}m`;

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

  // Supporting metrics count inside period
  const supportingStats = useMemo(() => {
    const targetSet = period === 'all' ? null : getDatesRangeSet(0, period === 'week' ? 7 : 30);
    const filteredSessions = targetSet 
      ? sessions.filter(s => targetSet.has(getLocalDateString(new Date(s.started_at))))
      : sessions;

    const sessionCount = filteredSessions.length;
    const activeProjectIds = new Set(filteredSessions.map(s => s.project_id).filter(Boolean));
    const projectsCount = activeProjectIds.size;

    return { sessionCount, projectsCount };
  }, [period, sessions]);

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
    const targetSet = period === 'all' ? null : getDatesRangeSet(0, period === 'week' ? 7 : 30);
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
    if (period === 'week') {
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
          displayValue: mins > 0 ? `${mins}m` : '0'
        };
      });
    }

    if (period === 'month') {
      const weeksData = [];
      // 5 weeks ending today
      for (let w = 4; w >= 0; w--) {
        const offsetStart = w * 7;
        const set = getDatesRangeSet(offsetStart, 7);
        const mins = sessions
          .filter(s => set.has(getLocalDateString(new Date(s.started_at))))
          .reduce((acc, s) => acc + (s.duration_minutes || 0), 0);

        weeksData.push({
          label: `Sem ${5 - w}`,
          mins,
          displayValue: mins > 0 ? (mins >= 60 ? `${Math.floor(mins / 60)}h` : `${mins}m`) : '0'
        });
      }
      return weeksData;
    }

    // period === 'all', 6 calendar months
    const monthsNames = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
    const monthsData = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const mYear = d.getFullYear();
      const mMonth = d.getMonth();

      const mins = sessions
        .filter(s => {
          const sDate = new Date(s.started_at);
          return sDate.getFullYear() === mYear && sDate.getMonth() === mMonth;
        })
        .reduce((acc, s) => acc + (s.duration_minutes || 0), 0);

      monthsData.push({
        label: monthsNames[mMonth],
        mins,
        displayValue: mins > 0 ? `${Math.floor(mins / 60)}h` : '0'
      });
    }
    return monthsData;
  }, [period, sessions]);

  const maxChartMins = useMemo(() => {
    return Math.max(...chartData.map(c => c.mins), 0);
  }, [chartData]);

  // ----------------------------------------------------
  // BLOCK 4 — REAL CONSISTENCY INDICATOR
  // ----------------------------------------------------
  const consistencyStats = useMemo(() => {
    const totalDays = period === 'week' ? 7 : (period === 'month' ? 30 : 90);
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
    const denominator = completed + lost;
    const rate = denominator > 0 ? Math.round((completed / denominator) * 100) : 100;

    return { completed, lost, cancelled, rate, total: scheduledActivities.length };
  }, [scheduledActivities]);

  // ----------------------------------------------------
  // LAST 90 DAYS COMPACT HEATMAP
  // ----------------------------------------------------
  const heatmapCells90 = useMemo(() => {
    const focusMap: { [day: string]: number } = {};
    sessions.forEach(s => {
      const day = getLocalDateString(new Date(s.started_at));
      if (day) {
        focusMap[day] = (focusMap[day] || 0) + (s.duration_minutes || 0);
      }
    });

    return Array.from({ length: 90 }, (_, idx) => {
      const d = new Date();
      d.setDate(d.getDate() - (89 - idx));
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
        intensity: intensityLevel
      };
    });
  }, [sessions]);

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
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] font-mono">Decision Engine</span>
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl md:text-3.5xl font-black tracking-tight text-text-primary uppercase font-sans">
              Centro de Inteligência Pessoal
            </h2>
            <p className="text-xs text-text-secondary/60 font-light max-w-2xl leading-normal">
              Uma visão completa de como você está utilizando seu tempo e construindo consistência.
            </p>
          </div>

          {/* Interpretive dynamic block */}
          <div className="p-4 bg-primary-green/[0.015] border border-primary-green/10 rounded-2xl flex items-center gap-3">
            <div className="w-5 h-5 rounded-full bg-primary-green/10 flex items-center justify-center shrink-0 border border-primary-green/10">
              <Sparkles size={11} className="text-primary-green" />
            </div>
            <p className="text-sm font-semibold tracking-tight text-text-primary">
              "{interpretiveHeadline}"
            </p>
          </div>
        </header>

        {/* PERIOD SELECTOR */}
        <div className="w-full flex">
          <div className="w-full grid grid-cols-3 bg-white/[0.02] border border-white/5 p-1 rounded-2xl">
            {(['week', 'month', 'all'] as PeriodType[]).map((pType) => (
              <button
                key={pType}
                onClick={() => setPeriod(pType)}
                className={`py-3 text-xs md:text-sm font-bold uppercase tracking-wider rounded-xl cursor-pointer transition-all ${
                  period === pType
                    ? 'bg-primary-green text-background shadow-[0_0_20px_rgba(110,231,168,0.25)]'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {pType === 'week' ? 'Semana' : pType === 'month' ? 'Mês' : 'Tudo'}
              </button>
            ))}
          </div>
        </div>

        {/* BLOCK 1: HERO VIEW (Glance of focus) */}
        <section className="bg-white/[0.01] border border-white/5 rounded-3xl p-6 md:p-8 space-y-4 relative overflow-hidden">
          {/* Subtle decoration background glow */}
          <div className="absolute top-0 right-0 w-[150px] h-[150px] bg-primary-green/5 blur-3xl rounded-full pointer-events-none" />

          <div className="space-y-1">
            <span className="text-[10px] font-black tracking-[0.25em] text-text-secondary/50 uppercase font-mono block">
              Foco Acumulado Total {period !== 'all' && `(${period === 'week' ? 'Semana' : 'Mês'})`}
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl md:text-5.5xl font-extrabold tracking-tighter text-text-primary select-none whitespace-nowrap inline-block" style={{ fontSize: 'clamp(2.2rem, 6.5vw, 4rem)' }}>
                {formatCompactDuration(period === 'all' ? totalFocusAllTimeMins : currentPeriodMins)}
              </span>
            </div>
            <p className={`text-xs font-mono font-bold tracking-wide mt-1.5 ${
              deltaType === 'positive' ? 'text-primary-green' : deltaType === 'negative' ? 'text-amber-500' : 'text-text-secondary/40'
            }`}>
              {deltaText}
            </p>
          </div>

          <div className="pt-4 border-t border-white/5 flex flex-wrap gap-x-6 gap-y-2 text-[10px] uppercase font-bold text-text-secondary/50 font-mono tracking-widest">
            <span>{supportingStats.sessionCount} {supportingStats.sessionCount === 1 ? 'Sessão' : 'Sessões'}</span>
            <span>·</span>
            <span>{supportingStats.projectsCount} {supportingStats.projectsCount === 1 ? 'Projeto' : 'Projetos'}</span>
            <span>·</span>
            <span className="text-primary-green">🔥 Sequência: {currentStreak} {currentStreak === 1 ? 'dia' : 'dias'}</span>
            <span>·</span>
            <span>Recorde: {bestStreak} {bestStreak === 1 ? 'dia' : 'dias'}</span>
          </div>
        </section>

        {/* TWO COLUMN CONTAINER: BLOCK 2 (Distributions) & BLOCK 4 (Consistency indicator) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* BLOCK 2: PARA ONDE SEU TEMPO FOI */}
          <div className="bg-white/[0.01] border border-white/5 p-6 rounded-3xl space-y-5">
            <h3 className="text-[11px] font-black text-text-secondary/40 uppercase tracking-[0.2em] flex items-center gap-1.5 font-mono">
              <Target size={12} className="text-primary-green" /> Onde seu tempo foi
            </h3>

            <div className="space-y-4">
              {projectDistribution.length === 0 ? (
                <div className="py-8 text-center bg-white/[0.01] border border-dashed border-white/5 rounded-2xl">
                  <p className="text-xs text-text-secondary/40 font-mono italic">Sem sessões de foco neste período.</p>
                </div>
              ) : (
                projectDistribution.map((item, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex justify-between items-baseline text-xs font-mono">
                      <span className="font-semibold text-text-primary max-w-[65%] truncate block">{item.name}</span>
                      <span className="text-text-secondary/80 text-right whitespace-nowrap block">
                        {formatCompactDuration(item.mins)} · <strong className="text-primary-green">{item.percent}%</strong>
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
          </div>

          {/* BLOCK 4: CONSISTÊNCIA REAL */}
          <div className="bg-white/[0.01] border border-white/5 p-6 rounded-3xl flex flex-col justify-between space-y-5">
            <h3 className="text-[11px] font-black text-text-secondary/40 uppercase tracking-[0.2em] flex items-center gap-1.5 font-mono">
              <Activity size={12} className="text-primary-green" /> Consistência de Ações
            </h3>

            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[9px] font-black text-text-secondary/40 uppercase tracking-widest block font-mono">Eficácia Geral</span>
                <p className="text-xs text-text-secondary/60 leading-normal max-w-[190px]">
                  Você esteve ativo em <strong className="text-text-primary font-bold">{consistencyStats.activeDays}</strong> de <strong className="text-text-primary font-bold">{consistencyStats.totalDays} dias</strong>.
                </p>
              </div>

              {/* Minimalist radial circle */}
              <div className="relative w-18 h-18 flex items-center justify-center shrink-0">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
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
                <div className="absolute flex flex-col items-center">
                  <span className="text-sm font-black font-mono text-primary-green">{consistencyStats.rate}%</span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-white/5 flex justify-between items-center text-[10px] uppercase font-bold text-text-secondary/40 font-mono tracking-widest">
              <span>Atual: {currentStreak}D</span>
              <span>Histórico: {bestStreak}D</span>
            </div>
          </div>

        </div>

        {/* BLOCK 3: EVOLUÇÃO DISCIPLINADA (BARS HEIGHT BUG FIXED) */}
        <section className="bg-white/[0.01] border border-white/5 p-6 rounded-3xl space-y-4">
          <h3 className="text-[11px] font-black text-text-secondary/40 uppercase tracking-[0.2em] flex items-center gap-1.5 font-mono">
            <BarChart2 size={12} className="text-primary-green" /> Evolução de Concentração
          </h3>

          <div id="focus-evolution-chart-container" className="flex flex-col space-y-2">
            
            {/* The chart area */}
            <div className="h-[120px] md:h-[150px] flex items-end gap-3 md:gap-4 px-2 pt-6 w-full relative">
              {chartData.map((dataItem, idx) => {
                const heightPercent = maxChartMins > 0 ? (dataItem.mins / maxChartMins) * 100 : 0;
                // Guard style
                const heightStyle = dataItem.mins > 0 ? `${Math.max(6, heightPercent)}%` : '3px';

                return (
                  <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full relative group">
                    {/* Always visible label top of column to avoid hover requirements */}
                    <span className="text-[9px] md:text-10px text-text-secondary/70 font-mono tracking-tighter mb-1 select-none">
                      {dataItem.displayValue}
                    </span>

                    {/* The bar core */}
                    <div 
                      className={`w-full rounded-t-lg transition-all duration-300 ${
                        dataItem.mins > 0 
                          ? 'bg-gradient-to-t from-primary-green/5 to-primary-green border-t border-primary-green group-hover:brightness-110 shadow-[0_-2px_10px_rgba(110,231,168,0.15)] cursor-pointer' 
                          : 'bg-white/[0.02] border-t border-transparent'
                      }`}
                      style={{ height: heightStyle }}
                    />

                    {/* Below-label */}
                    <span className="text-[9px] md:text-[10px] font-black text-text-secondary/50 font-mono mt-2 tracking-widest select-none">
                      {dataItem.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {maxChartMins === 0 && (
              <p className="text-xs text-text-secondary/40 italic font-mono text-center pt-2">
                Sem foco registrado neste período.
              </p>
            )}
          </div>
        </section>

        {/* PILLARS COLLAPSIBLE SECTIONS */}
        <section className="space-y-4">
          <h3 className="text-[11px] font-black text-text-secondary/40 uppercase tracking-[0.25em] font-mono px-1">
            Pilares do Desenvolvimento
          </h3>

          <div className="space-y-3">
            
            {/* PILLAR 1: HABITS ATOMICOS */}
            <div className="border border-white/5 rounded-2xl bg-white/[0.01] overflow-hidden transition-all duration-300">
              <button 
                onClick={() => setExpandedPillar(expandedPillar === 'habits' ? null : 'habits')}
                className="w-full p-5 flex items-center justify-between text-left cursor-pointer hover:bg-white/[0.01]"
              >
                <div className="flex items-center gap-3">
                  <Activity size={16} className="text-primary-green" />
                  <div>
                    <span className="text-xs md:text-sm font-bold tracking-tight text-text-primary">Hábitos Atômicos</span>
                    <span className="text-[9px] font-mono text-text-secondary/40 block uppercase tracking-wider mt-0.5">
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
                    className="px-5 pb-5 border-t border-white/5 pt-5 space-y-4"
                  >
                    {/* Warning reminder */}
                    {neglectedHabit && (
                      <div className="p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl flex items-center gap-2.5">
                        <AlertCircle size={14} className="text-amber-500 shrink-0" />
                        <p className="text-xs text-amber-500/80 font-light">
                          Atenção: o hábito <strong className="font-bold text-amber-500">{neglectedHabit.name}</strong> está com consistência abaixo do esperado nesta semana.
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {buildHabitsList.length === 0 ? (
                        <p className="text-xs text-text-secondary/40 italic font-mono col-span-2">Você ainda não possui hábitos em modo de construção.</p>
                      ) : (
                        buildHabitsList.map((h) => {
                          const target = h.sessions_per_week || 1;
                          const currentComp = h.sessions_this_week || 0;
                          const pct = Math.min(100, Math.round((currentComp / target) * 100));

                          return (
                            <div key={h.id} className="p-4 bg-white/[0.015] border border-white/5 rounded-xl space-y-2">
                              <div className="flex justify-between items-start gap-1">
                                <span className="text-[11px] font-bold text-text-primary max-w-[70%] truncate block">{h.name}</span>
                                <span className="text-[9px] font-black text-primary-green font-mono whitespace-nowrap">🔥 {h.weekly_streak === 1 ? '1 sem' : `${h.weekly_streak} sem`}</span>
                              </div>
                              <div id={`habit-detail-${h.id}`} className="space-y-1">
                                <div className="flex justify-between text-[9px] text-text-secondary/50 font-mono tracking-tight">
                                  <span>Progresso: {currentComp}/{target} sessões</span>
                                  <span>{pct}%</span>
                                </div>
                                <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
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

            {/* PILLAR 2: BLINDAGEM MENTAL */}
            <div className="border border-white/5 rounded-2xl bg-white/[0.01] overflow-hidden transition-all duration-300">
              <button 
                onClick={() => setExpandedPillar(expandedPillar === 'avoidance' ? null : 'avoidance')}
                className="w-full p-5 flex items-center justify-between text-left cursor-pointer hover:bg-white/[0.01]"
              >
                <div className="flex items-center gap-3">
                  <Shield size={16} className="text-primary-green" />
                  <div>
                    <span className="text-xs md:text-sm font-bold tracking-tight text-text-primary">Blindagem Mental (Modular)</span>
                    <span className="text-[9px] font-mono text-text-secondary/40 block uppercase tracking-wider mt-0.5">
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
                    className="px-5 pb-5 border-t border-white/5 pt-5 space-y-4"
                  >
                    {avoidanceHabitsList.length === 0 ? (
                      <div className="p-5 bg-white/[0.015] border border-dashed border-white/5 rounded-xl text-center space-y-2">
                        <p className="text-xs text-text-secondary/60 leading-relaxed font-light max-w-md mx-auto">
                          Você ainda não configurou nenhuma blindagem. Configure um vício no painel principal e o DUDE começará a mapear suas vitórias nos horários que você definir.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {avoidanceHabitsList.map((ah) => {
                          const streak = avoidanceStreaks[ah.id] || 0;
                          const checkinsList = avoidanceCheckins.filter(c => c.habit_id === ah.id && (c.status === 'success' || c.status === 'relapse'));
                          const totalCheckins = checkinsList.length;
                          const wins = checkinsList.filter(c => c.status === 'success').length;
                          const lapses = checkinsList.filter(c => c.status === 'relapse').length;
                          const rate = totalCheckins > 0 ? Math.round((wins / totalCheckins) * 100) : 100;
                          
                          // Estimate hours saved
                          const hrsSaved = Math.round(wins * (ah.minutes_per_session || 150) / 60);

                          return (
                            <div key={ah.id} className="p-4 bg-white/[0.015] border border-white/5 rounded-xl space-y-3">
                              <div className="flex justify-between items-baseline gap-1">
                                <span className="text-[11px] font-bold text-text-primary truncate block max-w-[65%]">{ah.name}</span>
                                <span className="text-[10px] font-black text-primary-green font-mono whitespace-nowrap">
                                  {streak} {streak === 1 ? 'dia' : 'dias'} resistindo
                                </span>
                              </div>
                              <div className="text-[9.5px] font-mono text-text-secondary/50 space-y-1 block leading-normal">
                                <p>{totalCheckins} {totalCheckins === 1 ? 'check-in respondido' : 'check-ins respondidos'} · <strong className="text-primary-green font-bold">{wins} resistidos</strong> · <strong className="text-amber-500 font-bold">{lapses} lapsos</strong></p>
                                <p className="text-text-secondary/65">Eficácia: <strong className="text-text-primary">{rate}% de sucesso</strong></p>
                                <p className="text-primary-green mt-1">≈ {hrsSaved}h que você recuperou do {ah.name}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* PILLAR 3: AGENDAMENTOS */}
            <div className="border border-white/5 rounded-2xl bg-white/[0.01] overflow-hidden transition-all duration-300">
              <button 
                onClick={() => setExpandedPillar(expandedPillar === 'schedule' ? null : 'schedule')}
                className="w-full p-5 flex items-center justify-between text-left cursor-pointer hover:bg-white/[0.01]"
              >
                <div className="flex items-center gap-3">
                  <Calendar size={16} className="text-primary-green" />
                  <div>
                    <span className="text-xs md:text-sm font-bold tracking-tight text-text-primary">Compromissos e Acordos</span>
                    <span className="text-[9px] font-mono text-text-secondary/40 block uppercase tracking-wider mt-0.5">
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
                    className="px-5 pb-5 border-t border-white/5 pt-5 space-y-4"
                  >
                    {scheduleCompliance.total === 0 ? (
                      <p className="text-xs text-text-secondary/40 italic font-mono">Nenhum compromisso marcado na sua agenda até o momento.</p>
                    ) : (
                      <div className="space-y-3">
                        <div className="p-4 bg-white/[0.015] border border-white/5 rounded-xl space-y-2">
                          <span className="text-[10px] font-bold text-text-secondary/40 uppercase tracking-widest block font-mono">Taxa de Palavra Cumprida</span>
                          <span className="text-base font-bold text-text-primary block leading-tight">
                            Você cumpriu {scheduleCompliance.completed} de {scheduleCompliance.completed + scheduleCompliance.lost} agendamentos elegíveis ({scheduleCompliance.rate}%).
                          </span>
                          <p className="text-[10px] font-mono text-text-secondary/50 leading-snug">
                            Cancelamentos não reduzem sua pontuação, pois representam uma escolha consciente de recalibração de rota.
                          </p>
                        </div>

                        {/* Exact breakdown status blocks */}
                        <div className="grid grid-cols-3 gap-3 text-center">
                          <div className="p-3 bg-white/[0.01] border border-white/5 rounded-lg space-y-0.5">
                            <span className="text-[8px] font-mono text-text-secondary/40 uppercase tracking-wider block">Cumpridos</span>
                            <span className="text-sm font-bold text-primary-green">{scheduleCompliance.completed}</span>
                          </div>
                          <div className="p-3 bg-white/[0.01] border border-white/5 rounded-lg space-y-0.5">
                            <span className="text-[8px] font-mono text-text-secondary/40 uppercase tracking-wider block">Perdidos</span>
                            <span className="text-sm font-bold text-amber-500">{scheduleCompliance.lost}</span>
                          </div>
                          <div className="p-3 bg-white/[0.01] border border-white/5 rounded-lg space-y-0.5">
                            <span className="text-[8px] font-mono text-text-secondary/40 uppercase tracking-wider block">Cancelados</span>
                            <span className="text-sm font-bold text-text-secondary/60">{scheduleCompliance.cancelled}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

          </div>
        </section>

        {/* HEATMAP AT THE BOTTOM OF SCROLL (LAST 90 DAYS ONLY) */}
        <section className="space-y-4 pt-4 border-t border-white/5">
          <div className="flex flex-col space-y-1">
            <h3 className="text-[11px] font-black text-text-secondary/40 uppercase tracking-[0.2em] flex items-center gap-1.5 font-mono">
              <Calendar size={12} className="text-primary-green" /> Mapa do Foco Diário de 90 dias
            </h3>
            <span className="text-[10px] text-text-secondary/40 font-mono font-light leading-normal block">
              Representação visual compacta da intensidade de foco diário nos últimos 90 dias.
            </span>
          </div>

          <div id="90-days-focus-heatmap" className="bg-white/[0.01] border border-white/5 p-5 rounded-2.5xl space-y-4">
            <div className="overflow-x-auto style-scrollbar select-none py-1 pr-1">
              <div className="flex flex-wrap gap-[4px] min-w-[340px] md:max-w-none">
                {heatmapCells90.map((cell, idx) => {
                  const bgClass = {
                    0: 'bg-white/[0.01] border-white/[0.02]',
                    1: 'bg-primary-green/15 border-primary-green/10 hover:bg-primary-green/30 hover:scale-105',
                    2: 'bg-primary-green/35 border-primary-green/30 hover:bg-primary-green/50 hover:scale-105',
                    3: 'bg-primary-green/65 border-primary-green/60 hover:bg-primary-green/80 hover:scale-105',
                    4: 'bg-primary-green border-primary-green/100 hover:brightness-110 hover:scale-105 hover:shadow-[0_0_8px_rgba(110,231,168,0.4)]'
                  }[cell.intensity];

                  return (
                    <div
                      key={idx}
                      title={cell.label}
                      className={`aspect-square w-2.5 h-2.5 md:w-3 md:h-3 rounded-[2.5px] border cursor-crosshair transition-all duration-150 ${bgClass}`}
                    />
                  );
                })}
              </div>
            </div>

            {/* Scale legend */}
            <div className="flex items-center justify-between text-[9px] text-text-secondary/40 font-mono pt-1">
              <span>Menos ativo</span>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-white/[0.01] border border-white/[0.02] rounded-[1.5px]" />
                <span className="w-2.5 h-2.5 bg-primary-green/15 border border-primary-green/10 rounded-[1.5px]" />
                <span className="w-2.5 h-2.5 bg-primary-green/45 border border-primary-green/35 rounded-[1.5px]" />
                <span className="w-2.5 h-2.5 bg-primary-green/75 border border-primary-green/65 rounded-[1.5px]" />
                <span className="w-2.5 h-2.5 bg-primary-green border border-primary-green rounded-[1.5px]" />
                <span>Mais ativo</span>
              </div>
            </div>
          </div>
        </section>

        {/* FOOTER BUTTON */}
        <footer className="flex justify-end pt-4">
          <button
            onClick={onClose}
            className="px-6 py-3 bg-white/[0.02] border border-border-white hover:bg-white/5 rounded-2xl text-[10px] uppercase font-bold tracking-[0.2em] transition-all cursor-pointer text-text-primary"
          >
            Fechar Centro de Inteligência
          </button>
        </footer>

      </motion.div>
    </div>
  );
};
