import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useDataStore } from '../../store/useDataStore';
import { useAuthStore } from '../../store/useAuthStore';
import { getLocalDateString, getLocalYesterdayDateString, getCurrentPeriodAndDate } from '../../lib/utils';
import { MOOD_LIST } from '../../lib/mood';
import { X, Moon, Check, CheckSquare, Square, Plus } from 'lucide-react';
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
    addDailyShutdown
  } = useDataStore();

  const [isOpen, setIsOpen] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
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
  }, [sessions]);

  const percent = dailyGoal > 0 ? Math.round((totalMinutes / dailyGoal) * 100) : 0;

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
          className="relative w-full max-w-xl overflow-hidden rounded-3xl bg-surface-2/95 border border-border-custom p-6 sm:p-10 shadow-2xl text-center cursor-default"
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
                      ? "Um resumo rápido de ontem para manter suas estatísticas organizadas."
                      : "Um resumo rápido de hoje antes de deitar e recuperar as energias."}
                  </p>
                </div>

                {/* TODAY STATS SUMMARY ROW */}
                <div className="grid grid-cols-3 gap-2 w-full p-3 rounded-2xl bg-surface-1/40 border border-border-custom/50 text-center">
                  <div className="space-y-0.5">
                    <span className="text-[8px] font-bold uppercase tracking-wider text-text-dim/40">
                      {isCatchUp ? 'Foco Ontem' : 'Foco Hoje'}
                    </span>
                    <span className="text-xs sm:text-sm font-mono font-bold text-text block">
                      {totalMinutes >= 60 
                        ? `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m` 
                        : `${totalMinutes} min`
                      }
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

                {/* FIX FOR UNMARKED TASKS BLOCK */}
                <div className="w-full space-y-3 mt-1">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-text-dim/60">
                      Checklist de atividades
                    </span>
                    <span className="text-[9px] text-text-dim/40 font-mono">
                      {incompleteSessions.length > 0 ? `${incompleteSessions.length} pendentes` : 'Tudo em dia'}
                    </span>
                  </div>

                  {incompleteSessions.length > 0 ? (
                    <div className="space-y-3 max-h-[180px] overflow-y-auto style-scrollbar pr-1">
                      <p className="text-[10px] text-coral/80 font-medium">
                        ⚠️ Você fez {incompleteSessions.length} {incompleteSessions.length === 1 ? 'sessão' : 'sessões'} sem registrar o que avançou. Quer completar agora de forma rápida?
                      </p>

                      {incompleteSessions.map(session => {
                        const tasks = sessionTasks.filter(t => t.session_id === session.id);
                        return (
                          <div 
                            key={session.id} 
                            className="bg-white/[0.01] border border-white/5 rounded-xl p-3 space-y-2.5"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-text tracking-wide truncate max-w-[200px]">
                                🎯 {session.activity_name || 'Sessão de Foco'}
                              </span>
                              <span className="text-[9px] font-mono text-text-dim/60 shrink-0">
                                {session.actual_duration_minutes || session.duration_minutes} min
                              </span>
                            </div>

                            {/* Render associated tasks if any */}
                            {tasks.length > 0 && (
                              <div className="space-y-1.5 pl-1">
                                {tasks.map(t => (
                                  <button
                                    key={t.id}
                                    onClick={() => toggleSessionTask(t.id)}
                                    className="flex items-center gap-2 text-[11px] font-sans text-text-dim/80 hover:text-text cursor-pointer transition-colors w-full text-left"
                                  >
                                    {t.completed ? (
                                      <CheckSquare size={13} className="text-green shrink-0" />
                                    ) : (
                                      <Square size={13} className="text-text-dim/40 shrink-0" />
                                    )}
                                    <span className={`${t.completed ? 'line-through text-text-dim/40' : ''}`}>
                                      {t.description}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            )}

                            {/* Inline quick-add completed task */}
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                value={taskInputs[session.id] || ''}
                                onChange={(e) => setTaskInputs(prev => ({ ...prev, [session.id]: e.target.value }))}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleAddTaskInline(session.id);
                                }}
                               placeholder="O que você avançou nesta sessão?"
                               className="flex-1 bg-surface-1/50 border border-border-custom/50 rounded-lg px-2.5 py-1 text-[11px] text-text focus:outline-none focus:border-green transition-all"
                              />
                              <button
                                onClick={() => handleAddTaskInline(session.id)}
                                className="p-1 h-7 rounded-lg bg-green/10 hover:bg-green/20 border border-green/20 text-green transition-all flex items-center justify-center cursor-pointer aspect-square"
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-4 text-center bg-green/5 border border-green/10 rounded-2xl">
                      <p className="text-xs font-semibold text-green flex items-center justify-center gap-1.5">
                        <span>Tudo registrado. 👏 Noite limpa e produtiva!</span>
                      </p>
                    </div>
                  )}
                </div>

                {/* Primary Button Options */}
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full mt-4">
                  <button
                    onClick={handleCompleteShutdown}
                    className="w-full sm:flex-1 py-3.5 bg-green hover:brightness-105 active:scale-[0.98] transition-all rounded-xl font-bold uppercase tracking-wider text-[10px] text-center text-surface-2 cursor-pointer shadow-[0_4px_15px_rgba(110,231,168,0.2)]"
                  >
                    Fechar o dia com intenção
                  </button>

                  <button
                    onClick={handleDismiss}
                    className="w-full sm:w-auto px-6 py-3.5 border border-white/10 hover:bg-white/5 active:scale-[0.98] transition-all rounded-xl font-bold uppercase tracking-wider text-[10px] text-center text-text-dim cursor-pointer"
                  >
                    Fechar sem revisar
                  </button>
                </div>

              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
