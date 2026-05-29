import { useEffect, useState, useRef } from 'react';
import { useTimerStore } from '../../store/useTimerStore';
import { useDataStore } from '../../store/useDataStore';
import { useAuthStore } from '../../store/useAuthStore';
import { sendToServiceWorker, listenToServiceWorker } from '../../hooks/useServiceWorker';
import { useSessionNotifications } from '../../hooks/useSessionNotifications';
import { motion, AnimatePresence } from 'motion/react';
import { CustomSelect } from '../ui/CustomSelect';
import { Play, Pause, X, AlertTriangle, CheckCircle, StickyNote, Target, ListTodo, Pencil } from 'lucide-react';
import { resolverNomeSessao } from '../../lib/utils';
import { SessionTasksModal } from '../session/SessionTasksModal';
import { SessionEditPanel } from '../session/SessionEditPanel';

export const ActiveSession = () => {
  const timer = useTimerStore();
  const dataStore = useDataStore();
  const { user } = useAuthStore();
  const [display, setDisplay] = useState("00:00:00");
  const [progress, setProgress] = useState(0);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const [showNotificationRequest, setShowNotificationRequest] = useState(true);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showEarlyCompleteConfirm, setShowEarlyCompleteConfirm] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showLateConfig, setShowLateConfig] = useState(false);
  const [showTasksOverlay, setShowTasksOverlay] = useState(false);
  const [sessionTasksLocal, setSessionTasksLocal] = useState<string[]>([]);
  const [completedTasksLocal, setCompletedTasksLocal] = useState<string[]>([]);
  const [showAllTasksDonePopup, setShowAllTasksDonePopup] = useState(false);
  const [allTasksCompletedTime, setAllTasksCompletedTime] = useState<number | null>(null);
  const [actualDurationMinutes, setActualDurationMinutes] = useState<number | null>(null);

  // Inline edit state in completion modal
  const [isEditingConclusao, setIsEditingConclusao] = useState(false);
  const [editedProjectId, setEditedProjectId] = useState<string | null>(null);
  const [editedActivityName, setEditedActivityName] = useState<string>('');
  const [editedHabitId, setEditedHabitId] = useState<string | null>(null);

  useEffect(() => {
    if (showCompleteModal) {
      setEditedProjectId(timer.projectId);
      setEditedActivityName(timer.activityName);
      setEditedHabitId(timer.habitId);
    } else {
      setIsEditingConclusao(false);
    }
  }, [showCompleteModal, timer.projectId, timer.activityName, timer.habitId]);
  
  // Late session config state
  const [lateProjectId, setLateProjectId] = useState(timer.projectId || '');
  const [lateActivityName, setLateActivityName] = useState(timer.activityName || '');

  // Note Creation State
  const [noteContent, setNoteContent] = useState('');
  const [noteProjectId, setNoteProjectId] = useState(timer.projectId || '');
  const [noteActivityId, setNoteActivityId] = useState('');

  const { triggerNotification } = useSessionNotifications();
  const hasObservedFinish = useRef(false);
  const hasObservedWarning = useRef(false);
  const wakeLockRef = useRef<any>(null);
  const timerStartedRef = useRef(false);

  const currentProjectName = dataStore.projects.find(p => p.id === timer.projectId)?.name || 'Projeto Padrão';
  
  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        // @ts-ignore
        wakeLockRef.current = await navigator.wakeLock.request('screen');
      }
    } catch (err) {
      console.log('Wake Lock não suportado:', err);
    }
  };

  const releaseWakeLock = async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      } catch (err) {
        wakeLockRef.current = null;
      }
    }
  };

  useEffect(() => {
    if (timer.isActive && !timer.isPaused) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && timer.isActive && !timer.isPaused) {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      releaseWakeLock();
    };
  }, [timer.isActive, timer.isPaused]);

  // SW Timer Logic
  useEffect(() => {
    if (timer.isActive && timer.startTime && !timerStartedRef.current) {
      timerStartedRef.current = true;
      const endTime = timer.startTime + (timer.totalDurationMs || 0);
      sendToServiceWorker('START_TIMER', {
        totalMs: timer.totalDurationMs,
        endTime: endTime,
        activity: timer.activityName,
        project: currentProjectName || 'Geral'
      });
    }
    if (!timer.isActive) {
      timerStartedRef.current = false;
    }
  }, [timer.isActive, timer.startTime]);

  // Sincroniza o endTime com SW a cada 30 segundos (resiliência)
  useEffect(() => {
    if (!timer.isActive) return;
    const syncInterval = setInterval(() => {
      const endTime = (timer.startTime || 0) + (timer.totalDurationMs || 0);
      sendToServiceWorker('SYNC_TIMER', {
        endTime,
        activity: timer.activityName,
        project: currentProjectName || 'Geral'
      });
    }, 30000);
    return () => clearInterval(syncInterval);
  }, [timer.isActive]);

  useEffect(() => {
    const unsubscribe = listenToServiceWorker((data) => {
      if (data.type === 'TIMER_COMPLETE') {
         if (!hasObservedFinish.current) {
           hasObservedFinish.current = true;
           triggerNotification('complete');
         }
         setShowCompleteModal(true);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!timer.isActive) {
      hasObservedFinish.current = false;
      hasObservedWarning.current = false;
      return;
    }

    const interval = setInterval(() => {
      const ms = timer.getRemainingMs();
      
      // Update Progress
      if (timer.totalDurationMs) {
        const elapsed = timer.totalDurationMs - ms;
        const p = (elapsed / timer.totalDurationMs) * 100;
        setProgress(Math.min(100, p));
      }

      // 5-minute warning (300000ms)
      if (ms <= 300000 && ms > 295000 && !hasObservedWarning.current && timer.isActive) {
        hasObservedWarning.current = true;
        triggerNotification('warning');
      }

      if (ms <= 0 && timer.isActive && !hasObservedFinish.current) {
        hasObservedFinish.current = true;
        
        // Vibrate and Play Sound
        triggerNotification('complete');
        
        setShowCompleteModal(true);
        timer.pause(); // Pause so it stays at 0
        return;
      }

      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      
      if (h > 0) {
        setDisplay(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
      } else {
        setDisplay(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [timer.isActive, timer.startTime, timer.totalDurationMs, timer.getRemainingMs, timer.isPaused]);

  useEffect(() => {
    if (timer.isActive && timer.pendingTasks.length > 0 && sessionTasksLocal.length === 0) {
      setSessionTasksLocal(timer.pendingTasks);
      timer.clearPendingTasks();
    }
  }, [timer.isActive, timer.pendingTasks]);

  useEffect(() => {
    if (
      sessionTasksLocal.length > 0 &&
      completedTasksLocal.length === sessionTasksLocal.length &&
      !showAllTasksDonePopup &&
      !allTasksCompletedTime
    ) {
      setAllTasksCompletedTime(Date.now());
      setShowAllTasksDonePopup(true);
    }
  }, [completedTasksLocal, sessionTasksLocal]);

  const handleSave = async () => {
    if (!user || !timer.totalDurationMs || isSaving) return;

    setIsSaving(true);

    const allDone = completedTasksLocal.length === sessionTasksLocal.length && sessionTasksLocal.length > 0;
    const targetMinutes = Math.round((timer.totalDurationMs || 0) / 60000);
    const actualMinutes = actualDurationMinutes !== null ? actualDurationMinutes : targetMinutes;

    const sessionToSave = {
      user_id: user.id,
      project_id: editedProjectId !== null ? editedProjectId : (timer.projectId || null),
      habit_id: editedHabitId !== null ? editedHabitId : (timer.habitId || null),
      activity_name: editedActivityName || timer.activityName || 'Sessão Sem Título',
      description: timer.description,
      duration_minutes: targetMinutes,
      started_at: new Date(timer.startTime || Date.now()).toISOString(),
      completed_at: new Date().toISOString(),
      completed: true,
      all_tasks_completed: allDone,
      actual_duration_minutes: actualMinutes,
      activity_id: timer.activityId || null,
      scheduled_activity_id: timer.scheduledActivityId || null,
    };

    const noteDescription = timer.description.trim();
    const noteProjectIdFix = (editedProjectId !== null ? editedProjectId : timer.projectId) || undefined;

    try {
      const savedSession = await dataStore.addSession(sessionToSave);

      if (savedSession?.id) {
        // Se houver uma atividade agendada vinculada, marcá-la como concluída
        if (timer.scheduledActivityId) {
          await dataStore.updateScheduledActivity(timer.scheduledActivityId, {
            status: 'completed',
            completed_session_id: savedSession.id
          });
        }
        if (sessionTasksLocal.length > 0) {
          for (const task of sessionTasksLocal) {
            await dataStore.addSessionTask(
              savedSession.id,
              user.id,
              task,
              completedTasksLocal.includes(task)
            );
          }
        }

        // Determine context for pending tasks
        let contextHabitId: string | null = null;
        let contextActivityId: string | null = null;
        let contextAvulsa: string | null = null;

        const currentHabitId = editedHabitId !== null ? editedHabitId : (timer.habitId || null);
        if (currentHabitId) {
          contextHabitId = currentHabitId;
        } else if (timer.activityId) {
          contextActivityId = timer.activityId;
        } else {
          contextAvulsa = sessionToSave.activity_name;
        }

        const isPartial = actualMinutes < targetMinutes;
        const hasContext = !!(contextHabitId || contextActivityId || (contextAvulsa && contextAvulsa.trim().length > 0 && contextAvulsa.trim() !== 'Sessão Sem Título'));

        // REGRA 1 — Se incompleta (parcial: true), salvar não concluídas em pending_tasks
        if (isPartial && hasContext) {
          const uncompletedTasks = sessionTasksLocal.filter(task => !completedTasksLocal.includes(task));
          for (const taskText of uncompletedTasks) {
            await dataStore.addPendingTask({
              user_id: user.id,
              habit_id: contextHabitId,
              activity_id: contextActivityId,
              atividade_avulsa: contextAvulsa ? contextAvulsa.trim() : null,
              description: taskText,
              origin_session_id: savedSession.id
            });
          }
        } else if (isPartial && !hasContext) {
          console.warn('Sessão incompleta sem contexto identificável. Tarefas pendentes não serão persistidas.');
        }

        // REGRA 2 — Se houver tarefas concluídas, deletá-las de pending_tasks
        if (completedTasksLocal.length > 0 && hasContext) {
          await dataStore.deletePendingTasksByDescription(completedTasksLocal, {
            habit_id: contextHabitId,
            activity_id: contextActivityId,
            atividade_avulsa: contextAvulsa ? contextAvulsa.trim() : null
          });
        }
      }

      // Save auto-note if present
      if (noteDescription) {
        await dataStore.addNote(
          user.id,
          noteDescription,
          noteProjectIdFix,
          undefined
        );
      }
      
      if (!dataStore.hasCompletedFirstSession) {
        dataStore.completeFirstSession();
      }
    } catch (err) {
      console.error("Erro ao salvar sessão:", err);
    } finally {
      setSessionTasksLocal([]);
      setCompletedTasksLocal([]);
      setActualDurationMinutes(null);
      setAllTasksCompletedTime(null);
      setIsEditingConclusao(false);
      setEditedProjectId(null);
      setEditedActivityName('');
      setEditedHabitId(null);
      setShowCompleteModal(false);
      timer.reset();
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    sendToServiceWorker('CANCEL_TIMER');
    timer.reset();
    setShowCancelConfirm(false);
    setShowEarlyCompleteConfirm(false);
    setShowDiscardConfirm(false);
    setShowCompleteModal(false);
    setShowNoteModal(false);
  };

  const handleAddNote = async () => {
    if (!user || !noteContent) return;
    
    // Save note
    const content = noteContent;
    const pId = noteProjectId || timer.projectId || undefined;
    const aId = noteActivityId || undefined;
    
    // Clear and close immediately
    setNoteContent('');
    setShowNoteModal(false);

    await dataStore.addNote(
      user.id, 
      content, 
      pId,
      aId
    );
  };

  const handleUpdateLateConfig = () => {
    timer.updateConfig(lateProjectId, undefined, lateActivityName);
    setShowLateConfig(false);
  };

  const handleEarlyComplete = () => {
    const elapsedMs = (timer.totalDurationMs || 0) - timer.getRemainingMs();
    const actualMinutes = Math.max(1, Math.round(elapsedMs / 60000));
    setActualDurationMinutes(actualMinutes);
    setShowEarlyCompleteConfirm(false);
    setShowCompleteModal(true); // abre popup normal de confirmação
  };

  const handleRequestPermission = () => {
    if (typeof Notification !== 'undefined') {
      Notification.requestPermission().then(permission => {
        setNotificationPermission(permission);
        setShowNotificationRequest(false);
      });
    }
  };

  if (!timer.isActive && !showCompleteModal) return null;

  const currentHabitName = dataStore.habits.find(h => h.id === timer.habitId)?.name;

  return (
    <div className="fixed inset-0 z-[1000] bg-background/95 backdrop-blur-3xl flex flex-col overflow-hidden">
      {isSaving && (
        <div className="absolute inset-0 z-[1500] bg-background/90 backdrop-blur-3xl flex flex-col items-center justify-center space-y-4 pointer-events-auto">
          <div className="w-12 h-12 rounded-full border-t-2 border-primary-green animate-spin" />
          <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-primary-green animate-pulse">
            Registrando Sessão Operacional...
          </span>
        </div>
      )}

      <AnimatePresence mode="wait">
        {timer.isActive && (
          <motion.div
            layout={false}
            key="active-session"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-between py-20 px-6"
          >
            {/* Notification Permission Request */}
            {notificationPermission !== 'granted' && showNotificationRequest && (
              <motion.div 
                layout={false}
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute top-10 flex flex-col md:flex-row items-center gap-4 px-6 py-3 bg-white/5 border border-white/5 rounded-2xl backdrop-blur-md z-[1001]"
              >
                <p className="text-[10px] text-text-secondary/60 font-medium tracking-wide">
                  Ative as notificações para receber alertas durante sua sessão.
                </p>
                <div className="flex items-center gap-4">
                  <button 
                    onClick={handleRequestPermission}
                    className="text-[10px] font-bold text-primary-green uppercase tracking-widest hover:text-glow-green transition-colors min-h-[44px]"
                  >
                    Ativar Notificações
                  </button>
                  <button 
                    onClick={() => setShowNotificationRequest(false)}
                    className="text-[10px] font-bold text-text-secondary/40 uppercase tracking-widest hover:text-text-secondary transition-colors min-h-[44px]"
                  >
                    Agora Não
                  </button>
                </div>
              </motion.div>
            )}

            {/* 1. Header Activity Info */}
            {timer.habitId ? (
              <div className="flex flex-col items-center gap-1">
                <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary-green/60 flex items-center gap-1">
                  ⚡ Sessão Hábito Atômico
                </span>
                <h2 className="text-4xl font-bold text-text-primary tracking-tight text-center">
                  {dataStore.habits.find(h => h.id === timer.habitId)?.name || 'Hábito'}
                </h2>
                {timer.projectId && (
                  <span className="text-[10px] font-bold uppercase tracking-widest text-text-secondary/40">
                    {dataStore.projects.find(p => p.id === timer.projectId)?.name}
                  </span>
                )}
              </div>
            ) : (
              // Mantém o layout atual para sessões sem hábito
              <div className="flex flex-col items-center gap-1">
                <h2 className="text-4xl font-bold text-text-primary tracking-tight text-center">
                  {timer.activityName || 'Sessão Sem Título'}
                </h2>
                {timer.projectId && (
                  <span className="text-[10px] font-bold uppercase tracking-widest text-text-secondary/40">
                    {dataStore.projects.find(p => p.id === timer.projectId)?.name}
                  </span>
                )}
              </div>
            )}

            {/* Botão VER TAREFAS ou + ADICIONAR TAREFA */}
            <div className="flex justify-center mt-4 mb-2">
              <button
                onClick={() => setShowTasksOverlay(true)}
                className="flex items-center gap-2 px-4 py-2 hover:bg-primary-green/15 transition-all duration-200 cursor-pointer text-[#6ee7b7]"
                style={{
                  borderRadius: '999px',
                  backgroundColor: 'rgba(110, 231, 183, 0.08)',
                  border: '0.5px solid rgba(110, 231, 183, 0.25)',
                  fontSize: '10px',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  fontWeight: 500,
                }}
              >
                <ListTodo size={12} className="shrink-0" />
                <span>{sessionTasksLocal.length > 0 ? 'VER TAREFAS' : '+ ADICIONAR TAREFA'}</span>
                {sessionTasksLocal.length > 0 && (
                  <span
                    className="ml-1 text-[9px] font-bold text-[#6ee7b7]"
                    style={{
                      backgroundColor: 'rgba(110, 231, 168, 0.2)',
                      padding: '2px 6px',
                      borderRadius: '999px',
                    }}
                  >
                    {completedTasksLocal.length}/{sessionTasksLocal.length}
                  </span>
                )}
              </button>
            </div>

            {/* 2. Central Timer Display */}
            <div className="relative flex flex-col items-center justify-center w-full max-w-5xl">
              <h1 className="text-[18vw] md:text-[14rem] font-medium tabular-nums tracking-tighter leading-none text-primary-green drop-shadow-[0_0_80px_rgba(110,231,168,0.2)]">
                {display}
              </h1>
              {timer.isPaused && (
                <motion.span 
                  layout={false}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute -bottom-10 text-red-400 font-bold uppercase tracking-[0.5em] text-xs"
                >
                  Sessão Pausada
                </motion.span>
              )}
            </div>

            {/* 3. Progress Bar */}
            <div className="w-full max-w-md space-y-4">
              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                <motion.div 
                  layout={false}
                  className="h-full bg-primary-green shadow-[0_0_15px_rgba(110,231,168,0.5)]"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5, ease: "linear" }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-bold text-text-secondary/40 uppercase tracking-widest">
                <span>Início</span>
                <span>{progress.toFixed(0)}% Concluído</span>
                <span>Alvo</span>
              </div>
            </div>

            {/* 4. Action Buttons */}
            <div className="grid grid-cols-2 md:grid-cols-4 items-center gap-4 md:gap-6 w-full max-w-2xl px-4">
              <button 
                onClick={() => setShowNoteModal(true)}
                className="flex items-center justify-center gap-2 px-4 py-5 bg-surface/40 border border-border-white rounded-2xl text-text-primary text-[10px] font-bold uppercase tracking-widest hover:bg-surface/60 transition-all min-h-[44px] touch-manipulation col-span-1"
              >
                <StickyNote size={14} className="text-primary-green" />
                Anotar
              </button>

              <button 
                onClick={() => {
                  if (timer.isPaused) {
                    timer.resume();
                    sendToServiceWorker('RESUME_TIMER');
                  } else {
                    timer.pause();
                    sendToServiceWorker('PAUSE_TIMER');
                  }
                }}
                className={`flex items-center justify-center gap-2 px-4 py-5 border rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all min-h-[44px] touch-manipulation col-span-1 ${
                  timer.isPaused 
                    ? "bg-primary-green text-background border-primary-green hover:bg-glow-green" 
                    : "bg-surface/40 border-border-white text-text-primary hover:bg-surface/60"
                }`}
              >
                {timer.isPaused ? <Play size={14} fill="currentColor" /> : <Pause size={14} fill="currentColor" />}
                {timer.isPaused ? "Retomar" : "Pausar"}
              </button>

              <button 
                onClick={() => setShowEarlyCompleteConfirm(true)}
                className="flex items-center justify-center gap-2 px-4 py-5 border border-amber-500/30 text-amber-400 text-[10px] font-bold uppercase tracking-widest hover:bg-amber-500/10 transition-all min-h-[44px] touch-manipulation col-span-1"
              >
                <CheckCircle size={14} />
                Encerrar
              </button>

              <button 
                onClick={() => setShowCancelConfirm(true)}
                className="flex items-center justify-center gap-2 px-4 py-5 border border-red-500/20 text-red-400 text-[10px] font-bold uppercase tracking-widest hover:bg-red-500/10 transition-all min-h-[44px] touch-manipulation col-span-1"
              >
                <X size={14} />
                Cancelar
              </button>

              <button
                onClick={() => setShowLateConfig(true)}
                className="col-span-2 md:col-span-4 text-[9px] text-text-secondary/30 hover:text-text-secondary/60 transition-colors underline underline-offset-2 mt-2 touch-manipulation pb-4 text-center"
              >
                Esqueceu de configurar Projeto e Atividade? Configura aqui!
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Late Config Modal */}
      <AnimatePresence>
        {showLateConfig && (
          <motion.div
            layout={false}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1100] bg-background/90 backdrop-blur-3xl flex items-center justify-center p-6"
          >
            <motion.div
              layout={false}
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              style={{ willChange: 'transform' }}
              className="bg-surface border border-border-white p-8 rounded-[2.5rem] max-w-sm w-full space-y-6 shadow-[0_50px_100px_rgba(0,0,0,0.5)]"
            >
              <h3 className="text-xl font-semibold text-text-primary text-center">Configurar Sessão</h3>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary/40">Projeto</label>
                  <CustomSelect
                    value={lateProjectId}
                    onChange={val => setLateProjectId(val)}
                    placeholder="Sem Projeto"
                    options={[
                      { value: '', label: 'Sem Projeto' },
                      ...dataStore.projects.map(p => ({ value: p.id, label: p.name }))
                    ]}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary/40">Atividade</label>
                  <input
                    placeholder="O que está fazendo?"
                    autoComplete="off" enterKeyHint="done"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-text-primary outline-none focus:border-primary-green min-h-[44px]"
                    value={lateActivityName}
                    onChange={e => setLateActivityName(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setShowLateConfig(false)}
                  className="flex-1 py-3 border border-white/10 rounded-xl text-[10px] font-bold uppercase tracking-widest text-text-secondary min-h-[44px]"
                >
                  Voltar
                </button>
                <button 
                  onClick={handleUpdateLateConfig}
                  className="flex-1 py-3 bg-primary-green text-background rounded-xl text-[10px] font-bold uppercase tracking-widest min-h-[44px]"
                >
                  Salvar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showNoteModal && (
          <motion.div
            layout={false}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1100] bg-background/90 backdrop-blur-3xl flex items-center justify-center p-6"
          >
            <motion.div
              layout={false}
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              style={{ willChange: 'transform' }}
              className="bg-surface border border-border-white p-8 md:p-12 rounded-[2.5rem] max-w-xl w-full space-y-10 shadow-[0_50px_100px_rgba(0,0,0,0.5)]"
            >
              <div className="flex justify-between items-center border-b border-white/5 pb-2">
                <h3 className="text-2xl font-semibold tracking-tight text-text-primary flex items-center gap-3">
                  <StickyNote className="text-primary-green" /> Registro Rápido
                </h3>
              </div>

              <div className="flex flex-col gap-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary/40">Projeto</label>
                    <CustomSelect
                      value={noteProjectId}
                      onChange={val => setNoteProjectId(val)}
                      placeholder="Sem Projeto"
                      options={[
                        { value: '', label: 'Sem Projeto' },
                        ...dataStore.projects.map(p => ({ value: p.id, label: p.name }))
                      ]}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary/40">Atividade</label>
                    <CustomSelect
                      value={noteActivityId}
                      onChange={val => setNoteActivityId(val)}
                      placeholder="Sem Atividade"
                      options={[
                        { value: '', label: 'Sem Atividade' },
                        ...dataStore.activities
                          .filter(a => !noteProjectId || a.project_id === noteProjectId)
                          .map(a => ({ value: a.id, label: a.name }))
                      ]}
                    />
                  </div>
                </div>

                <div className="text-left py-2">
                   <p className="text-[10px] font-bold text-primary-green/60 uppercase tracking-widest flex items-center gap-2">
                     📅 {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                   </p>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary/40">Anotação</label>
                  <textarea
                    placeholder="O que precisa registrar agora?"
                    autoComplete="off" autoCorrect="off" enterKeyHint="send" inputMode="text"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleAddNote();
                      }
                    }}
                    className="w-full bg-surface/40 border border-border-white rounded-2xl p-6 text-lg font-light text-text-primary outline-none focus:border-primary-green h-40 resize-none touch-manipulation min-h-[44px]"
                    value={noteContent}
                    onChange={e => setNoteContent(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setShowNoteModal(false)}
                  className="flex-1 py-5 border border-white/10 rounded-2xl font-bold uppercase tracking-widest text-xs text-text-secondary hover:text-white transition-all min-h-[44px]"
                >
                  ← Voltar
                </button>
                <button
                  disabled={!noteContent}
                  onClick={handleAddNote}
                  className="flex-[2] py-5 bg-primary-green text-background rounded-2xl font-bold uppercase tracking-widest text-xs hover:bg-glow-green transition-all disabled:opacity-20 min-h-[44px] shadow-[0_20px_40px_rgba(110,231,168,0.2)]"
                >
                  Salvar Anotação
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Completion Modal */}
      <AnimatePresence>
        {showCompleteModal && !showDiscardConfirm && (
          <motion.div
            layout={false}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1200] bg-background/95 backdrop-blur-3xl flex items-center justify-center p-6"
          >
            <motion.div
              layout={false}
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              style={{ willChange: 'transform' }}
              className="bg-surface border border-border-white p-8 md:p-12 rounded-[2.5rem] md:rounded-[3rem] max-w-lg w-full text-center space-y-10 shadow-[0_0_100px_rgba(110,231,168,0.1)] transform translate-z-0"
            >
              <div className="w-20 h-20 md:w-24 md:h-24 bg-primary-green/10 text-primary-green rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={48} />
              </div>
              
              <div className="space-y-4">
                <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-text-primary">Sessão Concluída!</h2>
                <p className="text-text-secondary font-light text-base md:text-lg">Excelente progresso. Deseja registrar esta sessão no seu histórico?</p>
              </div>

              {isEditingConclusao ? (
                <SessionEditPanel
                  initialProjectId={editedProjectId}
                  initialActivityName={editedActivityName}
                  initialHabitId={editedHabitId}
                  initialTasks={sessionTasksLocal}
                  initialCompletedTasks={completedTasksLocal}
                  projects={dataStore.projects}
                  habits={dataStore.habits}
                  activities={dataStore.activities}
                  onSave={(proj, act, hab, tsks, comps) => {
                    setEditedProjectId(proj);
                    setEditedActivityName(act);
                    setEditedHabitId(hab);
                    setSessionTasksLocal(tsks);
                    setCompletedTasksLocal(comps);
                    setIsEditingConclusao(false);
                  }}
                  onCancel={() => {
                    setIsEditingConclusao(false);
                  }}
                />
              ) : (
                <>
                  {(() => {
                    const resolved = resolverNomeSessao(
                      {
                        habit_id: editedHabitId !== null ? editedHabitId : timer.habitId,
                        project_id: editedProjectId !== null ? editedProjectId : timer.projectId,
                        activity_name: editedActivityName || timer.activityName
                      },
                      dataStore.habits,
                      dataStore.projects
                    );
                    return (
                      <div className="relative p-4 md:p-6 bg-white/5 rounded-3xl space-y-2 text-center">
                        <button
                          type="button"
                          onClick={() => setIsEditingConclusao(true)}
                          className="absolute top-[10px] right-[10px] text-[#6a7570] hover:text-white transition-colors cursor-pointer p-1"
                          title="Editar Detalhes"
                        >
                          <Pencil size={14} />
                        </button>

                        <p className="text-xl md:text-2xl font-light text-text-primary tracking-tight">{resolved.titulo}</p>
                        <p className="text-[9px] md:text-[10px] font-bold text-primary-green uppercase tracking-[0.3em]">
                           {resolved.projeto}
                        </p>
                        {(editedHabitId !== null ? editedHabitId : timer.habitId) && (() => {
                          const habit = dataStore.habits.find(h => h.id === (editedHabitId !== null ? editedHabitId : timer.habitId));
                          const minutesRealized = actualDurationMinutes !== null ? actualDurationMinutes : Math.round((timer.totalDurationMs || 0) / 60000);
                          const targetMinutes = habit?.minutes_per_session || 0;
                          return (
                            <p className={`text-xs font-bold uppercase mt-2 tracking-widest ${minutesRealized >= targetMinutes ? 'text-primary-green' : 'text-amber-400'}`}>
                              Progresso de Hoje: {minutesRealized} / {targetMinutes} min
                            </p>
                          );
                        })()}
                      </div>
                    );
                  })()}

                  {sessionTasksLocal.length > 0 && (
                    <div className="space-y-3 text-left border-t border-white/5 pt-6">
                      <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest block mb-1">
                        Tarefas da Sessão
                      </label>
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {sessionTasksLocal.map((task, i) => {
                          const isDone = completedTasksLocal.includes(task);
                          return (
                            <label
                              key={i}
                              className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5 hover:border-primary-green/20 cursor-pointer transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={isDone}
                                onChange={() => {
                                  if (isDone) {
                                    setCompletedTasksLocal(completedTasksLocal.filter(t => t !== task));
                                  } else {
                                    setCompletedTasksLocal([...completedTasksLocal, task]);
                                  }
                                }}
                                className="w-4 h-4 rounded border-white/10 text-primary-green bg-transparent focus:ring-0 cursor-pointer"
                              />
                              <span className={`text-xs ${isDone ? 'line-through text-text-secondary/50 font-light' : 'text-text-primary'}`}>
                                {task}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
              
              <div className="flex flex-col gap-4">
                <button
                  onClick={handleSave}
                  className="w-full py-5 md:py-6 bg-primary-green text-background rounded-2xl font-bold uppercase tracking-[0.2em] text-xs hover:bg-glow-green shadow-[0_0_30px_rgba(110,231,168,0.3)] transition-all min-h-[44px] touch-manipulation"
                >
                  Registrar Sessão
                </button>
                <button
                  onClick={() => setShowDiscardConfirm(true)}
                  className="w-full py-2 text-text-secondary/40 hover:text-red-400 font-bold uppercase tracking-widest text-[10px] transition-colors min-h-[44px] touch-manipulation"
                >
                  Descartar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Discard Confirmation Modal */}
      <AnimatePresence>
        {showDiscardConfirm && (
          <motion.div
            layout={false}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1300] bg-background/95 backdrop-blur-xl flex items-center justify-center p-6"
          >
            <motion.div
              layout={false}
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-surface border border-border-white p-10 rounded-[2.5rem] max-w-md w-full text-center space-y-8 shadow-[0_0_80px_rgba(0,0,0,0.5)]"
            >
              <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto">
                <AlertTriangle size={24} />
              </div>
              <div className="space-y-4">
                <h3 className="text-2xl font-semibold tracking-tight text-text-primary">Tem certeza?</h3>
                <p className="text-text-secondary font-light">Essa sessão não será salva e seu progresso será perdido.</p>
              </div>
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleCancel}
                  className="w-full py-4 bg-red-500 text-white rounded-2xl font-bold uppercase tracking-widest text-xs hover:bg-red-400 transition-all"
                >
                  Sim, descartar
                </button>
                <button
                  onClick={() => setShowDiscardConfirm(false)}
                  className="w-full py-4 bg-white/5 border border-white/10 text-text-secondary rounded-2xl font-bold uppercase tracking-widest text-xs transition-all"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Early Completion Confirmation Modal */}
      <AnimatePresence>
        {showEarlyCompleteConfirm && (
          <motion.div
            layout={false}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1100] bg-background/90 backdrop-blur-xl flex items-center justify-center p-6"
          >
            <motion.div
              layout={false}
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-surface border border-border-white p-10 rounded-[2.5rem] max-w-md w-full text-center space-y-8 shadow-[0_0_80px_rgba(0,0,0,0.5)]"
            >
              <div className="w-20 h-20 bg-amber-500/10 text-amber-400 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle size={32} />
              </div>
              <div className="space-y-4">
                <h3 className="text-2xl font-semibold tracking-tight text-text-primary">Encerrar com segurança?</h3>
                <p className="text-text-secondary font-light">
                  Deseja encerrar o foco agora? Isso registrará uma sessão incompleta de <strong className="text-amber-400 font-bold">{Math.max(1, Math.round(((timer.totalDurationMs || 0) - timer.getRemainingMs()) / 60000))} minutos</strong>.
                </p>
              </div>
              
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleEarlyComplete}
                  className="w-full py-4 bg-amber-400 text-background rounded-2xl font-bold uppercase tracking-widest text-xs hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  Sim, encerrar foco
                </button>
                <button
                  onClick={() => setShowEarlyCompleteConfirm(false)}
                  className="w-full py-4 bg-white/5 border border-white/10 text-text-secondary rounded-2xl font-bold uppercase tracking-widest text-xs transition-all hover:bg-white/10"
                >
                  Continuar Focado
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cancellation Confirmation Modal */}
      <AnimatePresence>
        {showCancelConfirm && (
          <motion.div
            layout={false}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1100] bg-background/90 backdrop-blur-xl flex items-center justify-center p-6"
          >
            <motion.div
              layout={false}
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-surface border border-border-white p-10 rounded-[2.5rem] max-w-md w-full text-center space-y-8 shadow-[0_0_80px_rgba(0,0,0,0.5)]"
            >
              <div className="w-20 h-20 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto">
                <AlertTriangle size={32} />
              </div>
              <div className="space-y-4">
                <h3 className="text-2xl font-semibold tracking-tight text-text-primary">Tem certeza?</h3>
                <p className="text-text-secondary font-light">Este tempo focado será perdido e não contabilizado no seu histórico.</p>
              </div>
              
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => setShowCancelConfirm(false)}
                  className="w-full py-4 bg-primary-green text-background rounded-2xl font-bold uppercase tracking-widest text-xs hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  Continuar Sessão
                </button>
                <button
                  onClick={handleCancel}
                  className="w-full py-4 bg-transparent text-red-500/50 hover:text-red-500 rounded-2xl font-bold uppercase tracking-widest text-[10px] transition-all"
                >
                  Sim, cancelar sessão
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Task Checklist Overlay during session */}
      <AnimatePresence>
        {showTasksOverlay && (
          <SessionTasksModal
            isOpen={showTasksOverlay}
            onClose={() => setShowTasksOverlay(false)}
            tasks={sessionTasksLocal}
            completedTasks={completedTasksLocal}
            onChangeTasks={setSessionTasksLocal}
            onChangeCompleted={setCompletedTasksLocal}
          />
        )}
      </AnimatePresence>

      {/* All Tasks Done Popup */}
      <AnimatePresence>
        {showAllTasksDonePopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1150] bg-background/90 backdrop-blur-xl flex items-center justify-center p-6"
          >
            <div className="w-full max-w-sm bg-surface border border-border-white p-8 rounded-[2rem] text-center space-y-6 shadow-[0_0_80px_rgba(110,231,168,0.2)]">
              <div className="w-16 h-16 bg-primary-green/10 text-primary-green rounded-full flex items-center justify-center mx-auto">
                <CheckCircle size={32} />
              </div>
              <div className="space-y-2">
                <h4 className="text-xl font-semibold tracking-tight text-text-primary">Meta Cumprida!</h4>
                <p className="text-text-secondary font-light text-sm">
                  Parabéns, todas as tarefas foram marcadas como concluídas! Deseja finalizar a sessão agora?
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    setShowAllTasksDonePopup(false);
                    handleEarlyComplete();
                  }}
                  className="w-full py-4 bg-primary-green text-background rounded-2xl font-bold uppercase tracking-widest text-xs hover:bg-glow-green transition-all"
                >
                  Ir para Conclusão
                </button>
                <button
                  onClick={() => setShowAllTasksDonePopup(false)}
                  className="w-full py-4 bg-white/5 border border-white/10 text-text-secondary rounded-2xl font-bold uppercase tracking-widest text-xs hover:bg-white/10 transition-all"
                >
                  Continuar Sessão
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

