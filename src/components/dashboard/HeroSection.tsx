import { motion, AnimatePresence } from 'motion/react';
import { useState, useMemo, useEffect, useRef } from 'react';
import { useTimerStore } from '../../store/useTimerStore';
import { useDataStore } from '../../store/useDataStore';
import { usePWA } from '../../context/PWAContext';
import { Moon, X, Calendar } from 'lucide-react';
import { resolverNomeSessao, formatSessionDuration, formatTimeRange, getLocalDateString } from '../../lib/utils';
import { MOODS } from '../../lib/mood';
import { calculateAvoidanceMetrics } from './AvoidanceSection';
import { Habit, AvoidanceCheckin } from '../../types';
import { playScheduleSound } from '../../hooks/useSessionNotifications';
import { useAgendaAlertEngine } from '../../hooks/useAgendaAlertEngine';

interface HeroSectionProps {
  tasks?: any[];
  onNavigateToLists?: () => void;
}

export const HeroSection = ({ tasks = [], onNavigateToLists }: HeroSectionProps) => {
  const timer = useTimerStore();
  const dataStore = useDataStore();
  
  const firstName = dataStore.profile?.full_name?.split(' ')[0] || 'Gustavo';

  // Greeting Logic
  const [isEditingGoal, setIsEditingGoal] = useState(false);

  // PWA Install hook context
  const { canInstall, installApp } = usePWA();

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

  const todayTasks = (dataStore.dailyTasks || []).filter(t => t.task_date === today);
  const completedTasksCount = todayTasks.filter(t => t.is_completed).length;
  const totalTasksCount = todayTasks.length;

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

  const activeBannerHabit = useMemo(() => {
    const avoidHabits = dataStore.habits.filter(h => h.habit_mode === 'avoid');
    if (avoidHabits.length === 0 || !dataStore.profile?.id) return null;

    const now = new Date();
    const todayStr = getLocalDateString(now);
    const dayOfWeek = now.getDay();

    const getWeekdays = (weekdaysStr?: string): number[] => {
      if (!weekdaysStr || weekdaysStr === 'all' || weekdaysStr === '') {
        return [0, 1, 2, 3, 4, 5, 6];
      }
      return weekdaysStr.split(',').map(Number);
    };

    for (const h of avoidHabits) {
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

        if (now.getTime() >= wStart.getTime()) {
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

        return {
          habit: h,
          windowLabel,
          checkinPeriod,
          promptsShown,
        };
      }
    }

    return null;
  }, [dataStore.habits, dataStore.avoidanceCheckins, dataStore.profile, dismissedAntiVicioKeys]);

  const handleResisti = async (habit: Habit, windowLabel: string, checkinPeriod: string) => {
    if (!dataStore.profile?.id) return;
    playVictorySound();
    
    setAnimatingResistedHabitId(habit.id);
    dismissAntiVicio(habit.id, windowLabel);
    
    const todayStr = getLocalDateString(new Date());
    await dataStore.addAvoidanceCheckin({
      user_id: dataStore.profile.id,
      habit_id: habit.id,
      checkin_date: todayStr,
      checkin_period: checkinPeriod,
      status: 'resisti',
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

    const todayStr = getLocalDateString(new Date());
    await dataStore.addAvoidanceCheckin({
      user_id: dataStore.profile.id,
      habit_id: habit.id,
      checkin_date: todayStr,
      checkin_period: checkinPeriod,
      status: 'recai',
      window_label: windowLabel,
      prompts_shown: 1
    });

    setRelapsedHabitName(habit.name);
    setShowSupportiveRelapseModal(true);
  };

  const handleDepois = async (habit: Habit, windowLabel: string, checkinPeriod: string) => {
    if (!dataStore.profile?.id) return;
    
    dismissAntiVicio(habit.id, windowLabel);

    const todayStr = getLocalDateString(new Date());
    await dataStore.addAvoidanceCheckin({
      user_id: dataStore.profile.id,
      habit_id: habit.id,
      checkin_date: todayStr,
      checkin_period: checkinPeriod,
      status: 'depois',
      window_label: windowLabel,
      prompts_shown: 1
    });

    dataStore.showNotification('Acompanhamento adiado silenciosamente.', 'success');
  };

  const bannerRender = useMemo(() => {
    if (!activeBannerHabit) return null;
    const { habit, windowLabel, checkinPeriod } = activeBannerHabit;
    const metrics = calculateAvoidanceMetrics(habit, dataStore.avoidanceCheckins);
    const isAnimating = animatingResistedHabitId === habit.id;
    const isJanela = habit.monitor_type === 'janela' || habit.avoidance_scope === 'time_window';
    const mStart = habit.monitor_start || habit.avoidance_window_start || "18:00";
    const mEnd = habit.monitor_end || habit.avoidance_window_end || "22:00";

    return (
      <motion.div
        key={habit.id}
        initial={{ opacity: 0, y: -10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.98 }}
        className="w-full max-w-sm sm:max-w-md mx-auto p-5 rounded-2xl bg-surface-1/90 border border-green/30 shadow-[0_0_20px_rgba(110,231,168,0.12)] flex flex-col gap-4 text-center select-none relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-green/5 animate-pulse opacity-40 pointer-events-none" />

        <div className="flex justify-between items-center relative z-10 w-full">
          <p className="text-[9px] uppercase tracking-widest font-bold text-green flex items-center gap-1.5 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-green animate-ping shrink-0" />
            ● Acompanhamento · {habit.name}
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
            Como você está com seu autocontrole de <span className="text-green font-extrabold">{habit.name}</span> agora?
          </h4>
          {isJanela && (
            <p className="text-[10px] font-mono text-text-secondary/50 uppercase tracking-wider">
              Janela Programada: {mStart} às {mEnd}
            </p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 relative z-10 font-sans">
          <button
            type="button"
            onClick={() => handleResisti(habit, windowLabel, checkinPeriod)}
            className="py-2.5 px-3 bg-green hover:brightness-110 text-background rounded-xl font-bold uppercase tracking-wider text-[10px] transition-all hover:scale-102 cursor-pointer text-center"
          >
            ✓ Resisti
          </button>
          <button
            type="button"
            onClick={() => handleRecai(habit, windowLabel, checkinPeriod)}
            className="py-2.5 px-3 bg-red-400/10 hover:bg-red-400/20 border border-red-400/20 text-red-300 rounded-xl font-bold uppercase tracking-wider text-[10px] transition-all hover:scale-102 cursor-pointer text-center"
          >
            Recaí
          </button>
          <button
            type="button"
            onClick={() => handleDepois(habit, windowLabel, checkinPeriod)}
            className="py-2.5 px-3 bg-white/5 hover:bg-white/10 border border-white/10 text-text-secondary/65 rounded-xl font-medium tracking-wider text-[10px] transition-all cursor-pointer text-center"
          >
            Depois
          </button>
        </div>
      </motion.div>
    );
  }, [activeBannerHabit, dataStore.avoidanceCheckins, animatingResistedHabitId]);

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
        className="w-full max-w-3xl space-y-6 md:space-y-8 py-2 md:py-4"
      >
        {/* Bloco 1 — Saudação */}
        <div className="space-y-2 flex flex-col items-center w-full max-w-full overflow-hidden relative">
          <h2 className="text-[clamp(1.75rem,5.8vw,3.2rem)] font-bold tracking-tight text-text leading-none whitespace-nowrap px-2 relative z-10">
            {greeting}, {firstName}
          </h2>
          <span className="text-xs sm:text-sm md:text-base text-text-dim/60 md:text-text-dim font-mono tracking-[0.15em] uppercase font-bold md:font-semibold">
            {fullCustomDate}
          </span>
          <p className="text-[#6EE7B7] whitespace-nowrap text-[clamp(8.5px,2.8vw,14px)] text-center italic font-medium leading-tight select-none max-w-full tracking-[[-0.05em]] mb-6 pr-2">
            Se organize para passar mais tempo com as pessoas que importam ❤️
          </p>

          {canInstall && (
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

          {/* Seu tom de hoje: [label] chip */}
          {activeMoodEntry && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="inline-flex items-center gap-2 px-3 py-1 bg-surface-2/65 border border-border-custom rounded-full text-[10px] uppercase font-bold tracking-wider text-text-dim mt-2 hover:bg-surface-2 transition-colors cursor-default select-none relative z-10"
            >
              <span className="w-1.5 h-1.5 rounded-full animate-pulse z-10" style={{ backgroundColor: 'var(--mood)' }} />
              <span>Seu tom de hoje: <span className="text-text font-semibold capitalize">{activeMoodEntry.mood} {MOODS[activeMoodEntry.mood]?.emoji}</span></span>
            </motion.div>
          )}
        </div>

        {/* THE AVERAGE RING COLUMNS (WAVE 2C / PART B) */}
        <div className="flex flex-col items-center justify-center gap-5 w-full py-2">
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

        {/* PRECISION CONSCIOUSNESS BANNER */}
        <AnimatePresence mode="wait">
          {bannerRender}
        </AnimatePresence>

        {/* Bloco 4 — Botão de ação (The primary action centered with generous breathing room) */}
        <motion.div 
          layout={false}
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="pb-2 flex flex-col items-center gap-2 w-full animate-fade-in"
        >
          <button 
            onClick={openDeepSession}
            className="group relative px-5 sm:px-10 py-4 sm:py-5 bg-green text-base rounded-2xl overflow-hidden transition-all hover:brightness-105 active:scale-[0.98] flex flex-col items-center justify-center gap-1.5 mx-auto shadow-[0_4px_12px_rgba(110,231,168,0.15)] sm:shadow-[0_20px_40px_rgba(110,231,168,0.25)] touch-manipulation min-h-[56px] w-full max-w-[340px] sm:max-w-md hover:scale-[1.02] duration-200 cursor-pointer text-center"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-full bg-base animate-pulse shrink-0" />
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
        </motion.div>

        {/* "SEUS NÚMEROS DE HOJE" BLOCK (PART B3 & B4) */}
        <div className="w-full space-y-4 pt-1">
          <h3 className="text-xs sm:text-sm font-bold tracking-[0.22em] text-text uppercase text-center font-sans">
            SEUS NÚMEROS DE HOJE
          </h3>
          
          <div className="grid grid-cols-3 gap-3 w-full">
            {/* Card 1 — Horas Focadas */}
            <div className="flex flex-col items-center justify-between p-4 rounded-2xl bg-surface-1 border border-border-custom hover:border-white/10 transition-all w-full select-none cursor-default">
              <div className="flex items-center justify-center w-full min-h-[40px]">
                <span className="text-xl sm:text-2xl md:text-3.5xl font-mono font-bold text-text whitespace-nowrap leading-none">
                  {formatCompact(todayMinutesToShow)}
                </span>
              </div>
              <span className="text-[10px] sm:text-xs text-text-dim text-center font-sans tracking-wide leading-tight mt-2 whitespace-nowrap">
                Horas Focadas
              </span>
            </div>

            {/* Card 2 — Sessões Profundas */}
            <div className="flex flex-col items-center justify-between p-4 rounded-2xl bg-surface-1 border border-border-custom hover:border-white/10 transition-all w-full select-none cursor-default">
              <div className="flex items-center justify-center w-full min-h-[40px]">
                <span className="text-xl sm:text-2xl md:text-3.5xl font-mono font-bold text-text whitespace-nowrap leading-none">
                  {todaySessions.length}
                </span>
              </div>
              <span className="text-[10px] sm:text-xs text-text-dim text-center font-sans tracking-wide leading-tight mt-2 whitespace-nowrap">
                {todaySessions.length === 1 ? 'Sessão Profunda' : 'Sessões Profundas'}
              </span>
            </div>

            {/* Card 3 — Dias Invictos */}
            <div className="flex flex-col items-center justify-between p-4 rounded-2xl bg-surface-1 border border-border-custom hover:border-white/10 transition-all w-full select-none cursor-default">
              <div className="flex items-center justify-center w-full min-h-[40px]">
                <div className="flex items-center justify-center gap-1.5 w-full font-mono">
                  <span className="text-lg sm:text-xl md:text-2xl select-none leading-none shrink-0 text-center">🔥</span>
                  <span className="text-xl sm:text-2xl md:text-3.5xl font-mono font-bold text-green whitespace-nowrap leading-none">
                    {streak}
                  </span>
                </div>
              </div>
              <span className="text-[10px] sm:text-xs text-text-dim text-center font-sans tracking-wide leading-tight mt-2 whitespace-nowrap">
                {streak === 1 ? 'Dia Invicto' : 'Dias Invictos'}
              </span>
            </div>
          </div>

          {/* Summary Card for Today's Task List */}
          <div 
            onClick={() => onNavigateToLists?.()}
            className="w-full p-4 rounded-2xl bg-surface-1/40 hover:bg-surface-1/75 border border-border-custom hover:border-green/20 transition-all cursor-pointer text-center flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 group select-none mt-2"
          >
            <span className="text-base sm:text-lg group-hover:scale-110 transition-transform">📋</span>
            <span className="text-[11px] sm:text-xs md:text-sm font-medium text-text-primary leading-relaxed">
              Você fez <span className="text-green font-bold">{completedTasksCount}</span> das <span className="text-text-primary font-bold">{totalTasksCount}</span> tarefas que planejou para hoje
            </span>
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
                    window.dispatchEvent(new CustomEvent('open-stats'));
                    setTimeout(() => {
                      const el = document.getElementById('stats-block');
                      if (el) {
                        el.scrollIntoView({ behavior: 'smooth' });
                      } else {
                        window.scrollTo({ top: document.body.scrollHeight / 3, behavior: 'smooth' });
                      }
                    }, 100);
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

      {/* Elemento Decorativo: Gradiente Sutil de Fundo */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[280px] h-[200px] md:w-[800px] md:h-[400px] bg-green/5 blur-[80px] md:blur-[120px] rounded-full" />
      </div>
    </section>
  );
};
