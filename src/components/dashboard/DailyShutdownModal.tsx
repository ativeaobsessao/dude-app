import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useDataStore } from '../../store/useDataStore';
import { useAuthStore } from '../../store/useAuthStore';
import { getLocalDateString, getLocalYesterdayDateString, getCurrentPeriodAndDate, formatTimeRange } from '../../lib/utils';
import { MOOD_LIST } from '../../lib/mood';
import { X, Moon, Check, Calendar, ChevronDown, ChevronUp, Folder } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { DailyShutdown } from '../../types';

export const DailyShutdownModal = () => {
  const { user } = useAuthStore();
  const { 
    sessions, 
    habitCompletions, 
    avoidanceCheckins, 
    scheduledActivities, 
    sessionTasks, 
    addSessionTask, 
    toggleSessionTask,
    moodEntries, 
    initialFetchDone,
    profile,
    dailyShutdowns,
    addDailyShutdown,
    projects
  } = useDataStore();

  const [isOpen, setIsOpen] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [showAllSessions, setShowAllSessions] = useState(false);
  const [showConfirmPopup, setShowConfirmPopup] = useState(false);
  const [taskInputs, setTaskInputs] = useState<{ [sessionId: string]: string }>({});
  const [targetDate, setTargetDate] = useState<string>(() => getLocalDateString(new Date()));
  const [isCatchUp, setIsCatchUp] = useState<boolean>(false);

  const todayStr = useMemo(() => getLocalDateString(new Date()), []);
  const firstName = profile?.full_name?.split(' ')[0] || 'Gustavo';

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

  // Have any activity on the target date?
  const hasActivityOnTargetDay = useMemo(() => {
    if (todaySessions.length > 0) return true;

    const todaysHabitComps = habitCompletions.filter(hc => hc.completed_at.startsWith(targetDate));
    if (todaysHabitComps.length > 0) return true;

    const todaysAvoidance = avoidanceCheckins.filter(ac => ac.checkin_date === targetDate);
    if (todaysAvoidance.length > 0) return true;

    const todaysScheduled = scheduledActivities.filter(sa => sa.scheduled_date === targetDate && sa.status === 'completed');
    if (todaysScheduled.length > 0) return true;

    return false;
  }, [todaySessions, habitCompletions, avoidanceCheckins, scheduledActivities, targetDate]);

  // Check for completed sessions from target day that have NO checklist tasks marked / look incomplete
  const incompleteSessions = useMemo(() => {
    return todaySessions.filter(session => {
      const tasks = sessionTasks.filter(t => t.session_id === session.id);
      const hasAnyCompleted = tasks.some(t => t.completed);
      return tasks.length === 0 || !hasAnyCompleted;
    });
  }, [todaySessions, sessionTasks]);

  // Target day's logged mood (if any)
  const todayMoodObj = useMemo(() => {
    const todayMoodsList = moodEntries.filter(m => m.date === targetDate);
    if (todayMoodsList.length > 0) {
      return MOOD_LIST.find(m => m.key === todayMoodsList[0].mood);
    }
    return null;
  }, [moodEntries, targetDate]);

  // Determine if we should trigger the modal automatically for yesterday
  useEffect(() => {
    if (!user || !initialFetchDone) return;

    const checkRequirement = async () => {
      const yesterdayStr = getLocalYesterdayDateString(new Date());

      // Yesterday was completed or dismissed in cache/store?
      const isYesterdayDone = localStorage.getItem(`dude-shutdown-completed-${yesterdayStr}`) === 'true' ||
                              dailyShutdowns.some(d => d.date === yesterdayStr && d.status === 'completed');
      const isYesterdayDismissed = localStorage.getItem(`dude-shutdown-dismissed-${yesterdayStr}`) === 'true' ||
                                   dailyShutdowns.some(d => d.date === yesterdayStr && d.status === 'dismissed');

      if (isYesterdayDone || isYesterdayDismissed) {
        setIsOpen(false);
        return;
      }

      // Check if yesterday had activity
      const yesterdaySessionsObj = sessions.filter(s => getLocalDateString(new Date(s.started_at)) === yesterdayStr && s.completed);
      const yesterdayHabitComps = habitCompletions.filter(hc => hc.completed_at.startsWith(yesterdayStr));
      const yesterdayAvoidance = avoidanceCheckins.filter(ac => ac.checkin_date === yesterdayStr);
      const yesterdayScheduled = scheduledActivities.filter(sa => sa.scheduled_date === yesterdayStr && sa.status === 'completed');

      const hasActivityYesterday = yesterdaySessionsObj.length > 0 ||
                                   yesterdayHabitComps.length > 0 ||
                                   yesterdayAvoidance.length > 0 ||
                                   yesterdayScheduled.length > 0;

      if (!hasActivityYesterday) {
        setIsOpen(false);
        return;
      }

      // Mood ritual overlay check: wait for it if not completed or skipped
      const { period, dateStr } = getCurrentPeriodAndDate(new Date());
      const hasAnsweredMood = moodEntries.some(m => m.date === dateStr && m.period === period);
      const isMoodSkipped = localStorage.getItem(`dude-mood-skipped-${dateStr}-${period}`) === 'true';
      const isMoodActive = !hasAnsweredMood && !isMoodSkipped;

      if (isMoodActive) {
        setIsOpen(false);
        return;
      }

      // Trigger automatic catch-up for yesterday (initial state)
      setTargetDate(yesterdayStr);
      setIsCatchUp(true);
      setIsCompleted(false);
      setIsOpen(true);

      // Background revalidation
      try {
        const { data, error } = await supabase
          .from('daily_shutdowns')
          .select('*')
          .eq('user_id', user.id)
          .eq('date', yesterdayStr);

        if (!error && data) {
          const serverEntry = data[0];
          if (serverEntry) {
            // Already handled on another device! Close silently
            setIsOpen(false);

            // Reconcile and update cache/store
            const hasInStore = dailyShutdowns.some(d => d.date === yesterdayStr && d.status === serverEntry.status);
            if (!hasInStore) {
              const updated = [serverEntry, ...dailyShutdowns.filter(d => d.date !== yesterdayStr)];
              useDataStore.setState({ dailyShutdowns: updated });
              localStorage.setItem('dude-daily-shutdowns', JSON.stringify(updated));
              localStorage.setItem(`dude-shutdown-completed-${yesterdayStr}`, serverEntry.status === 'completed' ? 'true' : 'false');
              localStorage.setItem(`dude-shutdown-dismissed-${yesterdayStr}`, serverEntry.status === 'dismissed' ? 'true' : 'false');
            }
          }
        }
      } catch (err) {
        console.error('Background daily shutdown check failed:', err);
      }
    };

    checkRequirement();

    window.addEventListener('focus', checkRequirement);
    return () => {
      window.removeEventListener('focus', checkRequirement);
    };
  }, [user, initialFetchDone, sessions, habitCompletions, avoidanceCheckins, scheduledActivities, moodEntries, dailyShutdowns]);

  // Listen to custom event for manual trigger
  useEffect(() => {
    const handleManualTrigger = () => {
      setTargetDate(todayStr);
      setIsCatchUp(false);
      setIsCompleted(false);
      setIsOpen(true);
    };

    window.addEventListener('trigger-daily-shutdown', handleManualTrigger);
    return () => {
      window.removeEventListener('trigger-daily-shutdown', handleManualTrigger);
    };
  }, [todayStr]);

  const handleDismiss = async () => {
    localStorage.setItem(`dude-shutdown-dismissed-${targetDate}`, 'true');
    setIsOpen(false);
    if (user) {
      await addDailyShutdown(user.id, targetDate, 'dismissed');
    }
  };

  const handleCompleteShutdown = async () => {
    localStorage.setItem(`dude-shutdown-completed-${targetDate}`, 'true');
    setIsCompleted(true);
    if (user) {
      await addDailyShutdown(user.id, targetDate, 'completed');
    }
    setTimeout(() => {
      setIsOpen(false);
    }, 1800);
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

  const handleConfirmShutdown = async () => {
    setShowConfirmPopup(false);
    await handleCompleteShutdown();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div 
        onClick={handleDismiss}
        className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-base/80 backdrop-blur-md cursor-pointer"
      >
        <motion.div
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="relative w-full max-w-xl overflow-y-auto max-h-[92vh] style-scrollbar rounded-3xl bg-surface-2/95 border border-border-custom p-6 sm:p-10 shadow-2xl text-center cursor-default"
        >
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full blur-[80px] bg-green/10 pointer-events-none" />

          {/* Close button top right */}
          <button
            onClick={handleDismiss}
            className="absolute top-4 right-4 p-2 text-text-dim/40 hover:text-text hover:bg-white/5 rounded-full transition-colors cursor-pointer"
            title="Fechar sem revisar"
          >
            <X size={16} />
          </button>

          <AnimatePresence mode="wait">
            {isCompleted ? (
              <motion.div 
                key="completed-state"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-10 gap-4"
              >
                <div className="w-16 h-16 rounded-full bg-green/10 flex items-center justify-center text-green shadow-[0_0_30px_rgba(110,231,168,0.25)] animate-pulse">
                  <Check size={32} strokeWidth={3} />
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-text tracking-tight mt-2">
                  Dia fechado com sucesso!
                </h3>
                <p className="text-sm text-green font-medium tracking-wide">
                  Bom descanso, {firstName}. Amanhã é uma nova página. 💤
                </p>
              </motion.div>
            ) : (
              <motion.div 
                key="interactive-state"
                className="flex flex-col items-center gap-5 sm:gap-6 relative z-10 text-left w-full"
              >
                {/* Header Icon */}
                <div className="mx-auto w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-green/10 flex items-center justify-center text-green shadow-[0_0_20px_rgba(110,231,168,0.15)]">
                  <Moon size={18} className="fill-green/10 sm:scale-110" />
                </div>

                {/* Subtitle / Title */}
                <div className="space-y-1.5 text-center w-full">
                  <span className="text-[9px] sm:text-[10px] font-mono font-bold uppercase tracking-[0.25em] text-green block">
                    FECHAMENTO DO DIA
                  </span>
                  <h3 className="text-lg sm:text-2xl font-mono font-black text-text tracking-tight uppercase animate-fade-in">
                    {isCatchUp ? `Você não fechou ontem, ${firstName}.` : `Hora de fechar o dia, ${firstName}.`}
                  </h3>
                  <p className="text-[11px] sm:text-xs text-text-dim font-light max-w-md mx-auto">
                    {isCatchUp 
                      ? "Seu resumo e ritual com foco e clareza."
                      : "Tranque as tarefas de hoje, sinta orgulho do progresso e durma limpo."}
                  </p>
                </div>

                {/* TODAY STATS SUMMARY ROW */}
                <div className="grid grid-cols-3 gap-2 w-full p-3 rounded-2xl bg-surface-1/40 border border-border-custom/50 text-center">
                  <div className="space-y-0.5">
                    <span className="text-[8px] font-bold uppercase tracking-wider text-text-dim/40">
                      {isCatchUp ? 'Foco Ontem' : 'Foco Hoje'}
                    </span>
                    <span className="text-xs sm:text-sm font-mono font-bold text-text block">
                      {formatDuration(totalMinutes)}
                    </span>
                  </div>
                  <div className="space-y-0.5 border-l border-r border-white/5">
                    <span className="text-[8px] font-bold uppercase tracking-wider text-text-dim/40">Sessões SP</span>
                    <span className="text-xs sm:text-sm font-mono font-bold text-text block">
                      {todaySessions.length}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[8px] font-bold uppercase tracking-wider text-text-dim/40">Meta Batida</span>
                    <span className="text-xs sm:text-sm font-mono font-bold text-green block">
                      {percent >= 100 ? '100% ✓' : `${percent}%`}
                    </span>
                  </div>
                </div>

                {/* Optional Mood Display */}
                {todayMoodObj && (
                  <div className="mx-auto flex items-center gap-1.5 px-3 py-1 bg-white/[0.02] border border-white/5 rounded-full text-[10px] text-text-dim">
                    <span>Sintonia do dia:</span>
                    <span className="text-xs">{todayMoodObj.emoji}</span>
                    <span className="font-bold text-text uppercase tracking-wider text-[9px]">{todayMoodObj.label}</span>
                  </div>
                )}

                {/* TIME BY PROJECT SUMMARY (THE NEW MAIN summary) */}
                <div className="w-full space-y-2.5 text-left">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-text-dim/50 block">
                    Tempo por Projeto
                  </span>
                  
                  {timeByProject.length > 0 ? (
                    <div className="space-y-2">
                      {timeByProject.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-white/[0.02] border border-white/[0.05] rounded-xl px-4 py-3 hover:bg-white/[0.03] transition-all">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Folder size={12} className="text-green shrink-0" />
                            <span className="text-xs font-semibold text-text truncate">{item.name}</span>
                          </div>
                          <span className="text-xs font-mono font-black text-text-dim shrink-0">{formatDuration(item.minutes)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-6 text-center bg-white/[0.01] border border-white/[0.04] rounded-2xl">
                      <p className="text-xs font-medium text-text-dim/50 font-sans">Nenhuma sessão associada a projetos hoje.</p>
                    </div>
                  )}
                </div>

                {/* VER TODAS SESSÕES PROFUNDAS REGISTRADAS (ON-DEMAND DETAILED LIST) */}
                <div className="w-full">
                  <button
                    type="button"
                    onClick={() => setShowAllSessions(!showAllSessions)}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-white/[0.06] hover:border-white/10 bg-white/[0.01] hover:bg-white/[0.03] text-xs font-bold text-text-dim transition-all select-none cursor-pointer"
                  >
                    <span className="font-mono uppercase tracking-wider text-left block">Ver todas sessões profundas registradas</span>
                    {showAllSessions ? <ChevronUp size={14} className="text-text-dim shrink-0 ml-2" /> : <ChevronDown size={14} className="text-text-dim shrink-0 ml-2" />}
                  </button>
                  
                  {showAllSessions && (
                    <div className="mt-2 space-y-2 max-h-48 overflow-y-auto style-scrollbar pr-1 text-left">
                      {todaySessions.length > 0 ? (
                        todaySessions.map((s) => {
                          const rangeStr = s.started_at ? formatTimeRange(s.started_at, s.completed_at, s.actual_duration_minutes || s.duration_minutes) : '';
                          return (
                            <div key={s.id} className="flex justify-between items-center p-3 rounded-xl bg-white/[0.01] border border-white/[0.03] animate-fade-in hover:bg-white/[0.02] transition-colors">
                              <div className="flex flex-col min-w-0 pr-2">
                                <span className="text-xs font-bold text-text truncate">🎯 {s.activity_name || 'Sessão de Foco'}</span>
                                {rangeStr && <span className="text-[10px] text-text-dim/50 font-mono mt-0.5">{rangeStr}</span>}
                              </div>
                              <span className="text-xs font-mono font-bold text-text-dim shrink-0">
                                {formatDuration(s.actual_duration_minutes || s.duration_minutes)}
                              </span>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-xs text-text-dim/50 italic text-center py-2 font-sans">Nenhuma sessão registrada.</p>
                      )}
                    </div>
                  )}
                </div>

                {/* PRIMARY ACTION BUTTONS - PROMINENT ENCERRAR AND VOLTAR */}
                <div className="flex flex-col gap-3 w-full mt-4">
                  <button
                    type="button"
                    onClick={() => setShowConfirmPopup(true)}
                    className="w-full py-4 bg-green hover:bg-green/95 active:scale-[0.99] hover:brightness-110 text-surface-2 rounded-2xl font-mono font-bold uppercase tracking-wider text-xs transition-all flex items-center justify-center gap-2 select-none cursor-pointer shadow-lg shadow-green/5"
                  >
                    <span>🔒</span>
                    <span>Encerrar dia</span>
                  </button>
                  
                  <button
                    type="button"
                    onClick={handleDismiss}
                    className="w-full py-4 border border-white/10 hover:bg-white/[0.03] active:scale-[0.99] text-text-dim hover:text-text rounded-2xl font-mono font-bold uppercase tracking-wider text-xs transition-all flex items-center justify-center gap-2 select-none cursor-pointer"
                  >
                    <span>←</span>
                    <span>Voltar ao painel</span>
                  </button>
                </div>

              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* CONFIRMATION POPUP FOR THE RITUAL */}
      {showConfirmPopup && (
        <div className="fixed inset-0 z-[700] flex items-center justify-center p-4 bg-base/95 backdrop-blur-md">
          <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-surface-2 border border-border-custom p-6 sm:p-8 shadow-2xl text-center">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 rounded-full blur-[60px] bg-green/10 pointer-events-none" />
            
            {/* Icon */}
            <div className="mx-auto w-12 h-12 rounded-2xl bg-green/10 flex items-center justify-center text-green mb-4">
              <Moon size={20} className="fill-green/10" />
            </div>
            
            <h4 className="text-base font-mono font-bold text-text uppercase tracking-wider mb-2">
              Encerrar Ritual do Dia?
            </h4>
            
            <p className="text-xs sm:text-sm text-text-dim font-sans leading-relaxed text-left mb-6 bg-white/[0.02] p-4 rounded-2xl border border-white/5">
              Fechar seu dia marca o encerramento da sua jornada de hoje — você vê seu resumo e descansa tranquilo. Se voltar a focar ainda hoje, suas sessões continuam contando normalmente. Amanhã, seu dia recomeça do zero.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3 w-full">
              <button
                type="button"
                onClick={handleConfirmShutdown}
                className="flex-1 py-3.5 bg-green hover:brightness-110 text-surface-2 rounded-xl font-mono font-bold uppercase tracking-wider text-xs transition-all cursor-pointer"
              >
                Confirmar
              </button>
              <button
                type="button"
                onClick={() => setShowConfirmPopup(false)}
                className="flex-1 py-3.5 border border-white/10 hover:bg-white/5 text-text-dim hover:text-text rounded-xl font-mono font-bold uppercase tracking-wider text-xs transition-all cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
};
