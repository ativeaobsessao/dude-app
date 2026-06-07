import { useState, type FormEvent, useMemo, useEffect } from 'react';
import { useTimerStore } from '../../store/useTimerStore';
import { useDataStore } from '../../store/useDataStore';
import { useAuthStore } from '../../store/useAuthStore';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Trash2, Play, Info, Sparkles, Clock } from 'lucide-react';
import { CustomSelect } from '../ui/CustomSelect';
import { unlockAudio } from '../../hooks/useSessionNotifications';

export const SessaoProfundaTab = () => {
  const timer = useTimerStore();
  const dataStore = useDataStore();
  const user = useAuthStore(state => state.user);

  // States mirroring configuration fields
  const [projectId, setProjectId] = useState('');
  const [activityId, setActivityId] = useState('');
  const [activityManual, setActivityManual] = useState('');
  const [habitId, setHabitId] = useState('');
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(45); // default 45 mins
  const [newTaskInput, setNewTaskInput] = useState('');
  const [pendingTasks, setPendingTasks] = useState<string[]>([]);

  // Filter activities by project
  const filteredActivities = useMemo(() => {
    if (!projectId) return dataStore.activities;
    return dataStore.activities.filter(a => a.project_id === projectId);
  }, [dataStore.activities, projectId]);

  // Handle setting/resetting when starting
  const handleStartSession = (e: FormEvent) => {
    e.preventDefault();

    let finalActivityName = '';
    if (activityId) {
      finalActivityName = dataStore.activities.find(a => a.id === activityId)?.name || '';
    } else {
      finalActivityName = activityManual;
    }

    const activityName = finalActivityName.trim() || 'Sessão Sem Título';
    const totalMinutes = hours * 60 + minutes;
    if (totalMinutes < 1) {
      dataStore.showNotification('Por favor, defina um tempo válido de foco!', 'error');
      return;
    }

    // Unlock audio context
    unlockAudio();

    // Start timer with configured fields
    timer.start(
      totalMinutes,
      activityName,
      projectId || undefined,
      habitId || undefined,
      '', // description
      String(new Date().toISOString().split('T')[0]), // today date
      activityId || undefined,
      undefined // scheduledActivityId
    );

    // Save subtasks to the timer
    timer.setPendingTasks(pendingTasks);

    // Reset setup form
    setProjectId('');
    setActivityId('');
    setActivityManual('');
    setHabitId('');
    setHours(0);
    setMinutes(45);
    setPendingTasks([]);
    setNewTaskInput('');

    dataStore.showNotification('🚀 Sessão Profunda iniciada! Foco total ativado.', 'success');
  };

  // Add a task to the checklist in the preparation step
  const handleAddPendingTask = () => {
    if (newTaskInput.trim()) {
      setPendingTasks([...pendingTasks, newTaskInput.trim()]);
      setNewTaskInput('');
    }
  };

  // Remove a task from the checklist in the preparation step
  const handleRemovePendingTask = (index: number) => {
    setPendingTasks(pendingTasks.filter((_, idx) => idx !== index));
  };

  if (timer.isActive) {
    return (
      <div className="w-full max-w-2xl mx-auto p-8 rounded-3xl bg-surface/5 border border-primary-green/10 flex flex-col items-center justify-center text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-primary-green/5 border border-primary-green/20 flex items-center justify-center text-primary-green animate-pulse">
          <Clock size={28} />
        </div>
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.34em] font-black text-primary-green">Sessão Ativa Detectada</p>
          <h3 className="text-2xl font-black text-text-primary tracking-tight font-sans uppercase">
            {timer.activityName}
          </h3>
          <p className="text-xs text-text-secondary/70 leading-normal max-w-sm mx-auto">
            Uma sessão profissional de foco absoluto está rodando em segundo plano. Use o painel centralizado para gerenciar.
          </p>
        </div>
        
        <div className="pt-2 flex flex-col gap-3 w-full max-w-xs">
          <button 
            type="button" 
            onClick={() => {
              window.dispatchEvent(new CustomEvent('open-action-center', { detail: { screen: 'session' } }));
            }} 
            className="w-full py-3.5 bg-green hover:brightness-110 active:scale-95 text-background rounded-2xl text-xs font-bold uppercase tracking-widest transition-all cursor-pointer shadow-[0_4px_2px_rgba(110,231,168,0.15)] font-sans"
          >
            Abrir Controles de Foco
          </button>
          <button 
            type="button" 
            onClick={() => {
              if (confirm('Tem certeza de que deseja encerrar e cancelar esta sessão de foco?')) {
                timer.reset();
                dataStore.showNotification('Sessão cancelada.', 'success');
              }
            }} 
            className="w-full py-3 hover:bg-white/[0.04] text-coral hover:text-red-500 rounded-2xl text-xs font-semibold uppercase tracking-widest transition-all cursor-pointer border border-white/5"
          >
            Cancelar Sessão Ativa
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full bg-surface/5 border border-white/5 rounded-3xl p-6 md:p-8 space-y-8"
      >
        {/* HEADER */}
        <header className="space-y-2.5 text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary-green/5 border border-primary-green/15 rounded-full text-primary-green">
            <Sparkles size={11} className="animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-wider font-sans">Modo Operação</span>
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-black tracking-tight text-text-primary uppercase font-sans">
              Nova Sessão Profunda
            </h2>
            <p className="text-xs text-text-secondary/70 font-medium">
              Programe o cronograma, defina subtarefas e bloqueie as distrações.
            </p>
          </div>
        </header>

        {/* SETUP FORM */}
        <form onSubmit={handleStartSession} className="space-y-6">
          {/* SELECT PROJECT & ACTIVITY */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1 text-left">
              <label className="text-[10px] font-extrabold uppercase tracking-widest text-text-secondary/60">
                PROJETO (opcional)
              </label>
              <CustomSelect
                value={projectId}
                onChange={val => {
                  setProjectId(val);
                  setActivityId('');
                }}
                placeholder="Geral (Sem Projeto)"
                options={[
                  { value: '', label: 'Geral (Sem Projeto)' },
                  ...dataStore.projects.map(p => ({ value: p.id, label: p.name }))
                ]}
              />
            </div>
            
            <div className="space-y-1 text-left">
              <label className="text-[10px] font-extrabold uppercase tracking-widest text-text-secondary/60">
                ATIVIDADE (opcional)
              </label>
              <CustomSelect
                className={!!activityManual ? 'opacity-50 pointer-events-none' : ''}
                value={activityId}
                onChange={val => setActivityId(val)}
                placeholder="Selecionar Atividade"
                options={[
                  { value: '', label: 'Selecionar Atividade' },
                  ...filteredActivities.map(a => ({ value: a.id, label: a.name }))
                ]}
              />
            </div>
          </div>

          {/* MANUAL ACTIVITY NAME */}
          <div className="space-y-1 text-left">
            <label className="text-[10px] font-extrabold uppercase tracking-widest text-text-secondary/60">
              ATIVIDADE AVULSA (opcional)
            </label>
            <input
              type="text"
              disabled={!!activityId}
              placeholder={activityId ? "Inibido por Atividade selecionada" : "O que você está prestes a fazer?"}
              className={`w-full h-12 bg-surface/30 px-4 rounded-xl border border-white/5 text-sm font-medium tracking-tight text-text-primary placeholder:text-text-secondary/40 focus:outline-none focus:border-green/30 focus:bg-surface/50 transition-all ${
                activityId ? 'opacity-40 select-none pointer-events-none' : ''
              }`}
              value={activityManual}
              onChange={e => setActivityManual(e.target.value)}
            />
          </div>

          {/* ATOMIC HABITS LINK */}
          <div className="space-y-1 text-left">
            <label className="text-[10px] font-extrabold uppercase tracking-widest text-text-secondary/60">
              VINCULAR HÁBITO ATÔMICO (opcional)
            </label>
            <CustomSelect
              value={habitId}
              onChange={val => setHabitId(val)}
              placeholder="Nenhum"
              options={[
                { value: '', label: 'Nenhum' },
                ...dataStore.habits.filter(h => h.habit_mode !== 'avoid').map(h => ({ 
                  value: h.id, 
                  label: `${h.name} (${h.sessions_this_week || 0}/${h.sessions_per_week || 3} esta semana)`
                }))
              ]}
            />
          </div>

          {/* DURATION INPUT */}
          <div className="space-y-2 text-left p-4 rounded-2xl bg-surface/5 border border-white/5">
            <label className="text-[10px] font-extrabold uppercase tracking-widest text-text-secondary/60 flex items-center gap-1.5">
              <Clock size={12} className="text-green" /> Duração Estimada de Foco
            </label>
            
            <div className="flex items-center gap-4 py-2">
              <div className="flex-1 space-y-1">
                <span className="text-[9px] font-bold text-text-secondary/40 uppercase block">Horas</span>
                <input 
                  type="number"
                  min="0"
                  max="12"
                  value={hours || ''}
                  onChange={e => {
                    const hVal = Math.min(12, Math.max(0, parseInt(e.target.value) || 0));
                    setHours(hVal);
                  }}
                  className="w-full h-11 bg-surface/20 border border-white/5 rounded-xl text-center text-sm font-semibold text-text-primary focus:outline-none focus:border-green/30"
                  placeholder="0"
                />
              </div>

              <div className="flex-1 space-y-1">
                <span className="text-[9px] font-bold text-text-secondary/40 uppercase block">Minutos</span>
                <input 
                  type="number"
                  min="0"
                  max="59"
                  value={minutes || ''}
                  onChange={e => {
                    const mVal = Math.min(59, Math.max(0, parseInt(e.target.value) || 0));
                    setMinutes(mVal);
                  }}
                  className="w-full h-11 bg-surface/20 border border-white/5 rounded-xl text-center text-sm font-semibold text-text-primary focus:outline-none focus:border-green/30"
                  placeholder="45"
                />
              </div>
            </div>
          </div>

          {/* SESSION SUBTASKS */}
          <div className="space-y-2 text-left">
            <label className="text-[10px] font-extrabold uppercase tracking-widest text-text-secondary/60">
              Subtarefas / Checklist de Foco (opcional)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Insira um sub-objetivo para executar..."
                className="flex-1 h-12 bg-surface/30 px-4 rounded-xl border border-white/5 text-sm tracking-tight text-text-primary placeholder:text-text-secondary/40 focus:outline-none"
                value={newTaskInput}
                onChange={e => setNewTaskInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddPendingTask();
                  }
                }}
              />
              <button
                type="button"
                onClick={handleAddPendingTask}
                className="h-12 w-12 bg-green/10 hover:bg-green/20 border border-green/20 rounded-xl flex items-center justify-center text-green transition-all"
              >
                <Plus size={18} />
              </button>
            </div>

            {/* PENDING SUBTASKS LIST */}
            <AnimatePresence mode="popLayout">
              {pendingTasks.length > 0 && (
                <div className="space-y-2 pt-1">
                  {pendingTasks.map((task, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -5 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 5 }}
                      className="flex items-center gap-3 p-3 bg-surface/10 rounded-xl border border-white/5"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-green shrink-0 animate-pulse" />
                      <span className="text-xs text-text-primary flex-1 font-medium">{task}</span>
                      <button
                        type="button"
                        onClick={() => handleRemovePendingTask(i)}
                        className="text-text-secondary/40 hover:text-coral transition-colors p-1"
                      >
                        <Trash2 size={13} />
                      </button>
                    </motion.div>
                  ))}
                </div>
              )}
            </AnimatePresence>
          </div>

          {/* SUBMIT BUTTON */}
          <div className="pt-4">
            <button
              type="submit"
              className="w-full h-13 bg-green hover:brightness-110 active:scale-95 text-background rounded-2xl flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest transition-all cursor-pointer shadow-[0_4px_25px_rgba(110,231,168,0.25)] font-sans"
            >
              <Play size={13} fill="currentColor" /> INICIAR SESSÃO PROFUNDA
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
