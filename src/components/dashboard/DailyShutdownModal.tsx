import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useDataStore } from '../../store/useDataStore';
import { useAuthStore } from '../../store/useAuthStore';
import { getLocalDateString, getLocalYesterdayDateString, getCurrentPeriodAndDate, formatTimeRange } from '../../lib/utils';
import { MOOD_LIST } from '../../lib/mood';
import { X, Moon, Check, Calendar, ChevronDown, ChevronUp, Folder, Zap, Waves, Scale, BatteryLow, Shield, Sword, Target } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { DailyShutdown } from '../../types';

interface DailyShutdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetDate: string;
  isCatchUp: boolean;
}

export const DailyShutdownModal = ({ isOpen, onClose, targetDate, isCatchUp }: DailyShutdownModalProps) => {
  const { user } = useAuthStore();
  const { 
    habits,
    sessions, 
    habitCompletions, 
    avoidanceCheckins, 
    scheduledActivities, 
    sessionTasks, 
    addSessionTask, 
    moodEntries, 
    profile, 
    projects,
    addDailyShutdown
  } = useDataStore();

  const [taskInputs, setTaskInputs] = useState<{ [sessionId: string]: string }>({});

  useEffect(() => {
    if (isOpen) {
    }
  }, [isOpen]);

  const firstName = profile?.full_name?.split(' ')[0] || 'Gustavo';

  // Format YYYY-MM-DD into DD/MM without timezone pitfalls
  const formattedDayAndMonth = useMemo(() => {
    if (!targetDate) return '';
    const parts = targetDate.split('-');
    if (parts.length < 3) return targetDate;
    return `${parts[2]}/${parts[1]}`;
  }, [targetDate]);

  // Summarize stats for the targetDate
  const todaySessions = useMemo(() => {
    return sessions.filter(s => getLocalDateString(new Date(s.started_at)) === targetDate && s.completed);
  }, [sessions, targetDate]);

  const totalMinutes = useMemo(() => {
    return todaySessions.reduce((acc, s) => acc + (s.actual_duration_minutes || s.duration_minutes), 0);
  }, [todaySessions]);

  // Daily Goal derivation matching the Home page
  const dailyGoal = useMemo(() => {
    const userGoal = profile?.daily_goal_minutes;
    if (userGoal !== undefined && userGoal !== null && userGoal > 0) {
      return userGoal;
    }
    const sessionsByDate: { [key: string]: number } = {};
    sessions.forEach(s => {
      if (!s.completed) return;
      const day = getLocalDateString(new Date(s.started_at));
      const duration = s.actual_duration_minutes !== null ? s.actual_duration_minutes : s.duration_minutes;
      sessionsByDate[day] = (sessionsByDate[day] || 0) + duration;
    });

    const uniqueDaysCount = Object.keys(sessionsByDate).length;
    let autoGoal = 45;
    if (uniqueDaysCount > 0) {
      const previousDaysMins = Object.values(sessionsByDate);
      const lastActiveDays = previousDaysMins.slice(-14);
      const sum = lastActiveDays.reduce((a, b) => a + b, 0);
      const avg = sum / lastActiveDays.length;
      const rounded = Math.round(avg / 15) * 15;
      autoGoal = Math.max(25, rounded);
    }

    const saved = localStorage.getItem('dude_daily_focus_goal');
    return saved ? parseInt(saved, 10) : autoGoal;
  }, [sessions, profile?.daily_goal_minutes]);

  const percent = dailyGoal > 0 ? Math.round((totalMinutes / dailyGoal) * 100) : 0;

  const timeByProject = useMemo(() => {
    const map: { [projectId: string]: { name: string; minutes: number } } = {};
    
    todaySessions.forEach(s => {
      const duration = s.actual_duration_minutes !== null && s.actual_duration_minutes !== undefined
        ? s.actual_duration_minutes
        : s.duration_minutes;
      
      const pId = s.project_id || 'no-project';
      let pName = 'Sem Projeto';
      if (s.project_id && projects) {
        const proj = projects.find(p => p.id === s.project_id);
        if (proj) {
          pName = proj.name;
        }
      }
      
      if (!map[pId]) {
        map[pId] = { name: pName, minutes: 0 };
      }
      map[pId].minutes += duration;
    });
    
    return Object.values(map).sort((a, b) => b.minutes - a.minutes);
  }, [todaySessions, projects]);

  // Target day's logged mood (if any)
  const todayMoodObj = useMemo(() => {
    const todayMoodsList = moodEntries.filter(m => m.date === targetDate);
    if (todayMoodsList.length > 0) {
      return MOOD_LIST.find(m => m.key === todayMoodsList[0].mood);
    }
    return null;
  }, [moodEntries, targetDate]);

  const todayMoodEntry = useMemo(() => {
    return moodEntries.find(m => m.date === targetDate);
  }, [moodEntries, targetDate]);

  const todayAvoidanceCheckins = useMemo(() => {
    return avoidanceCheckins.filter(ac => ac.checkin_date === targetDate);
  }, [avoidanceCheckins, targetDate]);

  const totalBattlesToday = useMemo(() => {
    if (!targetDate) return 0;
    const [year, month, day] = targetDate.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    const dayOfWeek = dateObj.getDay(); // 0 is Sunday, 1 is Monday ... 6 is Saturday

    const getWeekdays = (weekdaysStr?: string): number[] => {
      if (!weekdaysStr || weekdaysStr === 'all' || weekdaysStr === '') {
        return [0, 1, 2, 3, 4, 5, 6];
      }
      return weekdaysStr.split(',').map(Number);
    };

    const avoidHabits = habits.filter(h => h.habit_mode === 'avoid');

    const activeAvoidHabits = avoidHabits.filter(ah => {
      const parsedWeekdays = ah.monitor_weekdays 
        ? getWeekdays(ah.monitor_weekdays)
        : (ah.recurrence_days && ah.recurrence_days.length > 0
            ? ah.recurrence_days.map(d => d === '7' ? 0 : parseInt(d, 10))
            : [0, 1, 2, 3, 4, 5, 6]);

      return parsedWeekdays.includes(dayOfWeek);
    });

    return activeAvoidHabits.length;
  }, [habits, targetDate]);

  const avoidanceStats = useMemo(() => {
    let wins = 0;
    let relapses = 0;
    todayAvoidanceCheckins.forEach(ac => {
      const status = ac.status?.toLowerCase();
      if (status === 'resisti' || status === 'success') {
        wins++;
      } else if (status === 'recai' || status === 'relapse') {
        relapses++;
      }
    });
    return { wins, relapses };
  }, [todayAvoidanceCheckins]);

  const formatEnergy = (energy?: string | null) => {
    if (!energy) return 'Normal ⚡';
    switch (energy) {
      case 'cansado': return 'Baixa 🥱';
      case 'normal': return 'Normal ⚡';
      case 'energizado': return 'Alta 🔥';
      default: return `${energy.charAt(0).toUpperCase() + energy.slice(1)}`;
    }
  };

  const energyByPeriod = useMemo(() => {
    const todayMoods = moodEntries.filter(m => m.date === targetDate);
    const getEnergyForPeriod = (p: string) => {
      const entry = todayMoods.find(m => m.period === p);
      return entry?.energy || null;
    };
    return {
      manha: getEnergyForPeriod('manha'),
      tarde: getEnergyForPeriod('tarde'),
      noite: getEnergyForPeriod('noite'),
    };
  }, [moodEntries, targetDate]);

  const getEnergyIcon = (energy: string | null) => {
    if (!energy) return <span className="w-4 h-px bg-white/20" />;
    switch (energy) {
      case 'pleno':
      case 'energizado': return <Zap size={18} strokeWidth={1.5} className="text-zinc-300" />;
      case 'inquieto': return <Waves size={18} strokeWidth={1.5} className="text-zinc-300" />;
      case 'equilibrado':
      case 'normal': return <Scale size={18} strokeWidth={1.5} className="text-zinc-300" />;
      case 'fadigado':
      case 'cansado': return <BatteryLow size={18} strokeWidth={1.5} className="text-zinc-300" />;
      default: return <Zap size={18} strokeWidth={1.5} className="text-zinc-300" />;
    }
  };
  
  const getEnergyLabel = (energy: string | null) => {
    if (!energy) return 'Não medido';
    switch (energy) {
      case 'pleno': return 'Pleno';
      case 'inquieto': return 'Inquieto';
      case 'equilibrado': return 'Equilibrado';
      case 'fadigado': return 'Fadigado';
      case 'cansado': return 'Cansado';
      case 'normal': return 'Normal';
      case 'energizado': return 'Energizado';
      default: return energy.charAt(0).toUpperCase() + energy.slice(1);
    }
  };

  const handleDismiss = async () => {
    localStorage.setItem(`dude-shutdown-dismissed-${targetDate}`, 'true');
    if (user) {
      await addDailyShutdown(user.id, targetDate, 'dismissed');
    }
    onClose();
  };

  const handleAddTaskInline = async (sessionId: string) => {
    const inputVal = taskInputs[sessionId]?.trim();
    if (!inputVal || !user) return;

    await addSessionTask(sessionId, user.id, inputVal, true);
    setTaskInputs(prev => ({ ...prev, [sessionId]: '' }));
  };

  const formatDuration = (totalMins: number) => {
    const h = Math.floor(totalMins / 60);
    const m = Math.round(totalMins % 60);
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  const handleStartDecompression = async () => {
    // Trancar os dados
    localStorage.setItem(`dude-shutdown-completed-${targetDate}`, 'true');
    if (user) {
      await addDailyShutdown(user.id, targetDate, 'completed');
    }
    // Fechar este modal
    onClose();
    // Emitir evento para abrir a descompressão
    window.dispatchEvent(new CustomEvent('open-decompression'));
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div 
        onClick={handleDismiss}
        className="fixed inset-0 z-[600] flex items-end justify-center bg-black/60 backdrop-blur-md cursor-pointer"
      >
        <motion.div
          onClick={(e) => e.stopPropagation()}
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="w-full h-[90vh] sm:max-w-xl bg-zinc-950 border-t border-zinc-800 rounded-t-[32px] p-6 sm:p-8 flex flex-col cursor-default overflow-hidden relative shadow-[0_-20px_50px_rgba(0,0,0,0.5)]"
        >
          {/* Header */}
          <div className="flex justify-between items-center mb-6 shrink-0">
            <h2 className="text-2xl sm:text-3xl font-semibold text-zinc-100 tracking-tight">Resumo de Hoje</h2>
            <button
              onClick={handleDismiss}
              className="p-2 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer rounded-full hover:bg-zinc-900"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto style-scrollbar space-y-4 pr-1 pb-24">
            
            {/* Bloco 1: Métricas de Foco */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Tempo Total Presente</span>
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-light text-zinc-100 tracking-tight">{formatDuration(totalMinutes)}</span>
                <span className="text-sm font-medium text-zinc-500">{todaySessions.length} sessões</span>
              </div>
            </div>

            {/* Grade 2 colunas: Autocontrole e Biológicas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Bloco 2: Níveis de Energia */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-4">Níveis de Energia</span>
                <div className="flex justify-between items-center h-full gap-2">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700/50">
                      {getEnergyIcon(energyByPeriod.manha)}
                    </div>
                    <span className="text-[10px] font-medium text-zinc-400">Manhã</span>
                  </div>
                  <div className="w-full h-px bg-zinc-800"></div>
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700/50">
                      {getEnergyIcon(energyByPeriod.tarde)}
                    </div>
                    <span className="text-[10px] font-medium text-zinc-400">Tarde</span>
                  </div>
                  <div className="w-full h-px bg-zinc-800"></div>
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700/50">
                      {getEnergyIcon(energyByPeriod.noite)}
                    </div>
                    <span className="text-[10px] font-medium text-zinc-400">Noite</span>
                  </div>
                </div>
              </div>

              {/* Bloco 3: Autocontrole */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-4">Autocontrole</span>
                <div className="flex-1 flex flex-col justify-center gap-3">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Target size={14} className="text-zinc-500" />
                      <span className="text-xs font-medium text-zinc-300">Programadas</span>
                    </div>
                    <span className="text-sm font-semibold text-zinc-100">{totalBattlesToday}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Shield size={14} className="text-emerald-500" />
                      <span className="text-xs font-medium text-zinc-300">Vitórias</span>
                    </div>
                    <span className="text-sm font-semibold text-emerald-400">{avoidanceStats.wins}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Sword size={14} className="text-rose-500" />
                      <span className="text-xs font-medium text-zinc-300">Recaídas</span>
                    </div>
                    <span className="text-sm font-semibold text-rose-400">{avoidanceStats.relapses}</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Bloco 4: Tempo por Projeto */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3">Tempo por Projeto</span>
              {timeByProject.length > 0 ? (
                <div className="flex flex-col">
                  {timeByProject.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-end py-2 border-b border-zinc-800/50 last:border-0 group">
                      <span className="text-sm text-zinc-300 font-medium truncate pr-4">{item.name}</span>
                      <div className="flex-1 border-b border-dotted border-zinc-700/50 mb-1.5 mx-2 opacity-50 group-hover:opacity-100 transition-opacity"></div>
                      <span className="text-sm text-zinc-400 font-mono shrink-0">{formatDuration(item.minutes)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-zinc-500 font-medium py-2">Nenhum projeto registrado hoje.</p>
              )}
            </div>

          </div>

          {/* Fixed Bottom Action */}
          <div className="absolute bottom-0 left-0 w-full p-6 bg-gradient-to-t from-zinc-950 via-zinc-950 to-transparent pt-12">
            <button
              type="button"
              onClick={handleStartDecompression}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-semibold text-[15px] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(5,150,105,0.2)]"
            >
              <Moon size={18} strokeWidth={2.5} />
              Iniciar Descompressão
            </button>
            <p className="text-center text-[10px] text-zinc-500 font-medium mt-3">
              Trancar dados e desligar a mente
            </p>
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
};
