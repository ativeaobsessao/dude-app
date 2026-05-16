import { useEffect, useState, useRef } from 'react';
import { useTimerStore } from '../../store/useTimerStore';
import { useDataStore } from '../../store/useDataStore';
import { useAuthStore } from '../../store/useAuthStore';
import { sendToServiceWorker, listenToServiceWorker } from '../../hooks/useServiceWorker';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Pause, X, AlertTriangle, CheckCircle, StickyNote, Target } from 'lucide-react';

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
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showLateConfig, setShowLateConfig] = useState(false);
  
  // Late session config state
  const [lateProjectId, setLateProjectId] = useState(timer.projectId || '');
  const [lateActivityName, setLateActivityName] = useState(timer.activityName || '');

  // Note Creation State
  const [noteContent, setNoteContent] = useState('');
  const [noteProjectId, setNoteProjectId] = useState(timer.projectId || '');
  const [noteActivityId, setNoteActivityId] = useState('');

  const hasObservedFinish = useRef(false);
  const wakeLockRef = useRef<any>(null);

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
    if (timer.isActive && timer.startTime) {
      sendToServiceWorker('START_TIMER', {
        totalMs: timer.getRemainingMs(),
        activity: timer.activityName,
        project: currentProjectName || 'Geral'
      });
    }
  }, [timer.isActive, timer.startTime]); // Only on session start

  useEffect(() => {
    const unsubscribe = listenToServiceWorker((data) => {
      if (data.type === 'TIMER_COMPLETE') {
        setShowCompleteModal(true);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!timer.isActive) {
      hasObservedFinish.current = false;
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

      if (ms <= 0 && timer.isActive && !hasObservedFinish.current) {
        hasObservedFinish.current = true;
        
        // Vibrate
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([200, 100, 200]);
        }
        
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

  const handleSave = async () => {
    if (!user || !timer.totalDurationMs) return;

    // Synchronous state update for instant UI feedback (Form 10)
    const sessionToSave = {
      user_id: user.id,
      project_id: timer.projectId,
      habit_id: timer.habitId,
      activity_name: timer.activityName,
      description: timer.description,
      duration_minutes: Math.round(timer.totalDurationMs / 60000),
      started_at: new Date(timer.startTime!).toISOString(),
      completed_at: new Date().toISOString(),
      completed: true
    };
    const noteDescription = timer.description.trim();
    const noteProjectIdFix = timer.projectId || undefined;
    const noteTargetDate = timer.targetDate;

    // Reset UI state immediately
    timer.reset();
    setShowCompleteModal(false);

    try {
      // Save focus session
      await dataStore.addSession(sessionToSave);

      // Save auto-note if present
      if (noteDescription) {
        await dataStore.addNote(
          user.id,
          null, // Title is null now
          noteDescription,
          noteProjectIdFix,
          undefined,
          noteTargetDate
        );
      }
      
      if (!dataStore.hasCompletedFirstSession) {
        dataStore.completeFirstSession();
      }
    } catch (err) {
      console.error("Erro ao salvar sessão:", err);
    }
  };

  const handleCancel = () => {
    sendToServiceWorker('CANCEL_TIMER');
    timer.reset();
    setShowCancelConfirm(false);
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
      null, 
      content, 
      pId,
      aId,
      new Date().toISOString().split('T')[0]
    );
  };

  const handleUpdateLateConfig = () => {
    timer.updateConfig(lateProjectId, undefined, lateActivityName);
    setShowLateConfig(false);
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
            <div className="text-center space-y-2">
              <h2 className="text-3xl md:text-5xl font-semibold tracking-tight text-text-primary">{timer.activityName}</h2>
              <div className="flex items-center justify-center gap-3">
                <span className="text-primary-green text-sm md:text-lg font-medium tracking-wide uppercase opacity-80">
                  {currentProjectName}
                </span>
                {currentHabitName && (
                  <>
                    <span className="w-1 h-1 rounded-full bg-border-white" />
                    <span className="text-text-secondary text-xs uppercase tracking-widest">{currentHabitName}</span>
                  </>
                )}
              </div>
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
            <div className="grid grid-cols-2 md:flex items-center gap-4 md:gap-8 w-full max-w-lg">
              <button 
                onClick={() => setShowNoteModal(true)}
                className="flex items-center justify-center gap-2 px-8 py-5 bg-surface/40 border border-border-white rounded-2xl text-text-primary text-[10px] font-bold uppercase tracking-widest hover:bg-surface/60 transition-all min-h-[44px] touch-manipulation"
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
                className={`flex items-center justify-center gap-2 px-8 py-5 border rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all min-h-[44px] touch-manipulation ${
                  timer.isPaused 
                    ? "bg-primary-green text-background border-primary-green hover:bg-glow-green" 
                    : "bg-surface/40 border-border-white text-text-primary hover:bg-surface/60"
                }`}
              >
                {timer.isPaused ? <Play size={14} fill="currentColor" /> : <Pause size={14} fill="currentColor" />}
                {timer.isPaused ? "Retomar" : "Pausar"}
              </button>

              <button 
                onClick={() => setShowCancelConfirm(true)}
                className="col-span-2 md:flex-none flex items-center justify-center gap-2 px-8 py-5 border border-red-500/20 text-red-400 text-[10px] font-bold uppercase tracking-widest hover:bg-red-500/10 transition-all min-h-[44px] touch-manipulation"
              >
                <X size={14} />
                Cancelar Sessão
              </button>

              <button
                onClick={() => setShowLateConfig(true)}
                className="col-span-2 text-[9px] text-text-secondary/30 hover:text-text-secondary/60 transition-colors underline underline-offset-2 mt-2 touch-manipulation pb-4"
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
                  <select 
                    value={lateProjectId} 
                    onChange={e => setLateProjectId(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-text-primary outline-none focus:border-primary-green min-h-[44px] appearance-none"
                  >
                    <option value="">Sem Projeto</option>
                    {dataStore.projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
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

      {/* Note Modal (Form 3 - Quick Record) */}
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
              <div className="flex justify-between items-center border-b border-white/5 pb-6">
                <h3 className="text-2xl font-semibold tracking-tight text-text-primary flex items-center gap-3">
                  <StickyNote className="text-primary-green" /> Registro Rápido
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary/40">Projeto (opcional)</label>
                  <select 
                    value={noteProjectId} 
                    onChange={e => setNoteProjectId(e.target.value)}
                    className="w-full bg-transparent border-b border-border-white py-2 text-sm focus:border-primary-green outline-none min-h-[44px] appearance-none"
                  >
                    <option value="">Sem Projeto</option>
                    {dataStore.projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary/40">Atividade (opcional)</label>
                  <select 
                    value={noteActivityId} 
                    onChange={e => setNoteActivityId(e.target.value)}
                    className="w-full bg-transparent border-b border-border-white py-2 text-sm focus:border-primary-green outline-none min-h-[44px] appearance-none"
                  >
                    <option value="">Sem Atividade</option>
                    {dataStore.activities
                      .filter(a => !noteProjectId || a.project_id === noteProjectId)
                      .map(a => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary/40">Anotação</label>
                <textarea
                  placeholder="Algo importante que não pode esquecer?"
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

              <div className="p-4 md:p-6 bg-white/5 rounded-3xl space-y-2 text-center">
                <p className="text-xl md:text-2xl font-light text-text-primary tracking-tight">{timer.activityName}</p>
                <p className="text-[9px] md:text-[10px] font-bold text-primary-green uppercase tracking-[0.3em]">
                   {currentProjectName}
                </p>
              </div>
              
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
    </div>
  );
};

